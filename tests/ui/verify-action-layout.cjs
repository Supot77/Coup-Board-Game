const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5197/tests/ui/index.html';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const content = page.locator('.actions-panel-content');
    const open = async scenario => {
      await page.goto(`${base}?scenario=${scenario}`);
      await page.locator('.game-workspace').waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    for (const [width, height] of [[320, 568], [360, 800], [390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await open('waiting');
      if (width < 1200) await page.getByRole('button', { name: 'แอคชั่น', exact: true }).click();
      assert.equal(await content.isVisible(), false, 'waiting collapses actions automatically');
      await page.getByRole('button', { name: 'ดูแอคชั่น', exact: true }).click();
      assert(await content.isVisible());
      assert(await page.locator('[data-action="Income"]').isDisabled());
      await page.evaluate(() => window.__coupUiFixture.setTurn(0));
      await page.locator('[data-action="Income"]:enabled').waitFor();
      assert(await content.isVisible());
      await page.evaluate(() => window.__coupUiFixture.setTurn(1));
      await page.waitForFunction(() => document.querySelector('.actions-panel-content').hidden);
      await page.evaluate(() => window.__coupUiFixture.setEvent('Steal'));
      await page.locator('.game-event-dialog').waitFor();
      assert(await content.isVisible(), 'response opens even outside own turn');
      await page.locator('.game-event-dialog').getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.actions-panel-content').hidden);
      await page.locator('.game-event-dialog').getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
      assert(await page.getByRole('button', { name: 'เปิดเหตุการณ์', exact: true }).isVisible());
      await page.getByRole('button', { name: 'เปิดเหตุการณ์', exact: true }).click();
      await page.locator('.game-event-dialog').getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
      await page.locator('.game-room-label strong').evaluate(el => { el.textContent = 'ABCDEFGH'; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (width <= 390) {
        const layout = await page.locator('.game-header').evaluate(el => {
          const rect = selector => el.querySelector(selector).getBoundingClientRect();
          const brand = rect('.game-brand'); const room = rect('.game-room-label');
          const stats = [...el.querySelectorAll('.game-stat')].map(item => item.getBoundingClientRect());
          return { below: room.top >= brand.bottom, aligned: stats.every(stat => Math.abs((stat.top + stat.height / 2) - (room.top + room.height / 2)) < 4), fits: el.scrollWidth <= el.clientWidth };
        });
        assert.deepEqual(layout, { below: true, aligned: true, fits: true });
      }
      await page.screenshot({ path: `tests/ui/artifacts/action-layout-${width}.png` });
      console.log(`PASS collapse, expand, turn transitions, response/pass and header ${width}px`);
    }
    for (const scenario of ['discard', 'exchange']) {
      await open(scenario);
      assert(await content.isVisible(), `${scenario} automatically opens required input`);
    }
    for (const scenario of ['discard-other', 'exchange-other', 'dead']) {
      await open(scenario);
      assert.equal(await content.isVisible(), false, `${scenario} requires no viewer decision`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open('waiting');
    assert.equal(await content.isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS discard, Exchange, elimination, reduced motion and no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
