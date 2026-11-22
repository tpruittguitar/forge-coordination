'use strict';
// Optional ATSBOT extraction, not a helper, an alternative Writer, or a billing reader.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Prepared=require('./prepared.cjs'),Cache=require('./posting-cache'),Recovery=require('./recovery'),L=require('./lib');
const W=require('../grant-backlog/worker.cjs'), C=require('../grant-backlog/windows-credential.cjs');
const {funding}=require('../grant-backlog/coordinator-preflight.cjs');
const {response}=require('../grant-backlog/responses.cjs');
const Store=require('../programmed-coordinator/store.cjs');
const Source=require('../programmed-coordinator/source.cjs');
const {lock}=require('../automation-run-lock.cjs');
const MAX_ATTEMPTS=W.LIMITS.batchJobs;
const fingerprint=x=>crypto.createHash('sha256').update(x).digest('hex');

function input(row,capture,needs,fields,now,{payUnresolved=false}={}) {
  if(Prepared.protectedRow(row)||!Recovery.urls(row).some(u=>Cache.route(u)===Cache.route(capture?.url)))return null;
  const source=Prepared.posting(row,capture,now);
  if(!source||source.basis!=='EMPLOYER_POSTED'||source.identityVerified!==true)return null;
  const groups=[];
  const ambiguousPay=payUnresolved||[capture,source].some(s=>s.payAmbiguous===true||s.payNeedsRefresh===true||s.payStatus==='PAY_UNRESOLVED');
  if(!ambiguousPay&&needs.includes('SALARY')&&!fields.SALARY_BASE_LOW&&/\$\s*\d|\bUSD\s*\d/i.test(source.text))groups.push('SALARY');
  // The ATS degree parser has already handled this capture. Do not spend
  // on a degree-only request that the same parser would reject or duplicate.
  if(!groups.length)return null;
  // Unmodified public source text; omit long bodies rather than cut away governing clauses.
  if(Buffer.byteLength(source.text)>4500)return null;
  Source.publicUrl(source.url);
  const u=new URL(source.url);
  if(u.search||u.hash||/docs\.google|drive\.google|mail\.|localhost/i.test(u.hostname))return null;
  const e={
    company:row.COMPANY,title:row.TITLE,location:row.LOCATION,url:source.url,
    text:source.text,observedAt:source.at,sha256:fingerprint(source.text)};
  return {e,groups,ambiguousPay};
}

function resultFields(result,e,groups,row,{ambiguousPay=false}={}){
  if(ambiguousPay)return {}; // Direct/late callers must preserve the same hold.
  const p=W.proposal(result,e,groups,row), fields=p.fields, q=p.evidence.fieldQuotes;
  const asOf=e.observedAt.slice(0,10), out={};
  if(!ambiguousPay&&fields.SALARY_BASE_LOW&&fields.SALARY_BASE_HIGH&&fields.SALARY_BASIS==='EMPLOYER_POSTED'){
    // Quote location and numeric presence are not enough on a multi-range posting.
    // Re-derive one exact annual base range from the quoted clause.
    const quote=q.SALARY, parsed=L.payFromText(quote);
    if(parsed&&/\bbase (?:salary|pay)\b/i.test(quote)&&!/\b(?:bonus|equity|total compensation|commission|CAD|AUD|EUR|GBP)\b/i.test(quote)
        && parsed.low===Number(fields.SALARY_BASE_LOW)&&parsed.high===Number(fields.SALARY_BASE_HIGH)){
      Object.assign(out,{SALARY_BASE_LOW:parsed.low,SALARY_BASE_HIGH:parsed.high,SALARY_BASIS:'EMPLOYER_POSTED',
        SALARY_SOURCE:e.url,SALARY_ASOF:asOf,SALARY_CONF:'HIGH'});
    }
  }
  return out;
}

function create({readFunding,openCredential=C.startup,transport=globalThis.fetch,expectedSid,now=Date.now,maxAttempts=MAX_ATTEMPTS}){
  if(![5,MAX_ATTEMPTS].includes(maxAttempts))throw Error('ATS_GRANT_ROW_LIMIT_INVALID');
  let attempts=0, stopped=false, projectId=null, credential;
  return {
    close(){credential?.close();credential=null;},
    get attempts(){return attempts;},
    async extract({row,capture,needs,fields,ledger,checkpoint,signal,payUnresolved}){
      if(stopped||attempts>=maxAttempts||signal?.aborted)return {};
      let selected;
      try{selected=input(row,capture,needs,fields,now(),{payUnresolved});}catch{return {};}
      if(!selected)return {};
      const {e,groups,ambiguousPay}=selected,key=fingerprint(JSON.stringify([row.PRIMARY_ID,Cache.route(e.url),e.sha256]));
      const records=ledger.grantExtractionAttempts??=(Object.create(null));
      if(Object.hasOwn(records,key))return {};
      let proof;
      try {
        proof=await readFunding();
        if(funding(proof,now()).length||proof.funding.availableMicrousd-proof.funding.otherConsumersReservedMicrousd
          <W.LIMITS.balanceFloorMicrousd+maxAttempts*W.LIMITS.reservationMicrousd||projectId&&projectId!==proof.project.id)throw Error('GRANT_FUNDING_BLOCKED');
        projectId=proof.project.id;
        credential??=openCredential({expectedSid});
      } catch {stopped=true;throw Error('GRANT_FUNDING_OR_HOST_BLOCKED');}
      const deadline=Math.min(Date.parse(proof.observedAt)+300000,Date.parse(proof.funding.expiresAt),Date.parse(W.LIMITS.stopAt));
      const body=W.request(e,groups);
      const remaining=Math.min(W.LIMITS.jobMs,deadline-now());
      if(remaining<=0||signal?.aborted)return {};
      const timeout=AbortSignal.timeout(remaining);
      records[key]={primaryId:row.PRIMARY_ID,at:new Date(now()).toISOString(),status:'POSTING_OR_UNKNOWN'};
      checkpoint(); // same normal ATS ledger, before any model request; no second ledger.
      attempts++;
      try {
        const r=await response(body,{secureRuntime:credential.secureRuntime,projectId,
          signal:signal?AbortSignal.any([signal,timeout]):timeout,transport});
        const fields=resultFields(r.result,e,groups,row,{ambiguousPay});
        records[key].status=Object.keys(fields).length?'FACTS_ACCEPTED':'NO_SUPPORTED_FACTS';
        return fields;
      } catch {
        stopped=true; // No retry or alternate account on invalid, unknown or unverifiable outcomes.
        throw Error('GRANT_RESPONSE_UNVERIFIED');
      }
    }
  };
}

async function assertGithubOwnerStopped({token,repo,transport=globalThis.fetch}){
  if(!token||repo!=='tpruittguitar/forge-coordination')throw Error('ATS_GRANT_GITHUB_AUTHORITY_REQUIRED');
  const base='https://api.github.com/repos/'+repo+'/actions/workflows/enrich-ats-pay.yml';
  async function read(tail){
    const r=await transport(base+tail,{redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error('ATS_GRANT_GITHUB_AUTHORITY_REQUIRED');
    return r.json();
  }
  if((await read('')).state!=='disabled_manually')throw Error('ATS_GITHUB_RUNNER_NOT_DISABLED');
  for(const status of ['queued','in_progress','waiting','pending','requested']){
    const runs=await read('/runs?per_page=1&status='+status);
    if(runs?.total_count!==0||!Array.isArray(runs.workflow_runs)||runs.workflow_runs.length!==0)throw Error('ATS_GITHUB_RUNNER_NOT_DRAINED');
  }
}

function configured({root,live,writerPostLock,env=process.env}){
  const file=env.FORGE_ATS_GRANT_FUNDING_FILE;
  if(!file)return null; // the existing Ubuntu producer is unchanged
  if(process.platform!=='win32'||!live||!writerPostLock||!path.isAbsolute(file))throw Error('ATS_GRANT_RUNTIME_REQUIRED');
  const privateFile=fs.realpathSync(file),checkout=fs.realpathSync(root);
  if(privateFile.toLowerCase().startsWith(checkout.toLowerCase()+path.sep))throw Error('ATS_GRANT_FUNDING_MUST_BE_PRIVATE');
  const configuredLimit=env.FORGE_ATS_GRANT_MAX_ROWS;
  if(configuredLimit!==undefined&&!['5',String(MAX_ATTEMPTS)].includes(configuredLimit))throw Error('ATS_GRANT_ROW_LIMIT_INVALID');
  const maxAttempts=configuredLimit===undefined?MAX_ATTEMPTS:Number(configuredLimit);
  const expectedSid=env.FORGE_ATS_GRANT_EXPECTED_SID;
  if(!/^S-1-5-21-(?:\d+-){3}\d+$/.test(expectedSid||''))throw Error('ATS_GRANT_NATIVE_ACCOUNT_REQUIRED');
  // Fail closed if the existing authoritative ATS workflow is enabled or still
  // has old runs. The host must be the single designated schedule/ledger owner.
  const github={token:env.GITHUB_TOKEN||env.GH_TOKEN,repo:env.GITHUB_REPOSITORY};
  const lockPath=privateFile+'.ats-run-lock',token='ATSBOT-'+crypto.randomUUID();
  let owned=false;
  return Object.assign(create({expectedSid,maxAttempts,readFunding:async()=>JSON.parse(fs.readFileSync(privateFile,'utf8'))}),{
    async acquire(){
      await assertGithubOwnerStopped(github);
      if(!lock(lockPath,'acquire',token).acquired)throw Error('ATS_GRANT_NATIVE_RUN_ALREADY_ACTIVE');
      owned=true;
    },
    async verifyExclusive(){lock(lockPath,'check',token);await assertGithubOwnerStopped(github);},
    release(){if(owned){lock(lockPath,'release',token);owned=false;}}
  });
}
function checkpoint(file,ledger){Store.save(path.dirname(file),path.basename(file),ledger);}
module.exports={create,configured,checkpoint,input,resultFields,assertGithubOwnerStopped};
