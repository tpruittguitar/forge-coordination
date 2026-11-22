'use strict';
const {LIMITS}=require('./worker.cjs');
// Unwired production transport. The approved host injects the restricted secret
// directly from its secure runtime; callers never supply credentials in files,
// CLI arguments, checkpoints, model input, or exception messages.
const providerCodes=new Set(['invalid_api_key','invalid_organization','invalid_project','model_not_found','insufficient_quota',
  'credit_balance_exhausted','rate_limit_exceeded','invalid_request_error','invalid_value','unsupported_value','unknown_parameter',
  'missing_required_parameter','organization_usage_limit_exceeded','organization_spend_limit_exceeded','project_spend_limit_exceeded']);
const providerParams=new Set(['input','instructions','model','service_tier','text.format','text.format.type','reasoning.effort',
  'max_output_tokens','tool_choice','tools','store','background']);
async function providerError(r){
  try{
    const reader=r.body.getReader(),chunks=[];let size=0;
    try{for(;;){
      const {done,value}=await reader.read();if(done)break;
      size+=value.length;if(size>4096)return null;chunks.push(Buffer.from(value));
    }}finally{await reader.cancel();}
    const error=JSON.parse(Buffer.concat(chunks).toString('utf8'))?.error;
    return {...(providerCodes.has(error?.code)?{providerCode:error.code}:{}),
      ...(providerParams.has(error?.param)?{providerParam:error.param}:{})};
  }catch{return null;}
}
async function response(body,{secureRuntime,projectId,signal,transport,observe}) {
  const note=(category,details={})=>observe?.({category,...details});
  note('REQUEST_VALIDATION');
  if(typeof transport!=='function'||typeof secureRuntime!=='function'||!/^proj_[A-Za-z0-9_-]+$/.test(projectId||'')) throw Error('SECURE_RUNTIME_REQUIRED');
  if(body.model!=='gpt-6-luna'||body.service_tier!=='default'||body.store!==false||body.background!==false||
     body.max_output_tokens!==LIMITS.outputTokens||body.tools?.length!==0||body.tool_choice!=='none'||
     Buffer.byteLength(JSON.stringify(body))+512>LIMITS.inputTokens) throw Error('API_REQUEST_CAP');
  let r;
  note('NATIVE_CALLBACK');
  try {
    // No key is returned from this callback. The host provides only scoped use.
    r=await secureRuntime(async credential=>transport('https://api.openai.com/v1/responses',{
      method:'POST',redirect:'error',signal,
      headers:{Authorization:'Bearer '+credential,'OpenAI-Project':projectId,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    }));
  } catch {throw Error('API_OUTCOME_UNKNOWN');}
  if(!r.ok&&observe){
    const status=Number.isInteger(r.status)&&r.status>=300&&r.status<=599?{httpStatus:r.status}:{};
    note('HTTP_REJECTION',status);
    const error=await providerError(r);
    if(error)note('HTTP_REJECTION',{...status,...error});
  }
  if([401,402,403,429].includes(r.status)) throw Error('API_AUTH_OR_CREDIT_FAILURE');
  if(!r.ok) throw Error('API_OUTCOME_UNKNOWN');
  // Bound the response while streaming, including reasoning/usage metadata.
  note('RESPONSE_STREAM');
  const reader=r.body.getReader();const chunks=[];let size=0;
  try {for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;
    if(size>65536){note('RESPONSE_SIZE');throw Error('API_RESPONSE_CAP');}chunks.push(Buffer.from(value));}}
  finally {await reader.cancel();}
  note('RESPONSE_JSON');
  let data;try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw Error('API_RESPONSE_INVALID');}
  if(data?.status!=='completed'){note('RESPONSE_STATUS');throw Error('API_USAGE_OR_STATUS_INVALID');}
  if(data.model!=='gpt-6-luna'){note('RESPONSE_MODEL');throw Error('API_USAGE_OR_STATUS_INVALID');}
  if(data.service_tier!=='default'){note('RESPONSE_SERVICE_TIER');throw Error('API_USAGE_OR_STATUS_INVALID');}
  if(!Number.isSafeInteger(data.usage?.input_tokens)||data.usage.input_tokens<0||data.usage.input_tokens>LIMITS.inputTokens||
     !Number.isSafeInteger(data.usage?.output_tokens)||data.usage.output_tokens<0||data.usage.output_tokens>LIMITS.outputTokens){
    note('RESPONSE_USAGE');throw Error('API_USAGE_OR_STATUS_INVALID');
  }
  note('RESPONSE_OUTPUT_SCHEMA');
  if(!Array.isArray(data.output)||data.output.some(x=>x.type!=='message')) throw Error('API_UNEXPECTED_TOOL_OR_REASONING');
  const blocks=data.output.flatMap(x=>x.content||[]);
  if(blocks.length!==1||blocks[0].type!=='output_text') throw Error('API_RESPONSE_INVALID');
  note('RESPONSE_OUTPUT_JSON');
  let result;try {result=JSON.parse(blocks[0].text);} catch {throw Error('API_RESPONSE_INVALID');}
  note('RESPONSE_DECODED');
  return {result,usage:data.usage,responseId:data.id};
}
module.exports={response};
