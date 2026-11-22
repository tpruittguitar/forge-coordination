'use strict';
const {LIMITS}=require('./worker.cjs');
// Unwired production transport. The approved host injects the restricted secret
// directly from its secure runtime; callers never supply credentials in files,
// CLI arguments, checkpoints, model input, or exception messages.
async function response(body,{secureRuntime,projectId,signal,transport}) {
  if(typeof transport!=='function'||typeof secureRuntime!=='function'||!/^proj_[A-Za-z0-9_-]+$/.test(projectId||'')) throw Error('SECURE_RUNTIME_REQUIRED');
  if(body.model!=='gpt-6-luna'||body.service_tier!=='default'||body.store!==false||body.background!==false||
     body.max_output_tokens!==LIMITS.outputTokens||body.tools?.length!==0||body.tool_choice!=='none'||
     Buffer.byteLength(JSON.stringify(body))+512>LIMITS.inputTokens) throw Error('API_REQUEST_CAP');
  let r;
  try {
    // No key is returned from this callback. The host provides only scoped use.
    r=await secureRuntime(async credential=>transport('https://api.openai.com/v1/responses',{
      method:'POST',redirect:'error',signal,
      headers:{Authorization:'Bearer '+credential,'OpenAI-Project':projectId,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    }));
  } catch {throw Error('API_OUTCOME_UNKNOWN');}
  if([401,402,403,429].includes(r.status)) throw Error('API_AUTH_OR_CREDIT_FAILURE');
  if(!r.ok) throw Error('API_OUTCOME_UNKNOWN');
  // Bound the response while streaming, including reasoning/usage metadata.
  const reader=r.body.getReader();const chunks=[];let size=0;
  try {for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;
    if(size>65536)throw Error('API_RESPONSE_CAP');chunks.push(Buffer.from(value));}}
  finally {await reader.cancel();}
  let data;try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw Error('API_RESPONSE_INVALID');}
  if(data.status!=='completed'||data.model!=='gpt-6-luna'||data.service_tier!=='default'||
     !Number.isSafeInteger(data.usage?.input_tokens)||data.usage.input_tokens<0||data.usage.input_tokens>LIMITS.inputTokens||
     !Number.isSafeInteger(data.usage?.output_tokens)||data.usage.output_tokens<0||data.usage.output_tokens>LIMITS.outputTokens) throw Error('API_USAGE_OR_STATUS_INVALID');
  if(!Array.isArray(data.output)||data.output.some(x=>x.type!=='message')) throw Error('API_UNEXPECTED_TOOL_OR_REASONING');
  const blocks=data.output.flatMap(x=>x.content||[]);
  if(blocks.length!==1||blocks[0].type!=='output_text') throw Error('API_RESPONSE_INVALID');
  let result;try {result=JSON.parse(blocks[0].text);} catch {throw Error('API_RESPONSE_INVALID');}
  return {result,usage:data.usage,responseId:data.id};
}
module.exports={response};
