(()=>{let cfg={},mode='login',pending=null,cooldown=0,interval=null,session=null;const q=s=>document.querySelector(s);const area=document.createElement('section');area.id='welcome';area.innerHTML=`<div class="welcome-wrap"><div class="welcome-copy"><h1>حوار يبقى أثره</h1><img class="brand-art" src="assets/elhami-reflection-approved.svg" width="1672" height="941" alt="نقرأ فتتسع رؤيتنا، ونتحاور فيتعمق فهمنا، ونكتب ليبقى الأثر. حوار بين ثلاثة رجال بلباس متنوع، أحدهم بالشماغ."></div><div class="auth-card"><div class="auth-tabs"><button id="login-tab" class="selected">تسجيل الدخول</button><button id="signup-tab">تسجيل جديد</button></div><div id="auth-content"></div><button class="text-btn" id="explore">تعرّف على الموقع ←</button><p class="muted"></p></div></div>`;document.querySelector('main').before(area);const style=document.createElement('style');style.textContent=`body.auth-screen main,body.auth-screen header nav,body.auth-screen footer{display:none}#welcome{display:none}body.auth-screen #welcome{display:block}.welcome-wrap{max-width:1250px;margin:60px auto;padding:0 5vw;display:grid;grid-template-columns:1.15fr 1fr;gap:70px;align-items:center}.welcome-copy h1{font-size:34px}.welcome-copy p{font-size:18px}.auth-card{background:#fffefa;border:1px solid var(--line);border-radius:16px;padding:32px}.auth-tabs{display:flex;border-bottom:1px solid var(--line);gap:24px;margin-bottom:24px}.auth-tabs button{background:none;border:0;padding:12px 0;color:var(--ink)}.auth-tabs .selected{border-bottom:2px solid var(--gold);font-weight:bold}.auth-card h2{font-size:21px}.auth-card .primary{width:100%;margin-top:20px}.auth-card .error{min-height:25px;margin-top:10px}.auth-card .text-btn{font-size:13px}.otp-input{text-align:center;letter-spacing:10px;font-size:24px}.auth-card a{text-underline-offset:4px}.auth-links{margin-top:16px;font-size:12px}.auth-links button{font-size:12px}.welcome-copy{position:relative}@media(max-width:760px){.welcome-wrap{margin:28px auto;grid-template-columns:1fr;gap:20px}.welcome-copy img{display:none}.welcome-copy h1{font-size:28px;margin-bottom:12px}.welcome-copy p{font-size:15px;margin-bottom:8px}.auth-card{padding:24px}.auth-tabs{gap:22px}.welcome-copy{padding:0 4px}}`;document.head.append(style);document.body.classList.add('auth-screen');const profile=q('#profile');profile.textContent='تسجيل الدخول';profile.onclick=()=>{if(session)account();else{document.body.classList.add('auth-screen');form('login')}};window.elhamiAccess={get authenticated(){return !!session;},get userId(){return session?.user?.id||null;},prompt(m='login'){document.body.classList.add('auth-screen');document.body.classList.remove('browse-mode');form(m);window.scrollTo(0,0);}};
const flow=window.ElhamiAuthFlow;
// Preserve an existing verified tab session when moving to device persistence.
try{if(!localStorage.getItem('elhami-auth-session')){const previous=sessionStorage.getItem('elhami-auth-session');if(previous)localStorage.setItem('elhami-auth-session',previous);}sessionStorage.removeItem('elhami-auth-session');}catch{}
const callback=flow.callback(location.hash);
// Remove credentials from browser history before any asynchronous callback work.
if(callback.kind!=='none')history.replaceState(null,'',location.pathname+location.search);
const ready=()=>!!(cfg.url&&cfg.publishableKey&&cfg.redirectUrl);
const endpoint=p=>cfg.url.replace(/\/$/,'')+'/auth/v1/'+p;
async function call(path,data,bearer){
 const r=await fetch(endpoint(path),{method:data?'POST':'GET',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const value=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(path.startsWith('otp')?flow.message(r.status):'تعذّر التحقق من رابط الدخول. اطلب رابطًا جديدًا.');
 return value;
}
function state(message){const el=q('#auth-error');if(el)el.textContent=message;}
function form(m){
 mode=m;pending=null;clearInterval(interval);
 q('#login-tab').classList.toggle('selected',m==='login');q('#signup-tab').classList.toggle('selected',m==='signup');
 q('#auth-content').innerHTML=`<h2>${m==='signup'?'ابدأ حسابك':'سعيدون بعودتك'}</h2><p class="muted">${m==='signup'?'اسمك وإيميلك، ثم رسالة لتأكيد حسابك.':'أدخل إيميلك للدخول.'}</p><form id="auth-form">${m==='signup'?'<label for="signup-name">الاسم</label><input id="signup-name" autocomplete="name" required minlength="2" maxlength="60">':''}<label for="auth-email">الإيميل</label><input id="auth-email" type="email" autocomplete="email" required maxlength="254" dir="ltr" placeholder="name@example.com">${m==='signup'?'<label class="check"><input id="auth-agree" type="checkbox" required> أوافق على شروط الاستخدام، واطّلعت على سياسة الخصوصية</label>':''}<button class="primary" id="send-link">${m==='signup'?'إرسال رابط التأكيد':'دخول'}</button><p class="error" role="status" id="auth-error"></p><button type="button" class="text-btn" id="verify-device" hidden>تأكيد الدخول على هذا الجهاز</button></form><div class="auth-links"><button class="text-btn" id="terms-link">شروط الاستخدام</button> · <button class="text-btn" id="privacy-link">سياسة الخصوصية</button></div>`;
 q('#terms-link').onclick=terms;q('#privacy-link').onclick=privacy;
 if(m==='login')try{q('#auth-email').value=localStorage.getItem('elhami-remembered-email')||'';}catch{}
 q('#verify-device').onclick=async()=>{if(pending?.mode==='login'&&q('#auth-form').reportValidity()){pending.email=q('#auth-email').value.trim();await send();}};
 q('#auth-form').onsubmit=async e=>{e.preventDefault();if(!ready()||cfg.emailLinkReady===false){state('خدمة الدخول بالبريد غير متاحة حاليًا.');return;}
 pending={email:q('#auth-email').value.trim(),name:m==='signup'?q('#signup-name').value.trim():'',mode:m};
 if(m==='login'){
  let stored;try{stored=JSON.parse(localStorage.getItem('elhami-auth-session'));}catch{}
  if(stored?.access_token&&stored.user?.email?.toLowerCase()===pending.email.toLowerCase()){
   try{await resume(stored);return;}catch{}
  }
  state('هذا الجهاز غير معتمد أو انتهت جلسة دخوله. أكّد الدخول مرة واحدة لحماية حسابك.');q('#verify-device').hidden=false;return;
 }
 await send();};
}
async function send(){
 const button=q('#send-link')||q('#resend-link');if(button)button.disabled=true;
 try{const request=flow.request(pending.email,pending.name,pending.mode,cfg.redirectUrl);await call(request.path,request.body);sent();}
 catch(e){state(e.message);}finally{if(button?.isConnected)button.disabled=false;}
}
function sent(){
 q('#auth-content').innerHTML=`<h2>تحقّق من إيميلك</h2><p>أرسلنا ${pending.mode==='signup'?'رابط التأكيد':'رابط الدخول'} إلى<br><b dir="ltr">${esc(pending.email)}</b></p><p class="muted">اضغط الرابط في الرسالة لتفتح حسابك في إلهامي. إذا لم تجدها، تحقّق من البريد غير المرغوب فيه.</p><p class="error" role="status" id="auth-error"></p><button class="text-btn" id="resend-link" disabled></button><br><button class="text-btn" id="change-email">تعديل الإيميل</button>`;
 cooldown=60;const tick=()=>{const b=q('#resend-link');if(!b){clearInterval(interval);return;}b.disabled=cooldown>0;b.textContent=cooldown>0?'إعادة الإرسال بعد '+cooldown+' ثانية':'إعادة إرسال الرابط';cooldown--;if(cooldown<0)clearInterval(interval);};
 clearInterval(interval);tick();interval=setInterval(tick,1000);q('#resend-link').onclick=send;q('#change-email').onclick=()=>form(mode);
}
async function signIn(data){
 // The user endpoint validates the token; no URL claim or email alone grants access.
 const user=await call('user',null,data.access_token);
 const verified={...data,user};await window.elhamiCloud.activate(cfg,verified);
 session=verified;localStorage.setItem('elhami-auth-session',JSON.stringify(verified));localStorage.setItem('elhami-remembered-email',user.email||'');render();profile.textContent=db.name;window.dispatchEvent(new Event('elhami-account'));clearInterval(interval);document.body.classList.add('signed-in');document.body.classList.remove('auth-screen','browse-mode');page('home');
}
async function resume(stored){
 if(!stored?.access_token)return;
 if(!stored.expires_at||stored.expires_at<=Date.now()/1000+60){
  if(!stored.refresh_token)throw Error('انتهت جلسة الدخول. اطلب رابطًا جديدًا.');
  stored=await call('token?grant_type=refresh_token',{refresh_token:stored.refresh_token});
 }
 await signIn(stored);
}
function account(){
 modal('حسابك',`<p>${esc(session.user.user_metadata?.name||'عضو إلهامي')}</p><p dir="ltr">${esc(session.user.email)}</p><p class="muted">اربط مساحتك الخاصة لحفظ المحتوى مشفّرًا في Google Drive. صورتك الشخصية محفوظة في هذا المتصفح فقط.</p><button class="secondary" id="account-storage">إدارة التخزين</button> <button class="secondary" id="edit-avatar">الصورة الشخصية</button> <button class="secondary" id="logout">تسجيل الخروج</button>`);
 q('#account-storage').onclick=()=>window.elhamiCloud.show();
 q('#edit-avatar').onclick=()=>window.elhamiProfile?.open();
 q('#logout').onclick=async()=>{
  try{await window.elhamiCloud.deactivate();}catch(e){toast(e.message);return;}
  let latest=session;try{latest=JSON.parse(localStorage.getItem('elhami-auth-session'))||session;}catch{}
  if(ready())try{await call('logout',{},latest.access_token);}catch{}
  session=null;document.body.classList.remove('signed-in');window.dispatchEvent(new Event('elhami-account'));localStorage.removeItem('elhami-auth-session');q('#modal').close();document.body.classList.add('auth-screen');profile.textContent='تسجيل الدخول';form('login');
 };
}
function terms(){modal('شروط الاستخدام','<p>إلهامــي مساحة للقراءة والتأمل والحوار المعرفي والثقافي.</p><p>الآراء والمعلومات التي يطرحها المشاركون تعبّر عن أصحابها، ولا تعبّر بالضرورة عن وجهة نظر إدارة إلهامــي.</p><p>يتحمّل كل مشارك مسؤولية ما يطرحه، مع الالتزام باحترام الآخرين وحقوقهم وحقوق المؤلفين.</p><p>حفاظًا على طابع إلهامــي المعرفي والثقافي، تُستثنى من موضوعات الحوار القضايا الدينية والسياسية والجنسية.</p>');}
function privacy(){window.elhamiPrivacy();}
q('#login-tab').onclick=()=>form('login');q('#signup-tab').onclick=()=>form('signup');
q('#explore').onclick=()=>{document.body.classList.remove('auth-screen');document.body.classList.add('browse-mode');page(session?'home':'about');};
form('login');
fetch('auth-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(async c=>{
 cfg=c;if(!ready())return;
 if(callback.kind==='error'){state('رابط الدخول غير صالح أو انتهت صلاحيته. أدخل إيميلك لطلب رابط جديد.');return;}
 if(callback.kind==='session'){
  q('#auth-content').innerHTML='<h2>جارٍ فتح حسابك</h2><p role="status" id="auth-error">نتحقّق من رابط الدخول…</p>';
  try{await signIn(callback.session);}catch{localStorage.removeItem('elhami-auth-session');form('login');state('تعذّر فتح الحساب. قد يكون الرابط منتهيًا؛ اطلب رابطًا جديدًا.');}return;
 }
 let stored;try{stored=JSON.parse(localStorage.getItem('elhami-auth-session'));}catch{}
 if(stored?.access_token)try{await resume(stored);}catch{localStorage.removeItem('elhami-auth-session');state('انتهت جلسة الدخول أو تعذّر الاتصال. اطلب رابطًا جديدًا.');}
}).catch(()=>state('تعذّر الاتصال بخدمة الحسابات. أعد تحميل الصفحة.'));
})();
