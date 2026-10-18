const { chromium } = require('../../node_modules/.entry-preview-tools/node_modules/playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[1440,1000],[390,844],[320,568],[844,390]]) {
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5198/tests/ui/index.html?scenario=lobby');
  await page.locator('#room-code').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.getByRole('button',{name:'สร้างห้องใหม่',exact:true}).isDisabled());
  await page.getByRole('button',{name:'ชาย',exact:true}).click();
  await page.locator('#room-code').fill('abciodef');assert.equal(await page.locator('#room-code').inputValue(),'ABCDEF');
  await page.locator('#room-code').fill('');
  await page.locator('.council-entry').evaluate(el=>{el.style.position='relative';el.style.height='auto';el.style.overflow='visible'});
  await page.screenshot({path:`output/lobby-object-art-2026-10-18/lobby-${width}.png`,fullPage:true});
  await page.locator('#room-code').fill('abcdefgh');await page.locator('#room-code').press('Enter');await page.locator('.room-code-value').waitFor();
 }
 assert.deepEqual(errors,[]); await browser.close(); console.log('Lobby entry: 4 viewport layouts, avatar gating, code normalization and Enter join passed');
})().catch(e=>{console.error(e);process.exit(1)});
