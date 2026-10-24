/* Pure helpers for email-link authentication. */
(function(root){
 const api={
  callback(hash){
   const p=new URLSearchParams(String(hash||'').replace(/^#/,''));
   if(p.has('error')||p.has('error_code'))return {kind:'error'};
   if(!p.has('access_token')&&!p.has('refresh_token'))return {kind:'none'};
   const access=p.get('access_token'),refresh=p.get('refresh_token');
   if(!access||!refresh||access.length>16000||refresh.length>16000)return {kind:'error'};
   const seconds=Number(p.get('expires_in')||3600);
   return {kind:'session',session:{access_token:access,refresh_token:refresh,expires_at:Math.floor(Date.now()/1000)+(Number.isFinite(seconds)?Math.max(0,Math.min(seconds,86400)):3600)}};
  },
  request(email,name,mode,redirectUrl){
   const url=new URL(redirectUrl);
   if(url.protocol!=='https:')throw Error('Invalid redirect');
   return {path:'otp?redirect_to='+encodeURIComponent(url.href),body:{email:email.trim(),create_user:mode==='signup',...(mode==='signup'&&name?{data:{name:name.trim()}}:{})}};
  },
  message(status){return status===429?'طلبات كثيرة؛ انتظر قليلًا ثم حاول مجددًا.':'تعذّر إرسال رابط الدخول. تحقق من الإيميل وحاول لاحقًا.';}
 };
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ElhamiAuthFlow=api;
})(typeof window!=='undefined'?window:globalThis);
