const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5198/tests/ui/index.html';
const output = path.resolve('output/sword-loading-2026-10-18');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    let priorLeft = -1;
    for (const progress of [0, 50, 100]) {
      await page.goto(`${base}?scenario=loading-preview&progress=${progress}`);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.sword-progress-marker img').evaluate(img => img.decode());
      await page.waitForTimeout(240);
      assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), String(progress));
      const track = await page.locator('.sword-progress').boundingBox();
      const marker = await page.locator('.sword-progress-marker').boundingBox();
      assert(marker.x >= track.x - 1 && marker.x + marker.width <= track.x + track.width + 1);
      assert(marker.x >= priorLeft, 'sword moves forward');
      priorLeft = marker.x;
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (progress === 50) await page.screenshot({ path: path.join(output, `loading-${width}.png`) });
    }
  }
  // Hold a real preparation request. Completion must depend on it, not a timer.
  let release;
  await page.route('**/BG-LOGIN.png', route => { release = () => route.continue(); });
  await page.goto(`${base}?scenario=login`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '83');
  const percentages = [];
  await page.exposeFunction('recordLoadingProgress', value => percentages.push(value));
  await page.evaluate(() => {
    const bar = document.querySelector('[role="progressbar"]');
    new MutationObserver(() => window.recordLoadingProgress(bar.getAttribute('aria-valuenow'))).observe(bar, { attributes: true, attributeFilter: ['aria-valuenow'] });
  });
  await release();
  await page.locator('#player-name').waitFor();
  assert(percentages.includes('100'), 'startup reaches 100 only after held resource settles');
  await page.unroute('**/BG-LOGIN.png');
  // A decorative image error must not trap the player at startup.
  await page.route('**/BG-LOGIN.png', route => route.abort());
  await page.goto(`${base}?scenario=login`);
  await page.locator('#player-name').waitFor();
  await page.unroute('**/BG-LOGIN.png');
  // A pending session never reaches 100; long waits get an actionable retry.
  await page.clock.install();
  await page.goto(`${base}?scenario=loading-session`);
  await page.waitForFunction(() => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === '83');
  await page.clock.fastForward(16000);
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '83');
  assert(await page.getByRole('button', { name: 'ลองโหลดใหม่' }).isVisible());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.sword-progress-marker').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS sword progress: four viewports, 0/50/100, real preparation dependency, failed image, pending session, retry and reduced motion');
})().catch(error => { console.error(error); process.exit(1); });
