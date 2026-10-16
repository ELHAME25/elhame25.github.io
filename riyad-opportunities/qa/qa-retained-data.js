const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'retained-data-baseline.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(root,'MAP_AUDIT_LEDGER_2026-10-10.json'),'utf8'));
const auditById=new Map(audit.entries.map(x=>[x.id,x]));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'CAR_CORRECTION_APPLICATION_MANIFEST_212_R1_SAFE_PREVIEW_2026-10-11.json'),'utf8'));
const finalApplication=JSON.parse(fs.readFileSync(path.join(root,'audits/FINAL_CAR_APPLICATION_REPORT_2026-10-12.json'),'utf8'));
const finalRemovedIds=new Set(finalApplication.removed_ids||[]);
const finalDecisions=new Map();
for(const name of finalApplication.audits_considered||[]){
 const doc=JSON.parse(fs.readFileSync(path.join(root,'audits',name),'utf8'));
 for(const row of doc.records||doc.decisions||[])finalDecisions.set(row.id,row);
}
assert.equal(manifest.package_id,'CAR_CORRECTION_212_R1_SAFE_PREVIEW_2026-10-11','unexpected correction package');
const approvedExclusions=new Map(manifest.base_corrections.filter(x=>String(x.new_value?.action||'').startsWith('exclude_')).map(x=>[x.id,x]));
assert.equal(approvedExclusions.size,210,'approved exclusion count changed');
const dealers=JSON.parse(fs.readFileSync(path.join(root,'data/dealers.json'),'utf8'));
const dealerById=new Map(dealers.map(x=>[x.id,x]));
const dealerMigrations=new Map([['phase6-cars-56fc1e0cbe2502','official-dealer-mbabgi-qunfudhah'],['pdf-smalltown-026','official-dealer-mbabgi-qunfudhah']]);
let retained=0,phones=0;
for(const [kind,rows] of Object.entries(baseline.records)){
 const current=JSON.parse(fs.readFileSync(path.join(root,'data',kind+'.json'),'utf8'));
 const byId=new Map(current.map(x=>[kind==='nhc'?x.n+'\u0000'+x.city:x.id,x]));
 assert.equal(byId.size,current.length,kind+' duplicate IDs');
 for(const prior of rows){
  const now=byId.get(prior.id);
  if(!now){
   const entry=auditById.get(prior.id),archive=entry?.archivedRecord;
   const finalDecision=finalDecisions.get(prior.id);
   const finalProposed=finalDecision?.proposed_change||finalDecision?.proposed_changes||finalDecision?.proposedChange||finalDecision?.proposed||{};
   const finalArchiveDecision=String(finalDecision?.decision||'').includes('archive')||finalProposed.archive||finalProposed.archive_from_display||finalProposed.archive_duplicate||finalProposed.archive_duplicate_from_display;
   const properlyFinalArchived=kind==='cars'&&finalRemovedIds.has(prior.id)&&finalArchiveDecision&&!!(finalDecision.evidence||finalDecision.rationale||finalDecision.verified?.status||finalDecision.verified?.maps||finalDecision.googleCard?.url||finalDecision.observed?.closure_label||finalDecision.observed?.maps_cid||finalDecision.observed?.maps_url||(finalDecision.canonical_id&&finalDecision.place_ref)||(finalDecision.evidence_urls||[]).length);
   const properlyArchived=kind==='cars'&&archive?.id===prior.id&&entry.archiveReason&&['excluded_official_dealer','excluded_from_unverified_city_alias'].includes(entry.decision)&&!byId.has(prior.id);
   const migratedDealer=kind==='cars'?dealerById.get(dealerMigrations.get(prior.id)):null;
   const properlyMigrated=!!migratedDealer&&migratedDealer.city==='القنفذة'&&migratedDealer.kind==='وكالة سيارات رسمية'&&migratedDealer.web==='https://mbabgi.sa/findcenter'&&!!migratedDealer.maps;
   const approvedExclusion=kind==='cars'?approvedExclusions.get(prior.id):null;
   const retainedCanonical=approvedExclusion?.retain_id&&!approvedExclusions.has(approvedExclusion.retain_id)?byId.get(approvedExclusion.retain_id):null;
   const canonicalFinallyArchived=approvedExclusion?.retain_id&&finalRemovedIds.has(approvedExclusion.retain_id);
   const properlyExcluded=!!approvedExclusion&&(!!retainedCanonical||properlyMigrated||canonicalFinallyArchived)&&((approvedExclusion.evidence||[]).length>0||(approvedExclusion.proof||[]).length>0);
   assert(properlyArchived||properlyExcluded||properlyFinalArchived,kind+' missing '+prior.id);
   const preserved=properlyFinalArchived?prior:(properlyMigrated?migratedDealer:(properlyExcluded?approvedExclusion.current_record:archive));
   for(const p of prior.phones||[])assert((preserved.phones||[]).includes(p),prior.id+' preserved without source phone '+p);
   if(prior.contact)assert.equal(preserved.contact,prior.contact,prior.id+' preserved without named contact');
   assert.equal(preserved.img||'',prior.img,prior.id+' changed a deferred image during preservation');
   retained++;continue;
  }
  retained++;
  for(const [i,p] of prior.phones.entries()){
   const at=(now.phones||[]).indexOf(p);
   if(at<0){
    const entry=auditById.get(prior.id),archived=(entry?.archivedRecord?.phones||[]).includes(p)||entry?.corrected_from?.phone===p;
    const evidence=[entry?.evidence_note,entry?.map_check?.notes,JSON.stringify(entry?.correctedRecord||{}),JSON.stringify(entry?.field_checks?.phone||{})].filter(Boolean).join(' ').replace(/\+?966/g,'0').replace(/\D/g,'');
    const corrected=!!entry&&/corrected/i.test(entry.status||'')&&!!entry.evidence_note&&(now.phones||[]).length>0&&(now.phones||[]).every(phone=>evidence.includes(String(phone).replace(/\D/g,'')));
    const finalDecision=finalDecisions.get(prior.id),proposed=finalDecision?.proposed_change||finalDecision?.proposed_changes||finalDecision?.proposedChange||finalDecision?.proposed||finalDecision?.proposed_correction?.new_value||finalDecision?.proposed_correction||finalDecision?.verified;
    const proposedPhones=proposed?.phones||(proposed?.phone?[proposed.phone]:[]);
    const finalCorrectionEvidence=!!(finalDecision?.evidence||finalDecision?.rationale||finalDecision?.verified?.maps||finalDecision?.googleCard?.url||finalDecision?.observed?.maps_cid||finalDecision?.observed?.maps_url||(finalDecision?.evidence_urls||[]).length);
    const finalCorrected=finalCorrectionEvidence&&proposedPhones.length>0&&proposedPhones.every(phone=>(now.phones||[]).includes(phone));
    const finalConfirmed=String(finalDecision?.field_decisions?.phone||'').includes('confirmed')&&(finalDecision?.evidence_urls||[]).length>0&&(now.phones||[]).length>0;
    const rowDocumentedCorrection=!!now.phoneSource&&String(now.phoneAudit||'').includes(p)&&String(now.mapReviewStatus||'').includes('corrected');
    assert((archived&&corrected&&(entry.archiveReason||entry.corrected_from?.phone===p))||finalCorrected||finalConfirmed||rowDocumentedCorrection,prior.id+' dropped phone '+p+' without an archived, evidenced correction');phones++;
    continue;
   }
   phones++;
   if(prior.phoneContacts[i])assert(now.phoneContacts[at]===prior.phoneContacts[i] || (prior.phoneContacts[i]==='رقم المعرض' && now.phoneContacts[at].startsWith('رقم المعرض — ')),prior.id+' detached contact '+p);
  }
  if(prior.contact)assert.equal(now.contact,prior.contact,prior.id+' replaced named sales contact');
  // Reviewed replacement of the broken Asalah URL with the exact official gallery image.
  const correctedAsalah=kind==='nhc'&&prior.id==='الأصالة\u0000الرياض'&&now.img==='https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2024-02/CAM_02_Cluster_B_0.jpg';
  if(correctedAsalah){assert.equal(now.imageSource,'https://www.nhc.sa/ar/real-estate-development/communities/12592/');assert(now.imageVerifiedAt&&!isNaN(Date.parse(now.imageVerifiedAt)));assert.equal(now.imageType,'تصور معماري رسمي للوجهة');}
  else if(kind==='projects'&&prior.id==='P029'&&now.img===''){
   // One exact proven wrong-project image is held, not silently removed or reused.
   const source='https://jinanfadak.sa/projects/مجمع-محيط-البركة-السكني-التجاري';
   assert.equal(prior.img,'https://jinanfadak.sa/wp-content/uploads/2021/11/3-1024x682.jpg');
   assert.equal(now.n,'جي برايم 1');assert.equal(now.dev,'شركة جنان فدك للتطوير و الاستثمار العقاري');assert.equal(now.city,'سيهات');
   assert.equal(now.imageDisplayStatus,'held_wrong_project_provenance');assert.equal(now.imageType,'رسم عقاري توضيحي، وليس صورة المشروع');assert.equal(now.imagePlaceholder,'assets/images/real-estate-illustrative-apartments.svg');
   assert.equal(decodeURIComponent(now.imageSource),source);assert.equal(decodeURIComponent(now.imageSourceUrl),source);
   assert(Array.isArray(now.imageProvenanceHistory)&&now.imageProvenanceHistory.some(h=>h.url===prior.img&&decodeURIComponent(h.source||'')===source&&h.status==='held_from_display'&&h.sourceProjectName==='مجمع محيط البركة السكني التجاري'&&h.sourceProjectLocation==='غرب بلدة الجش بمحافظة القطيف'&&h.checkedAt&&!isNaN(Date.parse(h.checkedAt))&&String(h.reason||'').trim()),'P029 missing exact retained wrong-project provenance');
  }
  else assert.equal(now.img||'',prior.img,prior.id+' changed a deferred image');
 }
}
const cars=JSON.parse(fs.readFileSync(path.join(root,'data/cars.json'),'utf8'));
const company=JSON.parse(fs.readFileSync(path.join(root,'data/companies.json'),'utf8'));
for(const [id,phone] of [['report-qadisiyah-alsharaf','0536392223'],['report-qadisiyah-alkhadr','0538712548'],['report-qadisiyah-alsaadi','0501223206'],['report-ahsa-almulhim','0558111423']]){
 const x=cars.find(x=>x.id===id);
 if(x)assert(x.phones.includes(phone)&&x.mapsQ&&x.pageEvidence,id+' report mismatch');
 else{const archived=auditById.get(id)?.archivedRecord;assert(archived?.phones?.includes(phone)&&archived.mapsQ&&archived.pageEvidence,id+' archived report mismatch');}
}
const nhc=company.find(x=>x.id==='report-nhc-sales-riyadh');
assert(nhc&&nhc.phones.includes('0555454753')&&nhc.phones.includes('0595923759'),'NHC named sales phones missing');
console.log(JSON.stringify({suite:'Retained source records, phones, contacts and deferred images',baseCommit:baseline.baseCommit,retained,phones,addedReportShowrooms:4,ok:true}));

const namedPrimary=[["prior-qadisiyya-27","0535558085","أحمد"],["prior-qadisiyya-28","0533615115","صالح"],["prior-qadisiyya-29","0532763660","ناجي"],["prior-qadisiyya-30","0536131396","يزن"],["prior-qadisiyya-31","0506973877","مهاب"],["prior-qadisiyya-32","0561873516","فايز"],["prior-qadisiyya-33","0550805506","أبو غيث"],["prior-qadisiyya-34","0566415653","نور الدين الحيدري"],["prior-qadisiyya-35","0533490871","محمد"],["prior-qadisiyya-36","0536123588","فريد"],["prior-qadisiyya-37","0537713043","أبو مريم"],["prior-qadisiyya-39","0567391596","حازم"],["prior-qadisiyya-40","0531588302","أبو عبدالكريم"],["prior-qadisiyya-41","0590838966","لؤي"],["prior-qadisiyya-42","0566376813","علي حجاج"],["prior-qadisiyya-43","0558757576","أحمد نصر"],["prior-qadisiyya-45","0550648257","أبو يوسف"],["prior-qadisiyya-46","0540222002","محمد أبو نواف"],["prior-qadisiyya-47","0541341833","شاهر"],["prior-qadisiyya-48","0563272853","مؤمن"]];
for(const [id,phone,name] of namedPrimary){const x=cars.find(x=>x.id===id),at=x.phones.indexOf(phone);assert(at>=0&&x.phoneContacts[at].includes(name),id+' main report contact detached');}

const sourceCityCorrections=[["P046","الرياض",42],["P277","الرياض",1],["P356","جدة",2641],["P546","جدة",3834],["P562","جدة",457],["P570","جدة",436],["P571","جدة",525]];
const projects=JSON.parse(fs.readFileSync(path.join(root,'data/projects.json'),'utf8'));
for(const [id,city,units]of sourceCityCorrections){const p=projects.find(x=>x.id===id);assert(p&&p.city===city&&p.reportUnits===units&&decodeURIComponent(p.mapsQ).endsWith(city),id+' developer report city mismatch');}

