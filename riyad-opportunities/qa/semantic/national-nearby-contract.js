#!/usr/bin/env node
'use strict';
/* Independent semantic candidate contract. Offline, simulated DOM/GPS, no external requests,
   no real user position, no production edits. It is NOT live/browser QA evidence. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(process.argv[2]||process.env.QA_REPO_ROOT||path.join(__dirname,'../..'));
const out=path.resolve(process.argv[3]||path.join(__dirname,'national-nearby-report.json'));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'retention-fixture.json')));
const source=fs.readFileSync(process.env.SEMANTIC_APP_SOURCE||path.join(root,'assets/app.js'),'utf8');
const frozenFiles=Object.fromEntries(['config/site.json',...fs.readdirSync(path.join(root,'data')).filter(x=>x.endsWith('.json')).map(x=>'data/'+x)].map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const rawBranches=JSON.parse(fs.readFileSync(path.join(root,'data/branches.json')));
const expected={qadisiyah:[...fixture.groups.qadisiyah,...(fixture.reviewedAdditions?.qadisiyah||[])].map(x=>x.id).sort(),shifa:[...fixture.groups.shifa,...(fixture.reviewedAdditions?.shifa||[])].map(x=>x.id).sort()};
const report={at:new Date().toISOString(),root,appSha256:crypto.createHash('sha256').update(source).digest('hex'),dataSha256:Object.fromEntries(Object.entries(frozenFiles).map(([name,content])=>[name,crypto.createHash('sha256').update(content).digest('hex')])),mode:'independent-national-nearby-contract',realBrowser:false,liveProduction:false,externalCalls:0,realPositionRequested:false,checks:[],failures:[],observations:[]};
function check(name,fn){try{const details=fn();report.checks.push({name,ok:true,...details});}catch(e){report.checks.push({name,ok:false});report.failures.push({name,message:e.message});}}
async function harness(){
 const els={},docHandlers={},geoPending=[],requests=[],shares=[];class El{constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.disabled=false;this.hidden=false;this.handlers={};this.classList={contains:()=>false};}get isConnected(){return this.id==='app'||this.id==='site-head'||this.id==='site-foot'||!!(els.app&&els.app.innerHTML.includes('id=\"'+this.id+'\"'));}addEventListener(k,f){this.handlers[k]=f;}querySelectorAll(){return [];}querySelector(){return null;}setAttribute(){}getAttribute(){return null;}focus(){}remove(){}}
 const el=id=>els[id]||(els[id]=new El(id));const document={body:{appendChild(){}},getElementById(id){return id==='site-config'?null:el(id)},querySelectorAll(){return []},querySelector(){return null},addEventListener(k,f,c){if(!c)docHandlers[k]=f;},createElement(){return new El('new')}};
 const location={hash:'',pathname:'/',search:'',href:'http://offline.invalid/'};const window={scrollTo(){},addEventListener(){},location};
 const fetch=async u=>{requests.push(u);assert(!/^https?:/i.test(u),'External requests prohibited');const f=String(u).split('?')[0];return {ok:f in frozenFiles,json:async()=>JSON.parse(frozenFiles[f])}};
 const replacement=`window.__SEMANTIC={data:()=>D,state:()=>S,renderStart,selectBranch,renderBranch,compute,scopeOptions,destinationGroups,itemsFor,defaultCarArea,nearestBranch,intro,excludedCarReportRecord,recordLocations,multiLocationRecord,locationInformation,dist,distanceFromBranch,card,reg,openDetail,shareItem}; boot();`;
 assert(source.includes('  boot();'),'Instrumentation anchor present');
 vm.runInNewContext(source.replace('  boot();',replacement),{document,window,location,history:{replaceState(){},pushState(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},navigator:{share:async data=>{shares.push(data);},geolocation:{getCurrentPosition(success,error,options){geoPending.push({success,error,options});}}},fetch,setTimeout,clearTimeout,console,URL,Blob});
 for(let i=0;i<50&&!window.__SEMANTIC.data().branchByCode;i++)await new Promise(r=>setTimeout(r,10));
 const a=window.__SEMANTIC;assert(a.data().branchByCode,'Local boot succeeded');return {a,els,el,geoPending,requests,shares,clickGeo(){el('use-location').handlers.click({currentTarget:el('use-location')});},gps(lat,lon){assert(geoPending.length,'GPS callback must exist');geoPending.shift().success({coords:{latitude:lat,longitude:lon,accuracy:20}})},action(dataset){const t={dataset,hasAttribute(k){return k.replace(/^data-/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase()) in dataset},closest(){return this}};docHandlers.click({target:{closest(){return t}},preventDefault(){},stopImmediatePropagation(){}});}};
}

(async()=>{
 const h=await harness();
 const fixed=require('./national-nearby-fixture.json');
 for(const oracle of fixed.riyadhProjects){
  h.a.selectBranch(oracle.branch,true);h.a.state().scope='branch';h.a.state().radius=5;
  check('Fixed independent project membership '+oracle.branch,()=>{assert.deepEqual(h.a.compute().projects.items.map(x=>x.o.id).sort(),oracle.ids.slice().sort());});
  const first=h.a.compute().projects.items.map(x=>[x.o.id,x.d]);h.a.state().origin={lat:21.5,lon:39.2};
  check('Selected branch not user GPS determines project distances '+oracle.branch,()=>assert.deepEqual(h.a.compute().projects.items.map(x=>[x.o.id,x.d]),first));
 }
 // In-memory synthetic offices exercise every actual branch, without editing source datasets.
 // Different city, sector and pin precision are deliberate, fixed semantic oracles.
 for(const b of rawBranches){
  const st=h.a.state();st.branch=h.a.data().branchByCode[b.c];st.origin=null;st.scope='branch';st.radius=5;
  const valid=Number.isFinite(b.lat)&&Number.isFinite(b.lon), sector=['الرياض','جدة'].includes(b.city);
  const mk=(id,extra)=>Object.assign({id,n:id,city:b.city,nb:'حي اختبار مختلف',sec:b.sec,loc:'office',lat:valid?b.lat:null,lon:valid?b.lon:null},extra);
  const rows=[mk('near',{}),mk('district',{nb:b.nb||'',loc:'nb'}),mk('far',{lat:valid?b.lat+0.2:null}),mk('hq',{loc:'hq'}),mk('unknown',{locationVerificationStatus:'location_unverified'}),mk('cross-sector',{sec:b.sec==='شمال'?'جنوب':'شمال'}),mk('other-city',{city:'مدينة اختبار خارجية'})];
  const result=h.a.itemsFor('offices',b.sec,'branch',rows),ids=result.map(x=>x.o.id);
  check('Branch '+b.c+' precise local semantics and no false distances',()=>{
   assert(!ids.includes('other-city'));
   for(const x of result)if(['district','hq','unknown'].includes(x.o.id))assert.equal(x.d,null,x.o.id+' fabricated distance');
   if(valid&&sector){assert(ids.includes('near'));assert(ids.includes('cross-sector'));assert(!ids.includes('far'));assert(!ids.includes('hq'));assert(!ids.includes('unknown'));if(b.nb&&/^https?:\/\//.test(String(b.neighborhoodSource||'')))assert(ids.includes('district'));else assert(!ids.includes('district'));}
   else assert.deepEqual(ids.slice().sort(),rows.filter(x=>x.city===b.city).map(x=>x.id).sort(),'Nonsector/no-pin fallback must retain city inventory');
  });
  check('Branch '+b.c+' full city retains exact synthetic IDs',()=>assert.deepEqual(h.a.itemsFor('offices',b.sec,'city',rows).map(x=>x.o.id).sort(),rows.filter(x=>x.city===b.city).map(x=>x.id).sort()));
  check('Branch '+b.c+' outside city has only physical points',()=>{
   const external=h.a.itemsFor('offices',b.sec,'external',rows);assert.deepEqual(external.map(x=>x.o.id),valid?['other-city']:[]);
  });
 }

 h.a.state().branch={c:'qa',city:'الرياض',sec:'شرق',nb:'النسيم الشرقي',lat:24,lon:46};h.a.state().radius=5;h.a.state().origin={lat:0,lon:0};
 const delta=5/6371*180/Math.PI;
 const synthetic=[{id:'inside',n:'inside',city:'الرياض',sec:'غرب',nb:'آخر',loc:'office',lat:24+delta*(1-1e-7),lon:46},{id:'outside',n:'outside',city:'الرياض',sec:'شرق',nb:'آخر',loc:'office',lat:24+delta*(1+1e-7),lon:46},{id:'hood',n:'hood',city:'الرياض',nb:'حي النسيم الشرقي',loc:'nb',lat:24,lon:46},{id:'wrong-hood',n:'wrong',city:'الرياض',nb:'النسيم الغربي',loc:'nb',lat:24,lon:46},{id:'zero',n:'zero',city:'الرياض',nb:'آخر',loc:'office',lat:0,lon:0}];
 check('Independent 5km boundary and unverified branch district cannot admit centroid',()=>assert.deepEqual(h.a.itemsFor('offices','','branch',synthetic).map(x=>x.o.id),['inside']));
 h.a.state().branch.neighborhoodSource='https://example.org/verified-test-district';
 check('Explicit district source admits exact prefix-normalized neighborhood without distance',()=>{const a=h.a.itemsFor('offices','','branch',synthetic);assert.deepEqual(a.map(x=>x.o.id),['hood','inside']);assert.equal(a[0].d,null);});
 h.a.state().radius=10;
 check('Radius change admits farther physical site but never wrong district centroid',()=>assert.deepEqual(h.a.itemsFor('offices','','branch',synthetic).map(x=>x.o.id),['hood','inside','outside']));

 h.a.state().radius=5;
 const ordered=[{id:'other-sector-nearest',n:'a',city:'الرياض',sec:'غرب',nb:'آخر',loc:'project',lat:24.001,lon:46},{id:'own-sector-farther',n:'b',city:'الرياض',sec:'شرق',nb:'آخر',loc:'project',lat:24.02,lon:46},{id:'own-sector-district',n:'c',city:'الرياض',sec:'شرق',nb:'آخر',loc:'nb',lat:24,lon:46}];
 check('Full city project own sector wins over physically closer other sector; unknown remains without distance',()=>{const a=h.a.itemsFor('projects','','city',ordered);assert.deepEqual(a.map(x=>x.o.id),['own-sector-farther','own-sector-district','other-sector-nearest']);assert.equal(a[1].d,null);});
 check('Around branch allows closer cross-sector physical project without forcing complete own sector',()=>assert.deepEqual(h.a.itemsFor('projects','','branch',ordered).map(x=>x.o.id),['other-sector-nearest','own-sector-farther']));
 for(const city of ['بريدة','شقراء','الدوادمي','الخبر']){
  h.a.state().branch={c:'city-only-test',city,cityOnly:true,lat:null,lon:null,nb:'',sec:''};
  const rows=[{id:'local-unpinned',n:'a',city,loc:'nb'},{id:'local-pinned',n:'b',city,loc:'project',lat:24,lon:46},{id:'external',n:'c',city:'الرياض',loc:'project',lat:24,lon:46}];
  check('City-only '+city+' preserves own IDs, cannot invent origin/distances or external selection',()=>{let a=h.a.itemsFor('projects','','city',rows);assert.deepEqual(a.map(x=>x.o.id).sort(),['local-pinned','local-unpinned']);assert(a.every(x=>x.d==null));assert.equal(h.a.itemsFor('projects','','external',rows).length,0);});
 }

 const nhcNational=require('./nhc-national-fixture.json'),nhc=JSON.parse(frozenFiles['data/nhc.json']);
 const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
 check('NHC28 original master destinations unchanged except exact type annotations',()=>{const a=nhc.filter(x=>x.entityType==='nhc_destination');assert.equal(a.length,28);assert.deepEqual(a.map(x=>({name:x.n,city:x.city,source:x.url})),nhcNational.masters);const plain=a.map(x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['entityType','entityTypeLabel','unitCountSemantics'].includes(k))));assert.equal(crypto.createHash('sha256').update(canonical(plain)).digest('hex'),nhcNational.originalMasterRowsSha256);assert(a.every(x=>x.entityTypeLabel==='وجهة NHC'&&x.unitCountSemantics==='total_destination_units_not_current_available_units'));});
 check('NHC typed national coverage32,15physical cities, Riyadh5unchanged',()=>{assert.equal(nhc.length,32);assert.equal(new Set(nhc.map(x=>x.city)).size,15);assert.equal(nhc.filter(x=>x.city==='الرياض').length,5);assert.equal(JSON.parse(frozenFiles['data/meta.json']).counts.nhc,32);});
 for(const f of nhcNational.partners)check('NHC partner '+f.name+' identity and non-invented availability',()=>{const x=nhc.find(x=>x.n===f.name);assert(x);assert.equal(x.city,f.city);assert.equal(x.entityType,'nhc_partner_project');assert.equal(x.entityTypeLabel,'مشروع بالشراكة مع NHC');assert.equal(x.canonicalProjectId,f.bankRecord);assert.equal(x.availability.status,'unverified');assert.equal(x.availability.remainingUnitCount,null);assert(!x.bankApproval||x.bankApproval.status!=='verified','Never transfer bank approval to NHC card');if(['أزيان بريدة','داما جازان'].includes(x.n)){assert.equal(x.lat,null);assert.equal(x.lon,null);assert(!x.maps);}if(x.n==='داما جازان')assert.deepEqual(x.phones,[]);if(x.n==='أزيان بريدة'){assert(!x.unitCount);assert(!x.remainingUnitCount);assert(x.sourceEvidence.some(e=>e.source==='https://azyanburaydah.com/'));}});
 const stable=crypto.createHash('sha256').update(fs.readFileSync(process.env.SEMANTIC_APP_SOURCE||path.join(root,'assets/app.js'))).digest('hex')===report.appSha256;
 report.sourceStable=stable;report.dataStable=Object.entries(frozenFiles).every(([name,content])=>fs.readFileSync(path.join(root,name),'utf8')===content);report.passed=report.failures.length===0&&stable&&report.dataStable;report.summary={checks:report.checks.length,failed:report.failures.length};fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,...report.summary,sourceStable:stable,failures:report.failures.slice(0,12)}));process.exitCode=report.passed?0:1;
})().catch(e=>{console.error(e);process.exitCode=1;});
