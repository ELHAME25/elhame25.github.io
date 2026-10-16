#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const css=fs.readFileSync(path.join(root,'assets/app.css'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [token,value] of Object.entries({'--navy':'#2b256c','--navy-2':'#38386e','--teal':'#009c94','--mint':'#ecf8f7','--ink':'#1f1d45'}))assert(css.includes(token+':'+value),token+' must match the approved live portal');
assert(css.includes('--font-head:"Noto Kufi Arabic","Noto Sans Arabic",Tahoma,sans-serif'));
assert(css.includes('--font:"Noto Sans Arabic",Tahoma,sans-serif'));
assert(html.includes('Noto+Kufi+Arabic')&&html.includes('Noto+Sans+Arabic'));
assert(html.includes('name="theme-color" content="#2b256c"'));
assert(!css.includes('#092746')&&!css.includes('#006377'));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/brand/riyad-bank-logo.png'))).digest('hex'),'daffd1efd0f4b9ee4278040cc58457980468549af24d96df1b3f230afe330ae0','Original live right-header logo changed');
console.log(JSON.stringify({suite:'Live-reference brand identity',ok:true,originalLogoUnchanged:true,palette:'live portal',typography:'live portal Noto families, not a claim of proprietary bank font licensing'}));
