(()=>{
 const btn=document.querySelector('#profile');let picture='';
 const key=()=>window.elhamiAccess?.userId?'elhami-avatar-v2:'+window.elhamiAccess.userId:null;
 function read(){picture='';try{const k=key();if(k)picture=localStorage.getItem(k)||'';}catch{}}
 function refresh(){
  if(!window.elhamiAccess?.authenticated)return;
  read();btn.replaceChildren();
  if(picture){const im=document.createElement('img');im.src=picture;im.alt='';btn.append(im);}
  else{const initial=document.createElement('span');initial.className='account-initial';initial.setAttribute('aria-hidden','true');initial.textContent=(db.name||'أ')[0];btn.append(initial);}
  const name=document.createElement('span');name.textContent=db.name||'حسابي';btn.append(name);btn.setAttribute('aria-label','حساب '+(db.name||''));
 }
 function open(){
  if(!window.elhamiAccess?.authenticated){window.elhamiAccess?.prompt('login');return;}
  read();modal('الصورة الشخصية',`<p>إضافة الصورة اختيارية. يمكنك تغييرها أو حذفها.</p><label for="avatar-file">اختر صورة</label><input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp"><p class="muted">JPG أو PNG أو WebP، بحد أقصى 2 ميجابايت. تُحفظ الصورة في هذا المتصفح فقط.</p><p id="avatar-error" class="error" role="status"></p><div id="avatar-preview" style="text-align:center"></div><div class="form-actions"><button class="secondary" id="remove-avatar">حذف الصورة</button></div>`);
  const preview=document.querySelector('#avatar-preview');function show(){preview.replaceChildren();if(picture){const im=document.createElement('img');im.src=picture;im.alt='معاينة الصورة';im.style.cssText='width:110px;height:110px;border-radius:50%;object-fit:cover';preview.append(im);}}show();
  document.querySelector('#avatar-file').onchange=async e=>{
   const f=e.target.files[0];if(!f)return;const err=document.querySelector('#avatar-error');err.textContent='';
   if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>2*1024*1024){err.textContent='اختر صورة بصيغة مدعومة لا يتجاوز حجمها 2 ميجابايت.';return;}
   const owner=key();try{
    const bitmap=await createImageBitmap(f),canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d'),size=Math.min(bitmap.width,bitmap.height);c.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256);bitmap.close();
    if(!owner||key()!==owner)return;localStorage.setItem(owner,canvas.toDataURL('image/jpeg',.85));read();refresh();show();toast('تم حفظ الصورة.');
   }catch{err.textContent='تعذّر قراءة الصورة أو حفظها. جرّب صورة أخرى.';}
  };
  document.querySelector('#remove-avatar').onclick=()=>{const k=key();if(k)localStorage.removeItem(k);picture='';refresh();show();toast('تم حذف الصورة.');};
 }
 window.elhamiProfile={open,refresh};window.addEventListener('elhami-account',refresh);refresh();
})();
