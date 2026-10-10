#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El{constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.handlers={};this.classList={contains:()=>false};}addEventListener(k,f){this.handlers[k]=f}querySelectorAll(){return []}setAttribute(){}focus(){}}
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id))},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},createElement(){return new El('new')}};
const location={hash:'',pathname:'/',search:''},localStorage={getItem(){return null},setItem(){},removeItem(){}},window={location,scrollTo(){},addEventListener(){}};
const fetch=async url=>{const file=path.join(root,url.split('?')[0]);return{ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}};
const source=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',"  window.__cityQA={cities,cityKey,sameCity,data:()=>D}; boot();");
vm.runInNewContext(source,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob,Intl,Date});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 await wait(300);
 const Q=window.__cityQA,D=Q.data();assert(Q&&D.cityCount,'app data did not initialize');
 const choices=Q.cities();
 assert.strictEqual(choices.length,81,`expected 81 distinct city choices after adding the verified Baqaa opportunity; got ${choices.length}`);
 assert(choices.some(c=>Q.sameCity(c,'أحد رفيدة')),'Ahad Rufaydah missing from city choices');
 assert(choices.some(c=>Q.sameCity(c,'بقعاء')),'Baqaa missing from city choices');
 assert(!els['branch-list'].innerHTML.includes('data-city-only'),'the branch picker must not invent city-wide entries');
 const baqaaRow=D.opportunities.find(o=>o.id==='op-baqaa-rimal-127br-29');
 assert(baqaaRow&&baqaaRow.phones.includes('0555155763')&&baqaaRow.maps.includes('27.933561185501,42.395585012881'),'Baqaa listing fields missing');
 assert(choices.some(c=>Q.sameCity(c,'سبت العلاية')),'Sabt Al Alayah missing from city choices');
 assert.strictEqual(choices.filter(c=>Q.sameCity(c,'سبت العلايا')).length,1,'Sabt spelling variants must resolve to one city');
 assert.strictEqual(Q.cityKey('سبت العلايا'),Q.cityKey('سبت العلاية'));
 assert.strictEqual(choices.filter(c=>Q.sameCity(c,'ضرماء')).length,1,'Dhurma spelling variants must resolve to one city choice');
 assert.strictEqual(Q.cityKey('ضرما'),Q.cityKey('ضرماء'));
 const dhurmaBranch=D.branchByCode['219'];
 assert(dhurmaBranch&&Q.sameCity(dhurmaBranch.city,'ضرماء'),'branch 219 must resolve to Dhurma city strategy');
 const dhurmaOffices=D.offices.filter(o=>Q.sameCity(o.city,dhurmaBranch.city));
 assert.strictEqual(dhurmaOffices.length,20,'all 20 Dhurma offices must attach to branch 219 city');
 assert(D.cars.some(o=>o.id==='national-car-raed-dhurma-live'&&Q.sameCity(o.city,'ضرماء')),'Dhurma showroom must attach to Dhurma');
 assert.strictEqual(choices.filter(c=>Q.sameCity(c,'الأفلاج')).length,1,'Aflaaj/Layla must resolve to one city choice');
 const aflajBranch=D.branchByCode['215'];
 assert(aflajBranch&&Q.sameCity(aflajBranch.city,'الأفلاج'),'branch 215 must resolve to Layla/Aflaaj');
 const aflajCar=D.cars.filter(o=>Q.sameCity(o.city,'ليلى')&&(o.phones||[]).includes('0501144220'));
 assert.strictEqual(aflajCar.length,1,'regional Aflaaj listing must deduplicate with Layla source record');
 const sabtOffices=D.offices.filter(o=>Q.sameCity(o.city,'سبت العلاية'));
 assert.strictEqual(sabtOffices.length,5,'all five offices with variant spelling must attach to the branch city');
 const branchSearch=els['q-branch'], citySelect=els['q-city'];
 const branchCities=[...new Set(D.branches.map(b=>b.city).filter(Boolean))].sort();
 assert(branchCities.length>50,'national test must cover the nationwide branch-city set');
 for(const city of branchCities){
   const rows=D.branches.filter(b=>Q.sameCity(b.city,city));
   branchSearch.value=city; branchSearch.handlers.input();
   for(const b of rows)assert(els['branch-list'].innerHTML.includes('data-code="'+b.c+'"'),`typing city ${city} must list branch ${b.c}`);
   assert.strictEqual((els['branch-list'].innerHTML.match(/data-code=/g)||[]).length,rows.length,`city search ${city} must show only its actual branches`);
   assert(!els['branch-list'].innerHTML.includes('data-city-only'),`city search ${city} must not invent a city-wide branch`);
   branchSearch.value=''; citySelect.value=city; citySelect.handlers.change();
   assert.strictEqual((els['branch-list'].innerHTML.match(/data-code=/g)||[]).length,rows.length,`selecting ${city} must list all its branches`);
   for(const b of rows)assert(els['branch-list'].innerHTML.includes('data-code="'+b.c+'"'),`selecting ${city} must list branch ${b.c}`);
 }
 assert(branchCities.some(c=>Q.sameCity(c,'بريدة')),'Buraidah must be included in nationwide search');
 assert(branchCities.some(c=>Q.sameCity(c,'عنيزة')),'Unaizah must be included in nationwide search');
 assert(!branchCities.some(c=>Q.sameCity(c,'قبة')),'do not invent a Qubah branch city absent from the official branch dataset');
 assert(!els['branch-list'].innerHTML.includes('data-city-only'),'city selection must not add a city-wide entry');
 const knownDestinationCounts={
   'الجنى':'أكثر من 1,600 وحدة','الوريف':'أكثر من 12,000 وحدة','مكة هيلز':'أكثر من 3,100 وحدة',
   'بوابة مكة':'أكثر من 8,000 وحدة','سدايم':'أكثر من 8,000 وحدة','الفرسان':'أكثر من 50,000 وحدة',
   'الربى':'أكثر من 9,000 وحدة','خزام':'أكثر من 52,000 وحدة','المشرقية':'15,055 وحدة',
   'الأصالة':'5,835 وحدة','مرجانة':'أكثر من 1,500 وحدة','لازورد':'أكثر من 8,100 وحدة',
   'تبوك فالي':'1,106 وحدة','تبوك هيلز':'أكثر من 4,600 وحدة','الورود':'أكثر من 3,700 وحدة',
   'وديانا':'نحو 2,000 وحدة','تبوك فالي 2':'874 وحدة','الغروب':'نحو 8,000 وحدة',
   'قمرة':'2,832 وحدة','النخلة':'169 وحدة'
 };
 for(const [name,count] of Object.entries(knownDestinationCounts)){
   const destination=D.nhc.find(o=>o.n===name);
   assert(destination,`NHC destination missing: ${name}`);
   assert.strictEqual(destination.unitCount,count,`verified NHC unit count missing or changed for ${name}`);
 }
 assert(D.nhc.every(o=>!o.unitCount||typeof o.unitCount==='string'),'NHC totals must be explicit display strings');
 for(const kind of ['projects','opps','nhc','selfbuild','companies','offices','cars'])for(const o of D[kind]||[])for(const city of [o.city,...(o.coverageCities||[])].filter(Boolean))assert(choices.some(c=>Q.sameCity(c,city)),`${kind} city/coverage missing: ${city}`);
 console.log(JSON.stringify({ok:true,cityChoices:choices.length,citySearchBranches:buraidahBranches.length,sabtAlAlayahOffices:sabtOffices.length}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
