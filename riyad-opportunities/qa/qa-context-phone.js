const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
class El {
  constructor(id) { this.id=id; this.innerHTML=''; this.textContent=''; this.value=''; this.dataset={}; this.handlers={}; this.classList={contains:()=>false}; this.style={}; }
  addEventListener(k,f) { this.handlers[k]=f; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  setAttribute() {}
  getAttribute() { return null; }
}
const els={};
const document={
  title:'', body:{appendChild(){}},
  getElementById(id) { if(id==='site-config') return null; return els[id]||(els[id]=new El(id)); },
  querySelector(selector) { return selector.indexOf('data-phonesel')>=0 ? {value:'0'} : null; },
  querySelectorAll() { return []; }, addEventListener(){}, createElement(){return new El('new');}
};
const location={hash:'',pathname:'/',search:''}, localStorage={getItem(){return null},setItem(){},removeItem(){}};
const window={location,scrollTo(){},addEventListener(){}};
const fetch=async u=>{const p=path.join(root,u.split('?')[0]);return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8'))}};
let src=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').replace('  boot();',`  window.__phoneQA={currentPhone, seed:function(){REG[0]={o:{phones:['0500000001','0500000002']}};}}; boot();`);
vm.runInNewContext(src,{document,window,location,history:{replaceState(){}},localStorage,navigator:{},fetch,setTimeout,clearTimeout,console,URL,Blob});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await wait(150);
  const api=window.__phoneQA; api.seed();
  const makeContext=value=>({closest(){return {querySelector(){return {value:String(value)}}}}});
  const cardPhone=api.currentPhone(0,makeContext(0));
  const dialogPhone=api.currentPhone(0,makeContext(1));
  const fallbackPhone=api.currentPhone(0,null);
  const tests={cardUsesCardSelection:cardPhone==='0500000001',dialogUsesDialogSelection:dialogPhone==='0500000002',legacyFallbackStillWorks:fallbackPhone==='0500000001'};
  const failed=Object.entries(tests).filter(([,v])=>!v).map(([k])=>k);
  console.log(JSON.stringify({suite:'context-aware multi-number actions',tests,passed:Object.values(tests).filter(Boolean).length,total:Object.keys(tests).length,failed},null,2));
  if(failed.length) process.exitCode=1;
})();
