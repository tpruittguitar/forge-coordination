'use strict';
// One completeness gate for the decision queue and the process-flow "enriched" counter
// (Tim, Nov 17 2026 5:23/5:25 PM ET): a job reaches Tim only when every input the
// TIM_WEIGHTED_JOB_RATING score and the decision display read is present. Otherwise it
// stays in enrichment. Unknown/placeholder values count as missing.
const placeholder=v=>{const s=String(v??'').trim();return !s||/^(UNKNOWN|NOT[ _]STATED|NOT[ _]RESEARCHED|N\/A|NA|TBD|NONE|—|-)$/i.test(s);};
const present=v=>!placeholder(v);
const num=v=>{const m=String(v??'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):NaN;};
const coord=v=>String(v??'').trim()!==''&&Number.isFinite(Number(v));
// Same rule as the foreman-cockpit finalScore used by PROCESS_FLOW since REV rollout.
function finalScore(p){const raw=String(p.OVERALL_RATING??p.OVERALL??'').trim(),n=Number(raw);return raw!==''&&Number.isFinite(n)&&n>=0&&n<=100&&/^TIM_WEIGHTED_JOB_RATING \S+ rev\d+$/.test(String(p.SCORING_MODEL_REF||''));}
const FLEX_CLASS=/^(HIGH_FLEX|SOFT_FLEX|NO_FLEX|STRICT)$/;
// Same rule as Explorer experience(): CODE_FIT / keyword-proxy values are not a researched fit.
function keywordFit(p,ev){ev=ev||{};const basis=String(p.EXPERIENCE_FIT_BASIS||p.FIT_BASIS||'');
 return /^CODE_FIT\b/i.test(String(p.SCOPE_FIT_MODEL_REF||''))||/^CODE_FIT/i.test(basis)||ev.source==='KEYWORD_PROXY'||p.evidenceSource==='KEYWORD_PROXY';}
function researchedFit(p,E){const ev=E.fit(p);return ev&&ev.value!=null&&!keywordFit(p,ev);}
// Each check: [name, fields it reads, test(row, evidence)].
const REQUIRED=[
 ['final score',['OVERALL_RATING','SCORING_MODEL_REF'],r=>finalScore(r.p)],
 ['experience fit',['FIT_KEYS (SCOPE_FIT_RAW, ...)'],(r,E)=>researchedFit(r.p,E)],
 ['degree FLEX class',['FLEX_CLASS','TIM_FLEX_CLASS'],r=>FLEX_CLASS.test(String(r.p.TIM_FLEX_CLASS||r.p.FLEX_CLASS||'').trim().toUpperCase())],
 ['degree evidence',['DEGREE_TEXT','DEGREE_REQ'],r=>present(r.p.DEGREE_TEXT)||present(r.p.DEGREE_REQ)],
 ['work arrangement (remote/hybrid/on-site)',['REMOTE_HYBRID','WORK_ARRANGEMENT'],r=>present(r.p.REMOTE_HYBRID)||present(r.p.WORK_ARRANGEMENT)],
 ['pay range',['SALARY_BASE_LOW','SALARY_BASE_HIGH'],r=>{const lo=num(r.p.SALARY_BASE_LOW),hi=num(r.p.SALARY_BASE_HIGH);return present(r.p.SALARY_BASE_LOW)&&present(r.p.SALARY_BASE_HIGH)&&lo>0&&hi>=lo;}],
 ['pay basis and source',['SALARY_BASIS','SALARY_SOURCE'],r=>/^(EMPLOYER_POSTED|FORGE-ESTIMATE|THIRD_PARTY_ESTIMATE)$/.test(String(r.p.SALARY_BASIS||'').trim())&&present(r.p.SALARY_SOURCE)],
 ['location / geography',['LOCATION','LATITUDE','LONGITUDE'],r=>present(r.LOCATION)&&(coord(r.p.LATITUDE)&&coord(r.p.LONGITUDE)||/^\s*remote/i.test(String(r.p.REMOTE_HYBRID||r.p.WORK_ARRANGEMENT||'')))],
 ['employer (culture input)',['COMPANY'],r=>present(r.COMPANY)],
 ['title',['TITLE'],r=>present(r.TITLE)],
 // What do they make: Products.known() plus the reference it came from (site-products step).
 ['products (what they make)',['PRODUCT','PRODUCT_REFERENCE'],r=>present(r.p.PRODUCT)&&present(r.p.PRODUCT_REFERENCE)],
];
function missingFields(row,evidence){const r={...row,p:row.p||row.payload||{}};return REQUIRED.filter(([,,ok])=>!ok(r,evidence)).map(([name])=>name);}
function isDecisionComplete(row,evidence){return missingFields(row,evidence).length===0;}
module.exports={isDecisionComplete,missingFields,finalScore,REQUIRED,researchedFit};
