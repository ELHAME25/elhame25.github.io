const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El { constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.disabled=false;this.hidden=false;this.handlers={};this.classList={contains:()=>false};this.style={};} addEventListener(k,f){this.handlers[k]=f;} querySelectorAll(){return [];} setAttribute(){} getAttribute(){return null;} focus(){} }
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id));},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},createElement(){return new El('new');}};
const location={hash:'',pathname:'/',search:''};const localStorage={getItem(){return null},setItem(){},removeItem(){}};const window={location,scrollTo(){},addEventListener(){}};
const fetch=async u=>{const p=path.join(root,u.split('?')[0]);return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',`  window.__t={card,selectBranch,renderBranch,state:()=>S,data:()=>D}; boot();`);
vm.runInNewContext(src,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await sleep(250); const A=window.__t; A.selectBranch('243'); A.state().tab='projects'; A.renderBranch(); const page=els.app.innerHTML; const searchContent=els.content.innerHTML;
 const css=fs.readFileSync(path.join(root,'assets/app.css'),'utf8');
 const project=A.card('projects',{n:'مشروع اختبار',city:'الرياض',nb:'القادسية',dev:'مطوّر تجريبي',type:'فلل',rooms:'4',price:null,img:'https://example.com/p.jpg'},2,false,false,{});
 A.state().radius=5; A.renderBranch(); const zeroRadiusContent=els.content.innerHTML;
 const missing=A.data().branches.find(b=>b.lat==null||b.lon==null); A.selectBranch(missing.c); const missingPinPage=els.app.innerHTML;
 const tests={
  branchTitle:page.includes('دليل الفرص — مركز مبيعات')&&page.includes('القادسية'),
  visibleProjectDetails:project.includes('aria-label="تفاصيل مشروع اختبار"')&&project.includes('>التفاصيل</button>'),
  projectImageLazy:project.includes('loading="lazy"')&&project.includes('decoding="async"'),
  noPriceFallback:project.includes('السعر: غير معلن'),
  roomsOnProjectCard:project.includes('4 غرف'),
  searchAlwaysVisible:searchContent.includes('id="q-sec"'),
  expandZeroRadiusToTenKm:zeroRadiusContent.includes('data-radius="10"')&&zeroRadiusContent.includes('كل الرياض'),
  missingBranchPinClearCityFallback:missingPinPage.includes('إحداثيات الفرع غير متاحة')&&missingPinPage.includes('موقع الفرع غير محدد')&&!missingPinPage.includes('id="radius"'),
  noInternalReviewLabel:!fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes('الوظيفة التجارية قيد التحقق'),
  mobileTagline:css.includes('@media (max-width: 720px)')&&css.includes('.tagline { display: flex;'),
  narrowScreensSingleColumn:css.includes('@media (max-width: 720px)')&&css.includes('.grid, .grid.list { grid-template-columns: 1fr;')&&css.includes('@media (max-width: 420px)'),
  keyboardFocusForCards:project.includes('tabindex="0"')&&css.includes(':focus-visible')&&fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes("e.key === 'Enter' || e.key === ' '"),
  longNamesWrap:css.includes('.lcard h3 { color: var(--navy); overflow-wrap: anywhere; }')&&css.includes('.lcard .sub { line-height: 1.65; overflow-wrap: anywhere; }'),
  progressiveEmptyRadius:fs.readFileSync(path.join(root,'assets/app.js'),'utf8').includes('data-radius="\' + nextRadius')
 };
 const failed=Object.entries(tests).filter(([,v])=>!v).map(([k])=>k);
 console.log(JSON.stringify({suite:'ui refinement markup and responsive rules',tests,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));
 if(failed.length)process.exitCode=1;
})();
