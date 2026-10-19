const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5299/tests/ui/index.html';
const output = 'output/gameplay-ux-2026-10-19';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__audioNodes = 0;
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...args) { window.__audioNodes += 1; return original.apply(this, args); };
    });
    const open = async scenario => {
      await page.goto(`${base}?scenario=${scenario}`);
      await page.locator('.game-workspace').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const notice = page.getByRole('button', { name: 'ปิดแจ้งเตือนถึงตาคุณ' });
      if (await notice.isVisible()) await notice.click();
    };
    const actions = async () => { if (await page.locator('.mobile-tabs').isVisible()) await page.locator('.mobile-tabs button').nth(1).click(); };
    const count = () => page.evaluate(() => window.__coupUiFixture.submittedCommands.length);
    const fits = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const reachableResponses = async () => {
      const result = await page.locator('.game-event-dialog .response-buttons button').evaluateAll(buttons => buttons.map(button => {
        const r = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label'), fits: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === button, size: r.width >= 44 && r.height >= 44 };
      }));
      assert(result.length >= 2);
      assert(result.every(item => item.fits && item.hit && item.size), JSON.stringify(result));
    };
    for (const [width, height] of [[320, 568], [360, 800], [390, 844], [768, 1024], [1440, 900], [844, 390]]) {
      await page.setViewportSize({ width, height });
      for (const scenario of ['response', 'assassination', 'block']) {
        await open(scenario);
        await reachableResponses();
        const summaryBefore = await page.locator('.game-event-dialog .response-decision-summary').boundingBox();
        await page.locator('.game-event-dialog .response-decision-details').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await reachableResponses();
        assert.deepEqual(await page.locator('.game-event-dialog .response-decision-summary').boundingBox(), summaryBefore);
        assert.equal(await count(), 0);
        await fits();
        if (scenario === 'response') await page.screenshot({ path: `${output}/decision-${width}.png` });
      }
      await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
      for (const index of width < 1200 ? [0, 1, 2, 3] : []) {
        await page.locator('.mobile-tabs button').nth(index).click();
        assert(await page.locator('.table-overview').isVisible());
      }
      assert.equal(await page.locator('.table-overview .playing-card-front').count(), 0);
      await page.evaluate(() => window.__coupUiFixture.setTurnOrder(['player2', 'player1', 'player3']));
      await page.waitForFunction(() => document.querySelector('.table-overview li')?.getAttribute('data-player-id') === 'player2');
      assert.equal(await page.locator('.table-overview li').first().getAttribute('data-player-id'), 'player2');
      console.log(`PASS reachable fixed response controls, scrolling, public overview and order ${width}x${height}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await open('turn'); await actions();
    await page.getByRole('button', { name: 'แบบย่อ', exact: true }).click();
    assert.equal(await page.locator('.action-tile').count(), 7);
    assert(await page.locator('[data-action="Steal"] .role-mask').count());
    await page.reload(); await page.locator('.compact-actions').waitFor(); await actions();
    if (await page.getByRole('button', { name: 'ปิดแจ้งเตือนถึงตาคุณ' }).isVisible()) await page.getByRole('button', { name: 'ปิดแจ้งเตือนถึงตาคุณ' }).click();
    assert.equal(await page.locator('.action-tile').count(), 7);
    await page.locator('[data-action="Steal"]').click();
    assert.equal(await count(), 0);
    await page.locator('.target-player').first().click();
    assert.equal(await count(), 0);
    await page.getByRole('button', { name: 'เปลี่ยนเป้าหมาย', exact: true }).click();
    await page.locator('.target-player').first().click();
    await page.locator('.game-column-main').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `${output}/target-confirm-390.png` });
    await page.getByRole('button', { name: /^ยืนยัน Steal ใส่/ }).click();
    assert.equal(await count(), 1);
    assert.equal(await page.evaluate(() => window.__coupUiFixture.submittedCommands[0].targetId), 'player2');
    await open('coins10'); await actions();
    assert.equal(await page.locator('.action-tile:enabled').count(), 1);
    await page.locator('[data-action="Coup"]').click();
    await page.locator('.target-player').first().click();
    assert.match(await page.locator('.target-step').innerText(), /7 เหรียญ/);
    assert.equal(await count(), 0);
    await page.getByRole('button', { name: 'ยกเลิกการเลือก', exact: true }).click();
    assert.equal(await count(), 0);
    await page.getByRole('button', { name: 'แบบละเอียด', exact: true }).click();
    console.log('PASS persisted action density, all seven actions, bluffing, mandatory Coup and final target confirmation');

    await open('discard'); await actions();
    await page.getByRole('button', { name: 'เลือกเปิดเผย Duke', exact: true }).click();
    assert.equal(await count(), 0);
    await page.getByRole('button', { name: 'ยืนยันเปิดเผย Duke', exact: true }).click();
    assert.equal(await count(), 1);
    await page.locator('.game-feedback').waitFor();
    assert(await page.locator('.game-feedback .playing-card-revealed').count());
    await page.screenshot({ path: `${output}/discard-result-390.png` });
    await open('history');
    assert.equal(await page.locator('.public-event').count(), 3);
    assert.equal(await page.locator('.game-feedback').count(), 0, 'historical events never replay');
    await page.locator('.mobile-tabs button').nth(3).click();
    await page.getByRole('combobox', { name: 'กรองประวัติตามผู้เล่น' }).selectOption('player1');
    assert.equal(await page.locator('.public-event').count(), 2);
    await page.reload(); await page.locator('.game-workspace').waitFor();
    assert.equal(await page.locator('.public-event').count(), 3);
    await page.locator('.mobile-tabs button').nth(3).click();
    await page.evaluate(() => {
      for (let i = 0; i < 35; i++) window.__coupUiFixture.addPublicEvent({ outcome: `เหตุการณ์ทดสอบ ${i}` });
    });
    await page.locator('.history-log-box').evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
    const beforeScroll = await page.locator('.history-log-box').evaluate(el => el.scrollTop);
    await page.evaluate(() => window.__coupUiFixture.addPublicEvent({ outcome: 'เหตุการณ์ล่าสุด' }));
    assert.equal(await page.locator('.history-log-box').evaluate(el => el.scrollTop), beforeScroll);
    await page.getByRole('button', { name: /เหตุการณ์ใหม่ 1 รายการ/ }).click();
    assert(await page.locator('.history-log-box').evaluate(el => el.scrollTop > 0));
    await page.screenshot({ path: `${output}/history-390.png` });
    console.log('PASS explicit discard, confirmed reveal feedback, history reload/filter and non-disruptive new events');

    await open('history');
    await page.locator('.game-sound-settings summary').click();
    assert.equal(await page.evaluate(() => window.__audioNodes), 0);
    await page.getByRole('button', { name: 'เปิดเสียงเกม', exact: true }).click();
    await page.getByRole('slider', { name: 'ระดับเสียงเกม' }).fill('0.5');
    assert.equal(await page.evaluate(() => localStorage.getItem('coup_sound_enabled')), 'true');
    assert.equal(await page.evaluate(() => localStorage.getItem('coup_sound_volume')), '0.5');
    await page.locator('.game-sound-settings summary').click();
    await page.evaluate(() => window.__coupUiFixture.addPublicEvent({ kind: 'action', outcome: 'ได้รับเหรียญ', coinChanges: [{ playerId: 'player1', playerName: 'คุณ', before: 7, after: 8 }] }));
    await page.locator('.game-feedback').waitFor();
    await page.waitForFunction(() => window.__audioNodes > 0);
    await page.reload(); await page.locator('.game-workspace').waitFor();
    assert.equal(await page.locator('.game-feedback').count(), 0);
    await page.locator('.game-sound-settings summary').click();
    assert(await page.getByRole('button', { name: 'ปิดเสียงเกม', exact: true }).isVisible());
    await page.getByRole('button', { name: 'ปิดเสียงเกม', exact: true }).click();
    await page.locator('.game-sound-settings summary').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.__coupUiFixture.addPublicEvent({ coinChanges: [{ playerId: 'player1', playerName: 'คุณ', before: 7, after: 8 }] }));
    await page.locator('.game-feedback').waitFor();
    assert.equal(await page.locator('.game-feedback').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('PASS opt-in real Web Audio events, saved mute/volume, no replay on reload and reduced motion');

    await open('response&persistClock=1');
    await page.evaluate(() => window.__coupUiFixture.setResponseStart(Date.now() - 7000));
    await page.waitForFunction(() => Number(document.querySelector('[role="timer"]')?.textContent.match(/\d+/)?.[0]) <= 8);
    const before = Number((await page.getByRole('timer').innerText()).match(/\d+/)[0]);
    assert(before <= 8);
    await page.reload(); await page.getByRole('timer').waitFor();
    assert(Number((await page.getByRole('timer').innerText()).match(/\d+/)[0]) <= before, 'reload does not renew the response window');
    await page.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
    await context.setOffline(true);
    await page.getByText('การเชื่อมต่อขาด', { exact: false }).waitFor();
    await context.setOffline(false);
    await page.evaluate(() => window.__coupUiFixture.setHostSeen(Date.now() - 60000));
    await page.getByText('ยังไม่ได้รับสัญญาณล่าสุดจากเจ้าของห้อง', { exact: false }).waitFor();
    await page.clock.install();
    await open('turn'); await actions();
    await page.evaluate(() => window.__coupUiFixture.setCommandDelays(1500, 6500));
    await page.locator('[data-action="Income"]').click();
    await page.getByText('กำลังส่งคำสั่ง…', { exact: true }).waitFor();
    await page.clock.runFor(1600);
    await page.getByText('รับคำสั่งแล้ว · กำลังประมวลผล', { exact: true }).waitFor();
    await page.clock.runFor(5500);
    await page.getByText('รับคำสั่งแล้ว · กำลังรออุปกรณ์เจ้าของห้อง ไม่ต้องกดส่งซ้ำ', { exact: true }).waitFor();
    assert.equal(await count(), 1);
    await page.reload(); await page.locator('.game-workspace').waitFor();
    await page.waitForFunction(() => sessionStorage.getItem('coup_pending_TEST_player1') === null);
    assert.equal(await count(), 0, 'restoring a pending command never resubmits it');
    console.log('PASS shared deadline, real offline event, stale-host indication and sending/received/waiting/reload without duplicate commands');

    await open('gameover');
    assert.match(await page.locator('.victory-stats').innerText(), /2:05/);
    assert.equal((await page.locator('.victory-stats dd').allInnerTexts())[2], '1');
    await page.getByRole('button', { name: 'ดูผู้เล่นและประวัติ', exact: true }).click();
    await page.getByRole('button', { name: 'ดูผลเกม', exact: true }).click();
    assert(await page.locator('.victory-stats').isVisible());
    await page.screenshot({ path: `${output}/round-summary-390.png` });
    assert.deepEqual(errors, []);
    console.log('PASS actual round statistics, victory close/reopen and no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
