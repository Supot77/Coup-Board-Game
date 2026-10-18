const { chromium } = require('../../node_modules/.entry-preview-tools/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page = await browser.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 for (const [width,height] of [[1440,900],[390,844],[320,568],[844,390]]) {
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:5198/tests/ui/index.html?scenario=login');
  await page.locator('#player-name').waitFor(); await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(600);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'วิธีเล่นและกติกา',exact:true}).click();
  await page.locator('dialog[open]').waitFor();
  await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();
  await page.locator('.login-bg').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:`output/entry-refresh-2026-10-18/login-${width}.png`,fullPage:true});
  await page.locator('#player-name').fill('ผู้เล่นทดสอบ'); await page.locator('#player-name').press('Enter');
  await page.locator('#room-code').waitFor();
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:5198/tests/ui/index.html?scenario=login');
 assert.equal(await page.locator('.entry-card').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.deepEqual(errors,[]); await browser.close(); console.log('Entry: 4 viewports, rules, Enter login, reduced motion and runtime checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
