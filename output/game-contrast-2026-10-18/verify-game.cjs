const { chromium }=require('../../node_modules/.entry-preview-tools/node_modules/playwright');
const assert=require('node:assert/strict');
const ratios=[];
const lum=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,1000]]){
  await page.setViewportSize({width,height});
  for(const scenario of ['turn','response','exchange']){
   await page.goto(`http://127.0.0.1:5198/tests/ui/index.html?scenario=${scenario}`,{waitUntil:'domcontentloaded'});
   await page.locator('.game-workspace').waitFor();await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(scenario==='turn'){
    const selectors=[['.game-header h1','.game-header'],['.turn-status','.turn-status'],['.action-tile .action-title','.action-tile'],['.game-rules-button','.game-rules-button']];
    for(const [fg,bg] of selectors){
     const colors=await page.evaluate(([fg,bg])=>[getComputedStyle(document.querySelector(fg)).color,getComputedStyle(document.querySelector(bg)).backgroundColor],[fg,bg]);
     const values=colors.map(lum).sort((a,b)=>b-a);const ratio=(values[0]+.05)/(values[1]+.05);assert(ratio>=4.5,`${fg}: ${ratio}`);ratios.push({width,selector:fg,ratio:ratio.toFixed(2)});
    }
    const alivePortraits=await page.locator('.opponent-card-alive .playing-card-portrait').count();assert.equal(alivePortraits,0);
    await page.waitForTimeout(200); await page.screenshot({path:`output/game-contrast-2026-10-18/board-${width}.png`});
    if(width<1200) await page.getByRole('navigation',{name:'เมนูเกม'}).getByRole('button',{name:'แอคชั่น'}).click();
    await page.getByRole('button',{name:'ตามบทบาท',exact:false}).click();
    await page.waitForTimeout(200); await page.screenshot({path:`output/game-contrast-2026-10-18/actions-${width}.png`});
   }else if(scenario==='response'){
    await page.locator('dialog[open]').waitFor();await page.waitForTimeout(200); await page.screenshot({path:`output/game-contrast-2026-10-18/response-${width}.png`});
    await page.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();assert(await page.getByRole('button',{name:'เปิดเหตุการณ์',exact:true}).count());
   }else{
    if(width<1200)await page.getByRole('navigation',{name:'เมนูเกม'}).getByRole('button',{name:'แอคชั่น'}).click();
    await page.waitForTimeout(200); await page.screenshot({path:`output/game-contrast-2026-10-18/exchange-${width}.png`});
   }
  }
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify(ratios));await browser.close();console.log('PASS contrast >=4.5, private opponent faces, four viewport layouts and response reopen');
})().catch(e=>{console.error(e);process.exit(1)});
