'use strict';
const {isDecisionComplete}=require('./decision-complete');
const active=new Set(['SCOUT_INTAKE','DISCOVERY_LEAD','MANUAL_RESEARCH','BLOCKED','READY_TO_PURSUE','TIM_DECISION_REQUIRED']);
// Same evidence-complete identities as PROCESS_FLOW / PIPELINE_WAITING_QUEUES,
// computed from this run's canonical rows rather than a delayed queue snapshot.
// Every bucket, TIM_DECISION_REQUIRED included, needs the decision-complete fields; enrichment lanes stay work lists (cs-683348cf).
function ids(rows,built,evidence){
  return new Set(rows.filter(r=>active.has(r.BUCKET)&&!/^YES/i.test(r.p.ANTI_RESURRECTION||'')&&!r.p.DO_NOT_REWORK&&!/^CLOSED/.test(r.p.LIVENESS||'')&&!/^CLOSED/.test(r.p.ATS_CHECK_RESULT||'')&&isDecisionComplete(r,evidence)).map(r=>r.PRIMARY_ID));
}
module.exports={ids};
