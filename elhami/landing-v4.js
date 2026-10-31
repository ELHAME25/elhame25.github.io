/* Auth-first presentation. Existing email verification and private storage remain authoritative. */
(()=>{'use strict';
const welcome=document.querySelector('#welcome');if(!welcome)return;
const hero='assets/elhami-approved-hero-v4.png';
const artAlt='إلهامي: حرف R الأزرق يمتد نحو شخصين يتحاوران حول كتب ومذكرات، وخيوط تربط التفكير بالأفكار ونموّها. نقرأ فتتسع رؤيتنا، ونتحاور فيتعمق فهمنا، ونكتب ليبقى الأثر.';
document.querySelectorAll('.brand-art').forEach(img=>{img.src=hero;img.alt=artAlt;img.removeAttribute('style');});
// The first screen contains only the approved illustration and original account form.
const copy=document.querySelector('.welcome-copy');
if(copy){copy.querySelectorAll('p,a[data-public]').forEach(el=>el.remove());const title=copy.querySelector('h1');if(title)title.textContent='حوار يبقى أثره';}
const about=document.createElement('section');about.id='elhami-landing';about.setAttribute('aria-labelledby','lh-about-title');
about.innerHTML='<h1 id="lh-about-title" tabindex="-1">تعرّف على إلهامي</h1><div class="lh-about-grid"><article><h2>ما الذي يدور في بالك؟</h2></article><article><h2>مرافق القراءة</h2></article><article><h2>مشاريع معرفية</h2></article><article><h2>المجلس</h2></article></div><div class="lh-about-actions"><button type="button" class="primary" id="lh-about-login">تسجيل الدخول</button><button type="button" class="secondary" id="lh-about-signup">إنشاء حساب</button></div><button type="button" class="text-btn" id="lh-about-back">→ العودة إلى الصفحة الأولى</button>';
welcome.append(about);
function showAuth(mode){
 document.body.classList.remove('lh-about-open','browse-mode','lh-auth-open');
 document.body.classList.add('auth-screen');
 if(mode)window.elhamiAccess?.prompt(mode);
 window.scrollTo(0,0);
}
function showAbout(){
 document.body.classList.remove('browse-mode','lh-auth-open');document.body.classList.add('auth-screen','lh-about-open');
 window.scrollTo(0,0);requestAnimationFrame(()=>document.querySelector('#lh-about-title')?.focus({preventScroll:true}));
}
const originalPrompt=window.elhamiAccess?.prompt;
if(originalPrompt)window.elhamiAccess.prompt=function(){document.body.classList.remove('lh-about-open','lh-auth-open');return originalPrompt.apply(this,arguments);};
const explore=document.querySelector('#explore');if(explore){explore.textContent='تعرّف على الموقع';explore.addEventListener('click',showAbout);}
document.querySelector('#lh-about-login').addEventListener('click',()=>showAuth('login'));
document.querySelector('#lh-about-signup').addEventListener('click',()=>showAuth('signup'));
document.querySelector('#lh-about-back').addEventListener('click',()=>showAuth());
// Original header action continues to open login; this only clears the about view.
document.querySelector('body>header>a')?.addEventListener('click',()=>document.body.classList.remove('lh-about-open'));
// Verification/error UI must remain visible, including asynchronous callback failures.
const authContent=document.querySelector('#auth-content');if(authContent)new MutationObserver(()=>{const error=document.querySelector('#auth-error');if(error?.textContent.trim())document.body.classList.remove('lh-about-open');}).observe(authContent,{childList:true,subtree:true,characterData:true});
window.addEventListener('elhami-account',()=>document.body.classList.remove('lh-about-open','lh-auth-open'));
})();
