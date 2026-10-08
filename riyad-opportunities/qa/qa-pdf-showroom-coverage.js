#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const cars=JSON.parse(fs.readFileSync(path.join(root,'data/cars.json'),'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8'));
const ids=new Set(cars.map(x=>x.id));
const byId=new Map(cars.map(x=>[x.id,x]));
const pdfClones=cars.filter(x=>x.regionalListing===true&&String(x.regionalListingSource||'').includes('قائمة_معارض_المدن_الصغيرة.pdf'));
const newRoots=cars.filter(x=>/^pdf-smalltown-\d+$/.test(x.id));
const newClones=cars.filter(x=>x.regionalListing===true&&String(x.regionalListingOf||'').startsWith('pdf-smalltown-'));
const shared=cars.filter(x=>x.regionalServiceArea==='أبها–خميس مشيط');
const shifa=cars.filter(x=>x.city==='الرياض'&&x.zone==='shifa');
const qadi=cars.filter(x=>x.city==='الرياض'&&x.zone==='qadisiyah');
const validClone=(x)=>{const r=byId.get(x.regionalListingOf);return !!r&&x.n===r.n&&JSON.stringify(x.phones||[])===JSON.stringify(r.phones||[])&&x.maps===r.maps&&x.mapsQ===r.mapsQ&&x.lat===r.lat&&x.lon===r.lon&&x.originCity;};
const tests={
 'PDF inventory total and metadata match':cars.length===1058&&meta.counts.cars===1058,
 'all record IDs remain unique':ids.size===cars.length,
 'every PDF neighboring-city clone retains its source details':pdfClones.length===251&&pdfClones.every(x=>validClone(x)||x.regionalServiceArea==='أبها–خميس مشيط'),
 'new unambiguous city overlaps were added':pdfClones.filter(x=>x.id.includes('regional-pdf-')).length===251,
 'all 32 new PDF showroom records are included':newRoots.length===32,
 'every shared new record has its city counterpart':newClones.length===32,
 'Abha–Khamis records appear in both cities without invented pins':shared.length===42&&shared.filter(x=>!x.regionalListing).length===21&&shared.filter(x=>x.regionalListing).length===21&&shared.every(x=>x.lat==null&&x.lon==null&&x.mapsQ),
 'unlocated PDF records use search links rather than guessed coordinates':newRoots.every(x=>x.lat==null&&x.lon==null&&x.maps===''&&x.mapsQ&&x.mapReview),
 'PDF sourced company and brand showrooms are explicitly retained':newRoots.every(x=>x.pdfShowroomVerified===true),
 'review-required source conflicts remain flagged':cars.filter(x=>x.activityReviewStatus==='REVIEW_REQUIRED').length===15,
 'Riyadh Shifa and Qadisiyah group inventory remains intact':shifa.length===15&&qadi.length===30
};
const failed=Object.entries(tests).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({suite:'PDF showroom overlap and source integrity',counts:{total:cars.length,pdfClones:pdfClones.length,newRoots:newRoots.length,newClones:newClones.length,sharedAbhaKhamis:shared.length,shifa:shifa.length,qadisiyah:qadi.length},tests,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));
if(failed.length)process.exitCode=1;
