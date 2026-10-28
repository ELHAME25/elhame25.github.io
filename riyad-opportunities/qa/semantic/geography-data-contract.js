#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..')),out=path.resolve(process.argv[3]||'geography-data-report.json');
const f=require('./reviewed-geography-fixture.json');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const sha=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const r={mode:'reviewed-geography-retention',sourceReachabilityVerified:false,checks:[],failures:[]};
function check(name,fn){try{fn();r.checks.push({name,ok:true});}catch(e){r.checks.push({name,ok:false});r.failures.push({name,message:e.message});}}
const data={};
for(const [file,spec] of Object.entries(f.files)){
 const rows=data[file]=JSON.parse(fs.readFileSync(path.join(root,'data',file)));
 check(file+' all original records/order and non-geographic fields preserved',()=>{assert.equal(rows.length,spec.rowCount);const protectedRows=rows.map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>!f.geographicFields.includes(k))));assert.equal(sha(protectedRows),spec.protectedOrderedRowsSha256);});
}
for(const spec of f.records)check(spec.file+' '+spec.id+' reviewed location applied',()=>{const row=data[spec.file].find(x=>(x.id||x.c)===spec.id);assert(row);for(const [k,v] of Object.entries(spec.expected))assert.deepEqual(row[k],v,k);});
r.total=r.checks.length;r.passed=r.checks.filter(x=>x.ok).length;r.ok=!r.failures.length;fs.writeFileSync(out,JSON.stringify(r,null,2));console.log(JSON.stringify({ok:r.ok,total:r.total,passed:r.passed,failures:r.failures},null,2));if(!r.ok)process.exitCode=1;
