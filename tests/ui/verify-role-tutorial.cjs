const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.argv[2] || 'playwright');
const output = path.join(__dirname, 'artifacts');
fs.mkdirSync(output, { recursive: true });
const base = 'http://127.0.0.1:5174/tests/ui/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const open = async scenario => {
    await page.goto(`${base}?scenario=${scenario}`);
    await page.locator(scenario === 'login' ? '.login-card' : '.lobby-card').waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  const fits = async () => {
    const overflow = await page.locator('.login-card, .lobby-card, .dialog-surface, .role-practice, .simulation-player, .simulation-card, .simulation-choices button').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => el.className));
    assert.deepEqual(overflow, []);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  };
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [320, 568], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    for (const scenario of ['login', 'lobby', 'room']) {
      await open(scenario);
      const card = page.locator(scenario === 'login' ? '.login-card' : '.lobby-card');
      const bounds = await card.boundingBox();
      assert(bounds.width <= (scenario === 'login' ? 400 : 450) + 1, `${scenario} must remain compact on ${width}`);
      assert(bounds.width <= width - (width < 1024 ? 31 : 0));
      if (width >= 1024) assert(bounds.height <= height - 30, `${scenario} should fit desktop height`);
      if (scenario === 'room') {
        assert.equal(await page.locator('.lobby-card li').count(), 6);
        assert(await page.locator('.lobby-card ul').evaluate(el => el.scrollHeight > el.clientHeight));
      }
      await fits();
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${scenario}-compact-${width}.png`) });
    }
  }
  console.log('PASS compact login/lobby and six-player room at six desktop/mobile sizes');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await open('login');
  await page.getByRole('button', { name: 'วิธีเล่นและกติกา', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial สำหรับมือใหม่', exact: true }).click();
  const tracks = page.getByRole('navigation', { name: 'เลือกบทบาทใน Tutorial' });
  const catalog = await page.evaluate(async () => {
    const { tutorialScenarios } = await import('/src/core/tutorialScenarios.ts');
    return tutorialScenarios.map(scenario => ({ id: scenario.id, role: scenario.role, choices: scenario.choices.filter(choice => !choice.disabledReason).map(choice => choice.id), players: scenario.players }));
  });
  assert.equal(catalog.length, 35);
  assert.equal(new Set(catalog.map(scenario => scenario.id)).size, 35);
  const selectScenario = async scenario => {
    await tracks.getByRole('button', { name: scenario.role, exact: true }).click();
    const inRole = catalog.filter(item => item.role === scenario.role);
    await page.getByLabel(/เลือกสถานการณ์/).selectOption(String(inRole.findIndex(item => item.id === scenario.id)));
    await page.locator(`.role-simulation[data-scenario="${scenario.id}"]`).waitFor();
  };
  async function complete(rootChoice, nestedChoice = 'accept') {
    await page.locator(`[data-choice="${rootChoice}"]`).click();
    for (let limit = 0; limit < 30; limit++) {
      if (await page.locator('.simulation-result').count()) return;
      const nested = page.locator(`[data-choice="${nestedChoice}"]`);
      if (await nested.count()) { await nested.click(); continue; }
      const discard = page.locator('[data-discard]').first();
      if (await discard.count()) { await discard.click(); continue; }
      const exchange = page.locator('[data-exchange-confirm]');
      if (await exchange.count()) {
        assert(await exchange.isDisabled(), 'must choose the exact number of cards');
        const keep = await page.locator('[data-player="0"] .simulation-card').count() - await page.locator('[data-player="0"] .simulation-card-dead').count();
        for (let index = 0; index < keep; index++) await page.locator('[data-exchange-card]').nth(index).click();
        assert(await exchange.isEnabled());
        await exchange.click(); continue;
      }
      const next = page.locator('[data-simulation-next]');
      assert(await next.isEnabled(), 'scenario must have a reachable next step');
      await next.click();
    }
    throw Error('scenario did not finish');
  }
  const outcome = async () => page.locator('.simulation-player').evaluateAll(elements => elements.map(el => ({
    coins: Number(el.querySelector('.simulation-coins').textContent),
    cards: el.querySelectorAll('.simulation-card').length,
    dead: el.querySelectorAll('.simulation-card-dead').length,
  })));
  let routes = 0;
  for (const scenario of catalog) {
    await selectScenario(scenario);
    const before = await outcome();
    assert.equal(await page.locator('[data-player="1"] .simulation-card-back').count(), scenario.players[1].cards.filter(card => !card.isDead).length, 'opponent hand starts hidden');
    for (const choice of scenario.choices) {
      await complete(choice);
      const after = await outcome();
      for (let actor = 0; actor < 2; actor++) {
        assert(after[actor].coins >= 0, `${scenario.id}/${choice} negative coins`);
        assert.equal(after[actor].cards, before[actor].cards, 'reveal/proof/exchange preserve card slots');
        assert(after[actor].dead >= before[actor].dead && after[actor].dead <= after[actor].cards);
      }
      if (choice === 'income') assert.equal(after[0].coins, before[0].coins + 1);
      if (scenario.id === 'duke-tax' && choice === 'use') assert.equal(after[0].coins, 10);
      if (scenario.id === 'captain-one-coin' && choice === 'use') { assert.equal(after[0].coins, 8); assert.equal(after[1].coins, 0); }
      if (scenario.id === 'captain-no-coins' && choice === 'use') assert.equal(after[0].coins, 7);
      if (scenario.id === 'assassin-bluff' && choice === 'use') { assert.equal(after[0].coins, 4); assert.equal(after[0].dead, 1); }
      if (scenario.id === 'assassin-one-card' && choice === 'use') { assert.equal(after[1].dead, 1); assert.match(await page.locator('.simulation-history').innerText(), /ไม่ต้องเสียไพ่ซ้ำ/); }
      if (scenario.id === 'contessa-proof' && choice === 'block-Contessa') { assert.equal(after[0].dead, 0); assert.equal(after[1].dead, 1); }
      if (scenario.id === 'contessa-bluff' && choice === 'block-Contessa') assert.equal(after[0].dead, 2);
      if (scenario.id === 'contessa-last-card' && choice === 'block-Contessa') assert.equal(after[0].dead, 2);
      if (scenario.id === 'contessa-block' && choice === 'challenge') assert.equal(after[0].dead, 2, 'wrong challenge of Assassin costs two cards');
      if (scenario.id === 'ambassador-one-card' && choice === 'use') assert.equal(after[0].dead, 1, 'exchange must preserve revealed card');
      if (scenario.id === 'contessa-coup') assert.equal(scenario.choices.length, 1, 'Coup offers no block or challenge');
      if (scenario.id === 'duke-coup') assert.equal(await page.locator('[data-replay]').count(), 1);
      routes++;
      await page.locator('[data-replay]').click();
      assert.deepEqual(await outcome(), before, 'replay resets both hands and money');
    }
    if (scenario.id.includes('block-true') || scenario.id.includes('block-false') || ['captain-block-captain', 'captain-block-ambassador'].includes(scenario.id)) {
      await complete('use', 'challenge-block');
      const after = await outcome();
      if (scenario.id === 'assassin-block-true') { assert.equal(after[0].coins, 4); assert.equal(after[0].dead, 1); assert.equal(after[1].dead, 0); }
      if (scenario.id === 'assassin-block-false') { assert.equal(after[0].coins, 4); assert.equal(after[1].dead, 2); }
      if (scenario.id === 'captain-block-ambassador') { assert.equal(after[0].coins, 9); assert.equal(after[1].coins, 2); assert.equal(after[1].dead, 1); }
      routes++;
    }
    console.log(`PASS ${scenario.role}: ${scenario.id}`);
  }
  console.log(`PASS ${catalog.length} scenarios and ${routes} decision routes, including nested block challenges`);

  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    for (const role of ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa']) {
      const scenario = catalog.find(item => item.role === role);
      await selectScenario(scenario);
      await fits();
      if ([390, 768].includes(width) && role === 'Assassin') {
        await page.screenshot({ path: path.join(output, `role-tutorial-${width}.png`) });
        await page.locator('[data-choice="use"]').click();
        await page.locator('[data-simulation-next]').click();
        assert.equal((await outcome())[0].coins, 4);
        await page.locator('.simulation-board').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: path.join(output, `role-tutorial-play-${width}.png`) });
      }
    }
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('All role tutorial and compact layout checks passed. No production writes.');
})().catch(error => { console.error(error); process.exit(1); });
