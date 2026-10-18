const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5294/tests/ui/index.html';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const enter = async scenario => {
    await page.goto(`${base}?scenario=${scenario}`);
    await page.locator('.lobby-room-page, .lobby-entry-page, .game-shell').waitFor();
    await page.waitForFunction(() => !!window.__coupUiFixture);
  };
  const recovered = async (withNotice = true) => {
    await page.locator('.lobby-entry-page').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('coup_current_room')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('coup_player_name')), 'ผู้เล่นทดสอบ');
    if (withNotice) {
      await page.getByRole('button', { name: 'รับทราบ', exact: true }).click();
      assert.equal(await page.getByRole('dialog').count(), 0, 'one notice for multiple failing subscriptions and StrictMode');
    }
  };
  await enter('room-stale');
  await recovered();
  for (const scenario of ['room-2', 'default']) {
    await enter(scenario);
    await page.locator(scenario === 'room-2' ? '.lobby-room-page' : '.game-shell').waitFor();
    await page.evaluate(() => window.__coupUiFixture.failRoom('permission-denied'));
    await recovered();
  }
  // Cached absence is not proof that the room was deleted; server absence is.
  await enter('room-2');
  await page.locator('.lobby-room-page').waitFor();
  await page.evaluate(() => window.__coupUiFixture.removeRoom(true));
  assert.equal(await page.locator('.lobby-room-page').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('coup_current_room')), 'TEST');
  await page.evaluate(() => window.__coupUiFixture.removeRoom(false));
  await recovered();
  // Transient connection failures keep the resume pointer and room UI.
  await enter('room-2');
  await page.locator('.lobby-room-page').waitFor();
  await page.evaluate(() => window.__coupUiFixture.failRoom('unavailable'));
  assert.equal(await page.locator('.lobby-room-page').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('coup_current_room')), 'TEST');
  // Leave is an escape route even if membership disappeared before the request.
  await enter('room-2');
  await page.locator('.lobby-room-page').waitFor();
  await page.evaluate(() => window.__coupUiFixture.failLeave('permission-denied'));
  await page.getByRole('button', { name: 'ออกจากห้อง', exact: true }).tap();
  await recovered(false);
  // Valid reset retains membership and returns to the same lobby.
  await enter('default');
  await page.locator('.game-shell').waitFor();
  await page.evaluate(() => window.__coupUiCallable('resetGame'));
  await page.locator('.lobby-room-page').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('coup_current_room')), 'TEST');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS room recovery: stale login, deleted lobby/game, one notice, cache/offline retention, denied leave, valid reset; mobile touch');
})().catch(error => { console.error(error); process.exit(1); });
