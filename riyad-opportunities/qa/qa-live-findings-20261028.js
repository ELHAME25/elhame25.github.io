'use strict';
// Deterministic unit/markup regression. Actual input double-click is tested separately in qa-browser.js.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),els={},capture=[];let now=1000;
const el=id=>els[id]||(els[id]={innerHTML:'',addEventListener(){},querySelectorAll(){return[]},showModal(){this.open=true},setAttribute(){},querySelector(){return null}});
const document={getElementById:el,querySelectorAll(){return[]},addEventListener(k,f,c){if(k==='click'&&c)capture.push(f)},createElement(){return{}},activeElement:null};
const window={addEventListener(){},scrollY:0};let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();','window.API={reg,openDetail,contactView,evidenceLink,mapActionLabel,armEntryClickGuard,reviewedUnavailableUrl,displayEligible,verificationPending};');
vm.runInNewContext(src,{document,window,URL,console,setTimeout,clearTimeout,Date:{now:()=>now,parse:Date.parse},localStorage:{getItem(){return null}},location:{hash:'',href:'https://elhame25.github.io/riyad-opportunities/'},history:{pushState(){},state:null}});const a=window.API;
const opp=JSON.parse(fs.readFileSync(path.join(root,'data/opportunities.json'))).find(x=>x.id==='op-a69531296c'),original=JSON.stringify(opp);
a.openDetail(a.reg('opps',a.contactView(opp)),true);let html=el('detail').innerHTML;
assert(!html.includes('href="'+opp.availability.source+'"'));assert(html.includes('رابط المصدر غير متاح حاليًا'));assert(html.includes(opp.availability.checkedAt));assert.equal(JSON.stringify(opp),original);
for(const status of [403,429,500,503,null]){const o={...opp,projectPageCheck:{...opp.projectPageCheck,httpStatus:status}};assert(a.evidenceLink(o.availability.source,'مصدر',o).includes('<a '),'temporary/unverified status must not suppress');}
assert(a.evidenceLink('https://example.com/other','مصدر',opp).includes('<a '),'different URL not suppressed');
const company=JSON.parse(fs.readFileSync(path.join(root,'data/companies.json'))).find(x=>x.id==='cp-roshn-group-riyadh');a.openDetail(a.reg('companies',a.contactView(company)),true);html=el('detail').innerHTML;assert(html.includes('بحث عن مركز مبيعات الشركة'));
assert.equal(a.mapActionLabel('https://www.google.com/maps/search/?api=1&query=24.7,46.7'),'خرائط');assert.equal(a.mapActionLabel('https://www.google.com/maps/search/?api=1&query=ROSHN%20Warefa'),'بحث في الخرائط');
const lawnda=JSON.parse(fs.readFileSync(path.join(root,'data/opportunities.json'))).find(x=>x.id==='op-44dea0f520');assert.equal(lawnda.availability.status,'unverified');assert(!a.displayEligible('opps',lawnda,{hasLegacyMarketSource:true}));assert(a.verificationPending('opps',lawnda,{hasLegacyMarketSource:true}));const verified={...lawnda,availability:{...lawnda.availability,status:'available'}};assert(a.displayEligible('opps',verified,{hasLegacyMarketSource:true}));
let blocked=0;const ev=(x,y,detail=1)=>({clientX:x,clientY:y,detail,preventDefault(){blocked++},stopImmediatePropagation(){}});assert.equal(capture.length,1);a.armEntryClickGuard(ev(500,400));capture[0](ev(500,400,2));assert.equal(blocked,1);capture[0](ev(700,400));assert.equal(blocked,1,'fast navigation elsewhere allowed');capture[0](ev(500,400,0));assert.equal(blocked,1,'keyboard allowed');now=1700;capture[0](ev(500,400));assert.equal(blocked,1,'guard expires');
console.log(JSON.stringify({ok:true,checks:17,actualBrowser:false,sourcePreserved:true,temporaryErrorsNotSuppressed:true,searchCenterExplicit:true,samePointDoubleClickGuard:true}));
