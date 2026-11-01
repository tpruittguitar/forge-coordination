'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function load(){const c=JSON.parse(fs.readFileSync(path.join(root,'control/RELEVANCE_SCREEN.json')));if(c.schema!=='forge.relevance-screen.v1'||!c.enabled||!Array.isArray(c.rules)||!/^[a-f0-9]{40}$/.test(c.policyCommit))throw Error('Relevance screen release is not active');const b=JSON.parse(fs.readFileSync(path.join(root,c.backtest)));for(const r of c.rules){const t=b.rules.find(x=>x.ruleId===r.id&&x.pattern===r.pattern);if(!t||t.falseClosures!==0||t.positiveCohort<1)throw Error('Unproven closure rule '+r.id);}const f=path.join(root,'state/RELEVANCE_SCREEN_GUARD.json');if(fs.existsSync(f)){const g=JSON.parse(fs.readFileSync(f));if(g.policyCommit===c.policyCommit)c.disabledRules=g.disabledRules||[];}return c;}
function guarded(c,rows){const disabled=new Set(c.disabledRules||[]);for(const r of rows){const p=r.p||{};if(!['APPLIED','REJECTED_BY_EMPLOYER','READY_TO_PURSUE'].includes(r.BUCKET)&&!p.APP_DATE&&p.PRIOR_APPLICATION!=='YES')continue;const hit=evaluate({company:r.COMPANY,title:r.TITLE,location:r.LOCATION,url:'https://canonical.invalid/'+r.PRIMARY_ID},c);if(hit.outcome==='FUNCTION_MISMATCH')disabled.add(hit.ruleId);}return{...c,disabledRules:[...disabled]};}
function evaluate(card,c=load()){
 const title=String(card.title||card.TITLE||'').trim(),company=String(card.company||card.COMPANY||'').trim(),location=String(card.location||card.LOCATION||'').trim(),url=card.url||card.SOURCE_URL;
 if(!title||!company||!location||!/^https:\/\//i.test(url||''))return{outcome:'HOLD_SOURCE_IDENTITY',rank:8,reason:'Missing card company, title, location or exact source URL'};
 const manufacturing=new RegExp(c.manufacturingContext,'i').test(title);
 // Scope is card-level function only. No title-level, employer-name, geography,
 // estimated-pay, missing-pay, agency or unknown-client exclusion is permitted.
 for(const r of c.rules){if((c.disabledRules||[]).includes(r.id))continue;if(manufacturing)break;if(r.id==='FM_SOFTWARE_ONLY'&&new RegExp(c.softwareContextGuard,'i').test(title))continue;const hit=title.match(new RegExp(r.pattern,'i'));if(hit)return{outcome:'FUNCTION_MISMATCH',ruleId:r.id,matchedTerm:hit[0],sourceTitle:title,policyCommit:c.policyCommit,reason:'Explicit off-function title without manufacturing context',rank:9};}
 const core=/manufactur|production|plant|factory|assembl|industrializ|\bnpi\b|operational excellence|continuous improvement/i.test(title),related=/quality|engineer|\btest\b|commissioning|supply chain/i.test(title),ops=/operations|general manager|\bgm\b/i.test(title);
 const targetLevel=/\b(?:director|head|vice president|vp|chief|manager|president|plant leader|site leader|principal|senior staff|sr\.? staff|technical fellow)\b/i.test(title);
 return{outcome:(core||related)&&targetLevel?'ADMIT':'RANKED_DISCOVERY',rank:core?0:related?1:ops?2:3,reason:(core||related)&&targetLevel?'Plausible target function; Writer decides canonical admission and Never Consider':'Card scope unclear; retain visibly for one fact-changing targeted lookup',maxTargetedLookups:1};
}
function rank(items,c=load()){return items.map(x=>({...x,screen:evaluate(x,c)})).sort((a,b)=>a.screen.rank-b.screen.rank||String(a.sourceDate||a.firstSeen||'9999').localeCompare(String(b.sourceDate||b.firstSeen||'9999'))||String(a.key||a.url).localeCompare(String(b.key||b.url)));}
function updateGuard(rows){const c=guarded(load(),rows),g={schema:'forge.relevance-guard.v1',at:new Date().toISOString(),policyCommit:c.policyCommit,disabledRules:c.disabledRules};fs.writeFileSync(path.join(root,'state/RELEVANCE_SCREEN_GUARD.json'),JSON.stringify(g,null,2)+'\n');return c;}
module.exports={load,evaluate,rank,guarded,updateGuard};
