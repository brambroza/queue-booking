import path from 'node:path';
import fs from 'node:fs';
const proj='/Users/amnartkongpet/Project/GoAlong/2026/Queue';
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('/Users/amnartkongpet/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
const dims={sq:[1080,1080],x:[1600,900],fb:[1200,630]};
const themes=['hero','noshow','free','board'];
const browser=await chromium.launch({ channel: 'chrome' });
for(const t of themes)for(const s of Object.keys(dims)){
  const [w,h]=dims[s];
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
  await page.goto('file://'+path.resolve('template.html')+`?t=${t}&s=${s}`);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(out,`${t}-${s}-${w}x${h}.png`),type:'png'});
  await page.close();
}
await browser.close();
console.log(fs.readdirSync(out).join('\n'));
