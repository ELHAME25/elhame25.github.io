#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const cars=JSON.parse(fs.readFileSync(path.join(root,'data/cars.json'),'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(root,'data/meta.json'),'utf8'));
const dealers=JSON.parse(fs.readFileSync(path.join(root,'data/dealers.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'CAR_CORRECTION_APPLICATION_MANIFEST_212_R1_SAFE_PREVIEW_2026-10-11.json'),'utf8'));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'MAP_AUDIT_LEDGER_2026-10-10.json'),'utf8'));
const finalApplication=JSON.parse(fs.readFileSync(path.join(root,'audits/FINAL_CAR_APPLICATION_REPORT_2026-10-12.json'),'utf8'));
const finalRemovedIds=new Set(finalApplication.removed_ids||[]);
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
const excludedCorrections=manifest.base_corrections.filter(x=>String(x.new_value?.action||'').startsWith('exclude_'));
const excludedIds=new Set(excludedCorrections.map(x=>x.id));
const retainedCanonicalIds=[...new Set(excludedCorrections.map(x=>x.retain_id).filter(id=>id&&!excludedIds.has(id)))];
const genan=byId.get('national-car-c80e0cb5068ed3');
const vision=byId.get('phase6-cars-8e1ef9c80a327c');
const babgiDealer=dealers.find(x=>x.id==='official-dealer-mbabgi-qunfudhah');
const sameCoordinate=(a,b)=>a==null&&b==null||Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<0.0001;
const validClone=(x)=>{const r=byId.get(x.regionalListingOf);const preservesOriginMap=x.maps===r?.maps&&(x.mapsQ||'')===(r?.mapsQ||'')&&sameCoordinate(x.lat,r?.lat)&&sameCoordinate(x.lon,r?.lon);const suppressesForeignMap=x.mapReviewStatus==='no_verified_local_pin'&&!x.maps&&!x.mapsQ&&x.lat==null&&x.lon==null;const sourcePhones=r?.phones||[];const clonePhones=x.phones||[];const phonesMatch=clonePhones.every(p=>sourcePhones.includes(p));return !!r&&x.n===r.n&&phonesMatch&&(preservesOriginMap||suppressesForeignMap)&&x.originCity;};
const reviewRequiredIds=['phase5-google-2049951513340009758','phase6-google-7740940609020663943','phase6-cars-75dfdefd60deba','phase6-google-7593477781153902425','phase6-google-14514093740487545178','national-car-00d7bc837202eb','national-car-da080928d404e3','national-car-7749faab1f6281','phase6-cars-93b8851dbd48d9','phase6-cars-0c9ff285bc9877','phase6-cars-4d2fa54d2074e9','phase6-google-4044662082393491158','national-car-d41509abbbaa06'].sort();
const actualReviewRequiredIds=cars.filter(x=>x.activityReviewStatus==='REVIEW_REQUIRED').map(x=>x.id).sort();
const tests={
 'PDF inventory total and metadata match':cars.length===meta.counts.cars,
 'confirmed authorized agencies remain archived and excluded from independent showrooms':cars.every(x=>x.authorizedDealer!==true)&&archivedOfficial.length>=11&&archivedOfficial.every(x=>x.archivedRecord.id===x.id&&x.archiveReason&&(x.source_urls?.length||x.evidence_note)&&!ids.has(x.id)),
 'verified Khobar duplicate is archived and its canonical listing remains':finalRemovedIds.has('pdf-smalltown-024')&&!ids.has('pdf-smalltown-024')&&byId.get('national-car-0cd777a68d1394')?.phones?.includes('0138990676'),
 'all record IDs remain unique':ids.size===cars.length,
 'every PDF neighboring-city clone retains its source details':pdfClones.every(x=>validClone(x)||x.regionalServiceArea==='أبها–خميس مشيط')&&archivedUnverifiedPdfClones.every(x=>x.archivedRecord.id===x.id&&x.archivedRecord.originCity&&x.archivedRecord.regionalListingOf&&x.archiveReason),
 'approved duplicate exclusions are absent and retained canonical rows remain':excludedCorrections.length===210&&excludedCorrections.every(x=>!ids.has(x.id))&&[...finalRemovedIds].every(id=>!ids.has(id))&&retainedCanonicalIds.filter(id=>!finalRemovedIds.has(id)).every(id=>ids.has(id)),
 'approved city coverage safeguards remain active':genan?.serviceCities?.includes('أم الحمام')&&!!vision&&!ids.has('regional-pdf-phase6-cars-8e1ef9c80a327c-053'),
 'Babgi is preserved only in the official dealers section':dealers.length===1&&!!babgiDealer&&babgiDealer.city==='القنفذة'&&babgiDealer.phones?.includes('920033745')&&babgiDealer.web==='https://mbabgi.sa/findcenter'&&!ids.has('phase6-cars-56fc1e0cbe2502')&&!ids.has('pdf-smalltown-026'),
 'Abha–Khamis records retain only verified pins or explicit unresolved searches':shared.length===28&&shared.every(x=>(x.lat==null&&x.lon==null&&x.mapsQ)||(Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.maps)),
 'unlocated PDF records use search links rather than guessed coordinates':newRoots.filter(x=>x.lat==null&&x.lon==null).every(x=>x.maps===''&&x.mapsQ&&x.mapReview)&&newRoots.filter(x=>x.lat!=null||x.lon!=null).every(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.maps),
 'PDF sourced company and brand showrooms are explicitly retained':newRoots.every(x=>x.pdfShowroomVerified===true),
 'review-required source conflicts remain flagged':JSON.stringify(actualReviewRequiredIds)===JSON.stringify(reviewRequiredIds),
 'Riyadh Shifa and Qadisiyah group inventory remains intact':shifa.length===15&&qadi.length===33
};
const failed=Object.entries(tests).filter(([,v])=>!v).map(([k])=>k);
console.log(JSON.stringify({suite:'PDF showroom overlap and source integrity',counts:{total:cars.length,pdfClones:pdfClones.length,newRoots:newRoots.length,newClones:newClones.length,sharedAbhaKhamis:shared.length,shifa:shifa.length,qadisiyah:qadi.length},tests,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));
if(failed.length)process.exitCode=1;
