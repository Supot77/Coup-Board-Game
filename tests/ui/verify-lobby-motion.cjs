const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5197/tests/ui/index.html';
const output = path.join(__dirname, 'artifacts');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const open = async scenario => {
      await page.goto(`${base}?scenario=${scenario}`);
      await page.locator(scenario === 'lobby' ? '#room-code' : '.council-stage-long').waitFor();
      await page.evaluate(() => document.fonts.ready);
    };
    const framesAt = async frame => page.waitForFunction(value => {
      const sprites = [...document.querySelectorAll('.council-seat .player-avatar-sprite')];
      return sprites.length > 0 && sprites.every(sprite => Number(sprite.dataset.frame) === value);
    }, frame);
    const fits = async () => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(await page.locator('.seat-details, .council-roster-mobile, .council-ready-control').evaluateAll(elements =>
        elements.filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2).map(el => el.className)), []);
    };

    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await open('room-6');
      await page.waitForFunction(() => [...document.querySelectorAll('.avatar-sprite-sheet, .council-tabletop img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.council-seat').count(), 6);
      assert.equal(await page.locator('.player-avatar-sprite').count(), 6);
      assert.equal(await page.locator('.council-room-backdrop').count(), 0, 'one continuous room background');
      assert.equal(await page.locator('.lobby-card-room').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
      assert.equal(await page.locator('.lobby-room-header .room-code-value').count(), 1);
      assert(await page.locator('.lobby-room-header').getByRole('button', { name: 'ออกจากห้อง', exact: true }).isVisible());
      assert(await page.locator('.lobby-room-header').getByRole('button', { name: 'วิธีเล่นและกติกา', exact: true }).isVisible());
      const positions = await page.locator('.seat-person').evaluateAll(elements => elements.map(el => ({ top: Math.round(el.getBoundingClientRect().top), width: el.getBoundingClientRect().width })));
      assert.equal(new Set(positions.map(pos => pos.top)).size, width <= 900 ? 2 : 1);
      assert(positions.every(pos => pos.width >= 60), 'portraits stay legible');
      assert.equal(await page.locator('.council-candle:visible').count(), width <= 900 ? 4 : 2);
      assert.equal(await page.locator('.council-row-lighting').first().evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      assert.equal(await page.locator('.council-candle-flame').first().evaluate(el => getComputedStyle(el).animationName), 'councilFlame');
      assert(await page.evaluate(() => new Promise(resolve => {
        const image = new Image(); image.onload = () => resolve(image.naturalWidth > 0); image.onerror = () => resolve(false);
        image.src = '/assets/secret-council/council-candle-room-v1.webp';
      })), 'candle-room background loads');
      await fits();
      await page.screenshot({ path: path.join(output, `long-table-${width}.png`) });
      console.log(`PASS long table ${width}: six portraits, row layout, loaded artwork and no overflow`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await open('lobby');
    await page.getByRole('button', { name: 'หญิง', exact: true }).click();
    await page.getByRole('button', { name: 'สร้างห้องใหม่', exact: true }).click();
    await page.locator('.council-stage-long').waitFor();
    assert.equal(await page.locator('.player-avatar-sprite').getAttribute('data-avatar'), 'female');
    assert.equal(await page.locator('.council-seat-empty').count(), 5);
    assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0);
    await page.locator('.player-avatar-sprite').evaluate(el => {
      window.__lobbyMotionFrames = [];
      const observer = new MutationObserver(() => window.__lobbyMotionFrames.push(Number(el.dataset.frame)));
      observer.observe(el, { attributes: true, attributeFilter: ['data-frame'] });
    });
    await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
    await framesAt(11);
    assert(await page.evaluate(() => window.__lobbyMotionFrames.some(value => value > 0 && value < 11)));
    await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).click();
    await framesAt(0);
    await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
    await page.waitForFunction(() => { const value = Number(document.querySelector('.player-avatar-sprite').dataset.frame); return value > 0 && value < 11; });
    await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).click();
    await framesAt(0);
    console.log('PASS create room with female, real intermediate frames, reverse and rapid interruption');

    for (const [scenario, count] of [['room-1', 1], ['room-2', 2], ['room-6', 6]]) {
      await open(scenario);
      assert.equal(await page.locator('.council-seat:not(.council-seat-empty)').count(), count);
      assert.equal(await page.locator('.council-seat-empty').count(), 6 - count);
    }
    await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
    await framesAt(11);
    assert.equal(await page.locator('.player-avatar-sprite[data-ready="true"]').count(), 6);
    assert(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).isEnabled());
    await page.evaluate(() => window.__coupUiFixture.setAllReady(false));
    await framesAt(0);
    assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0);
    console.log('PASS 1/2/6 members and public roster updates animate all six players');

    await open('room-2');
    await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
    await page.locator('.lobby-ready-main[data-state="cancel-ready"]').waitFor();
    await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
    await page.locator('.lobby-ready-main[data-state="start"]').waitFor();
    await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).click();
    await page.locator('.lobby-ready-main[data-state="ready"]').waitFor();
    await page.getByRole('button', { name: 'พร้อมเล่น', exact: true }).click();
    await page.locator('.lobby-ready-main[data-state="start"]').waitFor();
    await page.evaluate(() => window.__coupUiFixture.addPlayer());
    await page.locator('.lobby-ready-main[data-state="cancel-ready"]').waitFor();
    assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0, 'unready join returns to waiting');
    await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
    await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).click();
    await page.locator('.game-workspace').waitFor();
    await open('room-member');
    await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
    assert.equal(await page.getByRole('button', { name: 'เริ่มเกม', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'ยกเลิกความพร้อม', exact: true }).click();
    await page.locator('.lobby-ready-main[data-state="ready"]').waitFor();
    console.log('PASS combined owner ready/cancel/start, late join, successful start and member toggle');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open('room-2');
    await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
    await framesAt(11);
    assert.equal(await page.locator('.council-stage').evaluate(el => getComputedStyle(el, '::after').animationName), 'none');
    assert(await page.locator('.council-candle-flame, .council-candle-halo').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none')), 'reduced motion stops flames and light variation');
    await page.evaluate(() => window.__coupUiFixture.setAllReady(false));
    await framesAt(0);
    console.log('PASS reduced motion endpoint states and no table flash');

    await page.route('**/avatar-male.png', route => route.abort());
    await open('room-2');
    await page.locator('.player-avatar-silhouette[data-avatar="male"]').waitFor();
    assert.equal(await page.locator('.player-avatar-sprite[data-avatar="female"]').count(), 1);
    assert.deepEqual(errors, [], 'no JavaScript runtime errors');
    console.log('PASS missing artwork uses neutral silhouette; no runtime errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
