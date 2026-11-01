import {INSTRUCTIONS,OUTPUT_SCHEMA} from './runtime.mjs';
// Single bounded step; no SDK automatic retries, paid tools, fallback or background jobs.
export function openAIProvider(apiKey,fetcher=fetch) {return {async generate(context,config) {
 const r=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,store:false,instructions:INSTRUCTIONS,input:[{role:'user',content:JSON.stringify(context)}],max_output_tokens:config.maxOutputTokens,tools:[],tool_choice:'none',text:{format:{type:'json_schema',name:'elhami_guided_result',strict:true,schema:OUTPUT_SCHEMA}}}),signal:AbortSignal.timeout(40000)});
 if(!r.ok)throw Error('provider_failed');const data=await r.json();
 // Usage retained even on malformed content, through caller's conservative reservation otherwise.
 if(data.status!=='completed')throw Error('provider_incomplete');
 const outputText=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 return {output:JSON.parse(outputText),usage:data.usage};
 }};}
