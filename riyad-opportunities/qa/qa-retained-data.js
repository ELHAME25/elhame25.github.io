const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'retained-data-baseline.json'),'utf8'));
let retained=0,phones=0;
for(const [kind,rows] of Object.entries(baseline.records)){
 const current=JSON.parse(fs.readFileSync(path.join(root,'data',kind+'.json'),'utf8'));
 const byId=new Map(current.map(x=>[x.id,x]));
 assert.equal(byId.size,current.length,kind+' duplicate IDs');
 for(const prior of rows){
  const now=byId.get(prior.id);assert(now,kind+' missing '+prior.id);retained++;
  for(const [i,p] of prior.phones.entries()){
   const at=(now.phones||[]).indexOf(p);assert(at>=0,prior.id+' dropped phone '+p);phones++;
   if(prior.phoneContacts[i])assert.equal(now.phoneContacts[at],prior.phoneContacts[i],prior.id+' detached contact '+p);
  }
  if(prior.contact)assert.equal(now.contact,prior.contact,prior.id+' replaced named sales contact');
  assert.equal(now.img||'',prior.img,prior.id+' changed a deferred image');
 }
}
const cars=JSON.parse(fs.readFileSync(path.join(root,'data/cars.json'),'utf8'));
const company=JSON.parse(fs.readFileSync(path.join(root,'data/companies.json'),'utf8'));
for(const [id,phone] of [['report-qadisiyah-alsharaf','0536392223'],['report-qadisiyah-alkhadr','0538712548'],['report-qadisiyah-alsaadi','0501223206'],['report-ahsa-almulhim','0558111423']]){
 const x=cars.find(x=>x.id===id);assert(x&&x.phones.includes(phone)&&x.mapsQ&&x.pageEvidence,id+' report mismatch');
}
const nhc=company.find(x=>x.id==='report-nhc-sales-riyadh');
assert(nhc&&nhc.phones.includes('0555454753')&&nhc.phones.includes('0595923759'),'NHC named sales phones missing');
console.log(JSON.stringify({suite:'Retained source records, phones, contacts and deferred images',baseCommit:baseline.baseCommit,retained,phones,addedReportShowrooms:4,ok:true}));
