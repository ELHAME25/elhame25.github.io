#!/usr/bin/env node
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
function boot(appFile) {
  const els = {};
  class El {
    constructor(id) { Object.assign(this,{id,innerHTML:'',textContent:'',value:'',dataset:{},handlers:{},style:{}}); this.classList={contains:()=>false}; }
    addEventListener(k,f){this.handlers[k]=f;} querySelectorAll(){return [];} setAttribute(){} getAttribute(){return null;} focus(){}
  }
  const document={title:'',body:{appendChild(){}},getElementById(id){return id==='site-config'?null:(els[id]||(els[id]=new El(id)));},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},createElement(){return new El('new');}};
  const location={hash:'',pathname:'/',search:''},window={location,scrollTo(){},addEventListener(){}};
  const fetch=async url=>{const file=path.join(root,url.split('?')[0]);return{ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};};
  const source=fs.readFileSync(appFile,'utf8').replace('  boot();',`  window.__policy={itemsFor,rawItems,radiusApplies,renderBranch,renderSection,selectBranch,sameCity,companyKey,companyActivities:typeof companyActivities==='function'?companyActivities:null,state:()=>S,data:()=>D,choose:code=>{S=fresh();S.branch=D.branchByCode[code];S.scope=(S.branch.lat==null||S.branch.lon==null)&&sectorCity(S.branch.city)?'city':'branch';}}; boot();`);
  vm.runInNewContext(source,{window,document,location,fetch,history:{replaceState(){}},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},navigator:{},setTimeout,clearTimeout,console,URL,Blob,Intl,Date});
  return {window,els};
}
const ids=rows=>Array.from(rows,x=>x.o.id||x.o.n).sort();
const ranks=rows=>rows.map(x=>x.rankD===undefined?x.d:x.rankD);
function assertNearFirst(rows,label){let last=-Infinity,unknown=false;for(const d of ranks(rows)){if(d==null){unknown=true;continue;}assert(!unknown,label+' has a located row after an unknown row');assert(d>=last-1e-9,label+' is not near-first');last=d;}}
(async()=>{
  const env=boot(path.join(root,'assets/app.js'));await new Promise(r=>setTimeout(r,350));
  const A=env.window.__policy,D=A.data();assert(D.branches.length,'app not initialized');
  const totals={branches:0,companyScopes:0,projectScopes:0,officeRadii:0,missingOfficePins:0};
  for(const b of D.branches){
    A.choose(b.c);totals.branches++;
    const companyCity=ids(A.itemsFor('companies','','city'));
    for(const scope of ['branch','sector','city'])for(const sec of ['شرق','جنوب']){
      A.state().scope=scope;A.state().explore=sec;A.state().radius=5;
      assert.deepEqual(ids(A.itemsFor('companies',sec,scope)),companyCity,`${b.c}: companies filtered by ${scope}/${sec}`);
      assert.equal(A.radiusApplies('companies','branch'),false);totals.companyScopes++;
    }
    A.choose(b.c);
    for(const kind of ['projects','opps']){
      const city=A.itemsFor(kind,'','city'),isSector=D.meta.sectorCities.some(c=>A.sameCity(c,b.city));
      const expected=isSector&&b.sec&&A.state().scope!=='city'?city.filter(x=>(x.o.sectors||(x.o.sec?[x.o.sec]:[])).includes(b.sec)):city;
      for(const radius of [5,20]){A.state().radius=radius;const actual=A.itemsFor(kind);assert.deepEqual(ids(actual),ids(expected),`${b.c}/${kind}: branch is not complete sector/city`);assertNearFirst(actual,`${b.c}/${kind}`);totals.projectScopes++;}
      assert.equal(A.radiusApplies(kind,'branch'),false);
      if(isSector)for(const sec of ['شرق','شمال','جنوب','غرب','وسط']){A.state().scope='sector';A.state().explore=sec;const expectedSector=city.filter(x=>(x.o.sectors||(x.o.sec?[x.o.sec]:[])).includes(sec));const actual=A.itemsFor(kind,sec,'sector');assert.deepEqual(ids(actual),ids(expectedSector),`${b.c}/${kind}/${sec}: not a complete sector`);assertNearFirst(actual,`${b.c}/${kind}/${sec}`);totals.projectScopes++;}
      A.choose(b.c);
    }
    const cityOffices=A.itemsFor('offices','','city');
    if(b.lat!=null&&b.lon!=null){
      for(const radius of [5,10,15,20]){A.state().radius=radius;A.state().scope='branch';const expected=cityOffices.filter(x=>x.rankD!=null&&x.rankD<=radius);const actual=A.itemsFor('offices','','branch');assert.deepEqual(ids(actual),ids(expected),`${b.c}: offices outside/missing radius ${radius}`);assertNearFirst(actual,`${b.c}/offices`);A.state().scope='sector';A.state().explore='غرب';assert.deepEqual(ids(A.itemsFor('offices','غرب','sector')),ids(expected),`${b.c}: offices inherited sector`);totals.officeRadii++;}
    }else{assert.deepEqual(ids(A.itemsFor('offices','','branch')),ids(cityOffices),`${b.c}: missing pin office fallback loses city records`);assert.equal(A.radiusApplies('offices','branch'),false);totals.missingOfficePins++;}
  }
  // A representative company appears from every Riyadh branch, without needing a matching sector/project.
  const riyadhBranches=D.branches.filter(b=>A.sameCity(b.city,'الرياض'));
  const desam=D.companies.find(o=>/ديسم|دسم/.test(o.n||''));
  if(desam)for(const b of riyadhBranches){A.choose(b.c);assert(A.itemsFor('companies').some(x=>A.companyKey(x.o.n)===A.companyKey(desam.n)),`Desam absent at ${b.c}`);}
  // Actual UI handlers: activity selection, reset, optional near-first order and branch reset.
  A.selectBranch('243',true);A.state().tab='companies';A.state().scope='sector';A.state().explore='جنوب';A.state().limit.companies=10000;A.renderBranch();
  assert(!env.els.app.innerHTML.includes('data-explore='),'company sector controls must be hidden');
  assert(!env.els.app.innerHTML.includes('id="radius"'),'company radius must be hidden');
  assert(env.els.content.innerHTML.includes('id="company-activity"')&&env.els.content.innerHTML.includes('id="company-sort"'),'company filters absent');
  const allCompanies=A.itemsFor('companies');
  for(const activity of ['تطوير','استثمار','تسويق ووساطة','سداد']){
    env.els['company-activity'].value=activity;env.els['company-activity'].handlers.change();A.state().limit.companies=10000;A.renderSection();
    const expected=allCompanies.filter(x=>A.companyActivities(x.o).includes(activity));
    assert.equal((env.els.content.innerHTML.match(/<article class="lcard"/g)||[]).length,expected.length,'activity filter count mismatch '+activity);
  }
  env.els['company-activity'].value='';env.els['company-activity'].handlers.change();assert.equal(A.state().companyActivity,'');
  env.els['company-sort'].value='distance';env.els['company-sort'].handlers.change();assertNearFirst(A.itemsFor('companies'),'company distance ordering');assert.deepEqual(ids(A.itemsFor('companies')),ids(allCompanies),'sort must not hide companies');
  A.selectBranch('607',true);assert(!A.state().companyActivity&&A.state().companySort!=='distance','company filters leaked across branches');
  for(const b of riyadhBranches.filter(b=>['شرق','شمال'].includes(b.sec))){A.choose(b.c);A.state().tab='cars';A.renderBranch();assert(env.els.content.innerHTML.indexOf('data-car-area="qadisiyah"')<env.els.content.innerHTML.indexOf('data-car-area="shifa"'),'Qadisiyah is not first for '+b.c);}
  // The selected sector, not the original branch sector, sets showroom card order and subtitle.
  let showroomSectorSwitches=0;
  for(const [branchSector,selected,first,label] of [
    ['جنوب','شرق','qadisiyah','القادسية'], ['جنوب','شمال','qadisiyah','القادسية'],
    ['شرق','غرب','shifa','الشفا'], ['شرق','وسط','shifa','القادسية والشفا']
  ]){
    const b=riyadhBranches.find(x=>x.sec===branchSector);assert(b,'missing Riyadh '+branchSector+' branch');
    A.choose(b.c);A.state().tab='cars';A.state().scope='sector';A.state().explore=selected;A.renderBranch();
    const html=env.els.content.innerHTML,other=first==='qadisiyah'?'shifa':'qadisiyah';
    assert(html.indexOf('data-car-area="'+first+'"')<html.indexOf('data-car-area="'+other+'"'),'showroom order follows original branch, not '+selected);
    assert(html.includes('معرضًا في '+label),'showroom subtitle does not follow '+selected);
    assert.equal(A.state().branch.sec,branchSector,'sector browsing mutated branch metadata');showroomSectorSwitches++;
  }
  // If supplied, compare exact car result IDs/order with a read-only pre-change app.
  let carComparisons=0;const baseline=process.env.NATIONAL_POLICY_BASELINE_APP;
  if(baseline){const old=boot(baseline);await new Promise(r=>setTimeout(r,350));const B=old.window.__policy;for(const b of D.branches){A.choose(b.c);B.choose(b.c);for(const scope of ['branch','city'])for(const radius of [5,20]){for(const q of [A,B]){q.state().scope=scope;q.state().radius=radius;}assert.deepEqual(Array.from(A.itemsFor('cars','',''+scope),x=>x.o.id),Array.from(B.itemsFor('cars','',''+scope),x=>x.o.id),'car behavior changed at '+b.c+'/'+scope+'/'+radius);carComparisons++;}if(A.sameCity(b.city,'الرياض'))for(const sec of ['شرق','شمال','جنوب','غرب','وسط'])for(const q of [A,B]){q.state().scope='sector';q.state().explore=sec;if(q===B){assert.deepEqual(Array.from(A.itemsFor('cars',sec,'sector'),x=>x.o.id),Array.from(B.itemsFor('cars',sec,'sector'),x=>x.o.id),'Riyadh sector car behavior changed '+b.c+'/'+sec);carComparisons++;}}}}
  console.log(JSON.stringify({suite:'National category scope policy',ok:true,...totals,carComparisons,activityFilters:4,showroomSectorSwitches},null,2));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
