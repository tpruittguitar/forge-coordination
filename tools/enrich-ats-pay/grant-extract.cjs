'use strict';
// Optional ATSBOT extraction, not a helper, an alternative Writer, or a billing reader.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Prepared=require('./prepared.cjs'),Cache=require('./posting-cache'),Recovery=require('./recovery'),L=require('./lib');
const W=require('../grant-backlog/worker.cjs'), C=require('../grant-backlog/windows-credential.cjs');
const {response}=require('../grant-backlog/responses.cjs');
const Store=require('../programmed-coordinator/store.cjs');
const Source=require('../programmed-coordinator/source.cjs');
const SourceBlanks=require('./source-blanks.cjs');
const {lock}=require('../automation-run-lock.cjs');
const {execFileSync}=require('node:child_process');
const SMOKE_LIMIT=1,BULK_LIMIT=50,SMOKE_CAP=10000,GRANT_CAP=37470000;
const {reservationMicrousd}=W.LIMITS;
const fingerprint=x=>crypto.createHash('sha256').update(x).digest('hex');

const API_PARTITION='a1e2b300e063764faac242364e009cd8a3b72987';
const API_FIRST='V2I-7E2E8E0559E8';
function frozenApiIds(queue){
  const ids=queue?.ids?.enrichment,id=/^V2I-[A-F0-9]{12}$/;
  if(queue?.schema!=='forge.waiting-queues.v1'||queue.reconciled!==true||!Array.isArray(ids)||ids.length!==3164
    ||new Set(ids).size!==3164||!ids.every(pid=>typeof pid==='string'&&id.test(pid)))throw Error('ATS_GRANT_FROZEN_API_ID_REQUIRED');
  const api=new Set(ids.filter(pid=>pid>=API_FIRST));
  if(api.size!==1582)throw Error('ATS_GRANT_FROZEN_API_ID_REQUIRED');
  return api;
}
function requireFrozenApiId(pid,queue){
  if(!frozenApiIds(queue).has(pid))throw Error('ATS_GRANT_FROZEN_API_ID_REQUIRED');
}
function productInput(row,capture,now,{allowKnown=false}={}){
  if(Prepared.protectedRow(row)||(!allowKnown&&Source.known(row.p.PRODUCT))||!Recovery.urls(row).some(u=>Cache.route(u)===Cache.route(capture?.url)))return null;
  const source=Prepared.posting(row,capture,now);
  if(!source||source.identityVerified!==true||source.fullPosting!==true)return null;
  Source.publicUrl(source.url);const u=new URL(source.url);
  if(u.search||u.hash||/docs\.google|drive\.google|mail\.|localhost/i.test(u.hostname))return null;
  // Model receives a bounded contiguous excerpt, not an operator-selected answer.
  let text=source.text;
  if(Buffer.byteLength(text)>4300){
    text=Buffer.from(text).subarray(0,4300).toString('utf8');
    const cut=Math.max(text.lastIndexOf('\n'),text.lastIndexOf('. '));
    if(cut<300)return null;
    text=text.slice(0,cut+1);
  }
  return {e:{url:source.url,text,sha256:fingerprint(source.text),observedAt:source.at},source,groups:['PRODUCT']};
}
function productResult(result,e,row){
  if(!result||Array.isArray(result)||Object.keys(result).sort().join(',')!=='product,quote')return {};
  const {product,quote}=result;
  if(typeof product!=='string'||product.length<3||product.length>160||product!==product.trim()||/[\r\n]/.test(product)
    ||typeof quote!=='string'||quote.length<15||quote.length>1000||!e.text.includes(quote)||!quote.includes(product))return {};
  return {primaryId:row.PRIMARY_ID,product,quote,sourceUrl:e.url,sourceObservedAt:e.observedAt,fullPostingTextSha256:e.sha256};
}

// Promote the actual Product proposal only after the exact stock Writer ruling
// is durable and its fresh canonical row still has the proven Product and 11/11.
async function completeProductSmoke({ledger,proof,row,product,capture,Products,Evidence,index,read,parse,now=Date.now()}){
  const {proposal,ruling}=proof||{},pid=row?.PRIMARY_ID;
  const invalid=()=>{throw Error('ATS_GRANT_PRODUCT_SMOKE_WRITE_UNVERIFIED');};
  if(!pid||proposal?.primaryId!==pid||ruling?.primaryId!==pid||ruling.kind!=='ENRICH'||!['ATSBOT','CHATGPT'].includes(ruling.actor)
    ||!/^[-_A-Za-z0-9]{3,160}$/.test(ruling.requestId||'')||product?.primaryId!==pid)return invalid();
  // The canonical row already has Product now; reproduce only the original
  // source binding and literal-quote checks, never submit a new grant request.
  const selected=productInput({...row,p:{...row.p,PRODUCT:''}},capture,now);
  const bound=selected&&productResult({product:proposal.product,quote:proposal.quote},selected.e,row);
  if(!bound?.primaryId||Object.keys(bound).some(k=>bound[k]!==proposal[k]))return invalid();
  const key=fingerprint(JSON.stringify([pid,Cache.route(bound.sourceUrl),bound.fullPostingTextSha256]));
  const record=ledger.grantExtractionAttempts?.[key],expected=Products.fields(product);
  const fields=ruling.fields;
  if(record?.primaryId!==pid||record?.phase!=='SMOKE'||record.purpose!=='PRODUCT_PROPOSAL'
    ||!['PRODUCT_PROPOSED','WRITER_VERIFIED'].includes(record.status)||!Number.isSafeInteger(record.reportedCostMicrousd)
    ||record.reportedCostMicrousd<=0||record.writerRequestId&&record.writerRequestId!==ruling.requestId
    ||!fields||expected.PRODUCT_SCOPE!=='JOB_POSTING'||expected.PRODUCT!==proposal.product
    ||expected.PRODUCT_SOURCE!==proposal.sourceUrl||Object.entries(expected).some(([k,v])=>fields[k]!==v))return invalid();
  if(record.status==='WRITER_VERIFIED')return false;
  let drift=false,complete=false;
  if(!await require('./writer-proof').verify([{action:'ruling',ruling}],{index,read,parse:line=>{
    const current=parse(line);
    complete=!!current&&require('./decision-complete').isDecisionComplete(current,Evidence)&&!!current.p?.PRODUCT_SOURCE;
    return current;
  },onDrift:()=>{drift=true;}})||drift||!complete)return invalid();
  Object.assign(record,{status:'WRITER_VERIFIED',writerRequestId:ruling.requestId});
  return true;
}

function input(row,capture,needs,fields,now,{payUnresolved=false}={}) {
  if(Prepared.protectedRow(row)||!Recovery.urls(row).some(u=>Cache.route(u)===Cache.route(capture?.url)))return null;
  const source=Prepared.posting(row,capture,now);
  if(!source||source.basis!=='EMPLOYER_POSTED'||source.identityVerified!==true)return null;
  const candidate=SourceBlanks.modelCandidate(row,source,now,needs.filter(g=>g==='WORK_ARRANGEMENT'?!fields.WORK_ARRANGEMENT&&!fields.REMOTE_HYBRID:g==='DEGREE'?!fields.DEGREE_REQ&&!fields.DEGREE_TEXT:true)),groups=candidate?[candidate.group]:[];
  const ambiguousPay=payUnresolved||[capture,source].some(s=>s.payAmbiguous===true||s.payNeedsRefresh===true||s.payStatus==='PAY_UNRESOLVED');
  if(!candidate&&!ambiguousPay&&needs.includes('SALARY')&&!fields.SALARY_BASE_LOW&&/\$\s*\d|\bUSD\s*\d/i.test(source.text))groups.push('SALARY');
  // The ATS degree parser has already handled this capture. Do not spend
  // on a degree-only request that the same parser would reject or duplicate.
  if(!groups.length)return null;
  // Unmodified public source text; omit long bodies rather than cut away governing clauses.
  const text=candidate?.text||source.text;
  if(Buffer.byteLength(text)>4500)return null;
  Source.publicUrl(source.url);
  const u=new URL(source.url);
  if(u.search||u.hash||/docs\.google|drive\.google|mail\.|localhost/i.test(u.hostname))return null;
  const e={
    company:row.COMPANY,title:row.TITLE,location:row.LOCATION,url:source.url,
    text,observedAt:source.at,sha256:fingerprint(source.text)};
  return {e,groups,ambiguousPay,candidate,source};
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

function create({readFunding,openCredential=C.startup,transport=globalThis.fetch,expectedSid,now=Date.now,maxAttempts=SMOKE_LIMIT,retryPriorId=null,retryTargetId=null,retryOriginalId=null,productId=null,actionsAccount=null}){
  if(![SMOKE_LIMIT,BULK_LIMIT].includes(maxAttempts))throw Error('ATS_GRANT_ROW_LIMIT_INVALID');
  if(actionsAccount&&(readFunding||!/^org[-_][A-Za-z0-9_-]+$/.test(actionsAccount.organizationId||'')||!/^proj_[A-Za-z0-9_-]+$/.test(actionsAccount.projectId||'')
    ||!/^[A-Za-z0-9_-]{4}$/.test(actionsAccount.keySuffix||'')))throw Error('ATS_GRANT_ACTIONS_ACCOUNT_INVALID');
  const id=/^V2[A-Z]-[A-Za-z0-9_-]+$/;
  if(productId&&(maxAttempts!==SMOKE_LIMIT||!id.test(productId)||retryPriorId||retryOriginalId))throw Error('ATS_GRANT_PRODUCT_PROPOSAL_SCOPE');
  if(retryPriorId&&(maxAttempts!==SMOKE_LIMIT||!id.test(retryPriorId)||!id.test(retryTargetId||'')||retryPriorId===retryTargetId))throw Error('ATS_GRANT_SMOKE_RETRY_SCOPE_INVALID');
  if(retryOriginalId&&(!retryPriorId||!id.test(retryOriginalId)||new Set([retryOriginalId,retryPriorId,retryTargetId]).size!==3))throw Error('ATS_GRANT_SMOKE_RETRY_SCOPE_INVALID');

  let attempts=0, reportedCostMicrousd=0, unknownAttempts=0, stopped=false, proof, credential, diagnostic;
  return {
    close(){credential?.close();credential=null;},
    get attempts(){return attempts;},
    get diagnostic(){return diagnostic;},
    get accounting(){return {reportedCostMicrousd,unknownAttempts,unknownReservedMicrousd:unknownAttempts*reservationMicrousd,cumulativeCapMicrousd:GRANT_CAP};},
    get smoke(){return maxAttempts===SMOKE_LIMIT;},
    get productProposal(){return !!productId;},
    requireBulkSmoke(ledger){
      if(maxAttempts!==BULK_LIMIT||!Object.values(ledger.grantExtractionAttempts||{}).some(r=>r?.phase==='SMOKE'&&r.status==='WRITER_VERIFIED'&&r.writerRequestId))throw Error('ATS_GRANT_SMOKE_WRITE_UNVERIFIED');
    },
    acceptedBulkResearch(row,capture,ledger,product){
      if(maxAttempts!==BULK_LIMIT)return null;
      const source=Prepared.posting(row,capture,now());
      if(!source?.identityVerified||!source?.fullPosting||!Recovery.urls(row).some(u=>Cache.route(u)===Cache.route(source.url)))return null;
      const sourceKey=[row.PRIMARY_ID,Cache.route(source.url),fingerprint(source.text)];
      const records=ledger.grantExtractionAttempts||{},fields={};
      let accepted=false;
      for(const [group,retry] of [['',null],...['PRODUCT','WORK_ARRANGEMENT','DEGREE','SALARY'].flatMap(g=>[[g,null],[g,'RETRY']])]){
        const key=fingerprint(JSON.stringify(group?[...sourceKey,group,...(retry?[retry]:[])]:sourceKey));
        const record=records[key];
        if(record?.primaryId!==row.PRIMARY_ID||record.phase!=='BULK'||!Number.isSafeInteger(record.reportedCostMicrousd))continue;
        if(record.status==='FACTS_ACCEPTED'&&record.acceptedFields){Object.assign(fields,record.acceptedFields);accepted=true;}
        const e=record.productReference;
        if(record.status==='PRODUCT_PROPOSED'&&e?.primaryId===row.PRIMARY_ID&&product?.id===e.id&&
          product.provenance?.grantAttemptKey===key&&product.provenance?.fullPostingTextSha256===e.provenance.fullPostingTextSha256&&
          JSON.stringify(product.products)===JSON.stringify(e.products)&&JSON.stringify(product.sources)===JSON.stringify(e.sources))accepted=true;
      }
      return accepted?{fields}:null;
    },
    rejectedProductSource(row,ledger){
      const rejected=require('./grant-public-source.cjs').rejectedProposal;
      const draft=Object.values(ledger.grantExtractionAttempts||{}).find(r=>r?.primaryId===row.PRIMARY_ID&&r.phase==='BULK'&&
        (r.rejectedProductUrl||r.status==='PRODUCT_PROPOSED'&&rejected(row,r.productReference)));
      return draft?.rejectedProductUrl||draft?.productReference?.sources?.[0];
    },
    pendingProduct(row,ledger){
      const rejected=require('./grant-public-source.cjs').rejectedProposal;
      const e=Object.values(ledger.grantExtractionAttempts||{}).find(r=>r?.primaryId===row.PRIMARY_ID&&r.phase==='BULK'&&r.status==='PRODUCT_PROPOSED'&&!rejected(row,r.productReference))?.productReference;
      return e&&e.company===row.COMPANY&&e.location===row.LOCATION&&
        (!Source.known(row.p.PRODUCT)||e.products[0]===row.p.PRODUCT)?e:null;
    },
    async extract({row,capture,needs,fields,ledger,checkpoint,signal,payUnresolved,bulkProduct=false,retryKnownNoFacts=false}){
      if(stopped||attempts>=maxAttempts||signal?.aborted)return {};
      let selected;
      if(bulkProduct&&maxAttempts!==BULK_LIMIT)throw Error("ATS_GRANT_PRODUCT_PROPOSAL_SCOPE");
      const proposeProduct=!!productId||bulkProduct;
      if(productId&&row.PRIMARY_ID!==productId)return {};
      try{selected=proposeProduct?productInput(row,capture,now(),{allowKnown:bulkProduct}):input(row,capture,needs,fields,now(),{payUnresolved});}catch{return {};}
      if(!selected)return {};
      const {e,groups,ambiguousPay,candidate,source}=selected;
      const sourceKey=[row.PRIMARY_ID,Cache.route(e.url),e.sha256], legacyKey=fingerprint(JSON.stringify(sourceKey));
      const group=maxAttempts===BULK_LIMIT?groups[0]:null;
      const normalKey=group?fingerprint(JSON.stringify([...sourceKey,group])):legacyKey;
      const records=ledger.grantExtractionAttempts??=(Object.create(null));
      const legacy=group&&records[legacyKey], first=records[normalKey];
      // No retry of an uncertain request; a second request is a new bounded
      // extraction only after an accounted-for no-facts response.
      if(retryKnownNoFacts&&(!group||first?.phase!=='BULK'||first.status!=='NO_SUPPORTED_FACTS'||
        !Number.isSafeInteger(first.reportedCostMicrousd)||first.rejectedProductUrl))return {};
      const key=retryKnownNoFacts?fingerprint(JSON.stringify([...sourceKey,group,'RETRY'])):normalKey;
      if(Object.hasOwn(records,key)||legacy?.phase==='BULK'&&(!legacy.purpose||group==='PRODUCT'))return {};
      const entries=Object.values(records);
      if(group&&entries.filter(r=>r?.primaryId===row.PRIMARY_ID&&r.phase==='BULK'&&
        (r.group===group||!r.group&&(!r.purpose||group==='PRODUCT'))).length>=2)return {};
      if(group&&entries.some(r=>r?.primaryId===row.PRIMARY_ID&&r.status==='POSTING_OR_UNKNOWN'))return {};
      const smoke=entries.find(r=>r?.phase==='SMOKE'&&r.status==='WRITER_VERIFIED'&&r.writerRequestId);
      if(maxAttempts===BULK_LIMIT&&!smoke)throw Error('ATS_GRANT_SMOKE_WRITE_UNVERIFIED');
      const priorSmokes=Object.entries(records).filter(([,r])=>r?.phase==='SMOKE');
      let priorKey;
      if(productId&&entries.some(r=>r?.primaryId===productId))throw Error('ATS_GRANT_PRODUCT_ALREADY_ATTEMPTED');
      if(bulkProduct&&entries.some(r=>r?.primaryId===row.PRIMARY_ID&&
        (r.status==='POSTING_OR_UNKNOWN'||r.purpose==='PRODUCT_PROPOSAL'&&r.status==='PRODUCT_PROPOSED'&&!r.rejectedProductUrl&&!require('./grant-public-source.cjs').rejectedProposal(row,r.productReference))))return {};
      if(!productId&&maxAttempts===SMOKE_LIMIT&&(retryPriorId||priorSmokes.length)){
        const previous=priorSmokes.find(([,r])=>r.primaryId===retryPriorId);
        const original=priorSmokes.find(([,r])=>r.primaryId===retryOriginalId);
        // A distinct corrected target cannot replay either older attempt.
        // Only the exact prior grant records govern that final opt-in.
        const hasOlderGuardEvidence=id=>Object.hasOwn(ledger.submitted||{},id)||['pendingWrites','notAccepted','releasedNotApplied'].some(group=>
          Object.values(ledger[group]||{}).some(x=>x?.ids?.includes(id)||x?.requests?.some(q=>q?.ruling?.primaryId===id)));
        const unknown=entry=>entry?.[0]!==key&&entry?.[1]?.status==='POSTING_OR_UNKNOWN'&&!entry[1].writerRequestId;
        const exactChain=retryOriginalId?priorSmokes.length===2&&unknown(original)&&!original[1].retryOf&&previous?.[1]?.retryOf===original[0]
          :priorSmokes.length===1&&!previous?.[1]?.retryOf&&!hasOlderGuardEvidence(retryPriorId);
        if(!retryPriorId||!exactChain||row.PRIMARY_ID!==retryTargetId||!unknown(previous))throw Error('ATS_GRANT_SMOKE_ALREADY_ATTEMPTED');
        priorKey=previous[0];
      }
      const reserved=(entries.length+1)*reservationMicrousd;
      if(reserved>GRANT_CAP||maxAttempts===SMOKE_LIMIT&&(priorSmokes.length+1)*reservationMicrousd>SMOKE_CAP)throw Error('ATS_GRANT_CAP_REACHED');

      let deadline;
      try {
        diagnostic={category:'ACCOUNT_PREFLIGHT'};
        if(actionsAccount){
          // Tim 2026-11-25 11:15 ET: Actions run without the operator funding receipt.
          // Spend stays bounded by SMOKE_CAP/GRANT_CAP on the committed ledger above
          // and the grant stopAt; the request stays pinned to this org/project.
          proof??={...actionsAccount};
          deadline=Date.parse(W.LIMITS.stopAt);
          if(!(now()<deadline))throw Error('GRANT_ACCOUNT_PROOF_EXPIRED');
        }else{
          proof??=await readFunding(); // Single bounded attestation snapshot per run.
          deadline=accountDeadline(proof,now());
          const sinceProof=entries.filter(r=>Date.parse(r?.at)>=Date.parse(proof.observedAt)).length;
          if((sinceProof+1)*reservationMicrousd>proof.grant.availableMicrousd)throw Error('GRANT_HEADROOM_REQUIRED');
        }
        diagnostic={category:'NATIVE_CREDENTIAL_PREFLIGHT'};
        credential??=openCredential({expectedSid});
      } catch {stopped=true;throw Error('GRANT_FUNDING_OR_HOST_BLOCKED');}
      diagnostic={category:'REQUEST_VALIDATION'};
      const body=W.request(e,groups,{explicitJsonMessage:true,productProposal:proposeProduct});
      const remaining=Math.min(W.LIMITS.jobMs,deadline-now());
      if(remaining<=0||signal?.aborted)return {};
      const timeout=AbortSignal.timeout(remaining);
      records[key]={primaryId:row.PRIMARY_ID,at:new Date(now()).toISOString(),status:'POSTING_OR_UNKNOWN',phase:maxAttempts===SMOKE_LIMIT?'SMOKE':'BULK',...(group?{group}:{}),...(proposeProduct?{purpose:'PRODUCT_PROPOSAL'}:{}),...(priorKey?{retryOf:priorKey}:{})};
      checkpoint(); // same normal ATS ledger, before any model request; no second ledger.
      attempts++;unknownAttempts++;
      try {
        // Token bytes never leave the existing native callback except to the
        // fixed Responses transport; the visible suffix is compared in memory.
        const r=await response(body,{
          secureRuntime:use=>credential.secureRuntime(secret=>{
            if(typeof secret!=='string'||!secret.endsWith(proof.keySuffix)){diagnostic={category:'NATIVE_KEY_LINK_MISMATCH'};throw Error('GRANT_NATIVE_KEY_LINK_MISMATCH');}
            return use(secret);
          }),
          projectId:proof.projectId,signal:signal?AbortSignal.any([signal,timeout]):timeout,
          observe:detail=>{diagnostic=detail;},
          transport:async(url,options)=>{
            diagnostic={category:'TRANSPORT'};
            try{return await transport(url,{...options,headers:{...options.headers,'OpenAI-Organization':proof.organizationId}});}
            catch(e){
              if(options.signal?.aborted)diagnostic={category:'TRANSPORT_ABORTED'};
              else if(['ENOTFOUND','EAI_AGAIN'].includes(e?.cause?.code))diagnostic={category:'TRANSPORT_DNS'};
              else if(['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(e?.cause?.code))diagnostic={category:'TRANSPORT_TIMEOUT'};
              throw e;
            }
          }
        });
        const cost=Math.ceil(r.usage.input_tokens*W.LIMITS.inputUsdPerMillion+r.usage.output_tokens*W.LIMITS.outputUsdPerMillion);
        Object.assign(records[key],{reportedCostMicrousd:cost,inputTokens:r.usage.input_tokens,outputTokens:r.usage.output_tokens});
        reportedCostMicrousd+=cost;unknownAttempts--;
        diagnostic={category:'FACT_VALIDATION'};
        let fields=proposeProduct?productResult(r.result,e,row):candidate?SourceBlanks.modelResult(r.result,candidate,source):resultFields(r.result,e,groups,row,{ambiguousPay});
        // Product provenance cannot legitimize a different already-stored fact.
        if(bulkProduct&&require('./grant-public-source.cjs').rejectedProposal(row,{products:[fields.product],sources:[e.url],provenance:{quote:fields.quote}})){
          records[key].rejectedProductUrl=e.url;fields={};
        }
        if(bulkProduct&&Source.known(row.p.PRODUCT)&&fields.product!==row.p.PRODUCT)fields={};
        records[key].status=Object.keys(fields).length?(proposeProduct?'PRODUCT_PROPOSED':'FACTS_ACCEPTED'):'NO_SUPPORTED_FACTS';
        if(bulkProduct&&records[key].status==='PRODUCT_PROPOSED'){
          records[key].productReference={id:'ats-grant-'+row.PRIMARY_ID.toLowerCase(),primaryId:row.PRIMARY_ID,company:row.COMPANY,location:row.LOCATION,
            products:[fields.product],status:'CONFIRMED',sources:[fields.sourceUrl],verifiedAt:fields.sourceObservedAt,
            provenance:{scope:'JOB_POSTING',grantAttemptKey:key,grantAttemptAt:records[key].at,costMicrousd:cost,
              quote:fields.quote,fullPostingTextSha256:fields.fullPostingTextSha256}};
          checkpoint(); // The exact proposal survives a stop before registry publication.
        }else if(maxAttempts===BULK_LIMIT&&records[key].status==='FACTS_ACCEPTED'){
          records[key].acceptedFields=fields;
          checkpoint(); // The returned verified facts are reusable without another model call.
        }
        if(records[key].rejectedProductUrl||maxAttempts===BULK_LIMIT&&records[key].status==='NO_SUPPORTED_FACTS')checkpoint();
        diagnostic={category:records[key].status};
        return fields;
      } catch {
        // A bounded per-job timeout stays individually fenced, but does not
        // stall other bulk IDs. Funding/HTTP/unknown errors still stop the lane.
        if(maxAttempts===BULK_LIMIT&&!signal?.aborted&&
          (diagnostic?.category==='TRANSPORT_TIMEOUT'||diagnostic?.category==='TRANSPORT_ABORTED'&&timeout.aborted))return {};
        stopped=true; // No retry or alternate account on invalid, unknown or unverifiable outcomes.
        throw Error('GRANT_RESPONSE_UNVERIFIED');
      }
    }
  };
}

// GitHub Actions secret, used only through the fixed Responses transport.
function envCredential(env){
  let secret=env.FORGE_ATS_GRANT_KEY;
  if(!/^sk-(?:proj-)?[A-Za-z0-9_-]{20,500}$/.test(secret||''))throw Error('ATS_GRANT_ACTIONS_KEY_REQUIRED');
  return {suffix:secret.slice(-4),open:()=>Object.freeze({
    async secureRuntime(use){
      if(secret===null)throw Error('CREDENTIAL_CLOSED');
      const result=await use(secret);
      if(!(result instanceof Response))throw Error('CREDENTIAL_CALLBACK_RESULT');
      return result;
    },
    close(){secret=null;}
  })};
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
  // Actions mode is explicit: the opt-in flag on a GitHub runner, never a default.
  const actions=env.FORGE_ATS_GRANT_ACTIONS==='1';
  if(!actions&&env.FORGE_ATS_GRANT_KEY)throw Error('ATS_GRANT_RUNTIME_REQUIRED');
  if(!file&&!actions)return null; // the existing Ubuntu producer is unchanged
  if(actions&&(file||env.GITHUB_ACTIONS!=='true'||!live||!writerPostLock||!path.isAbsolute(env.RUNNER_TEMP||'')))throw Error('ATS_GRANT_RUNTIME_REQUIRED');
  if(!actions&&(process.platform!=='win32'||!live||!writerPostLock||!path.isAbsolute(file)))throw Error('ATS_GRANT_RUNTIME_REQUIRED');
  let privateFile=null,key=null;
  if(actions)key=envCredential(env);
  else{
    privateFile=fs.realpathSync(file);const checkout=fs.realpathSync(root);
    if(privateFile.toLowerCase().startsWith(checkout.toLowerCase()+path.sep))throw Error('ATS_GRANT_FUNDING_MUST_BE_PRIVATE');
  }
  const configuredLimit=env.FORGE_ATS_GRANT_MAX_ROWS;
  if(configuredLimit!==undefined&&!['1','50'].includes(configuredLimit))throw Error('ATS_GRANT_ROW_LIMIT_INVALID');
  const maxAttempts=configuredLimit===undefined?SMOKE_LIMIT:Number(configuredLimit);
  const retryPriorId=env.FORGE_ATS_GRANT_RETRY_PRIOR_ID||null,retryTargetId=env.FORGE_ATS_GRANT_SMOKE_ID||null;
  const retryOriginalId=env.FORGE_ATS_GRANT_RETRY_ORIGINAL_ID||null;
  let productId=null,frozen=null;
  if(maxAttempts===BULK_LIMIT||env.FORGE_ATS_GRANT_PRODUCT_PROPOSAL==='1'){
    frozen=frozenApiIds(JSON.parse(execFileSync('git',['show',API_PARTITION+':state/PIPELINE_WAITING_QUEUES.json'],
      {cwd:root,encoding:'utf8',maxBuffer:262144})));
  }
  if(env.FORGE_ATS_GRANT_PRODUCT_PROPOSAL==='1'){
    if(!frozen.has(retryTargetId))throw Error('ATS_GRANT_FROZEN_API_ID_REQUIRED');
    productId=retryTargetId;
  }
  const expectedSid=actions?null:env.FORGE_ATS_GRANT_EXPECTED_SID;
  if(!actions&&!/^S-1-5-21-(?:\d+-){3}\d+$/.test(expectedSid||''))throw Error('ATS_GRANT_NATIVE_ACCOUNT_REQUIRED');
  // Fail closed if the existing authoritative ATS workflow is enabled or still
  // has old runs. The host must be the single designated schedule/ledger owner.
  const github={token:env.GITHUB_TOKEN||env.GH_TOKEN,repo:env.GITHUB_REPOSITORY};
  // Actions: the workflow concurrency group (enrich-ats-pay, cancel-in-progress
  // false) is the single owner; the Windows host still fails closed while it is enabled.
  const ownerStopped=actions?async()=>{}:()=>assertGithubOwnerStopped(github);
  const lockPath=(actions?path.join(env.RUNNER_TEMP,'forge-ats-grant'):privateFile)+'.ats-run-lock',token='ATSBOT-'+crypto.randomUUID();
  let owned=false;
  const account=actions?{actionsAccount:{organizationId:env.FORGE_ATS_GRANT_ORG_ID,projectId:env.FORGE_ATS_GRANT_PROJECT_ID,keySuffix:key.suffix},openCredential:key.open}
    :{expectedSid,readFunding:async()=>JSON.parse(fs.readFileSync(privateFile,'utf8'))};
  return Object.assign(create({...account,maxAttempts,retryPriorId,retryTargetId,retryOriginalId,productId}),{
    isEligibleId(pid){return !frozen||frozen.has(pid);},
    get firstPassScope(){return maxAttempts===BULK_LIMIT&&!productId?{partition:API_PARTITION,size:frozen.size}:null;},
    get rowLimit(){return maxAttempts;},
    async acquire(){
      await ownerStopped();
      if(!lock(lockPath,'acquire',token).acquired)throw Error('ATS_GRANT_NATIVE_RUN_ALREADY_ACTIVE');
      owned=true;
    },
    async verifyExclusive(){lock(lockPath,'check',token);await ownerStopped();},
    release(){if(owned){lock(lockPath,'release',token);owned=false;}}
  });
}
function checkpoint(file,ledger){Store.save(path.dirname(file),path.basename(file),ledger);}
module.exports={completeProductSmoke,frozenApiIds,requireFrozenApiId,create,configured,checkpoint,input,resultFields,assertGithubOwnerStopped,envCredential};
