#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..')),out=path.resolve(process.argv[3]||'geography-data-report.json');
const f=require('./reviewed-geography-fixture.json');
const transitions=require('./national-retention-transitions.json');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const sha=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const r={mode:'reviewed-geography-retention',sourceReachabilityVerified:false,checks:[],failures:[]};
function check(name,fn){try{fn();r.checks.push({name,ok:true});}catch(e){r.checks.push({name,ok:false});r.failures.push({name,message:e.message});}}
const data={};
for(const [file,spec] of Object.entries(f.files)){
 const rows=data[file]=JSON.parse(fs.readFileSync(path.join(root,'data',file)));
 check(file+' all original records/order and non-geographic fields preserved',()=>{
  const tr=transitions.files[file],id=x=>x.id||x.c,protect=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!f.geographicFields.includes(k)));
  if(!tr){assert.equal(rows.length,spec.rowCount);assert.equal(sha(rows.map(protect)),spec.protectedOrderedRowsSha256);return;}
  assert.equal(tr.originalRowCount,spec.rowCount);assert.equal(tr.originalProtectedOrderedRowsSha256,spec.protectedOrderedRowsSha256,'Original baseline must not be replaced');
  assert.equal(rows.length,tr.originalRowCount+tr.appendedRows.length);assert.deepEqual(rows.slice(0,tr.originalRowCount).map(id),tr.originalIds,'Original IDs/order retained');
  assert.equal(new Set(rows.map(id)).size,rows.length,'No duplicate IDs');
  const changed=new Set(tr.changedRows.map(x=>x.id));assert.equal(sha(rows.slice(0,tr.originalRowCount).filter(x=>!changed.has(id(x))).map(protect)),tr.unchangedProtectedOrderedRowsSha256,'Unapproved non-geographic mutation');
  for(const approved of tr.changedRows){const row=rows.find(x=>id(x)===approved.id);assert(row);assert.equal(sha(row),approved.afterRowSha256,'Approved changed row must match exactly: '+approved.id);}
  assert.deepEqual(rows.slice(tr.originalRowCount).map(id),tr.appendedRows.map(x=>x.id),'Only explicitly approved append order');
  for(const approved of tr.appendedRows)assert.equal(sha(rows.find(x=>id(x)===approved.id)),approved.rowSha256,'New row changed: '+approved.id);
 });
}
for(const spec of f.records)check(spec.file+' '+spec.id+' reviewed location applied',()=>{const row=data[spec.file].find(x=>(x.id||x.c)===spec.id);assert(row);for(const [k,v] of Object.entries(spec.expected))assert.deepEqual(row[k],v,k);});
r.total=r.checks.length;r.passed=r.checks.filter(x=>x.ok).length;r.ok=!r.failures.length;fs.writeFileSync(out,JSON.stringify(r,null,2));console.log(JSON.stringify({ok:r.ok,total:r.total,passed:r.passed,failures:r.failures},null,2));if(!r.ok)process.exitCode=1;
