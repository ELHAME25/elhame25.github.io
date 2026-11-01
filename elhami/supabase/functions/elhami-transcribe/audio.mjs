// Canonical PCM WAV only: exact format makes server duration independent of client claims.
export const MAX_AUDIO_BYTES=1920044;
export function inspectWav(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<46||bytes.length>MAX_AUDIO_BYTES)throw Error('audio_size');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tag=n=>String.fromCharCode(...bytes.slice(n,n+4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||tag(12)!=='fmt '||tag(36)!=='data'||d.getUint32(4,true)!==bytes.length-8||d.getUint32(16,true)!==16||d.getUint16(20,true)!==1||d.getUint16(22,true)!==1||d.getUint32(24,true)!==16000||d.getUint32(28,true)!==32000||d.getUint16(32,true)!==2||d.getUint16(34,true)!==16||d.getUint32(40,true)!==bytes.length-44||(bytes.length-44)%2)throw Error('audio_format');
 return {seconds:(bytes.length-44)/32000};
}
export async function transcribeBounded(bytes,{provider,budget,owner,requestId,usdPerMinute}){
 const {seconds}=inspectWav(bytes);if(!Number.isFinite(usdPerMinute)||usdPerMinute<=0)throw Error('pricing_missing');
 // Round upward by a whole second and add one second, capped audio is at most 60s.
 const reserve=(Math.ceil(seconds)+1)*usdPerMinute/60;
 if(!await budget.reserve(owner,requestId,reserve))return {status:'unavailable',reason:'budget_gate',message:'بلغ الطلب حد التشغيل؛ يمكنك كتابة الفكرة بدل التسجيل.'};
 try{const result=await provider(bytes);if(typeof result.text!=='string'||result.text.length>12000)throw Error('invalid_transcript');
 // Reserve is the conservative final charge; no reliance on client duration or text-token guess.
 await budget.settle(owner,requestId,null,'completed');return {status:'completed',text:result.text};
 }catch{await budget.settle(owner,requestId,null,'failed').catch(()=>{});return {status:'unavailable',reason:'transcription_unconfirmed',message:'لم يكتمل فهم التسجيل. يمكنك إعادة المحاولة أو كتابة الفكرة؛ لم يُحفظ الصوت.'};}
}
