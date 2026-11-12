// Same-address foreground updates. Drafts stay in this tab's session storage only.
export function installUpdates({capture,restore},env=globalThis){
 const {document:doc,window:win=env}=env;
 const key='finance-update-draft-v1',current=doc.documentElement.dataset.release;
 let checking=false,moving=false;
 try{const raw=env.sessionStorage.getItem(key);if(raw){env.sessionStorage.removeItem(key);const draft=JSON.parse(raw);if(Date.now()-draft.savedAt<30*60*1000)restore(draft.data);}}catch{}
 async function check(){
  if(checking||moving||doc.visibilityState==='hidden'||!current)return;
  checking=true;
  try{
   const url=new URL('./release.json',win.location.href);url.searchParams.set('_',Date.now());
   const response=await env.fetch(url,{cache:'no-store'});
   if(!response.ok)return;
   const next=await response.json();
   if(!/^[a-zA-Z0-9._-]{1,80}$/.test(next.version)||next.version===current)return;
   const data=capture();
   env.sessionStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}));
   moving=true;
   const target=new URL(win.location.href);target.searchParams.set('_release',next.version);
   win.location.replace(target.href);
  }catch{}finally{checking=false;}
 }
 doc.addEventListener('visibilitychange',check);
 win.addEventListener('pageshow',check);
 win.addEventListener('focus',check);
 env.setInterval(check,60000);
 check();
 return {check};
}
