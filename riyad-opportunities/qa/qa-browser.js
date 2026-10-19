/* Desktop/mobile browser regression for the approved portal. Screenshots use real
   data only. Evidence fixtures are injected in memory for interactions and are
   never written to the data directory or captured as production screenshots. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const artifacts=path.resolve(process.env.QA_ARTIFACT_DIR||path.join(root,'qa-artifacts'));fs.mkdirSync(artifacts,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
let browser;
const nhcData=JSON.parse(fs.readFileSync(path.join(root,'data/nhc.json'),'utf8'));
const expectedEastNHC=nhcData.filter(o=>o.city==='الرياض'&&(o.serviceSectors||o.sectors||[o.sec]).includes('شرق')).length;
const expectedCityNHC=nhcData.filter(o=>o.city==='الرياض').length;
const branchData=JSON.parse(fs.readFileSync(path.join(root,'data/branches.json'),'utf8'));
const selfbuildBranch=branchData.find(b=>b.city==='حائل');assert(selfbuildBranch,'Hail self-build browser scenario needs an actual branch');
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});let pageErrors=[],checks=[],imageChecks=[],mobileChecks=[];
 async function capture(page,name){
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.querySelectorAll('svg image')].every(i=>i.dataset.loaded==='1'),null,{timeout:15000});
  const images=await page.evaluate(async()=>{const list=[...document.images];list.forEach(i=>i.loading='eager');await Promise.race([Promise.all(list.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});}))),new Promise(r=>setTimeout(r,12000))]);await Promise.race([Promise.all(list.filter(i=>i.complete&&i.naturalWidth>0).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,5000))]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return list.map(i=>({src:i.currentSrc||i.src,loaded:i.complete&&i.naturalWidth>0,official:i.classList.contains('official-image')}));});
  const svgPhotos=await page.locator('svg image').evaluateAll(nodes=>nodes.map(i=>({src:i.getAttribute('href'),loaded:i.dataset.loaded==='1',displayCrop:i.parentElement.getAttribute('viewBox')})));imageChecks.push({screenshot:name,images:images.concat(svgPhotos)});await page.screenshot({path:path.join(artifacts,name),fullPage:true});
 }
 async function fit(page,label){
  try {
  await page.evaluate(()=>document.fonts.ready);
  const x=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth}));assert(x.doc<=x.width+1,label+' horizontal overflow');
  if(x.width<=760){
   const controls=await page.locator((await page.locator('#detail[open]').count()?'#detail[open] ':'')+'button:visible, '+(await page.locator('#detail[open]').count()?'#detail[open] ':'')+'a.btn:visible, '+(await page.locator('#detail[open]').count()?'#detail[open] ':'')+'select:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.trim().slice(0,70),width:r.width,height:r.height,clipped:n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1};}));
   assert(controls.length,label+' controls found');assert(controls.every(n=>n.width>=43.9&&n.height>=43.9),label+' targets under 44px: '+JSON.stringify(controls.filter(n=>n.width<43.9||n.height<43.9)));assert(controls.every(n=>!n.clipped),label+' clipped control text: '+JSON.stringify(controls.filter(n=>n.clipped)));
   const titles=await page.locator('.vcard h3:visible,.lcard h3:visible,.stat span:visible').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,fontSize:parseFloat(getComputedStyle(n).fontSize),width:n.clientWidth,height:n.clientHeight,scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight,clipped:n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1})));assert(titles.every(n=>!n.clipped&&n.fontSize>=12),label+' title/category legibility: '+JSON.stringify(titles.filter(n=>n.clipped||n.fontSize<12)));
   const cards=await page.locator('.vcard:visible').evaluateAll(nodes=>nodes.map(n=>{const b=n.querySelector('.body').getBoundingClientRect(),m=n.querySelector('.media').getBoundingClientRect(),a=n.querySelector('.card-actions').getBoundingClientRect();return {bodyWidth:b.width,mediaWidth:m.width,mediaHeight:m.height,actionsWidth:a.width,cardWidth:n.clientWidth};}));assert(cards.every(c=>c.mediaHeight<=101&&c.bodyWidth>c.mediaWidth&&c.actionsWidth>=c.cardWidth-2),label+' business content before compact media/full-width actions');
   const kufiLoaded=await page.evaluate(()=>[...document.fonts].some(f=>f.family.includes('Noto Kufi Arabic')&&f.status==='loaded')&&document.fonts.check('700 16px "Noto Kufi Arabic"','دليل الفرص'));assert(kufiLoaded,label+' Noto Kufi heading font not loaded');
   mobileChecks.push({label,viewport:x.width,controls:controls.length,minWidth:Math.min(...controls.map(n=>n.width)),minHeight:Math.min(...controls.map(n=>n.height)),noTextClipping:true,titles,font:await page.locator('.brand-name').evaluate(n=>getComputedStyle(n).fontFamily),kufiLoaded});
  }
  } catch(error) {
   const name='failure-'+label.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase();
   const measurements=await page.evaluate(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth,fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),elements:[...document.querySelectorAll('.stat,.stat b,.stat span,.vcard h3,.lcard h3,button,a.btn,select')].filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {tag:n.tagName,className:n.className,text:n.textContent.trim().slice(0,120),box:{x:r.x,y:r.y,width:r.width,height:r.height},client:{width:n.clientWidth,height:n.clientHeight},scroll:{width:n.scrollWidth,height:n.scrollHeight},fontSize:s.fontSize,lineHeight:s.lineHeight,display:s.display,flexShrink:s.flexShrink};})}));
   fs.writeFileSync(path.join(artifacts,name+'.json'),JSON.stringify(measurements,null,2));await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true});throw error;
  }
 }
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:800}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForSelector('#q-branch');await fit(page,'Entry '+viewport.width);
  if(viewport.width>760){const form=await page.locator('.start-card').boundingBox(),art=await page.locator('.entry-visual').boundingBox();assert(form.x>art.x,'Entry form must be right of artwork');}
  assert(await page.locator('.brand-logo').evaluate(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('body').getByText('إعداد: خالد الماطر',{exact:true}).count(),1);
  assert.equal(await page.locator('#site-head').getByText('إعداد: خالد الماطر',{exact:true}).count(),0);assert.equal(await page.locator('#site-foot').getByText('إعداد: خالد الماطر',{exact:true}).count(),1);assert.equal(await page.locator('.tagline').innerText(),'التنفيــذ … النتائــج … الأثــر');assert.equal(await page.locator('.entry-form-heading p').count(),0);assert.equal(await page.getByText('خطوتك الأولى',{exact:true}).count(),0);assert.equal(await page.locator('.entry-form-heading h2').innerText(),'اختر مدينتك وفرعك');const footer=await page.locator('#site-foot').evaluate(n=>{const a=n.querySelector('.footer-credit').getBoundingClientRect(),b=n.querySelector('.footer-updated').getBoundingClientRect();return {creditCenter:a.x+a.width/2,updateCenter:b.x+b.width/2,updateAlign:getComputedStyle(n.querySelector('.footer-updated')).textAlign};});assert(footer.updateCenter<footer.creditCenter);assert.equal(footer.updateAlign,'left');const head=await page.locator('.head-main').evaluate(n=>{const a=n.querySelector('.head-title').getBoundingClientRect(),b=n.querySelector('.brand-logo').getBoundingClientRect();return {titleCenter:a.x+a.width/2,logoCenter:b.x+b.width/2};});assert(Math.abs(head.titleCenter-viewport.width/2)<3);assert(head.logoCenter>head.titleCenter);
  assert.equal(await page.locator('#site-foot').getByText('مصادر الصور',{exact:true}).count(),0);assert.equal(await page.locator('.decorative-caption:visible,.image-caption:visible').count(),0);assert.equal(await page.locator('.brand-name').count(),1);assert.equal(await page.locator('img[src*="entry-architecture"]').count(),0);
  await page.waitForSelector('.entry-tower-photo image[data-loaded="1"]',{state:'attached'});
  await capture(page,'entry-'+viewport.width+'.png');
  await page.fill('#q-emp','خالد');await page.fill('#q-branch','243');assert(await page.locator('#go-branch').isEnabled());await page.click('#go-branch');await page.waitForSelector('.stat');assert.equal(await page.locator('.stat').count(),6);assert.equal(await page.locator('body').getByText('إعداد: خالد الماطر',{exact:true}).count(),1);assert.equal(await page.locator('#site-foot').getByText('إعداد: خالد الماطر',{exact:true}).count(),1);
  assert.equal(await page.locator('.selfbuild-link').count(),0,'Riyadh has no self-build category');await page.goto(origin+'/#b'+selfbuildBranch.c);await page.waitForSelector('.stat');await page.click('.selfbuild-link');assert.equal(await page.locator('#content h2').innerText(),'البناء الذاتي');assert.equal(await page.locator('.stat').count(),6);assert(await page.locator('#scope-select').isDisabled());await fit(page,'Self-build '+viewport.width);await capture(page,'selfbuild-'+viewport.width+'.png');await page.fill('#q-sec','__no_matching_record__');assert(await page.locator('.selfbuild-link').isVisible());assert.equal(await page.locator('.empty h3').innerText(),'لا نتائج مطابقة');await page.goto(origin+'/#b243');await page.waitForSelector('.stat');assert.equal(await page.locator('.selfbuild-link').count(),0);await page.click('[data-tab="opps"]');
  assert.equal(await page.locator('[data-explore],[data-scope]').count(),0);assert(await page.locator('#scope-select').isVisible());
  assert.equal(await page.locator('[data-tab="nhc"] .num').innerText(),expectedEastNHC+' من '+expectedCityNHC);assert((await page.locator('[data-tab="nhc"] .num').getAttribute('aria-label')).includes('في الرياض'));await fit(page,'Category counts '+viewport.width);
  const boxes=await page.locator('.stat').evaluateAll(a=>a.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));assert.equal(new Set(boxes.map(x=>Math.round(x.y))).size,2);assert.equal(new Set(boxes.map(x=>Math.round(x.x))).size,3);
  await page.click('[data-tab="nhc"]');let qa=await page.evaluate(()=>window.__rogQA());assert.equal(qa.sections.nhc.length,expectedEastNHC);assert.equal(await page.locator('.nhc-count-summary').innerText(),expectedEastNHC+' من '+expectedCityNHC+' في الرياض');await page.click('[data-nhc-view="city"]');qa=await page.evaluate(()=>window.__rogQA());assert.equal(qa.sections.nhc.length,expectedCityNHC);assert.equal(await page.locator('.nhc-count-summary').innerText(),expectedCityNHC+' من '+expectedCityNHC+' في الرياض');await fit(page,'NHC '+viewport.width);
  assert(await page.locator('[data-nhc-view="sector"]').isVisible());assert(await page.locator('[data-nhc-view="city"]').isVisible());await page.locator('[data-anchor="destination-contacts"]').first().click();await page.waitForSelector('#detail[open] #destination-contacts');await fit(page,'NHC contacts '+viewport.width);await page.keyboard.press('Escape');
  await capture(page,'results-nhc-'+viewport.width+'.png');
  await page.click('[data-tab="cars"]');assert.equal(await page.locator('#scope-select').inputValue(),'qadisiyah');qa=await page.evaluate(()=>window.__rogQA());assert.equal(qa.sections.cars.length,33);await page.selectOption('#scope-select','shifa');qa=await page.evaluate(()=>window.__rogQA());assert.equal(qa.sections.cars.length,15);
  await page.fill('#q-sec','__no_matching_record__');await page.waitForSelector('.empty');await page.click('[data-tab="companies"]');assert(await page.locator('#scope-select').isDisabled());assert.equal(await page.locator('#q-sec').inputValue(),'');await page.click('[data-tab="cars"]');assert.equal(await page.locator('#q-sec').inputValue(),'__no_matching_record__');assert.equal(await page.locator('#scope-select').inputValue(),'shifa');
  await page.fill('#q-sec','');await page.selectOption('#scope-select','qadisiyah');await capture(page,'results-cars-'+viewport.width+'.png');await fit(page,'Cars '+viewport.width);
  await page.click('[data-tab="opps"]');await page.waitForSelector('.sec-head');await fit(page,'Availability '+viewport.width);await capture(page,'results-available-'+viewport.width+'.png');await page.click('[data-tab="projects"]');if((await page.evaluate(()=>window.__rogQA())).bankApprovalPending){assert.equal(await page.locator('[data-tab="projects"] .num').innerText(),'—');assert(await page.locator('.approval-pending').isVisible());assert.equal(await page.locator('.vcard').count(),0);assert(!(await page.locator('#content').innerText()).includes('0 مشاريع'));}await fit(page,'Approved '+viewport.width);await capture(page,'results-approved-'+viewport.width+'.png');
  if(await page.locator('#content .vcard [data-detail]').count()){await page.locator('#content .vcard [data-detail]').first().click();await page.waitForSelector('#detail[open]');assert(await page.locator('#detail').evaluate(n=>n.querySelector('.primary-contact-actions').compareDocumentPosition(n.querySelector('.d-media'))&Node.DOCUMENT_POSITION_FOLLOWING));await fit(page,'Project detail '+viewport.width);await capture(page,'detail-approved-'+viewport.width+'.png');await page.keyboard.press('Escape');}
  checks.push({viewport:viewport.width,realData:true,sixCards:true,columns:3,rows:2,nhcScope:true,qadisiyah33:true,shifa15:true,perCategoryState:true,noOverflow:true});await context.close();
 }
 // In-memory proof records exercise the gated views without pretending existing data is audited.
 const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
 await page.route('**/data/meta.json?*',async route=>{const meta=JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8'));meta.bankApprovalCatalog={status:'verified',source:'https://example.invalid/qa-only-bank-inventory',checkedAt:'2026-10-16'};await route.fulfill({json:meta});});
 await page.route('**/data/projects.json?*',async route=>{const rows=JSON.parse(fs.readFileSync(path.join(root,'data/projects.json'),'utf8'));for(const o of rows){o.availability={status:'available',source:'https://example.invalid/qa-only',checkedAt:'2026-10-16'};o.bankApproval={status:'verified',sourceType:'bank_approved_inventory',code:'INTERNAL-QA-ONLY',source:'https://example.invalid/qa-only',checkedAt:'2026-10-16'};}const linked=rows.find(o=>o.city==='الرياض'&&(o.sectors||[o.sec]).includes('شرق'));Object.assign(linked,{destinationName:'الفرسان',destinationCity:'الرياض',destinationSource:'https://example.invalid/qa-only-destination',phoneSource:'https://example.invalid/qa-only-contact'});await route.fulfill({json:rows});});
 await page.goto(origin+'/#b243');await page.waitForSelector('.stat');await page.click('[data-tab="opps"]');assert.equal(await page.locator('.vcard').count(),12);await page.click('[data-more="opps"]');assert.equal(await page.locator('.vcard').count(),24);
 await page.locator('.vcard').nth(15).locator('[data-detail]').click();await page.waitForSelector('#detail[open]');assert(!await page.locator('#detail').innerText().then(x=>x.includes('INTERNAL-QA-ONLY')));await page.keyboard.press('Escape');assert.equal(await page.locator('#detail[open]').count(),0);assert.equal(await page.locator('.vcard').count(),24);
 const query=await page.locator('.vcard h3').first().innerText();await page.fill('#q-sec',query);await page.locator('.vcard [data-detail]').first().click();await page.waitForSelector('#detail[open]');const before=await page.evaluate(()=>({scroll:scrollY,qa:JSON.stringify(window.__rogQA()),query:document.querySelector('#q-sec').value}));await page.goBack();assert.equal(await page.locator('#detail[open]').count(),0);assert.equal(await page.locator('#q-sec').inputValue(),before.query);assert.equal(await page.evaluate(()=>JSON.stringify(window.__rogQA())),before.qa);assert(Math.abs((await page.evaluate(()=>scrollY))-before.scroll)<3);await page.goForward();assert.equal(await page.locator('#detail[open]').count(),1);await page.click('#detail .back-results');assert.equal(await page.locator('#detail[open]').count(),0);
 await page.fill('#q-sec','');await page.click('[data-tab="projects"]');assert.equal(await page.locator('.vcard').count(),12);await page.locator('.vcard [data-detail]').first().click();await page.waitForSelector('#detail[open]');assert(await page.locator('#detail').innerText().then(x=>x.includes('موثق وفق المصدر')));assert(!await page.locator('#detail').innerText().then(x=>x.includes('INTERNAL-QA-ONLY')));await page.keyboard.press('Escape');
 await page.click('[data-tab="nhc"]');const fursan=page.locator('.vcard').filter({has:page.locator('h3',{hasText:'الفرسان'})});await fursan.locator('[data-anchor="destination-projects"]').click();await page.waitForSelector('#detail[open] #destination-projects .vcard');await page.locator('#destination-projects .vcard [data-detail]').first().click();await page.waitForSelector('#detail[open] .back-results');assert((await page.locator('#detail .back-results').innerText()).includes('العودة إلى الوجهة'));await page.locator('#detail .back-results').click();await page.waitForSelector('#detail[open] #destination-projects');await page.keyboard.press('Escape');assert.equal(await page.locator('#detail[open]').count(),0);
 checks.push({fixturesOnlyInMemory:true,initial12:true,more24:true,modalEscape:true,browserBackForward:true,filtersAndScrollPreserved:true,internalProjectCodeHidden:true,nhcExactProjectAndNestedBack:true});await context.close();
 // Actual entry events for internal centers and data-only cities, on desktop and narrow mobile.
 const entryCityNames=['أحد رفيدة','الروضة','ضمد','بيش'];
 const entrySource=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
 const entryHeroMatch=entrySource.match(/var GENERATED_CITY_IDENTITIES = (\{[\s\S]*?\});/);
 assert(entryHeroMatch,'Generated city identity map is required for city-only browsing');
 const entryCityHeroes=require('vm').runInNewContext('('+entryHeroMatch[1]+')');
 for(const width of [1440,390,320]){
  const entryContext=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const entryPage=await entryContext.newPage();entryPage.on('pageerror',e=>pageErrors.push(e.message));
  for(const code of ['397','197']){
   const center=branchData.find(b=>b.c===code);assert(center&&center.codeStatus==='local_internal_reference');
   await entryPage.goto(origin);await entryPage.waitForSelector('#q-branch');
   await entryPage.fill('#q-branch',center.n);await entryPage.locator('[data-code="'+code+'"]').click();
   assert.equal(await entryPage.locator('#q-branch').inputValue(),center.n);
   assert(await entryPage.locator('#go-branch').isEnabled());await fit(entryPage,'Internal center selection '+code+' '+width);
   await entryPage.click('#go-branch');await entryPage.waitForSelector('.stat');
   assert((await entryPage.locator('.hero-branch').innerText()).includes('مرجع داخلي '+code));
   assert.equal((await entryPage.evaluate(()=>window.__rogQA())).branch,code);
   await entryPage.reload();await entryPage.waitForSelector('.stat');assert.equal((await entryPage.evaluate(()=>window.__rogQA())).branch,code);
   checks.push({internalCenterNameSelection:code,width,entryEnabled:true,reloadHash:true});
  }
  for(const city of entryCityNames){
   await entryPage.goto(origin);await entryPage.waitForSelector('#q-city');await entryPage.selectOption('#q-city',city);
   assert.equal(await entryPage.locator('.branch-item').count(),0,'Do not invent branch rows for '+city);
   const cityButton=entryPage.locator('[data-browse-city="'+city+'"]');assert(await cityButton.isVisible());
   await fit(entryPage,'City browse button '+city+' '+width);await cityButton.click();await entryPage.waitForSelector('.stat');
   assert.equal(await entryPage.locator('.hero-branch').innerText(),'تصفح المدينة بدون فرع');
   assert.equal(await entryPage.locator('.city-hero').getAttribute('aria-label'),city);
   const qa=await entryPage.evaluate(()=>window.__rogQA());assert.equal(qa.branch,'');assert.equal(qa.scope,'city');
   assert(['offices','cars','companies','projects','opps','nhc'].some(k=>qa.sections[k].length>0));
   const cityHero=entryPage.locator('.city-hero img');await cityHero.evaluate(i=>i.decode());
   const expectedCityHero=city==='ضمد'?'assets/images/city-neutral.webp':entryCityHeroes[city].src;
   assert.equal(await cityHero.getAttribute('src'),expectedCityHero);assert(await cityHero.evaluate(i=>i.complete&&i.naturalWidth>0));
   await fit(entryPage,'City only results '+city+' '+width);await capture(entryPage,'city-only-'+entryCityNames.indexOf(city)+'-'+width+'.png');
   const route=entryPage.url();assert(route.includes('#city='));await entryPage.reload();await entryPage.waitForSelector('.stat');
   assert.equal(await entryPage.locator('.hero-branch').innerText(),'تصفح المدينة بدون فرع');
   await entryPage.click('[data-act="change"]');await entryPage.waitForSelector('#q-branch');
   await entryPage.fill('#q-branch',city);assert(await entryPage.locator('[data-browse-city="'+city+'"]').isVisible());
   await entryPage.goto(route);await entryPage.waitForSelector('.stat');assert.equal((await entryPage.evaluate(()=>window.__rogQA())).scope,'city');
   checks.push({cityOnlyEntry:city,width,noInventedCode:true,ownCityHeroLoaded:true,mobileControlsFit:true,initialAndReturnRoute:true});
  }
  await entryContext.close();
 }
 // All city-specific real-data heroes, with no cross-city substitution.
 const appSource=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
 const archived=appSource.match(/var CITY_IMAGE_ARCHIVE = (\{[\s\S]*?\});/);assert(archived);
 const archiveRows=JSON.parse(archived[1]);
 const activeHeroMatch=appSource.match(/var CITY_HERO_ASSETS = (\{[\s\S]*?\});/);assert(activeHeroMatch);
 const activeHeroes=require('vm').runInNewContext('('+activeHeroMatch[1]+')',{CITY_IMAGE_ARCHIVE:archiveRows});
 Object.assign(activeHeroes,entryCityHeroes);
 const expectedCityHeroes=Object.fromEntries(Object.entries(activeHeroes).map(([city,asset])=>[city,asset.src]));
 const displayedCities=[...new Set(branchData.map(x=>x.city))];
 for(const city of displayedCities)assert(expectedCityHeroes[city],'Missing own-city image: '+city);
 for(const width of [1440,390]){
  const cx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const cp=await cx.newPage();cp.on('pageerror',e=>pageErrors.push(e.message));
  for(const city of displayedCities){
   const b=branchData.find(x=>x.city===city),asset=expectedCityHeroes[city];
   await cp.goto(origin+'/#b'+b.c);await cp.waitForSelector('.stat');
   const hero=cp.locator('.city-hero img');await hero.waitFor();await hero.evaluate(i=>i.decode());assert.equal(await hero.getAttribute('src'),asset);assert(await hero.evaluate(i=>i.complete&&i.naturalWidth>0));
   await fit(cp,'City '+city+' '+width);await cp.locator('.city-hero').screenshot({path:path.join(artifacts,'city-hero-'+b.c+'-'+width+'.png')});checks.push({city,width,exactCityHero:true,realData:true});
  }
  await cp.goto(origin);await cp.waitForSelector('#q-city');await cp.selectOption('#q-city','جازان');
  assert.equal(await cp.locator('.branch-item').filter({hasText:'مركز مبيعات جازان'}).count(),1);
  await cp.locator('.branch-item').filter({hasText:'مركز مبيعات جازان'}).click();await cp.click('#go-branch');await cp.waitForSelector('.hero-branch');
  assert((await cp.locator('.hero-branch').innerText()).includes('مركز مبيعات جازان'));assert(cp.url().endsWith('#b711'));checks.push({jazanSalesCenter711:true,width,oneUnifiedCityList:true});
  await cp.goto(origin);await cp.waitForSelector('#q-city');await cp.selectOption('#q-city','الدمام');
  assert(!/[·]\s*(شرق|غرب|شمال|جنوب|وسط)/.test(await cp.locator('#branch-list').innerText()));
  await cx.close();
 }
 // Missing source authority is a pending catalog, never an advertised zero.
 const pendingContext=await browser.newContext({viewport:{width:390,height:844}});const pendingPage=await pendingContext.newPage();pendingPage.on('pageerror',e=>pageErrors.push(e.message));
 await pendingPage.route('**/data/meta.json?*',async route=>{const meta=JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8'));meta.bankApprovalCatalog={status:'awaiting_original_source'};await route.fulfill({json:meta});});
 await pendingPage.goto(origin+'/#b243');await pendingPage.waitForSelector('.stat');await pendingPage.click('[data-tab="projects"]');assert.equal(await pendingPage.locator('[data-tab="projects"] .num').innerText(),'—');assert.equal(await pendingPage.locator('.approval-pending h3').innerText(),'بانتظار قائمة المشاريع المعتمدة');assert.equal(await pendingPage.locator('.vcard').count(),0);assert(!(await pendingPage.locator('#content').innerText()).includes('0 مشاريع'));const pendingQA=await pendingPage.evaluate(()=>window.__rogQA());assert(pendingQA.bankApprovalPending);assert.equal(pendingQA.releaseCounts.approved,null);await pendingPage.click('[data-tab="opps"]');assert.equal(await pendingPage.locator('.approval-pending').count(),0);checks.push({pendingCatalogInMemory:true,pendingDashNotZero:true,marketAvailabilityIndependent:true});await pendingContext.close();
 // In-scope unknowns are pending, while a genuinely empty scope remains zero.
 // Branch entry may select another populated category, so explicitly open the category under test.
 const reviewContext=await browser.newContext({viewport:{width:320,height:800}});const reviewPage=await reviewContext.newPage();reviewPage.on('pageerror',e=>pageErrors.push(e.message));let reviewRows=[{id:'qa-pending-only',n:'QA_UNVERIFIED_NOT_PUBLIC',city:'الرياض',sec:'شرق'}];
 await reviewPage.route('**/data/meta.json?*',route=>{const meta=JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8'));meta.bankApprovalCatalog={status:'verified',source:'https://example.invalid/qa-only-bank',checkedAt:'2026-10-16'};return route.fulfill({json:meta});});
 await reviewPage.route('**/data/projects.json?*',route=>route.fulfill({json:reviewRows}));await reviewPage.route('**/data/opportunities.json?*',route=>route.fulfill({json:[]}));
 await reviewPage.goto(origin+'/#b243');await reviewPage.waitForSelector('.stat');await reviewPage.click('[data-tab="opps"]');assert.equal(await reviewPage.locator('[data-tab="opps"]').getAttribute('aria-pressed'),'true');assert.equal(await reviewPage.locator('[data-tab="opps"] .num').innerText(),'—');assert(await reviewPage.locator('.verification-pending').isVisible());const reviewQA=await reviewPage.evaluate(()=>window.__rogQA());assert.equal(reviewQA.sections.opps.length,0);assert.equal(reviewQA.pendingCounts.opps,1);assert.equal(await reviewPage.locator('.vcard').count(),0);assert(!(await reviewPage.locator('body').innerText()).includes('QA_UNVERIFIED_NOT_PUBLIC'));await fit(reviewPage,'Pending verification 320');await reviewPage.fill('#q-sec','no_matching_name');assert.equal(await reviewPage.locator('.empty h3').innerText(),'لا نتائج مطابقة');reviewRows=[];await reviewPage.reload();await reviewPage.waitForSelector('.stat');await reviewPage.click('[data-tab="opps"]');assert.equal(await reviewPage.locator('[data-tab="opps"]').getAttribute('aria-pressed'),'true');assert.equal(await reviewPage.locator('[data-tab="opps"] .num').innerText(),'0');assert.equal(await reviewPage.locator('.verification-pending').count(),0);checks.push({inScopeReviewFixtureOnly:true,pendingDashNotInventory:true,trueEmptyZero:true,queryNoMatchDistinct:true});await reviewContext.close();
 // Fault injection: official photos and both bundled property images unavailable.
 const imageFaultContext=await browser.newContext({viewport:{width:390,height:844}});const imageFaultPage=await imageFaultContext.newPage();
 imageFaultPage.on('pageerror',e=>pageErrors.push(e.message));
 await imageFaultPage.route('**/*',route=>{const req=route.request(),u=req.url();return req.resourceType()==='image'&&(u.includes('/modern-apartments-illustrative.webp')||u.includes('/modern-villa-illustrative.webp')||!u.startsWith(origin))?route.abort():route.continue();});
 await imageFaultPage.goto(origin+'/#b243');await imageFaultPage.waitForSelector('.stat');await imageFaultPage.click('[data-tab="opps"]');await imageFaultPage.locator('#content img[data-generic="1"]').evaluateAll(nodes=>nodes.forEach(i=>i.loading='eager'));
 await imageFaultPage.waitForFunction(()=>{const list=[...document.querySelectorAll('#content img[data-generic="1"]')];return list.length>0&&list.every(i=>i.src.startsWith('data:image/webp;base64,')&&i.complete&&i.naturalWidth>0);});
 assert.equal(await imageFaultPage.locator('.image-caption:visible,.decorative-caption:visible').count(),0);
 checks.push({actualBrowserImageFailures:true,officialAndLocalImagesBlocked:true,embeddedModernImageLoaded:true,noVisibleCaptions:true});await imageFaultContext.close();
 assert.deepEqual(pageErrors,[]);await browser.close();await new Promise(r=>server.close(r));const result={ok:true,checks,pageErrors,imageChecks,mobileChecks,screenshots:fs.readdirSync(artifacts).filter(x=>x.endsWith('.png'))};fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(async e=>{console.error(e.stack||e);fs.writeFileSync(path.join(artifacts,'browser-failure.txt'),String(e.stack||e));if(browser)await browser.close();server.close();process.exitCode=1;});
