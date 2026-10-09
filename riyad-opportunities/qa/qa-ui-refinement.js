const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El { constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.disabled=false;this.hidden=false;this.handlers={};this.classList={contains:()=>false};this.style={};} addEventListener(k,f){this.handlers[k]=f;} querySelectorAll(){return [];} setAttribute(){} getAttribute(){return null;} focus(){} }
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id));},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},createElement(){return new El('new');}};
const location={hash:'',pathname:'/',search:''};const localStorage={getItem(){return null},setItem(){},removeItem(){}};const window={location,scrollTo(){},addEventListener(){}};
const fetch=async u=>{const p=path.join(root,u.split('?')[0]);return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',`  window.__t={card,selectBranch,renderBranch,state:()=>S,data:()=>D,itemsFor}; boot();`);
vm.runInNewContext(src,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await sleep(250); const A=window.__t; A.selectBranch('243'); A.state().tab='projects'; A.renderBranch(); const page=els.app.innerHTML; const searchContent=els.content.innerHTML;
 const css=fs.readFileSync(path.join(root,'assets/app.css'),'utf8');
 const project=A.card('projects',{n:'مشروع اختبار',city:'الرياض',nb:'القادسية',dev:'مطوّر تجريبي',type:'فلل',rooms:'4',price:null,img:'https://example.com/p.jpg'},2,false,false,{});
 const roomsUpper=A.card('projects',{n:'مشروع اختبار الغرف',city:'الرياض',nb:'القادسية',type:'شقق',rooms:'3 غرف فأكثر'},2,false,false,{});
 const districtProject=A.card('projects',{n:'اختبار حي',city:'سيهات',nb:'حي قرطبة',dev:'',type:'شقق'},null,false,false,{});
 const planProject=A.card('projects',{n:'اختبار مخطط',city:'المدينة المنورة',nb:'مخطط المكيمن',dev:'',type:'شقق'},null,false,false,{});
 const destinationProject=A.card('projects',{n:'اختبار وجهة',city:'المدينة المنورة',nb:'وجهة الغروب، الدعيثة',dev:'',type:'شقق'},null,false,false,{});
 A.selectBranch('222'); A.state().tab='projects'; A.state().radius=5; A.renderBranch(); const zeroRadiusContent=els.content.innerHTML;
 const missing=A.data().branches.find(b=>(b.lat==null||b.lon==null)&&!A.data().meta.sectorCities.includes(b.city)); A.selectBranch(missing.c); A.state().tab='offices'; A.renderBranch(); const missingPinPage=els.app.innerHTML;
 A.selectBranch('243'); const defaultCars=A.itemsFor('cars').length; A.state().tab='cars'; A.renderBranch(); const carsMarkup=els.content.innerHTML; A.state().carArea='shifa'; const westCars=A.itemsFor('cars').length; A.state().carArea='qadisiyah'; const qadisiyahCars=A.itemsFor('cars').length; A.state().scope='city'; A.state().carArea='all'; const cityCars=A.itemsFor('cars','','city').length; A.state().scope='branch'; A.state().carArea='qadisiyah'; A.state().tab='cars'; A.renderBranch(); const noDistanceControl=!els.app.innerHTML.includes('id="radius"'); A.state().tab='nhc'; A.renderBranch(); const nhc=A.itemsFor('nhc'), nearestNHC=nhc.length?nhc[0]:null;
 const tests={
  branchTitle:page.includes('<h1>مركز مبيعات القادسية</h1>')&&!page.includes('دليل الفرص — مركز مبيعات'),
  showroomGroups:defaultCars===30&&qadisiyahCars===30&&westCars===15&&cityCars===52&&carsMarkup.includes('معارض القادسية')&&carsMarkup.includes('معارض الشفا')&&noDistanceControl,
  activeShowroomFilterUsesNavyOnly:css.includes('.car-zone-card[aria-pressed="true"] { background: var(--navy);')&&css.includes('.car-zone-card[aria-pressed="true"] strong { color: var(--navy);'),
  destinationRankingAndReason:!!nearestNHC&&nhc.every((x,i)=>!i||nhc[i-1].d==null||x.d==null||nhc[i-1].d<=x.d)&&els.content.innerHTML.includes(nearestNHC.o.n),
  visibleProjectDetails:project.includes('aria-label="تفاصيل مشروع اختبار"')&&project.includes('>التفاصيل</button>'),
  projectLocationLabels:districtProject.includes('حي قرطبة، سيهات')&&!districtProject.includes('حي حي قرطبة')&&planProject.includes('مخطط المكيمن، المدينة المنورة')&&!planProject.includes('حي مخطط')&&destinationProject.includes('وجهة الغروب، الدعيثة، المدينة المنورة')&&fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes("['الموقع', o.nb]"),
  projectImageLazy:project.includes('loading="lazy"')&&project.includes('decoding="async"'),
  noPriceFallback:project.includes('السعر: غير معلن'),
  roomsOnProjectCard:project.includes('4 غرف')&&roomsUpper.includes('3 غرف فأكثر')&&!roomsUpper.includes('3 غرف فأكثر غرف'),
  searchAlwaysVisible:searchContent.includes('id="q-sec"'),
  expandZeroRadiusToTenKm:zeroRadiusContent.includes('data-radius="10"')&&zeroRadiusContent.includes('كل الرياض'),
  missingBranchPinClearCityFallback:!!missing&&!missingPinPage.includes('نطاق الفرع')&&!missingPinPage.includes('data-scope="city"')&&!missingPinPage.includes('id="radius"')&&!missingPinPage.includes('إحداثيات الفرع غير متاحة'),
  noInternalReviewLabel:!fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes('الوظيفة التجارية قيد التحقق'),
  mobileTagline:css.includes('@media (max-width: 720px)')&&css.includes('.tagline { display: flex;'),
  narrowScreensSingleColumn:css.includes('@media (max-width: 720px)')&&css.includes('.grid, .grid.list { grid-template-columns: 1fr;')&&css.includes('@media (max-width: 420px)'),
  keyboardFocusForCards:project.includes('tabindex="0"')&&css.includes(':focus-visible')&&fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes("e.key === 'Enter' || e.key === ' '"),
  longNamesWrap:css.includes('.lcard h3 { color: var(--navy); overflow-wrap: anywhere; }')&&css.includes('.lcard .sub { line-height: 1.65; overflow-wrap: anywhere; }'),
  progressiveEmptyRadius:fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes('data-radius="\' + nextRadius')
 };
 const failed=Object.entries(tests).filter(([,v])=>!v).map(([k])=>k);
 console.log(JSON.stringify({suite:'ui refinement markup and responsive rules',debug:{defaultCars,qadisiyahCars,cityCars,westCars,carsMarkup:carsMarkup.includes('معارض القادسية')&&carsMarkup.includes('معارض الشفا'),noDistanceControl,nhcCount:nhc.length,nearest:nearestNHC&&nearestNHC.o.n,firstD:nearestNHC&&nearestNHC.d},tests,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));
 if(failed.length)process.exitCode=1;
})();
