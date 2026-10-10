'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
  for(const [device,width,height] of [['desktop',1280,900],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},acceptDownloads:true});
   const page=await context.newPage();const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async(data)=>{window.__shared=data;}});});
   await page.goto(base);await page.locator('#go-branch').waitFor();
   await page.locator('#q-emp').fill('خالد الماطر');
   assert((await page.locator('#greet').innerText()).includes('خالد الماطر'));
   const open=async code=>{
    if(await page.locator('#q-branch').count()===0)await page.locator('[data-act="change"]').first().click();
    await page.locator('#q-branch').fill(code);await page.locator('#go-branch').click();
    await page.waitForFunction(code=>window.__rogQA?.().branch===code,code);
   };
   const section=async k=>{await page.locator('[data-tab="'+k+'"]').click();await page.locator('#q-sec').waitFor();};
   await open('243');
   assert((await page.locator('h1').innerText()).includes('القادسية'));
   // A single sector click must activate exactly that sector in Riyadh and Jeddah.
   const assertExclusiveSector=async sector=>{
    await page.locator('.seg button[data-explore="'+sector+'"]').click();
    assert.equal(await page.locator('.seg button[data-explore][aria-pressed="true"]').count(),1,'multiple sectors activated in '+sector);
    assert.equal(await page.locator('.seg button[data-explore="'+sector+'"]').getAttribute('aria-pressed'),'true');
   };
   await assertExclusiveSector('شرق');
   assert.equal(await page.locator('.seg button[data-explore="شمال"]').getAttribute('aria-pressed'),'false');
   await assertExclusiveSector('شمال');
   assert.equal(await page.locator('.seg button[data-explore="شرق"]').getAttribute('aria-pressed'),'false');
   await open('110'); // Jeddah, Hamdaniyah
   await assertExclusiveSector('شرق');
   await assertExclusiveSector('شمال');
   await open('243');
   await section('projects');
   const before=await page.locator('[data-detail]').count();assert(before>0);
   await page.locator('#q-sec').fill('__qa_no_such_record__');
   await page.getByText('لا نتائج مطابقة',{exact:false}).waitFor();
   await page.locator('#q-sec').fill('');await page.locator('[data-detail]').first().waitFor();
   await page.locator('.vcard [data-detail]').first().click();
   await page.locator('#detail').waitFor({state:'visible'});
   await page.locator('#detail .btn[data-close]').click();
    await page.locator('#detail').waitFor({state:'hidden'});
   await section('cars');
   assert(!(await page.locator('#content').innerText()).includes('مصدر رقم التواصل'));
   assert(await page.locator('[data-call]').count()>0);
   const phone=await page.locator('[data-call]').first().getAttribute('href');assert(/^tel:[+\d]+$/.test(phone));
   const mapLinks=await page.locator('a[href*="google.com/maps"],a[href*="maps.app.goo.gl"],a[href*="goo.gl/maps"]').count();assert(mapLinks>0);
   const downloaded=page.waitForEvent('download');
   await page.locator('[data-vcard]').first().click();
   const download=await downloaded;const file=await download.path();const vcf=fs.readFileSync(file,'utf8');
   assert(vcf.includes('BEGIN:VCARD')&&/TEL;TYPE=WORK,VOICE:0\d{9}/.test(vcf));
   await page.locator('[data-share]').first().click();
   const shared=await page.evaluate(()=>window.__shared);assert(shared?.title&&shared?.text);
   await page.locator('[data-car-area="shifa"]').click();
   assert((await page.locator('#content').innerText()).includes('الشفا'));
   await page.locator('[data-car-area="qadisiyah"]').click();
   assert((await page.locator('#content').innerText()).includes('القادسية'));
   // City-wide behavior through actual controls, including the branch without a pin.
   for(const code of ['602','105','304','302','401','307']){
    await open(code);
    const q=await page.evaluate(()=>window.__rogQA());
    assert(!await page.locator('#radius').count(),code+' exposed radius outside Riyadh/Jeddah');
    assert(!await page.locator('[data-scope="city"]').count(),code+' exposed redundant city control');
    assert(q.branch===code);
   }
   await open('176');assert(!await page.locator('#radius').count());
   // Seven independent search controls: Riyadh's six categories and Hail self-build.
   let searchSections=0;
   for(const [code,k] of [['243','projects'],['243','opps'],['243','nhc'],['243','companies'],['243','offices'],['243','cars'],['610','selfbuild']]){
    await open(code);await section(k);await page.locator('#q-sec').fill('__qa_no_such_record__');
    await page.getByText('لا نتائج مطابقة',{exact:false}).waitFor();searchSections++;
   }
   assert.equal(searchSections,7);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   assert(!overflow,device+' horizontal overflow');assert.deepEqual(errors,[]);
   results.push({device,width,searchSections,branchNavigation:true,detailDialog:true,downloadedContact:true,share:true,localCities:true,pageErrors:errors});
   await context.close();
  }
 }finally{await browser.close();}
 console.log(JSON.stringify({suite:'Chromium real browser interactions',results,ok:true},null,2));
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>server.close());
