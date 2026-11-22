'use strict';
// Optional ATSBOT extraction, not a helper, an alternative Writer, or a billing reader.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Prepared=require('./prepared.cjs'),Cache=require('./posting-cache'),Recovery=require('./recovery'),L=require('./lib');
const W=require('../grant-backlog/worker.cjs'), C=require('../grant-backlog/windows-credential.cjs');
const {response}=require('../grant-backlog/responses.cjs');
const Store=require('../programmed-coordinator/store.cjs');
const Source=require('../programmed-coordinator/source.cjs');
const {lock}=require('../automation-run-lock.cjs');
const SMOKE_LIMIT=1,BULK_LIMIT=50,SMOKE_CAP=10000,GRANT_CAP=37470000;
const {reservationMicrousd}=W.LIMITS;
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

// The operator reads the linked org/project billing and key metadata once. This
// private receipt is not a billing credential, a grant balance feed, or a paid fallback.
function accountDeadline(proof,now){
  const observed=Date.parse(proof?.observedAt),expiry=Date.parse(proof?.grant?.expiresAt);
  if(proof?.schema!=='forge.ats-grant-only-account.v1'||proof.source!=='SIGNED_IN_ACCOUNT_OPERATOR'
    ||!Number.isFinite(observed)||observed>now||!Number.isFinite(expiry)
    ||!/^org[-_][A-Za-z0-9_-]+$/.test(proof.organizationId||'')||!/^proj_[A-Za-z0-9_-]+$/.test(proof.projectId||'')
    ||proof.projectName!=='Default'||proof.keyName!=='forge-enrichment-responses'||!/^[A-Za-z0-9_-]{4}$/.test(proof.keySuffix||'')
    ||!['All','Responses only'].includes(proof.keyPermissions)||proof.noPaidBillingPlan!==true
    ||proof.noPurchasedCredits!==true||proof.autoRechargeEnabled!==false
    ||!Number.isSafeInteger(proof.grant.availableMicrousd)||proof.grant.availableMicrousd<=0)throw Error('GRANT_ACCOUNT_PROOF_INVALID');
  const deadline=Math.min(observed+30*60000,expiry,Date.parse(W.LIMITS.stopAt));
  if(now>=deadline)throw Error('GRANT_ACCOUNT_PROOF_EXPIRED');
  return deadline;
}

function create({readFunding,openCredential=C.startup,transport=globalThis.fetch,expectedSid,now=Date.now,maxAttempts=SMOKE_LIMIT}){
  if(![SMOKE_LIMIT,BULK_LIMIT].includes(maxAttempts))throw Error('ATS_GRANT_ROW_LIMIT_INVALID');
  let attempts=0, reportedCostMicrousd=0, unknownAttempts=0, stopped=false, proof, credential;
  return {
    close(){credential?.close();credential=null;},
    get attempts(){return attempts;},
    get accounting(){return {reportedCostMicrousd,unknownAttempts,unknownReservedMicrousd:unknownAttempts*reservationMicrousd,cumulativeCapMicrousd:GRANT_CAP};},
    get smoke(){return maxAttempts===SMOKE_LIMIT;},
    async extract({row,capture,needs,fields,ledger,checkpoint,signal,payUnresolved}){
      if(stopped||attempts>=maxAttempts||signal?.aborted)return {};
      let selected;
      try{selected=input(row,capture,needs,fields,now(),{payUnresolved});}catch{return {};}
      if(!selected)return {};
      const {e,groups,ambiguousPay}=selected,key=fingerprint(JSON.stringify([row.PRIMARY_ID,Cache.route(e.url),e.sha256]));
      const records=ledger.grantExtractionAttempts??=(Object.create(null));
      if(Object.hasOwn(records,key))return {};
      const entries=Object.values(records),smoke=entries.find(r=>r?.phase==='SMOKE'&&r.status==='WRITER_VERIFIED'&&r.writerRequestId);
      if(maxAttempts===BULK_LIMIT&&!smoke)throw Error('ATS_GRANT_SMOKE_WRITE_UNVERIFIED');
      if(maxAttempts===SMOKE_LIMIT&&entries.some(r=>r?.phase==='SMOKE'))throw Error('ATS_GRANT_SMOKE_ALREADY_ATTEMPTED');
      const reserved=(entries.length+1)*reservationMicrousd;
      if(reserved>GRANT_CAP||maxAttempts===SMOKE_LIMIT&&reservationMicrousd>SMOKE_CAP)throw Error('ATS_GRANT_CAP_REACHED');

      let deadline;
      try {
        proof??=await readFunding(); // Single bounded attestation snapshot per run.
        deadline=accountDeadline(proof,now());
        const sinceProof=entries.filter(r=>Date.parse(r?.at)>=Date.parse(proof.observedAt)).length;
        if((sinceProof+1)*reservationMicrousd>proof.grant.availableMicrousd)throw Error('GRANT_HEADROOM_REQUIRED');
        credential??=openCredential({expectedSid});
      } catch {stopped=true;throw Error('GRANT_FUNDING_OR_HOST_BLOCKED');}
      const body=W.request(e,groups);
      const remaining=Math.min(W.LIMITS.jobMs,deadline-now());
      if(remaining<=0||signal?.aborted)return {};
      const timeout=AbortSignal.timeout(remaining);
      records[key]={primaryId:row.PRIMARY_ID,at:new Date(now()).toISOString(),status:'POSTING_OR_UNKNOWN',phase:maxAttempts===SMOKE_LIMIT?'SMOKE':'BULK'};
      checkpoint(); // same normal ATS ledger, before any model request; no second ledger.
      attempts++;unknownAttempts++;
      try {
        // Token bytes never leave the existing native callback except to the
        // fixed Responses transport; the visible suffix is compared in memory.
        const r=await response(body,{
          secureRuntime:use=>credential.secureRuntime(secret=>{
            if(typeof secret!=='string'||!secret.endsWith(proof.keySuffix))throw Error('GRANT_NATIVE_KEY_LINK_MISMATCH');
            return use(secret);
          }),
          projectId:proof.projectId,signal:signal?AbortSignal.any([signal,timeout]):timeout,
          transport:(url,options)=>transport(url,{...options,headers:{...options.headers,'OpenAI-Organization':proof.organizationId}})
        });
        const cost=Math.ceil(r.usage.input_tokens*W.LIMITS.inputUsdPerMillion+r.usage.output_tokens*W.LIMITS.outputUsdPerMillion);
        Object.assign(records[key],{reportedCostMicrousd:cost,inputTokens:r.usage.input_tokens,outputTokens:r.usage.output_tokens});
        reportedCostMicrousd+=cost;unknownAttempts--;
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
  if(configuredLimit!==undefined&&!['1','50'].includes(configuredLimit))throw Error('ATS_GRANT_ROW_LIMIT_INVALID');
  const maxAttempts=configuredLimit===undefined?SMOKE_LIMIT:Number(configuredLimit);
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
