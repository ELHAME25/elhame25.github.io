/* Shared account-token lifecycle; no UI, user-content storage, or privileged keys. */
(()=>{'use strict';const KEY='elhami-auth-session';let inflight=null;
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY));}catch{return null;}};
async function refresh(cfg,original,guard=()=>{}){const owner=original?.user?.id;if(!owner)throw Error('سجّل الدخول أولًا.');
 const run=async()=>{guard();let session=read();if(!session||session.user?.id!==owner)throw Error('تغيّر الحساب؛ أعد المحاولة.');if(session.expires_at>Date.now()/1000+60)return session;
 if(!session.refresh_token)throw Error('انتهت الجلسة. أكّد الدخول من البريد.');const before=session.refresh_token;
 const r=await fetch(cfg.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:before})});guard();const latest=read();if(!latest||latest.user?.id!==owner||latest.refresh_token!==before)throw Error('تغيّرت الجلسة أثناء الاتصال؛ أعد المحاولة.');if(!r.ok)throw Error('انتهت الجلسة. أكّد الدخول من البريد.');const value=await r.json();guard();const after=read();if(!after||after.user?.id!==owner||after.refresh_token!==before||value.user?.id!==owner)throw Error('تغيّرت الجلسة أثناء الاتصال؛ لم نحفظ النتيجة.');const next={...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+value.expires_in};localStorage.setItem(KEY,JSON.stringify(next));return next;};
 if(navigator.locks?.request)return navigator.locks.request('elhami-auth-refresh',run);
 // Without a cross-tab lock, never race rotating refresh tokens. A new email login remains available.
 const current=read();guard();if(current?.user?.id===owner&&current.expires_at>Date.now()/1000+60)return current;
 throw Error('لإكمال الدخول بأمان في هذا المتصفح، أكّد الدخول مجددًا من بريدك.');
}
window.ElhamiAccountSession={refresh,read};
})();
