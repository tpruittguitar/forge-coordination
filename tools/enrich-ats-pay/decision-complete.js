'use strict';
// One gate for the decision queue and the process-flow "enriched" counter: enough to decide (cs-683348cf, Tim Nov 27 2026).
// Identity must be present, and any pay shown carries its basis and source. Other gaps show as UNKNOWN on the card.
const placeholder=v=>{const s=String(v??'').trim();return !s||/^(UNKNOWN|NOT[ _]STATED|NOT[ _]RESEARCHED|N\/A|NA|TBD|NONE|—|-)$/i.test(s);};
const present=v=>!placeholder(v);
const coord=v=>String(v??'').trim()!==''&&Number.isFinite(Number(v));
// Same rule as the foreman-cockpit finalScore used by PROCESS_FLOW since REV rollout.
function finalScore(p){const raw=String(p.OVERALL_RATING??p.OVERALL??'').trim(),n=Number(raw);return raw!==''&&Number.isFinite(n)&&n>=0&&n<=100&&/^TIM_WEIGHTED_JOB_RATING \S+ rev\d+$/.test(String(p.SCORING_MODEL_REF||''));}
// Each check: [name, fields it reads, test(row, evidence)].
const REQUIRED=[
 ['pay basis and source',['SALARY_BASIS','SALARY_SOURCE'],r=>!(present(r.p.SALARY_BASE_LOW)||present(r.p.SALARY_BASE_HIGH))||/^(EMPLOYER_POSTED|FORGE-ESTIMATE|THIRD_PARTY_ESTIMATE)$/.test(String(r.p.SALARY_BASIS||'').trim())&&present(r.p.SALARY_SOURCE)],
 ['location / geography',['LOCATION','LATITUDE','LONGITUDE'],r=>present(r.LOCATION)||(coord(r.p.LATITUDE)&&coord(r.p.LONGITUDE))],
 ['employer (culture input)',['COMPANY'],r=>present(r.COMPANY)],
 ['title',['TITLE'],r=>present(r.TITLE)],
];
function missingFields(row,evidence){const r={...row,p:row.p||row.payload||{}};return REQUIRED.filter(([,,ok])=>!ok(r,evidence)).map(([name])=>name);}
function isDecisionComplete(row,evidence){return missingFields(row,evidence).length===0;}
module.exports={isDecisionComplete,missingFields,finalScore,REQUIRED};
