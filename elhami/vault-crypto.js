/* Browser-only encrypted envelope. No password or derived key is persisted. */
(()=>{
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>{let s='';for(const n of new Uint8Array(b))s+=String.fromCharCode(n);return btoa(s)};
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(password,salt){const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function seal(data,key,salt){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('elhami-vault-v1')},key,enc.encode(JSON.stringify(data)));return {format:'elhami-vault',version:1,kdf:'PBKDF2-SHA256',iterations:600000,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)};}
async function open(envelope,password){if(envelope?.format!=='elhami-vault'||envelope.version!==1||envelope.iterations!==600000)throw Error('صيغة النسخة المشفّرة غير مدعومة.');const salt=un64(envelope.salt);if(salt.length!==16)throw Error('النسخة المشفّرة غير صالحة.');const key=await derive(password,salt);try{const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(envelope.iv),additionalData:enc.encode('elhami-vault-v1')},key,un64(envelope.ciphertext));return {data:JSON.parse(dec.decode(bytes)),key,salt};}catch{throw Error('كلمة التشفير غير صحيحة، أو أن النسخة تالفة.');}}
window.elhamiVaultCrypto={derive,seal,open,newSalt:()=>crypto.getRandomValues(new Uint8Array(16))};
})();
