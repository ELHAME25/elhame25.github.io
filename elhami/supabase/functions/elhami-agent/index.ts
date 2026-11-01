// All credentials remain server-side. No deployment or secret provisioning is implicit.
import {parseInput,preflight,action,runGuided} from './runtime.mjs';
import {openAIProvider} from './openai.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
const origins=env('ELHAMI_ALLOWED_ORIGINS').split(',').map(x=>x.trim()).filter(Boolean);
const url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),publicKey=env('SUPABASE_ANON_KEY');
const config={model:env('OPENAI_MODEL'),maxInputTokens:Math.min(50000,Math.max(4096,Number(env('ELHAMI_MAX_INPUT_TOKENS'))||24000)),maxOutputTokens:Math.min(4096,Math.max(256,Number(env('ELHAMI_MAX_OUTPUT_TOKENS'))||1200)),inputUsdPerMillion:Number(env('ELHAMI_INPUT_USD_PER_MILLION')),outputUsdPerMillion:Number(env('ELHAMI_OUTPUT_USD_PER_MILLION'))};
async function db(path:string,token:string,body?:unknown){const r=await fetch(url+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:token,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('storage_unavailable');return r.json();}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!origins.includes(origin))return reply({error:'origin_denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_denied'},405);
 try {
 const bearer=req.headers.get('authorization')||'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(bearer))return reply({error:'sign_in'},401);
 const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:bearer},signal:AbortSignal.timeout(8000)});if(!auth.ok)return reply({error:'sign_in'},401);
 const user=await auth.json();if(!user.id||user.is_anonymous)return reply({error:'sign_in'},401);
 if(Number(req.headers.get('content-length')||0)>60000)return reply({error:'input_too_large'},413);
 // Streaming limit also covers chunked bodies without Content-Length.
 const reader=req.body?.getReader();if(!reader)return reply({error:'empty'},400);let size=0;const chunks:Uint8Array[]=[];while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>60000){await reader.cancel();return reply({error:'input_too_large'},413);}chunks.push(chunk.value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}const raw=JSON.parse(new TextDecoder().decode(bytes));
 const input=parseInput(raw);if(input.mode==='prepared')return reply(preflight(input));
 if(env('ELHAMI_AGENT_ENABLED')!=='true'||!env('OPENAI_API_KEY')||!config.model||!service)return reply(action('not_configured','أضف مقطعًا أو رتّب فكرتك في مسودة؛ الإجابات الجديدة لم تُفعّل بعد.','unavailable'));
 if(!input.sessionId)return reply({error:'session_required'},400);
 const normalized=(input.goal+'\n'+input.message+'\n'+input.passage+'\n'+JSON.stringify(input.selectedFragments)).normalize('NFKC').trim().replace(/\s+/g,' ');
 const hashKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(service),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',hashKey,new TextEncoder().encode(user.id+'\n'+normalized)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const admission=await db('rpc/elhami_agent_begin_session',service,{p_owner:user.id,p_session:input.sessionId,p_mode:input.mode,p_hash:digest,p_stop:input.stop});
 if(!admission[0]?.allowed)return reply(action(admission[0]?.reason||'session_unavailable',admission[0]?.reason==='step_limit'?'بلغت هذه الجولة حدها الآمن. احتفظ بالنتيجة، أو ابدأ هدفًا جديدًا باختيارك.':'توقفت هذه الجولة؛ يمكنك الاحتفاظ بنتيجتها أو بدء هدف جديد.','stopped'));
 try {
 const sources:any[]=[];
 if(input.projectId){const rows=await db('elhami_published_content?id=eq.'+encodeURIComponent(input.projectId)+'&select=id,title,body,sources&limit=1',service);for(const row of rows){
 // Published editorial sources are the only citable evidence. Body is interpretation, not book evidence.
 for(const s of Array.isArray(row.sources)?row.sources:[])if(s&&typeof s.id==='string'&&typeof s.text==='string'&&typeof s.title==='string'&&s.verified===true&&(!input.sourceIds.length||input.sourceIds.includes(s.id)))sources.push({sourceId:s.id,title:s.title.slice(0,200),text:s.text.slice(0,12000),page:Number.isSafeInteger(s.page)?s.page:null});}}
 const memories:any[]=[];
 if(input.memoryConsent&&!input.group&&input.sourceIds.length){
 // JWT/RLS plus explicit owner filter; never use service role for the private workspace.
 const r=await fetch(url+'/rest/v1/workspaces?owner_id=eq.'+encodeURIComponent(user.id)+'&select=data&limit=1',{headers:{apikey:publicKey,Authorization:bearer},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('workspace_unavailable');const rows=await r.json();
 const snapshot=rows[0]?.data?.sessions?.find((s:any)=>s.id==='elhami-journey-v1')?.elhamiJourney;
 for(const m of snapshot?.context?.memories||[])if(input.sourceIds.includes(m.id)&&typeof m.text==='string')memories.push({text:m.text.slice(0,3000)});
 }
 const budget={async reserve(owner:string,request:string,cost:number){const rows=await db('rpc/elhami_agent_reserve',service,{p_owner:owner,p_request:request,p_reserved_usd:cost});return rows[0]?.allowed===true;},async settle(owner:string,request:string,cost:number|null,status:string){await db('rpc/elhami_agent_settle',service,{p_owner:owner,p_request:request,p_actual_usd:cost,p_status:status});}};
 const result=await runGuided(input,{sources:sources.slice(0,8),memories,provider:openAIProvider(env('OPENAI_API_KEY')),budget,config,requestId:crypto.randomUUID(),owner:user.id});
 await db('rpc/elhami_agent_finish_session',service,{p_owner:user.id,p_session:input.sessionId,p_end:['completed','stopped'].includes(result.status)});
 return reply(result);
 }catch(error){await db('rpc/elhami_agent_finish_session',service,{p_owner:user.id,p_session:input.sessionId,p_end:false}).catch(()=>{});throw error;}
 }catch{return reply(action('request_unconfirmed','لم يكتمل هذا الطلب؛ احتفظ بسؤالك أو أضف مقطعًا أقصر للمحاولة التالية.','unavailable'),400);}
});
