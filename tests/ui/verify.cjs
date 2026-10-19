const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');

const output = path.join(__dirname, 'artifacts');
fs.mkdirSync(output, { recursive: true });
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5197/tests/ui/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const open = async (scenario = 'turn') => {
    await page.goto(`${base}?scenario=${scenario}`);
    await page.locator(scenario === 'login' ? '.login-bg' : scenario === 'lobby' ? '#room-code' : scenario.startsWith('room') ? '.council-lobby' : '.game-workspace').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const expand = page.getByRole('button', { name: 'ดูแอคชั่น', exact: true });
    if (await expand.isVisible() && await page.locator('dialog[open]').count() === 0) await expand.click();
  };
  const closeDialog = async () => { await page.locator('dialog[open]').getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click(); };
  const fits = async () => {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page overflows horizontally');
    const overflowing = await page.locator('.game-panel, .dialog-surface, .action-choice, .opponent-card, .mobile-tabs, .rules-content, .rules-role, .rules-action, .tutorial, .response-guide, .council-roster-mobile, .council-roster-mobile li, .seat-details').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => el.className));
    assert.deepEqual(overflowing, [], `overflow: ${overflowing.join(', ')}`);
  };

  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await open();
    await fits();
    const mobile = width < 1200;
    if (mobile) await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
    await page.getByRole('button', { name: 'ตามบทบาท' }).click();
    const exchange = page.getByRole('button', { name: /Ambassador.*Exchange/ });
    await exchange.scrollIntoViewIfNeeded();
    assert(await exchange.isEnabled(), 'role action should allow bluffing');
    assert(await exchange.locator('.role-star').count(), 'held Ambassador has star');
    await fits();
    if ([390, 768, 1440].includes(width)) await page.screenshot({ path: path.join(output, `actions-${width}.png`) });
    await exchange.click();
    await page.getByRole('dialog').waitFor();
    await fits();
    await closeDialog();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.getByRole('button', { name: 'เปิดเหตุการณ์', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    if (mobile) await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'ผู้เล่น' }).click();
    await fits();
    assert.equal(await page.locator('.revealed-card').count(), 3);
    if (width === 390) await page.screenshot({ path: path.join(output, 'players-390.png') });
    console.log(`PASS responsive ${width}x${height}: actions, scroll, reveal, close/reopen`);
  }

  await page.setViewportSize({ width: 390, height: 650 });
  for (const scenario of ['waiting', 'dead', 'coins10']) {
    await open(scenario);
    await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
    assert.equal(await page.locator('.action-tile:enabled').count(), scenario === 'coins10' ? 1 : 0);
    if (scenario === 'coins10') assert.match(await page.locator('.action-tile:enabled').innerText(), /Coup/);
    await page.getByRole('button', { name: 'ตามบทบาท' }).click();
    assert.equal(await page.locator('.action-tile:enabled').count(), 0);
  }
  console.log('PASS availability: waiting, eliminated, forced Coup');

  for (const scenario of ['turn', 'waiting', 'role-revealed']) {
    await open(scenario);
    await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
    assert.equal(await page.locator('.action-tile .role-badge').count(), 0, 'general actions do not claim a role');
    await page.getByRole('button', { name: 'ตามบทบาท' }).click();
    const tax = page.getByRole('button', { name: /Duke.*Tax/ });
    const steal = page.getByRole('button', { name: /Captain.*Steal/ });
    const exchange = page.getByRole('button', { name: /Ambassador.*Exchange/ });
    assert.equal(await tax.locator('.role-star').count(), 1, 'living Duke grants a star even while waiting');
    assert.equal(await steal.locator('.role-mask').count(), 1, 'missing Captain shows smiling mask');
    assert.equal(await exchange.locator(scenario === 'role-revealed' ? '.role-mask' : '.role-star').count(), 1, 'revealed Ambassador cannot grant a star');
    if (scenario !== 'waiting') {
      assert(await steal.isEnabled(), 'bluffing stays available without Captain');
      if (scenario === 'role-revealed') {
        assert(await exchange.isEnabled(), 'can still bluff with a revealed Ambassador');
        await steal.click();
        await page.getByRole('heading', { name: 'เลือกเป้าหมาย · Steal' }).waitFor();
      }
    }
    await fits();
  }
  console.log('PASS role badges: owned, missing, revealed, waiting and bluff selection');

  await open();
  const rulesTrigger = page.getByRole('button', { name: 'เปิดกติกา', exact: true });
  await rulesTrigger.click();
  const rules = page.getByRole('dialog', { name: 'กติกาสภาลับ' });
  await rules.waitFor();
  await fits();
  await page.keyboard.press('Tab');
  assert(await rules.evaluate(el => el.contains(document.activeElement)), 'dialog traps focus');
  await page.keyboard.press('Escape');
  assert(await rulesTrigger.evaluate(el => el === document.activeElement), 'dialog restores focus');
  await rulesTrigger.click();
  await rules.click({ position: { x: 2, y: 2 } });
  assert.equal(await page.locator('dialog[open]').count(), 0, 'outside click closes modal');
  console.log('PASS rules: focus trap, focus restoration, Escape and outside close');

  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await open();
    const historyBefore = await page.locator('.history-log-box').innerText();
    await page.getByRole('button', { name: 'เปิดกติกา', exact: true }).click();
    const rules = page.getByRole('dialog', { name: 'กติกาสภาลับ' });
    await rules.waitFor();
    assert.equal(await rules.locator('.rules-action').count(), 7);
    assert.equal(await rules.locator('.rules-role').count(), 5);
    await fits();
    if ([390, 768].includes(width)) await page.screenshot({ path: path.join(output, `rules-${width}.png`) });
    await rules.locator('.rules-section').last().scrollIntoViewIfNeeded();
    assert(await rules.locator('.dialog-body').evaluate(el => el.scrollTop > 0), 'rules scroll to final section');
    await rules.getByRole('button', { name: 'Tutorial สำหรับมือใหม่', exact: true }).click();
    assert(await rules.getByRole('heading', { name: 'เริ่มจากไพ่ในมือ' }).isVisible());
    assert(await rules.getByRole('button', { name: 'ย้อนกลับ', exact: true }).isDisabled());
    for (let step = 0; step < 6; step++) {
      await fits();
      if (step === 1) {
        await rules.getByRole('button', { name: 'Steal ด้วย Captain', exact: true }).click();
        assert.match(await rules.locator('.tutorial-feedback').innerText(), /คุณไม่มี/);
        await rules.getByRole('button', { name: 'Tax ด้วย Duke', exact: true }).click();
        assert.match(await rules.locator('.tutorial-feedback').innerText(), /ถูกต้อง/);
      }
      if (step === 2) {
        await rules.getByRole('button', { name: 'จับโกหก Foreign Aid', exact: true }).click();
        assert.match(await rules.locator('.tutorial-feedback').innerText(), /จับโกหกแอคชั่นนี้ไม่ได้/);
        await rules.getByRole('button', { name: 'บล็อกด้วย Duke', exact: true }).click();
        assert.match(await rules.locator('.tutorial-feedback').innerText(), /ถูกต้อง/);
        if ([390, 768].includes(width)) await page.screenshot({ path: path.join(output, `tutorial-${width}.png`) });
      }
      if (step === 3) {
        await rules.getByRole('button', { name: 'เพื่อนไม่มี Duke แน่นอน', exact: true }).click();
        assert.match(await rules.locator('.tutorial-feedback').innerText(), /หลายใบ/);
        await rules.getByRole('button', { name: 'ยังยืนยันไม่ได้', exact: true }).click();
        assert.match(await rules.locator('.tutorial-feedback').innerText(), /ถูกต้อง/);
      }
      if (step < 5) await rules.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    }
    await rules.getByRole('button', { name: 'กลับไปดูกติกา', exact: true }).click();
    assert.equal(await rules.locator('.tutorial').count(), 0);
    await closeDialog();
    assert.equal(await page.locator('.history-log-box').innerText(), historyBefore, 'tutorial must not change gameplay');
  }
  console.log('PASS responsive rules and all six tutorial lessons, feedback and no game actions');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const scenario of ['login', 'lobby']) {
    await open(scenario);
    await page.getByRole('button', { name: 'วิธีเล่นและกติกา', exact: true }).click();
    await page.getByRole('button', { name: 'Tutorial สำหรับมือใหม่', exact: true }).click();
    assert(await page.getByRole('heading', { name: 'เริ่มจากไพ่ในมือ' }).isVisible());
    await closeDialog();
  }
  console.log('PASS tutorial access before login and from lobby');

  await open();
  await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
  assert.equal(await page.locator('.hand-guide li').count(), 2);
  await page.screenshot({ path: path.join(output, 'hand-guide-390.png') });
  await page.evaluate(() => {
    window.__coupUiFixture.setHand([{ character: 'Duke', isDead: true }, { character: 'Contessa', isDead: false }]);
  });
  await page.waitForFunction(() => document.querySelector('.hand-guide li')?.textContent.includes('Contessa'));
  assert.equal(await page.locator('.hand-guide li').count(), 1);
  assert.match(await page.locator('.hand-guide li').innerText(), /Contessa/);
  await page.locator('.hand-guide summary').click();
  assert.equal(await page.locator('.hand-guide').getAttribute('open'), null);
  console.log('PASS hand guide updates when cards change and excludes revealed cards');

  for (const scenario of ['tax', 'other-target', 'assassination', 'response-revealed']) {
    await open(scenario);
    const guide = page.getByRole('complementary', { name: 'คำแนะนำการตอบโต้' });
    await guide.waitFor();
    const text = await guide.innerText();
    if (scenario === 'tax') assert.match(text, /Tax บล็อกไม่ได้/);
    if (scenario === 'other-target') assert.match(text, /ไม่ได้เป็นเป้าหมาย/);
    if (scenario === 'assassination') { assert.match(text, /อ้าง Contessa/); assert.match(text, /รวม 2 ใบ/); }
    if (scenario === 'response-revealed') {
      assert.match(text, /ไม่มีบทบาทสำหรับบล็อกครั้งนี้/);
      assert.equal(await guide.locator('.held-role-advice').count(), 0);
    }
    await fits();
  }
  await open('response');
  await page.getByRole('complementary', { name: 'คำแนะนำการตอบโต้' }).waitFor();
  assert.match(await page.locator('.held-role-advice').innerText(), /Ambassador/);
  await page.screenshot({ path: path.join(output, 'response-advice-390.png') });
  await page.evaluate(() => {
    window.__coupUiFixture.setHand([{ character: 'Captain', isDead: false }, { character: 'Ambassador', isDead: true }]);
  });
  await page.waitForFunction(() => document.querySelector('.held-role-advice')?.textContent.includes('Captain'));
  assert.match(await page.locator('.held-role-advice').innerText(), /Captain/);
  assert.doesNotMatch(await page.locator('.held-role-advice').innerText(), /Ambassador/);
  console.log('PASS response advice: legal targets, claims, assassination risk and current hand');

  for (const scenario of ['response', 'foreignaid', 'block']) {
    await open(scenario);
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'ดูไพ่ในมือของฉัน' }).click();
    await fits();
    assert.equal(await dialog.getByRole('button', { name: /จับโกหก/ }).count(), scenario === 'foreignaid' ? 0 : 1);
    assert.equal(await dialog.getByRole('button', { name: /บล็อก ·/ }).count(), scenario === 'response' ? 2 : scenario === 'foreignaid' ? 1 : 0);
    if (scenario === 'response') {
      assert.equal(await dialog.getByRole('button', { name: /บล็อก · Ambassador/ }).locator('.role-star').count(), 1);
      assert.equal(await dialog.getByRole('button', { name: /บล็อก · Captain/ }).locator('.role-mask').count(), 1);
    }
    if (scenario === 'foreignaid') assert.equal(await dialog.getByRole('button', { name: /บล็อก · Duke/ }).locator('.role-star').count(), 1);
    await page.screenshot({ path: path.join(output, `${scenario}-390.png`) });
    await closeDialog();
    await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
    await page.getByRole('button', { name: 'ตอบสนอง', exact: false }).first().click();
    assert(await page.getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).isEnabled(), 'closing must not pass');
    await page.getByRole('button', { name: 'เปิดเหตุการณ์', exact: true }).click();
    await dialog.getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).click();
    await closeDialog();
    assert.equal(await page.getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).count(), 0);
  }
  console.log('PASS response/block popup, peek, close/reopen, allow, legal challenge options');

  await open('exchange');
  await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
  assert.equal(await page.locator('.exchange-card').count(), 4);
  const confirmExchange = page.getByRole('button', { name: 'ยืนยันการสลับไพ่', exact: true });
  assert(await confirmExchange.isDisabled());
  await page.locator('.exchange-card').nth(0).click();
  await page.locator('.exchange-card').nth(2).click();
  assert(await confirmExchange.isEnabled());
  await fits();
  await page.screenshot({ path: path.join(output, 'exchange-390.png') });
  await open('discard');
  await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
  assert.equal(await page.getByRole('button', { name: /^เลือกเปิดเผย / }).count(), 2);
  await page.getByRole('button', { name: 'เลือกเปิดเผย Duke', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__coupUiFixture.submittedCommands.length), 0, 'selection does not discard');
  assert(await page.getByRole('button', { name: 'ยืนยันเปิดเผย Duke', exact: true }).isEnabled());
  await fits();
  console.log('PASS discard and exchange selection');

  await open('gameover');
  await page.getByRole('dialog', { name: 'ผลการชิงอำนาจ' }).waitFor();
  await closeDialog();
  await page.getByRole('button', { name: 'ดูผลเกม', exact: true }).click();
  await page.getByRole('dialog', { name: 'ผลการชิงอำนาจ' }).waitFor();
  await page.getByRole('button', { name: 'กลับล็อบบี้เพื่อเริ่มเกมใหม่' }).click();
  await page.getByRole('dialog', { name: 'ยืนยันการดำเนินการ' }).waitFor();
  await closeDialog();
  await page.getByRole('button', { name: /เปิดคำยืนยัน/ }).click();
  await page.getByRole('dialog', { name: 'ยืนยันการดำเนินการ' }).getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  assert(await page.getByRole('dialog', { name: 'ผลการชิงอำนาจ' }).isVisible());
  console.log('PASS result and confirmation close/reopen/cancel');

  await open('lobby');
  const maleChoice = page.getByRole('button', { name: 'ชาย', exact: true });
  const femaleChoice = page.getByRole('button', { name: 'หญิง', exact: true });
  await femaleChoice.press('Enter');
  assert.equal(await femaleChoice.getAttribute('aria-pressed'), 'true', 'female choice is keyboard selectable');
  assert.equal(await femaleChoice.locator('.player-avatar-sprite[data-avatar="female"]').count(), 1);
  assert(await femaleChoice.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), 'female sprite loads');
  assert.doesNotMatch(await femaleChoice.innerText(), /Duke|Assassin|Captain|Ambassador|Contessa|ไพ่/);
  await maleChoice.press('Enter');
  assert.equal(await maleChoice.getAttribute('aria-pressed'), 'true', 'male choice remains keyboard selectable');
  assert.equal(await maleChoice.locator('.player-avatar-sprite[data-avatar="male"]').count(), 1);
  const code = page.getByLabel('เข้าร่วมด้วยรหัสห้อง 8 ตัวอักษร');
  await code.fill('ab c');
  assert.equal(await code.inputValue(), 'ABC');
  assert.equal(await code.evaluate(el => getComputedStyle(el, '::placeholder').letterSpacing), 'normal');
  await code.fill('abcdefgh');
  assert.equal(await code.inputValue(), 'ABCDEFGH');
  await fits();
  await page.screenshot({ path: path.join(output, 'lobby-390.png') });
  await code.fill('AB');
  await code.press('Enter');
  await page.getByRole('dialog', { name: 'แจ้งเตือน' }).waitFor();
  await closeDialog();
  await page.getByRole('button', { name: /เปิดแจ้งเตือน/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'รับทราบ', exact: true }).click();
  await code.fill('ABCDEFGH');
  await page.getByRole('button', { name: 'เข้าห้อง', exact: true }).click();
  await page.locator('.room-code-value').waitFor();
  assert.equal(await page.locator('.room-code-value').innerText(), 'ABCDEFGH');
  await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  await page.getByRole('button', { name: 'สร้างห้องใหม่', exact: true }).waitFor();
  await page.getByRole('button', { name: 'สร้างห้องใหม่' }).click();
  await page.locator('.room-code-value').waitFor();
  assert.equal(await page.locator('.player-avatar').getAttribute('data-avatar'), 'male');
  assert.equal(await page.locator('.council-seat-empty').count(), 5);
  assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0);
  assert.match(await page.locator('.start-disabled-reason').innerText(), /อย่างน้อย 2 คน/);
  await page.locator('.player-avatar-sprite').evaluate(el => {
    window.__avatarFrames = [];
    window.__avatarObserver = new MutationObserver(() => window.__avatarFrames.push(Number(el.dataset.frame)));
    window.__avatarObserver.observe(el, { attributes: true, attributeFilter: ['data-frame'] });
  });
  await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
  await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).waitFor();
  assert.equal(await page.locator('.council-seat:not(.council-seat-empty) .player-avatar').getAttribute('data-ready'), 'true');
  assert.equal(await page.locator('.player-avatar.is-ready').count(), 1, 'avatar pose follows public readiness');
  await page.locator('.player-avatar[data-frame="11"]').waitFor();
  assert(await page.evaluate(() => window.__avatarFrames.some(frame => frame > 0 && frame < 11)), 'readiness uses intermediate sprite frames');
  await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).click();
  await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).waitFor();
  assert.equal(await page.locator('.council-seat:not(.council-seat-empty) .player-avatar').getAttribute('data-ready'), 'false');
  await page.locator('.player-avatar[data-frame="0"]').waitFor();
  await page.evaluate(() => window.__avatarObserver.disconnect());
  await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
  await page.waitForFunction(() => {
    const frame = Number(document.querySelector('.player-avatar-sprite')?.dataset.frame);
    return frame > 0 && frame < 11;
  });
  await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).click();
  await page.locator('.player-avatar[data-frame="0"]').waitFor();
  console.log('PASS room-code normalization, avatar selection, create-room, six seats and own readiness');

  for (const [scenario, count] of [['room-1', 1], ['room-2', 2], ['room-6', 6]]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(scenario);
    assert.equal(await page.locator('.council-seat').count(), 6, 'lobby always has six fixed seat positions');
    assert.equal(await page.locator('.council-roster-mobile li').count(), 6, 'mobile roster lists all six seats');
    assert.equal(await page.locator('.council-seat:not(.council-seat-empty)').count(), count);
    assert.equal(await page.locator('.council-seat-empty').count(), 6 - count);
    assert.equal(await page.locator('.council-stage-long').count(), 1, 'front-facing long-table layout');
    assert.equal(await page.locator('.council-seat-row').count(), 2, 'two rows of three on compact screens');
    if (count > 1) assert.equal(await page.locator('.seat-entering').count(), 0, 'existing members do not replay join motion on room load');
    assert.equal(await page.locator('.all-ready-flash').count(), 0, 'initial roster does not replay all-ready motion');
    assert.equal(await page.locator('.council-lobby .playing-card').count(), 0, 'lobby never shows game cards');
    assert.doesNotMatch(await page.locator('.council-lobby').innerText(), /เหรียญ|Duke|Assassin|Captain|Ambassador|Contessa/);
    await fits();
    if (scenario === 'room-6') await page.screenshot({ path: path.join(output, 'lobby-6-390.png') });
    await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
    await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).waitFor();
    if (scenario === 'room-2') {
      await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
      assert(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).isEnabled(), 'owner can start when the current roster is ready');
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await open('room-6');
  await fits();
  assert(await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).isVisible());
  assert(await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).isVisible());
  await page.setViewportSize({ width: 390, height: 844 });
  await open('room-member');
  assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0, 'non-owner cannot start from the UI');
  assert(await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).isVisible());
  await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).click();
  await page.getByRole('button', { name: 'สร้างห้องใหม่', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await open('room-6');
  await page.getByRole('button', { name: 'นำออก', exact: true }).first().click();
  await page.getByRole('dialog', { name: 'ยืนยันการดำเนินการ' }).getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  assert.equal(await page.locator('.council-seat:not(.council-seat-empty)').count(), 5, 'owner kick updates the roster');
  assert.equal(await page.locator('.council-seat-empty').count(), 1);
  console.log('PASS join, leave, owner kick and live roster updates');
  for (const [width, height] of [[768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await open('room-6');
    assert.equal(await page.locator('.council-seat').count(), 6, 'desktop keeps six fixed seats');
    assert.equal(await page.locator('.council-seat:not(.council-seat-empty)').count(), 6);
    assert(await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).isVisible());
    assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0);
    assert(await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).isVisible());
    await fits();
    await page.screenshot({ path: path.join(output, `lobby-6-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open('room-2');
  await page.evaluate(() => window.__coupUiFixture.addPlayer());
  await page.locator('.seat-entering').waitFor();
  await page.waitForTimeout(260);
  assert.equal(await page.locator('.seat-entering').count(), 0, 'join motion settles once');
  await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
  await page.locator('.all-ready-flash').waitFor();
  await page.waitForTimeout(460);
  assert.equal(await page.locator('.all-ready-flash').count(), 0, 'all-ready highlight settles once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open('room-2');
  assert.equal(await page.locator('.player-avatar').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
  await page.locator('.player-avatar-sprite[data-frame="11"]').first().waitFor();
  assert.equal(await page.locator('.player-avatar-sprite[data-frame="11"]').count(), 2, 'reduced motion snaps both avatars to ready');
  assert.equal(await page.locator('.council-stage').evaluate(el => getComputedStyle(el, '::after').animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  console.log('PASS lobby 1/2/6 seats, owner/member controls, one-shot motion and reduced motion');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  for (const [width, height] of [[320, 568], [768, 400]]) {
    await page.setViewportSize({ width, height });
    await open();
    await page.getByRole('navigation', { name: 'เมนูเกม' }).getByRole('button', { name: 'แอคชั่น' }).click();
    await page.getByRole('button', { name: 'ตามบทบาท' }).click();
    const column = page.locator('.game-column-main');
    await column.evaluate(el => el.scrollTop = 0);
    const columnBounds = await column.boundingBox();
    const touchX = columnBounds.x + columnBounds.width / 2;
    const touchY = columnBounds.y + columnBounds.height * .8;
    const swipeDistance = Math.min(150, columnBounds.height * .5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
    for (let step = 1; step <= 10; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - step * swipeDistance / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('.game-column-main').scrollTop > 0);
  }
  console.log('PASS emulated touch swipes scroll actions on phone and tablet');
  assert.deepEqual(errors, [], 'browser runtime errors');
  await browser.close();
  console.log('All UI checks passed. Isolated Firestore fixture; no production writes.');
})().catch(error => { console.error(error); process.exit(1); });
