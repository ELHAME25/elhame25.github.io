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
  const source=fs.readFileSync(appFile,'utf8').replace('  boot();',`  window.__policy={itemsFor,rawItems,radiusApplies,renderBranch,renderSection,selectBranch,sameCity,companyKey,companyActivities:typeof companyActivities==='function'?companyActivities:null,state:()=>S,data:()=>D,choose:code=>{S=fresh();S.branch=D.branchByCode[code];S.scope=(S.branch.lat==null||S.branch.lon==null)&&sectorCity(S.branch.city)&&!S.branch.sec?'city':'branch';}}; boot();`);
  vm.runInNewContext(source,{window,document,location,fetch,history:{replaceState(){}},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},navigator:{},setTimeout,clearTimeout,console,URL,Blob,Intl,Date});
  return {window,els};
}
const ids=rows=>Array.from(rows,x=>x.o.id||x.o.n).sort();
const ranks=rows=>rows.map(x=>x.rankD===undefined?x.d:x.rankD);
function assertNearFirst(rows,label){let last=-Infinity,unknown=false;for(const d of ranks(rows)){if(d==null){unknown=true;continue;}assert(!unknown,label+' has a located row after an unknown row');assert(d>=last-1e-9,label+' is not near-first');last=d;}}
(async()=>{
  const env=boot(path.join(root,'assets/app.js'));await new Promise(r=>setTimeout(r,350));
  const A=env.window.__policy,D=A.data();assert(D.branches.length,'app not initialized');
  const totals={branches:0,companyScopes:0,projectScopes:0,officeRadii:0,missingOfficePins:0,fullCityRetentionCases:0,externalScopeCases:0};
  for(const b of D.branches){
    A.choose(b.c);totals.branches++;
    const companyCity=ids(A.itemsFor('companies','','city'));
    for(const scope of ['branch','sector','city'])for(const sec of ['شرق','جنوب']){
      A.state().scope=scope;A.state().explore=sec;A.state().radius=5;
      assert.deepEqual(ids(A.itemsFor('companies',sec,scope)),companyCity,`${b.c}: companies filtered by ${scope}/${sec}`);
      assert.equal(A.radiusApplies('companies','branch'),false);totals.companyScopes++;
    }
    A.choose(b.c);
    const isSector=D.meta.sectorCities.some(c=>A.sameCity(c,b.city));
    const neighborhood=v=>String(v||'').replace(/^حي\s+/,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
    const ownNeighborhood=o=>/^https?:\/\//.test(String(b.neighborhoodSource||''))&&o.locationVerificationStatus!=='location_unverified'&&!!neighborhood(b.nb)&&neighborhood(o.nb)===neighborhood(b.nb);
    const distance=o=>{if(!['project','pt','office'].includes(o.loc)||o.locationVerificationStatus==='location_unverified'||['multi_location_series','villa_model'].includes(o.geographicEntityType)||![b.lat,b.lon,o.lat,o.lon].every(Number.isFinite))return null;const rad=Math.PI/180,dp=(o.lat-b.lat)*rad,dl=(o.lon-b.lon)*rad;return 12742*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(b.lat*rad)*Math.cos(o.lat*rad)*Math.sin(dl/2)**2));};
    const sameHood=o=>ownNeighborhood(o)||(/^https?:\/\//.test(String(b.neighborhoodSource||''))&&(o.verifiedLocations||[]).some(site=>A.sameCity(site.city,b.city)&&neighborhood(site.nb)===neighborhood(b.nb)&&!!neighborhood(b.nb)&&site.sources?.length));
    for(const kind of ['projects','opps','offices']){
      const city=A.itemsFor(kind,'','city');
      const retained=(D[kind]||[]).filter(o=>A.sameCity(o.city,b.city)&&(!o.regionalListingOf||A.sameCity(o.originCity||o.city,b.city))&&(kind!=='offices'||o.activityReviewStatus!=='closed_permanently'));
      assert.deepEqual(ids(city),retained.map(o=>o.id||o.n).sort(),`${b.c}/${kind}: full-city raw IDs must remain accessible`);totals.fullCityRetentionCases++;
      const externalExpected=(D[kind]||[]).filter(o=>!A.sameCity(o.city,b.city)&&(!o.regionalListingOf||A.sameCity(o.originCity||o.city,b.city))&&(kind!=='offices'||o.activityReviewStatus!=='closed_permanently')&&distance(o)!=null);
      const external=A.itemsFor(kind,'','external');assert.deepEqual(ids(external),externalExpected.map(o=>o.id||o.n).sort(),`${b.c}/${kind}: external physically located inventory`);
      assertNearFirst(external,`${b.c}/${kind}/external`);for(const row of external)assert(Math.abs(row.d-distance(row.o))<1e-7,'External distance must be straight-line from actual branch, not hand-picked support city or route mixture');totals.externalScopeCases++;

      for(const radius of [5,20]){
        A.state().radius=radius;A.state().scope='branch';
        const expected=isSector&&[b.lat,b.lon].every(Number.isFinite)?city.filter(x=>sameHood(x.o)||(distance(x.o)!=null&&distance(x.o)<=radius)):city;
        const actual=A.itemsFor(kind,'','branch');assert.deepEqual(ids(actual),ids(expected),`${b.c}/${kind}: neighborhood or physical-radius membership`);
        for(const row of actual){const expectedDistance=distance(row.o);assert.equal(row.d==null,expectedDistance==null,`${b.c}/${kind}/${row.o.id}: approximate location must not gain distance`);if(expectedDistance!=null)assert(Math.abs(row.d-expectedDistance)<1e-7,'Branch straight-line distance');}
        totals[kind==='offices'?'officeRadii':'projectScopes']++;
      }
      if(isSector)for(const sec of ['شرق','شمال','جنوب','غرب','وسط']){A.state().scope='sector';A.state().explore=sec;const expectedSector=city.filter(x=>(x.o.sectors||(x.o.sec?[x.o.sec]:[])).includes(sec));const actual=A.itemsFor(kind,sec,'sector');assert.deepEqual(ids(actual),ids(expectedSector),`${b.c}/${kind}/${sec}: not a complete sector`);totals.projectScopes++;}
      A.choose(b.c);
    }

  }
  // A representative company appears from every Riyadh branch, without needing a matching sector/project.
  const riyadhBranches=D.branches.filter(b=>A.sameCity(b.city,'الرياض'));
  const desam=D.companies.find(o=>/ديسم|دسم/.test(o.n||''));
  if(desam)for(const b of riyadhBranches){A.choose(b.c);assert(A.itemsFor('companies').some(x=>A.companyKey(x.o.n)===A.companyKey(desam.n)),`Desam absent at ${b.c}`);}
  // Companies are a single city-wide contact directory, never project previews.
  A.selectBranch('243',true);A.state().tab='companies';A.state().scope='sector';A.state().explore='جنوب';A.state().limit.companies=10000;A.renderBranch();
  assert(!env.els.app.innerHTML.includes('data-explore='),'company sector controls must be hidden');
  assert(!env.els.app.innerHTML.includes('id="radius"'),'company radius must be hidden');
  assert(!env.els.content.innerHTML.includes('id="company-activity"')&&!env.els.content.innerHTML.includes('id="company-sort"'),'company filters must be removed');
  assert(env.els.app.innerHTML.includes('id="q-sec"'),'company search missing');
  assert(env.els.app.innerHTML.includes('شركات الاستثمار والتطوير العقاري'),'company title incorrect');
  assert(!/الياقوت A|الياقوت14/.test(env.els.content.innerHTML),'company card leaks project names');
  for(const id of ['cp-48de384477','cp-center-riyadh-asas-makeen'])assert.equal(A.itemsFor('companies').filter(x=>x.o.id===id).length,1,id+' duplicated or missing');
  // Small cities remain independent; their projects are complete city lists.
  for(const city of ['الدمام','الخبر','الظهران','الجبيل','بريدة','عنيزة']){
    const b=D.branches.find(x=>A.sameCity(x.city,city));assert(b,'missing '+city);A.choose(b.c);
    for(const kind of ['projects','opps']){
      const rows=A.itemsFor(kind);
      assert(rows.every(x=>A.sameCity(x.o.city,city)),city+' imports neighboring projects');
      assert.deepEqual(ids(rows),ids(A.itemsFor(kind,'','city')),city+' is incorrectly sector-limited');
    }
    assert(A.itemsFor('companies').every(x=>A.sameCity(x.o.city,city)),city+' imports neighboring company locations');
  }
  A.choose('243');
  let projectSeparationCases=0;
  for(const sec of ['شرق','غرب','شمال','جنوب']){
    A.state().scope='sector';A.state().explore=sec;
    for(const id of ['op-center-riyadh-yaqut-a','op-center-riyadh-yaqut-14']){
      assert.equal(A.itemsFor('opps',sec,'sector').some(x=>x.o.id===id),sec==='شرق',id+' escaped its actual sector');projectSeparationCases++;
    }
  }
  for(const b of riyadhBranches.filter(b=>['شرق','شمال'].includes(b.sec))){A.choose(b.c);A.state().tab='cars';A.renderBranch();assert(env.els.app.innerHTML.indexOf('value="qadisiyah"')<env.els.app.innerHTML.indexOf('value="shifa"'),'Qadisiyah is not first for '+b.c);}
  // The selected sector, not the original branch sector, sets showroom card order and subtitle.
  let showroomSectorSwitches=0;
  for(const [branchSector,selected,first,label] of [
    ['جنوب','شرق','qadisiyah','القادسية'], ['جنوب','شمال','qadisiyah','القادسية'],
    ['شرق','غرب','shifa','الشفا'], ['شرق','وسط','shifa','الشفا']
  ]){
    const b=riyadhBranches.find(x=>x.sec===branchSector);assert(b,'missing Riyadh '+branchSector+' branch');
    A.choose(b.c);A.state().tab='cars';A.state().scope='sector';A.state().explore=selected;A.renderBranch();
    const html=env.els.app.innerHTML,other=first==='qadisiyah'?'shifa':'qadisiyah';
    assert(html.indexOf('value="'+first+'"')<html.indexOf('value="'+other+'"'),'showroom order follows original branch, not '+selected);
    assert(env.els.content.innerHTML.includes('معرضًا في '+label),'showroom subtitle does not follow '+selected);
    assert(A.itemsFor('cars',selected,'sector').every(x=>x.o.zone===first),'default primary group contains another hub');
    assert(env.els.content.innerHTML.includes('data-car-area="'+other+'"'),'alternate hub is missing below selected-group results');
    assert.equal(A.state().branch.sec,branchSector,'sector browsing mutated branch metadata');showroomSectorSwitches++;
  }
  // Old-baseline equivalence is meaningful only for unaffected cities. Riyadh now follows
  // the explicit primary/alternate policy above, not its previous exclusive hub behavior.
  let carComparisons=0;const baseline=process.env.NATIONAL_POLICY_BASELINE_APP;
  if(baseline){
    const old=boot(baseline);await new Promise(r=>setTimeout(r,350));const B=old.window.__policy;
    for(const b of D.branches.filter(b=>!A.sameCity(b.city,'الرياض'))){
      A.choose(b.c);B.choose(b.c);
      for(const scope of ['branch','city'])for(const radius of [5,20]){
        for(const q of [A,B]){q.state().scope=scope;q.state().radius=radius;}
        assert.deepEqual(Array.from(A.itemsFor('cars','',scope),x=>x.o.id),Array.from(B.itemsFor('cars','',scope),x=>x.o.id),'unaffected city car behavior changed at '+b.c+'/'+scope+'/'+radius);carComparisons++;
      }
    }
  }
  console.log(JSON.stringify({suite:'National category scope policy',ok:true,...totals,carComparisons,companyDirectoryOnly:true,projectSeparationCases,showroomSectorSwitches},null,2));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
