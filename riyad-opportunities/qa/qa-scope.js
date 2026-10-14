const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El { constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.disabled=false;this.hidden=false;this.handlers={};this.classList={contains:()=>false};} addEventListener(k,f){this.handlers[k]=f;} querySelectorAll(){return [];} setAttribute(){} getAttribute(){return null;} focus(){} }
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id));},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},createElement(){return new El('new');}};
const location={hash:'',pathname:'/',search:''};const localStorage={getItem(){return null},setItem(){},removeItem(){}};const window={location,scrollTo(){},addEventListener(){}};
const fetch=async u=>{const p=path.join(root,u.split('?')[0]);return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',`  window.__t={choose:code=>{S=fresh();S.branch=D.branchByCode[code];S.scope=(S.branch.lat==null||S.branch.lon==null)&&sectorCity(S.branch.city)?'city':'branch';},selectBranch,itemsFor,rawItems,unlocatedItemsFor,nearestBranch,employeeGreeting,cities,sameCity,radiusApplies,card,renderBranch,setScope:(x,r)=>{S.scope=x;S.radius=r||15;},data:()=>D,state:()=>S}; boot();`);
vm.runInNewContext(src,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await sleep(1200);const A=window.__t,D=A.data(), kinds=['projects','opps','nhc','selfbuild','companies','offices','cars'];
 const result={branches:D.branches.length,displayCities:A.cities().length,scopeRows:0,scopePassed:0,failures:[],checks:[]};
 const parseCSV=s=>{const rows=[];let row=[],v='',q=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c=='"'&&s[i+1]=='"'){v+='"';i++}else if(c=='"')q=false;else v+=c}else if(c=='"')q=true;else if(c==','){row.push(v);v=''}else if(c=='\n'){row.push(v);rows.push(row);row=[];v=''}else if(c!='\r')v+=c;}if(v||row.length){row.push(v);rows.push(row)}return rows};
 const csv=parseCSV(fs.readFileSync(path.join(__dirname,'scope_test_cases.csv'),'utf8').replace(/^\uFEFF/,'')), ix=Object.fromEntries(csv[0].map((v,i)=>[v,i]));
 for(const row of csv.slice(1).filter(r=>r.length>1)){
 const code=row[ix['الرمز']],kind=row[ix['القسم']];if(!kinds.includes(kind))continue;
 result.scopeRows++;const b=D.branchByCode[code];if(!b){result.failures.push({code,kind,error:'branch missing'});continue;}
 A.choose(code);const vis=A.itemsFor(kind,''),city=A.itemsFor(kind,'','city'),applies=A.radiusApplies(kind,'branch');
 const ids=xs=>xs.map(x=>x.o.id||x.o.n).sort().join('|');
 const sectorCity=D.meta.sectorCities.some(c=>A.sameCity(c,b.city));
 let expected=city;
 if(kind==='companies') expected=city;
 else if(kind==='offices'&&b.lat!=null&&b.lon!=null)expected=city.filter(x=>x.rankD!=null&&x.rankD<=15);
 else if((kind==='projects'||kind==='opps')&&sectorCity&&b.sec&&A.state().scope!=='city')expected=city.filter(x=>(x.o.sectors||(x.o.sec?[x.o.sec]:[])).includes(b.sec));
 else if(kind==='nhc'&&sectorCity&&b.sec&&A.state().scope!=='city')expected=city.filter(x=>(x.o.sectors||(x.o.sec?[x.o.sec]:[])).includes(b.sec));
 else if(kind==='cars')expected=applies?city.filter(x=>x.rankD==null||x.rankD<=15):city; // Riyadh city query retains the same selected showroom group; baseline comparison separately locks all car scopes.
 const foreign=vis.filter(x=>!A.sameCity(x.o.city,b.city)&&!(kind==='companies'&&(x.cityOnly||x.explicitCityCoverage||(x.o.coverageCities||[]).some(c=>A.sameCity(c,b.city)))));
 const invalid=kind==='offices'&&applies?vis.filter(x=>x.rankD==null||x.rankD>15):[];
 if(ids(vis)===ids(expected)&&!foreign.length&&!invalid.length)result.scopePassed++;else result.failures.push({code,kind,visible:vis.length,expected:expected.length,foreign:foreign.length,invalid:invalid.length});
 }

 const b242=D.branchByCode['242'];result.checks.push({check:'242 غرب الرياض',ok:b242.sec==='غرب'});
 const b243=D.branchByCode['243'];A.selectBranch('243',true);const near=A.itemsFor('projects',''),city=A.itemsFor('projects','','city'),expected=city.filter(x=>(x.o.sectors||(x.o.sec?[x.o.sec]:[])).includes('شرق'));A.state().tab='projects';A.renderBranch();result.checks.push({check:'243 يعرض قطاع الشرق كاملاً بلا استبعاد المشاريع البعيدة أو مجهولة الموقع',ok:near.map(x=>x.o.id).sort().join('|')===expected.map(x=>x.o.id).sort().join('|')&&near.some(x=>x.rankD==null)&&near.some(x=>x.rankD>15)&&!A.radiusApplies('projects','branch')&&!els.app.innerHTML.includes('id="radius"'),near:near.length,city:city.length});
 A.state().tab='offices';A.renderBranch();result.checks.push({check:'اختيارات 5/10/15/20 كم متاحة للمكاتب فقط',ok:A.radiusApplies('offices','branch')&&[5,10,15,20].every(x=>els.app.innerHTML.includes('أقرب '+x+' كم'))});
 result.checks.push({check:'واجهة النتائج لا تعرض رسالة إحداثيات مزعجة',ok:!els.content.innerHTML.includes('إحداثيات الفرع غير متاحة')&&!els.content.innerHTML.includes('لم أتمكن من الحصول على إحداثيات الفرع')});
 result.checks.push({check:'قائمة المدن تشمل جميع مدن الفروع والفئات وتطابق البيانات الوصفية',ok:A.sameCity('الأحساء','الهفوف')&&A.sameCity('الأحساء','المبرز')&&A.sameCity('سبت العلايا','سبت العلاية')&&new Set(D.branches.map(b=>A.cities().find(c=>A.sameCity(c,b.city))||b.city)).size===D.meta.branchCityChoiceCount&&A.cities().length===D.meta.cityChoiceCount&&A.cities().some(c=>A.sameCity(c,'أحد رفيدة')),count:A.cities().length});
 const nearest=A.nearestBranch({lat:b243.lat,lon:b243.lon});result.checks.push({check:'أقرب فرع 243',ok:nearest&&nearest.c==='243'});
 const rakez=A.itemsFor('companies','').find(x=>x.o.n.includes('راكز'));result.checks.push({check:'راكز تحفظ القطاعات الخمسة',ok:!!rakez&&rakez.o.sectors.length===5});
 const companies=[['cp-ee28fb1fee','بريدة'],['cp-8ece8e6ede','الرياض'],['cp-c55e51e166','الدمام'],['cp-ebb24055cf','جدة'],['cp-df5fe89eac','صفوى'],['cp-fb2d83ba98','الدمام'],['cp-1b41c1ed02','مكة المكرمة'],['cp-c566adf828','جدة'],['cp-d0bacbed29','بريدة'],['cp-0912454315','مكة المكرمة'],['cp-4737529953','خميس مشيط']];
 const cv=companies.map(([id,city])=>{const b=D.branches.find(x=>A.sameCity(x.city,city));if(!b)return {id,city,ok:false};A.selectBranch(b.c,true);A.setScope('city');return {id,city,ok:A.itemsFor('companies','','city').filter(x=>x.o.id===id).length===1}});result.checks.push({check:'تغطية الشركات الجديدة تظهر مرة واحدة بالمدينة',ok:cv.every(x=>x.ok),coverage:cv});
 result.checks.push({check:'تحية الموظف ثابتة دون اعتماد على الساعة',ok:A.employeeGreeting('خالد')==='مرحبًا، خالد'});

 const geoCases=[['176','جدة'],['307','رأس تنورة']];
 for(const [code,city] of geoCases){const b=D.branchByCode[code];A.selectBranch(code,true);A.setScope('branch',15);A.renderBranch();const html=els.app.innerHTML;result.checks.push({check:'فرع '+code+' بلا دبوس يعرض المدينة بلا مسافة',ok:!!b&&A.sameCity(b.city,city)&&b.lat==null&&b.lon==null&&!A.radiusApplies('projects','branch')&&!html.includes('id="radius"')&&(code!=='176'||html.includes('كل جدة'))});}
 result.checks.push({check:'الرموز الستة موثقة ولا تُعرض المراجع المحلية كأكواد رسمية',ok:['302','346','222','258'].every(c=>D.branchByCode[c].serviceAudience==='business_services_only')&&['397','197'].every(c=>D.branchByCode[c].codeStatus==='local_internal_reference')});
 const localCenter=D.branchByCode['397'];A.selectBranch('397',true);A.renderBranch();result.checks.push({check:'المركز بلا كود رسمي يظهر مرجعه المحلي بوضوح',ok:!!localCenter&&els.app.innerHTML.includes('مرجع داخلي 397')});
 const noProjectImage=D.projects.find(p=>!p.img);result.checks.push({check:'الصورة البديلة الافتراضية حديثة حضرية وتبقى أنواع الوحدات مميزة',ok:!!noProjectImage&&A.card('projects',noProjectImage).includes('data-src="assets/images/real-estate-illustrative-apartments.svg"')&&A.card('projects',{id:'QA-VILLA',n:'QA',type:'فيلا'}).includes('real-estate-illustrative-villa.svg')});
 result.ok=result.scopeRows===result.scopePassed&&!result.failures.length&&result.checks.every(x=>x.ok);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;})();


