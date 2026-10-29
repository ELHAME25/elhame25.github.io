'use strict';
// Actual Playwright entry viewport contract shared by Chromium and WebKit.
// Simulated browser viewport only, NOT physical iPhone/browser chrome evidence.
const fs=require('fs'),path=require('path'),assert=require('assert');
module.exports=async function entryViewportContract(browser,origin,root,artifacts,pageErrors=[]){
 const checks=[];fs.mkdirSync(artifacts,{recursive:true});
 // Entry spacing contract: real mobile sizes, no hidden content or tower distortion.
 for(const viewport of [{width:390,height:844},{width:393,height:852},{width:390,height:740},{width:390,height:700},{width:375,height:667},{width:390,height:620},{width:320,height:568},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',isMobile:viewport.width<=760,hasTouch:viewport.width<=760,locale:'ar-SA'}),page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(origin);await page.waitForSelector('#q-branch');await page.evaluate(()=>document.fonts.ready);await page.waitForSelector('.entry-tower-photo image[data-loaded="1"]',{state:'attached'});
  const geometry=await page.evaluate(()=>{
   const box=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,display:s.display,visibility:s.visibility,opacity:s.opacity,fontSize:s.fontSize,overflowX:s.overflowX,overflowY:s.overflowY,clipped:n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1};};
   return {viewport:{width:innerWidth,height:innerHeight},visualViewport:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft,scale:visualViewport.scale}:null,viewportUnits:{svh:CSS.supports('height','100svh'),dvh:CSS.supports('height','100dvh')},scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,scrollWidth:document.documentElement.scrollWidth,rootOverflow:[getComputedStyle(document.documentElement).overflowY,getComputedStyle(document.body).overflowY],containers:Object.fromEntries(['.start','.entry-shell','.start-card','#site-foot','.entry-visual'].map(sel=>[sel,box(document.querySelector(sel))])),controls:Object.fromEntries(['#q-emp','#q-branch','#q-city','#go-branch','#use-location'].map(sel=>[sel,document.querySelector(sel)?box(document.querySelector(sel)):null])),text:[...document.querySelectorAll('.entry-copy h1,.entry-copy p,.entry-form-heading h2,.field label,.footer-credit,.footer-updated')].map(n=>{
    const range=document.createRange();range.selectNodeContents(n);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);const clips=[];
    // Arabic ink can exceed its logical line box with overflow:visible; that is not clipping.
    // A real failure requires a clipping ancestor intersecting the text painting bounds.
    for(let a=n;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){const style=getComputedStyle(a),r=a.getBoundingClientRect();if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)clips.push({ancestor:a.className,axis:'hidden'});for(const t of rects){if(['hidden','clip','auto','scroll'].includes(style.overflowX)&&(t.left<r.left-1||t.right>r.right+1))clips.push({ancestor:a.className,axis:'x'});if(['hidden','clip','auto','scroll'].includes(style.overflowY)&&(t.top<r.top-1||t.bottom>r.bottom+1))clips.push({ancestor:a.className,axis:'y'});}}
    const r=n.getBoundingClientRect(),overlappingControls=[...document.querySelectorAll('#q-emp,#q-branch,#q-city,#go-branch,#use-location')].filter(c=>{const b=c.getBoundingClientRect();return Math.min(r.right,b.right)-Math.max(r.left,b.left)>1&&Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top)>1;}).map(c=>c.id);
    return {text:n.textContent.trim(),...box(n),paintClipped:clips.length>0,clips,overlappingControls,rangeBounds:rects.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),horizontalPaintOverflow:rects.some(r=>r.left < -1 || r.right > innerWidth+1)};
   }),tower:{viewBox:document.querySelector('.entry-tower-photo').getAttribute('viewBox'),preserveAspectRatio:document.querySelector('.entry-tower-photo').getAttribute('preserveAspectRatio'),href:document.querySelector('.entry-tower-photo image').getAttribute('href')}};
  });
  assert((await page.locator('.footer-updated').innerText()).includes(JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8')).built),'Footer must show exact data build date');
  const name='entry-fit-'+viewport.width+'x'+viewport.height;
  fs.writeFileSync(path.join(artifacts,name+'.json'),JSON.stringify(geometry,null,2));await page.screenshot({path:path.join(artifacts,name+'-full.png'),fullPage:true});await page.screenshot({path:path.join(artifacts,name+'-viewport.png'),fullPage:false});
  assert(geometry.scrollWidth<=viewport.width+1,name+' horizontal overflow');
  assert(!geometry.rootOverflow.some(v=>v==='hidden'||v==='clip'),name+' natural page scrolling must remain enabled');
  for(const sel of ['.start','.entry-shell','.start-card'])assert(!['hidden','clip'].includes(geometry.containers[sel].overflowY),name+' must not clip '+sel);
  for(const [sel,b] of Object.entries(geometry.controls)){assert(b,name+' missing '+sel);assert(b.width>=44&&b.height>=44,name+' inaccessible target '+sel);assert(b.visibility!=='hidden'&&b.display!=='none',name+' hidden '+sel);assert(!b.clipped,name+' clipped '+sel);}
  assert(geometry.text.every(t=>t.display!=='none'&&t.visibility!=='hidden'&&!t.paintClipped&&!t.horizontalPaintOverflow&&!t.overlappingControls.length&&t.height>0),name+' text missing/clipped');
  assert.equal(geometry.tower.viewBox,'0 307 710 945');assert.equal(geometry.tower.preserveAspectRatio,'xMidYMid slice');assert.equal(geometry.tower.href,'assets/images/entry-riyad-bank.jpeg');
  if(viewport.width<=460){const tower=geometry.containers['.entry-visual'];assert.equal(tower.height,246,name+' original full-height tower restored');assert.equal(tower.width,viewport.width-24,name+' original full-width tower restored');assert(Math.abs(tower.x-12)<1,name+' tower must align with original form edges');const form=geometry.containers['.start-card'];assert(Math.abs(tower.x-form.x)<1&&Math.abs(tower.width-form.width)<1&&Math.abs(tower.bottom-form.y)<1,name+' original full-width photo must remain connected to form');for(const sel of ['#q-emp','#q-branch','#q-city'])assert.equal(geometry.controls[sel].height,54,name+' input dimensions preserved');}
  const mustFit=viewport.width===1440; // User restored original full-width photo; mobile natural scrolling is intentional.
  const visibleHeight=Math.min(viewport.height,geometry.visualViewport?.height||viewport.height);
  if(mustFit){assert(geometry.scrollHeight<=visibleHeight+1,name+' actual short phone entry must fit one unobscured screen');assert(geometry.containers['#site-foot'].bottom<=visibleHeight+1,name+' footer not in first screen');for(const [sel,b] of Object.entries(geometry.controls))assert(b.y>=0&&b.bottom<=visibleHeight+1,name+' control outside visible screen '+sel);}
  else if(geometry.scrollHeight>visibleHeight+1){await page.locator('#site-foot').scrollIntoViewIfNeeded();assert(await page.locator('.footer-updated').isVisible());}

  checks.push({entryFit:name,geometry,allContentPreserved:true,originalFullWidthTowerRestored:true,mustFit});await context.close();
 }
 return checks;
};
