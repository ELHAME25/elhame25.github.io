const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
class El { constructor(id){this.id=id;this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.disabled=false;this.hidden=false;this.handlers={};this.classList={contains:()=>false};} addEventListener(k,f){this.handlers[k]=f;} querySelectorAll(){return [];} setAttribute(){} getAttribute(){return null;} focus(){} }
const els={};const document={title:'',body:{appendChild(){}},getElementById(id){if(id==='site-config')return null;return els[id]||(els[id]=new El(id));},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},createElement(){return new El('new');}};
const location={hash:'',pathname:'/',search:''};const localStorage={getItem(){return null},setItem(){},removeItem(){}};const window={location,scrollTo(){},addEventListener(){}};
const fetch=async u=>{const p=path.join(root,u.split('?')[0]);return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',`  window.__t={actions,phoneLine,waLink:(typeof waLink==='function'?waLink:null),waMatchesPhone,telHref,selectBranch,itemsFor,rawItems,unlocatedItemsFor,nearestBranch,employeeGreeting,cities,sameCity,radiusApplies,setScope:(x,r)=>{S.scope=x;S.radius=r||15;return compute()},data:()=>D,state:()=>S}; boot();`);
vm.runInNewContext(src,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await sleep(1200);const A=window.__t,D=A.data(); const item={n:'اختبار',phones:['0551234567','966501234567'],wa:'https://wa.me/966501234567',maps:'https://maps.google.com/?q=24,46',site:'https://example.com'};const html=A.actions(7,item,'ibtn');
const verified=D.projects.find(o=>o.id==='P109');
const officialWaRows=['projects','companies'].flatMap(k=>(D[k]||[]).filter(o=>o.wa));
const numericWaRows=officialWaRows.filter(o=>A.waMatchesPhone(o));
const allNumericButtonsMatch=numericWaRows.length>0&&numericWaRows.every((o,i)=>{const h=A.actions(i,o,'ibtn'), firstPhone=(o.phones||[])[0];return !!firstPhone&&A.waMatchesPhone({phones:[firstPhone],wa:o.wa})&&h.includes(`data-wa="${i}"`)&&h.includes(o.wa);});
const shortOrMismatchedRows=officialWaRows.filter(o=>!A.waMatchesPhone(o));
const noWrongWaButtons=shortOrMismatchedRows.every((o,i)=>!A.actions(1000+i,o,'ibtn').includes('data-wa='));
const mobileWithoutOfficialWa={n:'جوال بلا رابط موثق',phones:['0551234567']};
const landlineWithoutOfficialWa={n:'رقم موحد بلا رابط موثق',phones:['920033499']};
const tests={call:html.includes('data-call="7"')&&html.includes('href="tel:0551234567"'),whatsapp:html.includes('data-wa="7"')&&html.includes('https://wa.me/966501234567'),maps:html.includes('https://maps.google.com/?q=24,46'),save:html.includes('data-vcard="7"'),share:html.includes('data-share="7"'),multiPhone:A.phoneLine(item.phones,7).includes('<option value="1">966501234567</option>'),safeTel:A.telHref('+966 50 123 4567')==='tel:+966501234567',
  verifiedProjectWhatsappRendersOnlyWhenItsUrlMatchesItsPhone:!!verified&&A.waMatchesPhone(verified)&&A.actions(109,verified,'ibtn').includes('data-wa="109"')&&A.actions(109,verified,'ibtn').includes(verified.wa),
  allNumericWhatsappDestinationsMatchPhonesAndRender:allNumericButtonsMatch,
  nonmatchingOrShortWhatsappDestinationsAreNotMisrepresentedAsPhoneMatched:noWrongWaButtons,
  noPhoneToWhatsappInferenceHelperExists:A.waLink===null,
  noWhatsappIsInferredForMobileWithoutVerifiedDestination:!A.actions(201,mobileWithoutOfficialWa,'ibtn').includes('data-wa='),
  noWhatsappIsInferredForLandlineOrUnifiedNumber:!A.actions(202,landlineWithoutOfficialWa,'ibtn').includes('data-wa='),
  dataCoverage:{officialWaRows:officialWaRows.length,numericWaRows:numericWaRows.length,hiddenWithoutDirectPhoneMatch:shortOrMismatchedRows.length}};
const detail=tests.dataCoverage;delete tests.dataCoverage;const failed=Object.entries(tests).filter(([,ok])=>!ok).map(([name])=>name);console.log(JSON.stringify({tests,dataCoverage:detail,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));})();
