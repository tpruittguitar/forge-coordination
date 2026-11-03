'use strict';
const {finalScore}=require('../pipeline-observability/process-flow');
const active=new Set(['SCOUT_INTAKE','DISCOVERY_LEAD','MANUAL_RESEARCH','BLOCKED','READY_TO_PURSUE','TIM_DECISION_REQUIRED']);
// Same evidence-complete identities as PROCESS_FLOW / PIPELINE_WAITING_QUEUES,
// computed from this run's canonical rows rather than a delayed queue snapshot.
function ids(rows,built,evidence){
  const missing=new Set([...built.lanes.FORGE_ENRICH_FEASIBILITY,...built.lanes.FORGE_ENRICH_STRATEGIC].map(r=>r.PRIMARY_ID));
  return new Set(rows.filter(r=>active.has(r.BUCKET)&&!/^YES/i.test(r.p.ANTI_RESURRECTION||'')&&!r.p.DO_NOT_REWORK&&!/^CLOSED/.test(r.p.LIVENESS||'')&&!/^CLOSED/.test(r.p.ATS_CHECK_RESULT||'')&&(r.BUCKET==='TIM_DECISION_REQUIRED'||!missing.has(r.PRIMARY_ID)&&evidence.fit(r.p).value!=null&&finalScore(r.p))).map(r=>r.PRIMARY_ID));
}
module.exports={ids};
