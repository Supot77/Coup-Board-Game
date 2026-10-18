const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5197/tests/ui/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const intro = page.locator('.game-opening');
    const openLobby = async (scenario = 'room-2') => {
      await page.goto(`${base}?scenario=${scenario}`);
      await page.locator('.council-stage').waitFor();
      await page.evaluate(() => window.__coupUiFixture.setAllReady(true));
    };
    const start = () => page.getByRole('button', { name: 'เริ่มเกม', exact: true }).click();
    const waitPhase = phase => page.locator(`.game-opening[data-phase="${phase}"]`).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await openLobby();
    await start();
    await waitPhase('fog');
    assert.equal(await page.locator('.turn-notice').count(), 0, 'turn notice waits until intro ends');
    await page.screenshot({ path: 'tests/ui/artifacts/game-opening-fog-390.png' });
    await waitPhase('cards');
    assert.deepEqual(await intro.locator('.playing-card').evaluateAll(es => es.map(el => el.getAttribute('aria-label'))), ['Duke', 'Ambassador']);
    assert.equal(await intro.locator('.playing-card-back').count(), 0);
    assert(await intro.evaluate(el => el.contains(document.activeElement)), 'focus stays in the opening dialog');
    await intro.locator('.opening-card').first().evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: 'tests/ui/artifacts/game-opening-cards-390.png' });
    await waitPhase('motto');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/ui/artifacts/game-opening-motto-390.png' });
    await intro.waitFor({ state: 'detached' });
    assert(await page.locator('.game-workspace').isVisible());
    await page.locator('.turn-notice').waitFor();
    assert.equal(await page.evaluate(() => window.__coupUiFixture.submittedCommands.length), 0);
    console.log('PASS fog → personal hand → motto → board, delayed turn notice and no gameplay commands');

    for (const [width, height] of [[320, 568], [768, 1024], [1440, 900], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await openLobby();
      await start();
      await waitPhase('cards');
      const fits = await intro.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight);
      assert(fits, `opening fits ${width}x${height}`);
      const cardFits = await intro.locator('.opening-card').evaluateAll(es => es.every(el => {
        const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      }));
      assert(cardFits);
      if (width === 1440) {
        await intro.locator('.opening-card').first().evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
        await page.screenshot({ path: 'tests/ui/artifacts/game-opening-cards-1440.png' });
      }
      await intro.getByRole('button', { name: 'ข้ามฉากเปิด', exact: true }).click();
      assert.equal(await intro.count(), 0);
    }
    console.log('PASS 320/768/1440px and landscape, immediate skip and no overflow');
    await page.evaluate(() => window.__coupUiCallable('resetGame'));
    await page.locator('.council-stage').waitFor();
    await start();
    await waitPhase('fog');
    await intro.getByRole('button', { name: 'ข้ามฉากเปิด', exact: true }).click();
    assert.equal(await intro.count(), 0, 'a new round can play its own intro and be skipped during fog');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLobby('room-member');
    await page.evaluate(() => window.__coupUiFixture.setHand([{ character: 'Captain', isDead: false }, { character: 'Contessa', isDead: false }]));
    await page.evaluate(() => window.__coupUiCallable('startGame'));
    await waitPhase('cards');
    assert.deepEqual(await intro.locator('.playing-card').evaluateAll(es => es.map(el => el.getAttribute('aria-label'))), ['Captain', 'Contessa'], 'intro follows only the viewer private hand');
    assert.equal(await intro.locator('.opening-card').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await intro.locator('.opening-fog').evaluate(el => getComputedStyle(el).display), 'none');
    await page.keyboard.press('Escape');
    await intro.waitFor({ state: 'detached' });
    console.log('PASS remote start for a member, reduced motion and Escape');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openLobby();
    await page.evaluate(() => window.__coupUiFixture.setPrivateCache(true));
    await start();
    await waitPhase('fog');
    await page.waitForTimeout(1200);
    assert.equal(await intro.getAttribute('data-phase'), 'fog', 'cached cards cannot trigger a new-hand reveal');
    assert.equal(await intro.locator('.playing-card').count(), 0);
    await page.evaluate(() => window.__coupUiFixture.setPrivateCache(false));
    await waitPhase('cards');
    await intro.getByRole('button', { name: 'ข้ามฉากเปิด', exact: true }).click();
    console.log('PASS waiting for server-confirmed private hand instead of stale cached cards');

    await openLobby();
    await start();
    await waitPhase('fog');
    await page.evaluate(() => window.__coupUiFixture.setEvent('Steal'));
    await intro.waitFor({ state: 'detached' });
    assert(await page.locator('.game-event-dialog').getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).isEnabled());
    await page.reload();
    await page.locator('.council-stage').waitFor();
    assert.equal(await intro.count(), 0, 'reload does not play the intro');
    await page.goto(`${base}?scenario=turn`);
    await page.locator('.game-workspace').waitFor();
    assert.equal(await intro.count(), 0, 'restoring an existing game skips intro');
    await page.reload();
    await page.locator('.game-workspace').waitFor();
    assert.equal(await intro.count(), 0, 'reloading an existing game skips intro');
    await openLobby();
    await page.evaluate(() => {
      const original = window.__coupUiCallable;
      window.__coupUiCallable = async (name, payload) => {
        if (name === 'startGame') throw { code: 'failed-precondition' };
        return original(name, payload);
      };
    });
    await start();
    await page.getByRole('dialog').waitFor();
    assert.equal(await intro.count(), 0, 'failed start never opens a cinematic');
    assert.deepEqual(errors, []);
    console.log('PASS urgent response interrupts intro, reload/resume do not replay, no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
