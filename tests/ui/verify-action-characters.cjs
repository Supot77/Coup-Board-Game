const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.UI_TEST_BASE || 'http://127.0.0.1:5197/tests/ui/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const setEvent = (action, block = null) => page.evaluate(([action, block]) => window.__coupUiFixture.setEvent(action, block), [action, block]);
    const sprite = page.locator('.action-character-sprite');
    const modal = page.locator('.game-event-dialog');
    const commands = () => page.evaluate(() => window.__coupUiFixture.submittedCommands.length);
    await page.goto(`${base}?scenario=response`);
    for (const [action, block, role] of [
      ['Tax', null, 'Duke'], ['Assassinate', null, 'Assassin'], ['Steal', null, 'Captain'],
      ['Exchange', null, 'Ambassador'], ['Assassinate', 'Contessa', 'Contessa'],
      ['ForeignAid', 'Duke', 'Duke'], ['Steal', 'Captain', 'Captain'], ['Steal', 'Ambassador', 'Ambassador'],
    ]) {
      await setEvent(action, block);
      await page.locator(`.action-character[data-role="${role}"] .action-character-sprite`).waitFor();
      assert(await modal.getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).isEnabled(), 'responses do not wait for animation');
      const middle = await sprite.evaluate(el => {
        const animation = el.getAnimations()[0];
        if (!animation) return null;
        animation.pause();
        animation.currentTime = 300;
        const position = getComputedStyle(el).backgroundPositionX;
        animation.play();
        return parseFloat(position);
      });
      assert(middle > 0 && middle < 100, 'gesture has intermediate frames');
      await sprite.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      assert.equal(await sprite.evaluate(el => getComputedStyle(el).backgroundPositionX), '100%');
      if (!block || role === 'Contessa') await page.locator('.action-character').screenshot({ path: `tests/ui/artifacts/action-pose-${role.toLowerCase()}.png` });
      assert.match(await modal.locator('.event-description').innerText(), /อ้างว่ามี/);
      const before = await commands();
      await modal.getByRole('button', { name: 'ปิดหน้าต่าง', exact: true }).click();
      await page.getByRole('button', { name: 'เปิดเหตุการณ์', exact: true }).click();
      await sprite.waitFor();
      assert.equal(await sprite.evaluate(el => el.getAnimations().length), 0, 'reopen holds the final pose');
      await page.evaluate(() => window.__coupUiFixture.passOther());
      assert.equal(await sprite.evaluate(el => el.getAnimations().length), 0, 'roster/vote update does not replay');
      assert.equal(await commands(), before, 'viewing/closing animation sends no command');
    }
    console.log('PASS all five role claims and legal blocks, final pose, reopen, vote updates and no commands');

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
      await page.goto(`${base}?scenario=assassination`);
      await sprite.waitFor();
      assert(await modal.getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).isEnabled());
      const bad = await modal.locator('.dialog-surface, .action-character, .response-buttons').evaluateAll(es => es.some(el => el.scrollWidth > el.clientWidth + 2));
      assert.equal(bad, false, `no overflow at ${width}`);
      assert.equal(await page.locator('.action-character-stage').evaluate(el => el.getBoundingClientRect().height), width <= 600 ? 120 : 160);
      await sprite.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await modal.screenshot({ path: `tests/ui/artifacts/action-character-${width}.png` });
    }
    console.log('PASS mobile/desktop layouts and enabled response controls');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setEvent('Tax');
    await sprite.waitFor();
    assert.equal(await sprite.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await sprite.evaluate(el => getComputedStyle(el).backgroundPositionX), '100%');
    await setEvent('ForeignAid');
    assert.equal(await page.locator('.action-character').count(), 0, 'general action never claims a role');

    await page.route('**/action-*-v1.webp', route => route.abort());
    await page.goto(`${base}?scenario=response`);
    await page.locator('.action-character-fallback').waitFor();
    assert(await modal.getByRole('button', { name: 'ปล่อยผ่าน', exact: true }).isEnabled());
    assert.deepEqual(errors, []);
    console.log('PASS reduced motion, general action, missing-art fallback and no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
