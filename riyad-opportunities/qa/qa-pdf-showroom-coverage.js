#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const cars=JSON.parse(fs.readFileSync(path.join(root,'data/cars.json'),'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8'));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'MAP_AUDIT_LEDGER_2026-10-10.json'),'utf8'));
const archivedCars=ledger.entries.filter(x=>x.category==='cars'&&x.archivedRecord);
const archivedOfficial=archivedCars.filter(x=>x.decision==='excluded_official_dealer');
const archivedUnverifiedPdfClones=archivedCars.filter(x=>x.decision==='excluded_from_unverified_city_alias'&&String(x.archivedRecord.regionalListingSource||'').includes('قائمة_معارض_المدن_الصغيرة.pdf'));
const ids=new Set(cars.map(x=>x.id));
const byId=new Map(cars.map(x=>[x.id,x]));
const pdfClones=cars.filter(x=>x.regionalListing===true&&String(x.regionalListingSource||'').includes('قائمة_معارض_المدن_الصغيرة.pdf'));
const newRoots=cars.filter(x=>/^pdf-smalltown-\d+$/.test(x.id));
const newClones=cars.filter(x=>x.regionalListing===true&&String(x.regionalListingOf||'').startsWith('pdf-smalltown-'));
const shared=cars.filter(x=>x.regionalServiceArea==='أبها–خميس مشيط');
const shifa=cars.filter(x=>x.city==='الرياض'&&x.zone==='shifa');
const qadi=cars.filter(x=>x.city==='الرياض'&&x.zone==='qadisiyah');
const validClone=(x)=>{const r=byId.get(x.regionalListingOf);const preservesOriginMap=x.maps===r?.maps&&x.mapsQ===r?.mapsQ&&x.lat===r?.lat&&x.lon===r?.lon;const suppressesForeignMap=x.mapReviewStatus==='no_verified_local_pin'&&!x.maps&&!x.mapsQ&&x.lat==null&&x.lon==null;const sourcePhones=r?.phones||[];const clonePhones=x.phones||[];const phonesMatch=clonePhones.every(p=>sourcePhones.includes(p));return !!r&&x.n===r.n&&phonesMatch&&(preservesOriginMap||suppressesForeignMap)&&x.originCity;};
const reviewRequiredIds=['phase5-google-2049951513340009758','phase6-google-7740940609020663943','phase6-cars-75dfdefd60deba','phase6-google-7593477781153902425','phase6-google-14514093740487545178','national-car-00d7bc837202eb','national-car-da080928d404e3','national-car-7749faab1f6281','phase6-cars-93b8851dbd48d9','phase6-cars-0c9ff285bc9877','phase6-cars-4d2fa54d2074e9','phase6-google-4044662082393491158','national-car-d41509abbbaa06'].sort();
const actualReviewRequiredIds=cars.filter(x=>x.activityReviewStatus==='REVIEW_REQUIRED').map(x=>x.id).sort();
const tests={
 'PDF inventory total and metadata match':cars.length===meta.counts.cars,
 'confirmed authorized agencies remain archived and excluded from independent showrooms':cars.every(x=>x.authorizedDealer!==true)&&archivedOfficial.length>=11&&archivedOfficial.every(x=>x.archivedRecord.id===x.id&&x.archiveReason&&(x.source_urls?.length||x.evidence_note)&&!ids.has(x.id)),
 'verified Khobar duplicate is retained as source data and linked to its canonical listing':byId.get('pdf-smalltown-024')?.duplicateOf==='national-car-0cd777a68d1394'&&byId.get('national-car-0cd777a68d1394')?.phones?.includes('0138990676'),
 'all record IDs remain unique':ids.size===cars.length,
 'every PDF neighboring-city clone retains its source details':pdfClones.every(x=>validClone(x)||x.regionalServiceArea==='أبها–خميس مشيط')&&archivedUnverifiedPdfClones.every(x=>x.archivedRecord.id===x.id&&x.archivedRecord.originCity&&x.archivedRecord.regionalListingOf&&x.archiveReason),
 'PDF city overlaps are visible with evidence or preserved in the audit archive':[...pdfClones,...archivedUnverifiedPdfClones.map(x=>x.archivedRecord)].filter(x=>String(x.id).includes('regional-pdf-')).length===251,
 'all 32 new PDF showroom records are included':newRoots.length===32,
 'every shared new record has its city counterpart':newClones.length===32,
 'Abha–Khamis records appear in both cities without invented pins':shared.length===42&&shared.filter(x=>!x.regionalListing).length===21&&shared.filter(x=>x.regionalListing).length===21&&shared.every(x=>x.lat==null&&x.lon==null&&x.mapsQ),
 'unlocated PDF records use search links rather than guessed coordinates':newRoots.every(x=>x.lat==null&&x.lon==null&&x.maps===''&&x.mapsQ&&x.mapReview),
 'PDF sourced company and brand showrooms are explicitly retained':newRoots.every(x=>x.pdfShowroomVerified===true),
 'review-required source conflicts remain flagged':JSON.stringify(actualReviewRequiredIds)===JSON.stringify(reviewRequiredIds),
 'Riyadh Shifa and Qadisiyah group inventory remains intact':shifa.length===15&&qadi.length===33
};
const failed=Object.entries(tests).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({suite:'PDF showroom overlap and source integrity',counts:{total:cars.length,pdfClones:pdfClones.length,newRoots:newRoots.length,newClones:newClones.length,sharedAbhaKhamis:shared.length,shifa:shifa.length,qadisiyah:qadi.length},tests,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));
if(failed.length)process.exitCode=1;
