const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'retained-data-baseline.json'),'utf8'));
let retained=0,phones=0;
for(const [kind,rows] of Object.entries(baseline.records)){
 const current=JSON.parse(fs.readFileSync(path.join(root,'data',kind+'.json'),'utf8'));
 const byId=new Map(current.map(x=>[kind==='nhc'?x.n+'\u0000'+x.city:x.id,x]));
 assert.equal(byId.size,current.length,kind+' duplicate IDs');
 for(const prior of rows){
  const now=byId.get(prior.id);assert(now,kind+' missing '+prior.id);retained++;
  for(const [i,p] of prior.phones.entries()){
   const at=(now.phones||[]).indexOf(p);assert(at>=0,prior.id+' dropped phone '+p);phones++;
   if(prior.phoneContacts[i])assert(now.phoneContacts[at]===prior.phoneContacts[i] || (prior.phoneContacts[i]==='رقم المعرض' && now.phoneContacts[at].startsWith('رقم المعرض — ')),prior.id+' detached contact '+p);
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

const namedPrimary=[["prior-qadisiyya-27","0535558085","أحمد"],["prior-qadisiyya-28","0533615115","صالح"],["prior-qadisiyya-29","0532763660","ناجي"],["prior-qadisiyya-30","0536131396","يزن"],["prior-qadisiyya-31","0506973877","مهاب"],["prior-qadisiyya-32","0561873516","فايز"],["prior-qadisiyya-33","0550805506","أبو غيث"],["prior-qadisiyya-34","0566415653","نور الدين الحيدري"],["prior-qadisiyya-35","0533490871","محمد"],["prior-qadisiyya-36","0536123588","فريد"],["prior-qadisiyya-37","0537713043","أبو مريم"],["prior-qadisiyya-39","0567391596","حازم"],["prior-qadisiyya-40","0531588302","أبو عبدالكريم"],["prior-qadisiyya-41","0590838966","لؤي"],["prior-qadisiyya-42","0566376813","علي حجاج"],["prior-qadisiyya-43","0558757576","أحمد نصر"],["prior-qadisiyya-45","0550648257","أبو يوسف"],["prior-qadisiyya-46","0540222002","محمد أبو نواف"],["prior-qadisiyya-47","0541341833","شاهر"],["prior-qadisiyya-48","0563272853","مؤمن"]];
for(const [id,phone,name] of namedPrimary){const x=cars.find(x=>x.id===id),at=x.phones.indexOf(phone);assert(at>=0&&x.phoneContacts[at].includes(name),id+' main report contact detached');}
