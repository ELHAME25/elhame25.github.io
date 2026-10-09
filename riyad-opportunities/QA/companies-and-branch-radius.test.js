#!/usr/bin/env node
/* Re-runnable functional checks for multi-city company scope and branch radii.
   Usage: node QA/companies-and-branch-radius.test.js [project-root]
   The root may be this release directory or any extracted copy of it. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
class Element {
  constructor(id) { this.id=id; this.innerHTML=''; this.textContent=''; this.value=''; this.dataset={}; this.handlers={}; this.classList={contains:()=>false}; }
  addEventListener(k,f) { this.handlers[k]=f; }
  querySelectorAll() { return []; }
  setAttribute() {} focus() {}
}
const els = {};
const document = { title:'', body:{appendChild(){}}, getElementById(id) {
  if (id === 'site-config') return null;
  return els[id] || (els[id] = new Element(id));
}, querySelector(){return null;}, querySelectorAll(){return [];}, addEventListener(){}, createElement(){return new Element('new');} };
const location = {hash:'', pathname:'/', search:''};
const localStorage = {getItem(){return null;},setItem(){},removeItem(){}};
const window = {location, scrollTo(){}, addEventListener(){}};
const fetch = async url => {
  const file = path.join(root, url.split('?')[0]);
  return {ok:fs.existsSync(file), json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
};
const jsFile = path.join(root, 'assets/app.js');
let source = fs.readFileSync(jsFile, 'utf8').replace('  boot();',
  "  window.__qa={selectBranch,renderBranch,itemsFor,rawItems,unlocatedItemsFor,nearestBranch,companyKey,radiusApplies,card,data:()=>D,state:()=>S,setScope:(scope,radius)=>{S.scope=scope;if(radius)S.radius=radius;return compute();}}; boot();");
vm.runInNewContext(source, {document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob,Intl,Date});
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
function check(name, fn) {
  try { const detail=fn(); results.push({name, pass:true, detail:detail||undefined}); }
  catch (e) { results.push({name, pass:false, error:e.message}); }
}
(async()=>{
  await sleep(250);
  const Q=window.__qa, D=Q.data();
  assert(Q && D.branches.length, 'app did not initialize');

  check('Small-city offices and showrooms remain city-wide for every branch', () => {
    Q.selectBranch('607', true); // الرس: فرع واحد، بإحداثيات موثقة
    assert.equal(Q.radiusApplies('offices','branch'), false);
    assert.equal(Q.radiusApplies('cars','branch'), false);
    Q.state().tab='offices'; Q.renderBranch();
    assert(!els.app.innerHTML.includes('id="radius"'), 'small cities must not expose a branch radius');
    const officeCity=Q.itemsFor('offices','','city').map(x=>x.o.id).sort();
    const officeBranch=Q.itemsFor('offices','','branch').map(x=>x.o.id).sort();
    const carCity=Q.itemsFor('cars','','city').map(x=>x.o.id).sort();
    const carBranch=Q.itemsFor('cars','','branch').map(x=>x.o.id).sort();
    assert.deepEqual(officeBranch,officeCity,'small-city offices should be city-wide');
    assert.deepEqual(carBranch,carCity,'small-city showrooms should be city-wide');
    return {branch:'607', city:D.branchByCode['607'].city, offices:officeCity.length, cars:carCity.length};
  });

  check('Branch scope never hides records in non-sector cities', () => {
    Q.selectBranch('607', true);
    const counts=[5,10,15,20].map(r=>{
      Q.setScope('branch',r);
      return {offices:Q.itemsFor('offices').map(x=>x.o.id).sort(),cars:Q.itemsFor('cars').map(x=>x.o.id).sort()};
    });
    assert(counts.every(x=>JSON.stringify(x.offices)===JSON.stringify(counts[0].offices)), 'office results changed with radius in a city-wide mode');
    assert(counts.every(x=>JSON.stringify(x.cars)===JSON.stringify(counts[0].cars)), 'car results changed with radius in a city-wide mode');
    Q.setScope('city',20);
    assert.deepEqual(Q.itemsFor('offices').map(x=>x.o.id).sort(),counts[0].offices,'city scope must match branch scope outside sector cities');
    return {branch:'607', offices:counts[0].offices.length, cars:counts[0].cars.length};
  });

  check('Central Safa row does not overwrite local Jeddah data and is deduplicated', () => {
    const b=D.branches.find(x=>x.city==='جدة'); assert(b,'Jeddah branch missing');
    Q.selectBranch(b.c,true); Q.setScope('city');
    const rows=Q.itemsFor('companies','','city').filter(x=>Q.companyKey(x.o.n)==='صفا');
    assert.equal(rows.length,1,'duplicate Safa rows in Jeddah');
    const x=rows[0].o;
    assert.equal(x.id,'cp-8882c5887d','expected Jeddah local record');
    assert.deepEqual(Array.from(x.projects||[]),['صفا 85 - جادة صفا'],'Riyadh project leaked to Jeddah');
    assert.deepEqual(Array.from(x.sectors||[]),['شمال'],'Riyadh sectors leaked to Jeddah');
    return {id:x.id,projects:x.projects,sectors:x.sectors};
  });

  check('Central-only coverage is shown without foreign pin, projects, sectors, map or contact', () => {
    const b=D.branches.find(x=>x.city==='جدة'); Q.selectBranch(b.c,true); Q.setScope('branch',5);
    const rows=Q.itemsFor('companies').filter(x=>Q.companyKey(x.o.n)==='دار الماجد');
    assert.equal(rows.length,1,'central coverage company missing or duplicated');
    const x=rows[0];
    assert(x.serviceMatch,'company city coverage should make it visible');
    assert.equal(x.displayD,null,'distance must not be transferred from source city');
    assert.equal(x.o.lat,null); assert.equal(x.o.lon,null); assert.equal(x.o.maps,''); assert.equal(x.o.wa,''); assert.equal(x.o.dsite,''); assert.equal(x.o.loc,'');
    assert.deepEqual(Array.from(x.o.projects||[]),[]); assert.deepEqual(Array.from(x.o.sectors||[]),[]);
    assert.equal(x.o.contact,'');
    const html=Q.card('companies',x.o,x.displayD,true,false,x);
    assert(html.includes('تخدم هذا النطاق'));
    assert(!/\d+(?:\.\d+)?\s*كم/.test(html),'invented/foreign distance appears');
    return {name:x.o.n,coverageMatchReason:x.coverageMatchReason};
  });

  check('Explicit city coverage appears outside the radius while retaining local sector data', () => {
    const b=D.branches.find(x=>x.city==='الرياض'&&x.sec==='غرب'&&x.lat!=null&&x.lon!=null);
    assert(b,'West Riyadh branch missing'); Q.selectBranch(b.c,true); Q.setScope('branch',5);
    const x=Q.itemsFor('companies').find(y=>Q.companyKey(y.o.n)==='صفا');
    assert(x&&x.serviceMatch,'explicit city coverage did not make Safa visible');
    assert.equal(x.displayD,null,'no location is tied to the west Riyadh service area');
    assert.deepEqual(Array.from(x.o.sectors||[]),['شرق','شمال','وسط'],'city-local sectors were lost or imported');
    assert(Q.card('companies',x.o,x.displayD,true,false,x).includes('تخدم هذا النطاق'));
    return {branch:b.c,reason:x.coverageMatchReason,localSectors:x.o.sectors};
  });

  check('No duplicate normalized company brand in any branch city', () => {
    const failures=[];
    for (const b of D.branches) {
      Q.selectBranch(b.c,true); Q.setScope('city');
      const seen=new Set();
      for (const x of Q.itemsFor('companies','','city')) {
        const key=Q.companyKey(x.o.n);
        if (seen.has(key)) failures.push({branch:b.c,city:b.city,brand:key});
        seen.add(key);
      }
    }
    assert.deepEqual(failures,[]);
    return {branches:D.branches.length, duplicateGroups:0};
  });

  check('Dar & Emaar variants deduplicate in Riyadh without dropping Riyadh projects', () => {
    const b=D.branches.find(x=>x.city==='الرياض'); Q.selectBranch(b.c,true); Q.setScope('city');
    const rows=Q.itemsFor('companies','','city').filter(x=>Q.companyKey(x.o.n)==='دار واعمار');
    assert.equal(rows.length,1);
    const projects=Array.from(rows[0].o.projects||[]);
    for (const expected of ['سرايا الجوان2','سرايا الفرسان','سرايا الفرسان المرحلة الثانية']) assert(projects.includes(expected), 'lost local project '+expected);
    return {displayName:rows[0].o.n, projects};
  });

  check('Al-Habib spelling variants deduplicate locally, without cross-city projects', () => {
    const b=D.branches.find(x=>x.city==='جدة'); Q.selectBranch(b.c,true); Q.setScope('city');
    const jeddah=Q.itemsFor('companies','','city').filter(x=>Q.companyKey(x.o.n)==='محمد الحبيب');
    assert.equal(jeddah.length,1);
    const jp=Array.from(jeddah[0].o.projects||[]);
    // Two source variants are audit-pending and must not be exposed through the company card.
    for (const expected of ['ايال سدايم']) assert(jp.includes(expected), 'lost verified local Jeddah project '+expected);
    assert(!jp.includes('ايال الفرسان'),'Riyadh project leaked to Jeddah');
    const r=D.branches.find(x=>x.city==='الرياض'); Q.selectBranch(r.c,true); Q.setScope('city');
    const rp=Q.itemsFor('companies','','city').filter(x=>Q.companyKey(x.o.n)==='محمد الحبيب');
    assert.equal(rp.length,1);
    assert(!Array.from(rp[0].o.projects||[]).includes('ايال سدايم'),'Jeddah project leaked to Riyadh');
    return {jeddahProjects:jp,riyadhProjects:rp[0].o.projects};
  });

  check('Multisector Rakez matches all Riyadh sectors without fictitious distance', () => {
    const sectors=['شرق','غرب','شمال','جنوب','وسط'], coverage=[];
    for (const sector of sectors) {
      const b=D.branches.find(x=>x.city==='الرياض'&&x.sec===sector&&x.lat!=null&&x.lon!=null);
      assert(b,'missing Riyadh '+sector+' branch'); Q.selectBranch(b.c,true); Q.setScope('branch',5);
      const x=Q.itemsFor('companies').find(y=>Q.companyKey(y.o.n)==='راكز');
      assert(x,'Rakez absent for '+sector); assert(x.serviceMatch,'no sector coverage evidence for '+sector);
      assert.equal(x.displayD,null,'Rakez sector match must not show HQ distance');
      coverage.push(sector);
    }
    return coverage;
  });


  check('Buraidah showroom results remain complete and identical across branches', () => {
    const lists=['602','249','273'].map(code => {
      const b=D.branchByCode[code]; assert(b&&b.city==='بريدة','unexpected branch/city '+code);
      Q.selectBranch(code,true); Q.setScope('branch',5);
      const branchCars=Q.itemsFor('cars','','branch'), cityCars=Q.itemsFor('cars','','city');
      assert.deepEqual(branchCars.map(x=>x.o.id).sort(),cityCars.map(x=>x.o.id).sort(),'Buraidah branch must show the full city inventory for '+code);
      return {ids:branchCars.map(x=>x.o.id).sort(),city:cityCars.length};
    });
    assert(new Set(lists.map(x=>x.ids.join('|'))).size===1,'Buraidah branch selection changed the city showroom inventory');
    return {codes:['602','249','273'],counts:lists.map(x=>x.ids.length)};
  });

  const failures=results.filter(x=>!x.pass);
  console.log(JSON.stringify({root,passed:results.length-failures.length,total:results.length,results},null,2));
  if (failures.length) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
