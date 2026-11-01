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
  emailKey(email){let h=2166136261;for(const c of String(email||'').trim().toLowerCase()){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return 'elhami-email-wait-v1:'+ (h>>>0).toString(16);},
  emailError(status,body={},retryAfter='',now=Date.now()){
   const code=String(body.code||body.error_code||'');let seconds=0;
   if(/^\d+$/.test(String(retryAfter).trim()))seconds=Number(retryAfter);else if(retryAfter){const date=Date.parse(retryAfter);if(Number.isFinite(date))seconds=Math.max(0,Math.ceil((date-now)/1000));}
   const match=String(body.msg||body.message||body.error_description||'').match(/after\s+(\d+)\s+seconds?/i);if(match)seconds=Math.max(seconds,Number(match[1]));
   const throttled=status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(code);
   if(throttled)seconds=Math.min(86400,Math.max(1,seconds||60));else seconds=0;
   const messages={email_address_invalid:'صيغة الإيميل غير صحيحة. راجعها ثم أعد المحاولة.',email_address_not_authorized:'خدمة البريد لا تسمح بإرسال الرابط إلى هذا العنوان حاليًا. يحتاج إعداد البريد إلى مراجعة.',signup_disabled:'إنشاء الحسابات الجديدة متوقف حاليًا.',otp_disabled:'الدخول برابط البريد غير متاح في إعدادات الخدمة حاليًا.',over_email_send_rate_limit:match?'طلبت رابطًا قبل قليل. إذا وصلتك رسالة حديثة، افتحها؛ لن نرسل طلبًا آخر أثناء الانتظار.':'خدمة البريد حدّت الإرسال مؤقتًا. يمكنك المحاولة بعد الانتظار، لكن انتهاء العداد لا يضمن زوال حدّ الخدمة.',over_request_rate_limit:'خدمة الدخول حدّت الطلبات مؤقتًا. لن نكرر الإرسال تلقائيًا.'};
   return {status,code,seconds,throttled,message:messages[code]||(throttled?'خدمة الدخول حدّت الإرسال مؤقتًا. انتظر انتهاء المدة؛ لن نكرر الطلب تلقائيًا.':status>=500?'تعذّرت خدمة البريد مؤقتًا. لم نؤكد إرسال رابط جديد.':'تعذّر طلب رابط الدخول. راجع الإيميل ثم حاول لاحقًا.')};
  },
  message(status){return api.emailError(status).message;}

 };
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ElhamiAuthFlow=api;
})(typeof window!=='undefined'?window:globalThis);
