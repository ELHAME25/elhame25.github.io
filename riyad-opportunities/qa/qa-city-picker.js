#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El{constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.handlers={};this.classList={contains:()=>false};}addEventListener(k,f){this.handlers[k]=f}querySelectorAll(){return []}setAttribute(){}focus(){}}
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id))},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},createElement(){return new El('new')}};
const location={hash:'',pathname:'/',search:''},localStorage={getItem(){return null},setItem(){},removeItem(){}},window={location,scrollTo(){},addEventListener(){}};
const fetch=async url=>{const file=path.join(root,url.split('?')[0]);return{ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}};
const source=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',"  window.__cityQA={cities,cityKey,sameCity,cityHasRecords,cityOnlyAvailable,cityOnlyProfile,data:()=>D}; boot();");
vm.runInNewContext(source,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob,Intl,Date});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 await wait(300);
 const Q=window.__cityQA,D=Q.data();assert(Q&&D.cityCount,'app data did not initialize');
 const choices=Q.cities();
 assert.strictEqual(choices.length,82,`expected 82 city choices; got ${choices.length}`);
 assert(choices.some(c=>Q.sameCity(c,'أحد رفيدة')),'Ahad Rufaydah missing from city choices');
 assert(choices.some(c=>Q.sameCity(c,'سبت العلاية')),'Sabt Al Alayah missing from city choices');
 assert.strictEqual(choices.filter(c=>Q.sameCity(c,'سبت العلايا')).length,1,'Sabt spelling variants must resolve to one city');
 assert.strictEqual(Q.cityKey('سبت العلايا'),Q.cityKey('سبت العلاية'));
 const sabtOffices=D.offices.filter(o=>Q.sameCity(o.city,'سبت العلاية'));
 assert.strictEqual(sabtOffices.length,5,'all five offices with variant spelling must attach to the branch city');
 assert(Q.cityHasRecords('أحد رفيدة'),'Ahad Rufaydah has data but is not recognized as browseable');
 assert.strictEqual(Q.cityOnlyAvailable('أحد رفيدة',''),true,'a data-only city with no branch must be selectable');
 assert.strictEqual(Q.cityOnlyAvailable('أحد رفيدة','x'),false,'typed branch search must not turn into a city-only option');
 assert.strictEqual(Q.cityOnlyAvailable('سبت العلاية',''),false,'a city with a branch must continue to offer its branch');
 const profile=Q.cityOnlyProfile('أحد رفيدة');
 assert(profile&&profile.branch.cityOnly,'city-only profile missing');
 assert.strictEqual(profile.tab,'opps','city-only access should open its first populated section');
 for(const kind of ['projects','opps','nhc','selfbuild','companies','offices','cars'])for(const o of D[kind]||[])for(const city of [o.city,...(o.coverageCities||[])].filter(Boolean))assert(choices.some(c=>Q.sameCity(c,city)),`${kind} city/coverage missing: ${city}`);
 console.log(JSON.stringify({ok:true,cityChoices:choices.length,branchCities:77,cityOnlyNoBranch:5,ahadRufaydahStart:profile.tab,sabtAlAlayahOffices:sabtOffices.length}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
