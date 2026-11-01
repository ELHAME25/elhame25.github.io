import {MAX_AUDIO_BYTES,transcribeBounded} from './audio.mjs';
const env=(k:string)=>Deno.env.get(k)||'';
const origins=env('ELHAMI_ALLOWED_ORIGINS').split(',').map(x=>x.trim()),url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY');
async function rpc(name:string,body:unknown){const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('budget_unavailable');return r.json();}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',allowed=!!origin&&origins.includes(origin);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-elhami-audio-consent','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{headers,status});
 if(!allowed)return reply({error:'origin_denied'},403);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'method_denied'},405);
 try{
 if(req.headers.get('x-elhami-audio-consent')!=='explicit-once')return reply({error:'consent_required'},400);
 if(req.headers.get('content-type')!=='audio/wav')return reply({error:'audio_format'},415);
 const bearer=req.headers.get('authorization')||'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(bearer))return reply({error:'sign_in'},401);
 const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:bearer},signal:AbortSignal.timeout(8000)});if(!auth.ok)return reply({error:'sign_in'},401);const user=await auth.json();if(!user.id||user.is_anonymous)return reply({error:'sign_in'},401);
 if(env('ELHAMI_TRANSCRIBE_ENABLED')!=='true'||!env('OPENAI_API_KEY')||env('ELHAMI_TRANSCRIBE_MODEL')!=='gpt-transcribe')return reply({status:'unavailable',reason:'not_configured',message:'فهم الصوت لم يُفعّل بعد؛ يمكنك كتابة الفكرة الآن.'});
 if(Number(req.headers.get('content-length')||0)>MAX_AUDIO_BYTES)return reply({error:'audio_size'},413);
 const reader=req.body?.getReader();if(!reader)return reply({error:'empty'},400);const chunks:Uint8Array[]=[];let total=0;while(true){const c=await reader.read();if(c.done)break;total+=c.value.length;if(total>MAX_AUDIO_BYTES){await reader.cancel();return reply({error:'audio_size'},413);}chunks.push(c.value);}const bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 const budget={async reserve(owner:string,request:string,cost:number){const rows=await rpc('elhami_agent_reserve',{p_owner:owner,p_request:request,p_reserved_usd:cost,p_kind:'audio'});return rows[0]?.allowed===true;},async settle(owner:string,request:string,cost:number|null,status:string){await rpc('elhami_agent_settle',{p_owner:owner,p_request:request,p_actual_usd:cost,p_status:status});}};
 const provider=async(audio:Uint8Array)=>{const form=new FormData();form.append('model','gpt-transcribe');form.append('file',new Blob([audio],{type:'audio/wav'}),'speech.wav');form.append('response_format','json');const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+env('OPENAI_API_KEY')},body:form,signal:AbortSignal.timeout(40000)});if(!r.ok)throw Error('provider_failed');return r.json();};
 return reply(await transcribeBounded(bytes,{provider,budget,owner:user.id,requestId:crypto.randomUUID(),usdPerMinute:Number(env('ELHAMI_TRANSCRIBE_USD_PER_MINUTE'))}));
 }catch{return reply({status:'unavailable',reason:'invalid_audio',message:'لم يُقبل التسجيل؛ استخدم تسجيلًا قصيرًا واضحًا أو اكتب الفكرة.'},400);}
});
