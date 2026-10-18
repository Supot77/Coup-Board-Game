const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = 'output/room-settings-2026-10-18';
fs.mkdirSync(output, { recursive: true });
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5294/tests/ui/index.html';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}?scenario=room-2`);
    const select = page.getByRole('combobox', { name: 'เวลาตอบโต้', exact: true });
    await select.waitFor();
    assert.equal(await select.inputValue(), '15');
    for (const seconds of ['30', '45', '60', '15']) {
      await select.selectOption(seconds);
      await page.waitForFunction(value => document.querySelector('#response-time')?.value === value, seconds);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 390) await page.screenshot({ path: `${output}/lobby-settings-mobile.png`, fullPage: true });
  }
  await page.goto(`${base}?scenario=room-member&responseSeconds=45`);
  await page.locator('.room-time-settings strong').waitFor();
  assert.match(await page.locator('.room-time-settings').innerText(), /45 วินาที/);
  assert.equal(await page.locator('#response-time').count(), 0);
  await page.clock.install();
  // Configured countdown and fallback for existing rooms, for both response phases.
  for (const [scenario, seconds] of [['response', 60], ['response', 45], ['block', 30], ['response', 15]]) {
    await page.goto(`${base}?scenario=${scenario}${seconds === 15 ? '' : `&responseSeconds=${seconds}`}`);
    const clock = page.getByRole('timer').first();
    await clock.waitFor();
    const remaining = () => clock.innerText().then(text => Number(text.match(/(\d+)/)[1]));
    assert((await remaining()) <= seconds && (await remaining()) >= seconds - 1);
    await page.clock.runFor(3000);
    const before = await remaining();
    await page.evaluate(() => window.__coupUiFixture.passOther());
    assert((await remaining()) <= before, 'other votes do not reset the timer');
    await page.clock.runFor((seconds + 1) * 1000);
    assert.equal(await page.evaluate(() => window.__coupUiFixture.submittedCommands.filter(c => c.type === 'respond' && c.response === 'pass').length), 1);
  }
  await page.goto(`${base}?scenario=waiting`);
  await page.locator('.game-shell').waitFor();
  assert.equal(await page.locator('.turn-notice').count(), 0);
  await page.evaluate(() => window.__coupUiFixture.setTurn(0));
  await page.locator('.turn-notice').waitFor();
  await page.locator('.turn-notice').getByRole('button', { name: 'เลือกแอคชั่น', exact: true }).click();
  assert.equal(await page.locator('.turn-notice').count(), 0);
  await page.evaluate(() => window.__coupUiFixture.setTurn(0));
  assert.equal(await page.locator('.turn-notice').count(), 0, 'no duplicate on roster updates');
  await page.evaluate(() => window.__coupUiFixture.setTurn(1));
  await page.evaluate(() => window.__coupUiFixture.setTurn(0));
  await page.locator('.turn-notice').waitFor();
  await page.clock.runFor(6100);
  assert.equal(await page.locator('.turn-notice').count(), 0, 'automatically dismissed');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__coupUiFixture.setTurn(1));
  await page.evaluate(() => window.__coupUiFixture.setTurn(0));
  await page.locator('.turn-notice').waitFor();
  assert.equal(await page.locator('.turn-notice').evaluate(el => getComputedStyle(el).animationName), 'none');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(`${base}?scenario=waiting`);
    await page.locator('.game-shell').waitFor();
    await page.evaluate(() => window.__coupUiFixture.setTurn(0));
    await page.locator('.turn-notice').waitFor();
    const bounds = await page.locator('.turn-notice').boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `${output}/turn-notice-${width}.png` });
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS room timing: owner/member, responsive 320/390/1440, configured/fallback countdowns, no vote reset, auto-pass once; turn notification once per turn, action shortcut, auto-dismiss and reduced motion');
})().catch(error => { console.error(error); process.exit(1); });
