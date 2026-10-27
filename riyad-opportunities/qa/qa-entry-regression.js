const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El { constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.disabled=false;this.hidden=false;this.handlers={};this.classList={contains:()=>false};} addEventListener(k,f){this.handlers[k]=f;} querySelectorAll(){return [];} setAttribute(){} getAttribute(){return null;} focus(){} }
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id));},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},createElement(){return new El('new');}};
const location={hash:'',pathname:'/',search:''};const localStorage={getItem(){return null},setItem(){},removeItem(){}};const window={location,scrollTo(){},handlers:{},addEventListener(k,f){this.handlers[k]=f;}};
const fetch=async u=>{const p=path.join(root,u.split('?')[0]);return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',`  window.__t={choose:code=>{S=fresh();S.branch=D.branchByCode[code];S.scope=(S.branch.lat==null||S.branch.lon==null)&&sectorCity(S.branch.city)?'city':'branch';},selectCity,renderStart,renderSection,filterQuery,visibleItemsFor,cityKey,selectBranch,itemsFor,rawItems,unlocatedItemsFor,nearestBranch,employeeGreeting,cities,sameCity,radiusApplies,compute,displayEligible,card,renderBranch,setScope:(x,r)=>{S.scope=x;S.radius=r||15;},data:()=>D,state:()=>S}; boot();`);
vm.runInNewContext(src,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await sleep(1500);const A=window.__t,D=A.data(),assert=require('assert'),result={internalRefs:[],cityRoutes:[],codeEntries:0,cityEntries:0};
function entry(q,city=''){A.renderStart();els['q-branch'].value=q;els['q-city'].value=city;els['q-branch'].handlers.input();}
for(const b of D.branches){entry(b.c);if(b.codeStatus==='local_internal_reference')assert(els['go-branch'].disabled);else{assert(!els['go-branch'].disabled,b.c);assert(els['branch-list'].innerHTML.includes('data-code="'+b.c+'"'));result.codeEntries++;}}
for(const city of A.cities()){entry('',city);const bs=D.branches.filter(b=>A.sameCity(b.city,city));for(const b of bs)assert(els['branch-list'].innerHTML.includes('data-code="'+b.c+'"'));result.cityEntries++;}
for(const b of D.branches.filter(b=>b.codeStatus==='local_internal_reference')){entry(b.n);assert(els['branch-list'].innerHTML.includes('data-code="'+b.c+'"'));els['branch-list'].handlers.click({target:{closest(sel){return sel==='[data-code]'?{dataset:{code:b.c}}:null;}}});assert(!els['go-branch'].disabled);els['go-branch'].handlers.click();assert.strictEqual(A.state().branch.c,b.c);assert(els.app.innerHTML.includes('مرجع داخلي '+b.c));location.hash='';window.handlers.hashchange();assert(!A.state().branch);location.hash='#b'+b.c;window.handlers.hashchange();assert.strictEqual(A.state().branch.c,b.c);result.internalRefs.push(b.c);}
for(const city of A.cities().filter(city=>!D.branches.some(b=>A.sameCity(b.city,city)))){entry('',city);assert(els['branch-list'].innerHTML.includes('data-browse-city="'+city+'"'));assert(!els['branch-list'].innerHTML.includes('data-code='));els['branch-list'].handlers.click({target:{closest(sel){return sel==='[data-browse-city]'?{dataset:{browseCity:city}}:null;}}});assert(A.state().branch.cityOnly);assert(A.sameCity(A.state().branch.city,city));assert.strictEqual(A.state().scope,'city');assert(!A.state().branch.c);const c=A.compute();for(const k of ['offices','cars','companies','projects','opps','nhc'])assert(c[k].items.every(x=>A.sameCity(x.o.city,city)||k==='companies'));const hash=location.hash.startsWith('#')?location.hash:'#'+location.hash;location.hash='';window.handlers.hashchange();assert(!A.state().branch);location.hash=hash;window.handlers.hashchange();assert(A.state().branch.cityOnly&&A.sameCity(A.state().branch.city,city));result.cityRoutes.push({city,counts:Object.fromEntries(['offices','cars','companies','projects','opps','nhc'].map(k=>[k,c[k].items.length]))});}
result.categoryIndependence=[];
const savedCatalog=D.meta.bankApprovalCatalog;
for(const city of ['الرياض','جدة','أبها','محايل عسير']){
 const b=D.branches.find(b=>A.sameCity(b.city,city));assert(b,'Missing real branch for '+city);A.selectBranch(b.c,true);A.state().scope='city';const before=A.compute();
 D.meta.bankApprovalCatalog={status:'pending'};const pending=A.compute();assert.strictEqual(pending.projects.items.length,0,'Pending bank catalog must gate approved projects');
 for(const k of ['companies','opps','nhc','offices','cars']){
  const ids=rows=>rows.map(x=>x.o.id||x.o.n).sort().join('|');assert.strictEqual(ids(pending[k].items),ids(before[k].items),'Bank pending changed '+city+' '+k);
  A.state().tab=k;A.state().q[k]='';A.state().limit[k]=100000;A.renderSection(pending);assert.strictEqual((els.content.innerHTML.match(/<article\b/g)||[]).length,pending[k].items.length,'Bank pending hid rendered '+k);assert(!els.content.innerHTML.includes('approval-pending'),'Wrong bank pending UI in '+k);
  result.categoryIndependence.push({city,kind:k,count:pending[k].items.length});
 }
 D.meta.bankApprovalCatalog=savedCatalog;
}
result.ok=true;console.log(JSON.stringify(result,null,2));})().catch(e=>{console.error(e.stack);process.exitCode=1});
