// Look-owner fixture: every score shown in the M-01..M-07 pages comes from foreman-cockpit scoreRow() (main @ e7389ed).
// Population is synthetic (mock) but scored by the real function; band cut-points are percentiles of that population.
const path='/workspace/pe/fcmain/';
global.PipelinePolicy=require(path+'pipeline-policy.js');global.PipelineEvidence=require(path+'pipeline-evidence.js');
const S=require(path+'pipeline-scoring.js');
const geo=require('/workspace/forge/PIPELINE_SCORING_MODEL.json').geo;
const cfg={publishedRevision:24,weights:{experience:35,flex:30,compensation:15,geo:10,ats:0,title:5,culture:5,ownership:0},
  geo:{power:geo.power,controlPoints:geo.controlPoints},salary:{floor:160000,target:220000,ceiling:320000,stateFactors:{TN:1,FL:1.02,MI:.9,NY:.72,CA:.82,WA:.9,OR:.84}},
  targetCompanies:[{company:'Halvorsen Robotics',aliases:[],priority:'P1'},{company:'Vantor Defense Systems',aliases:['Vantor Defense Sys.'],priority:'P2'},{company:'Ironbark Battery',aliases:[],priority:'P3'},{company:'Cobalt Aerostructures',aliases:[],priority:'WATCH'}]};
// seeded RNG
let seed=20261018;function rnd(){seed=(seed*1103515245+12345)%2147483648;return seed/2147483648}
const cities=['Nashville, TN','Knoxville, TN','Chattanooga, TN','Huntsville, AL','Birmingham, AL','Atlanta, GA','Charlotte, NC','Greenville, SC','Columbus, OH','Detroit, MI','Chicago, IL','Austin, TX','Dallas, TX','Phoenix, AZ','Tampa, FL','Memphis, TN','Raleigh, NC','Louisville, KY','Indianapolis, IN','New York, NY'];
const titles=['Director, Manufacturing Ops','Plant Manager','Head of Production','VP Operations','Sr. Dir., Operations','Production Manager','Ops Manager, Machining','Dir., Mfg Engineering','Quality Director','Sr. Mgr., Mfg Excellence','Operations Engineer'];
const flex=['HIGH_FLEX','HIGH_FLEX','SOFT_FLEX','SOFT_FLEX','NO_FLEX','NO_FLEX','NO_FLEX','UNKNOWN'];
function row(o){return {TITLE:o.t,COMPANY:o.c,LOCATION:o.l,BUCKET:o.b||'TIM_DECISION_REQUIRED',payload:Object.assign({SCOPE_FIT_RAW:o.fit,FLEX_CLASS:o.flex,SALARY_BASE_EST:o.pay?('$'+o.pay+'K'):''},o.p||{})}}
const pop=[];
for(let i=0;i<440;i++){const f=Math.round(Math.max(5,Math.min(95,40+rnd()*36-rnd()*30)));const pay=rnd()<.15?null:Math.round(140+rnd()*150);
  pop.push(row({t:titles[Math.floor(rnd()*titles.length)],c:'Mock Co '+i,l:cities[Math.floor(rnd()*cities.length)],fit:f,flex:rnd()<.06?'STRICT':flex[Math.floor(rnd()*flex.length)],pay}))}
const show={
 agency:row({t:'Director of Manufacturing',c:'Keystone Recruiting Group',l:'Huntsville, AL',fit:74,flex:'SOFT_FLEX',pay:235,p:{EMPLOYER_PRIMARY_BUSINESS:'RECRUITING_AGENCY',SCOUT_NOTES:'AGENCY_POSTING; CLIENT=UNKNOWN; CLIENT_SEARCH=BASIC_DONE',EMPLOYER_DOMAIN_HINT:'Aerospace components'}}),
 agencyAerotek:row({t:'Director of Manufacturing',c:'Aerotek',l:'Huntsville, AL',fit:74,flex:'SOFT_FLEX',pay:235,p:{EMPLOYER_PRIMARY_BUSINESS:'RECRUITING_AGENCY',SCOUT_NOTES:'AGENCY_POSTING; CLIENT=UNKNOWN; CLIENT_SEARCH=BASIC_DONE'}}),
 closed:row({t:'Plant Manager',c:'Ironbark Battery',l:'Knoxville, TN',fit:70,flex:'HIGH_FLEX',pay:210,p:{LIVENESS:'CLOSED_EMPLOYER_ATS',LIVENESS_ASOF:'2026-10-18',LIVENESS_METHOD:'ATS_API:greenhouse'}}),
 closed2:row({t:'Head of Operations',c:'Lumen Grid Storage',l:'Columbia, SC',fit:55,flex:'NO_FLEX',pay:220,p:{LIVENESS:'CLOSED_EMPLOYER_ATS'}}),
 closed3:row({t:'Ops Director, Assembly',c:'Sablewood Machines',l:'Cleveland, TN',b:'CLOSED_DEAD',fit:41,flex:'HIGH_FLEX',pay:195,p:{LIVENESS:'CLOSED_EMPLOYER_ATS'}}),
 applied:row({t:'Director, Production Ops',c:'Cobalt Aerostructures',l:'Huntsville, AL',b:'APPLIED',fit:78,flex:'SOFT_FLEX',pay:230,p:{APP_DATE:'2026-10-16',APP_STATUS_EVIDENCE:'Gmail 18f3c2a9d41e · "Thank you for applying – Director, Production Operations" · careers@cobaltaero.example · 16 Oct 09:42',TIM_RULING:'DECLINE'}}),
 appliedTim:row({t:'Sr. Dir., Operations',c:'Bayline Medical Devices',l:'Tampa, FL',b:'APPLIED',fit:72,flex:'HIGH_FLEX',pay:240,p:{APP_DATE:'2026-10-14',APP_STATUS_EVIDENCE:'Tim direct statement via Pipeline Explorer 2026-10-14',TIM_RULING:'APPLIED'}}),
 upper:row({t:'VP Operations',c:'Ridgeline Composites',l:'Charlotte, NC',fit:52,flex:'SOFT_FLEX',pay:215}),
 top:row({t:'Director, Manufacturing Ops',c:'Halvorsen Robotics',l:'Nashville, TN',fit:84,flex:'HIGH_FLEX',pay:235}),
 hold:row({t:'Production Manager',c:'Oakridge Cabinets',l:'Atlanta, GA',fit:60,flex:'STRICT',pay:160}),
 mid:row({t:'Plant Manager',c:'Kestrel Mfg',l:'Greenville, SC',fit:62,flex:'NO_FLEX',pay:185}),
};
const SHOWPOP=['agency','top','mid','hold','upper'];
SHOWPOP.forEach(k=>pop.push(show[k]));
const scored=pop.map(r=>({r,s:S.scoreRow(r,cfg)}));
const elig=scored.filter(x=>!x.s.assessment.flex.blocked&&x.s.overall!=null).map(x=>x.s.overall).sort((a,b)=>a-b);
const N=elig.length;function pct(p){return elig[Math.min(N-1,Math.max(0,Math.ceil(p*N)-1))]}
const cuts={P90:pct(.90),P65:pct(.65),P20:pct(.20),median:pct(.5),top:elig[N-1],bottom:elig[0],N};
function rank(s){return elig.filter(v=>v>s).length+1}
function bandOf(s){return s>=cuts.P90?'TOP':s>=cuts.P65?'UPPER':s>=cuts.P20?'MID':'LOW'}
function detail(r){const s=S.scoreRow(r,cfg);const parts=Object.keys(s.parts).filter(k=>s.parts[k].weight>0).map(k=>({k,w:s.parts[k].weight,score:s.parts[k].score,known:s.parts[k].known,basis:s.parts[k].basis}));
  const known=parts.filter(p=>p.known),sw=known.reduce((a,p)=>a+p.w,0),raw=known.reduce((a,p)=>a+p.w*p.score,0)/sw;
  const factor=.7+.3*s.confidence/100;
  known.forEach(p=>p.pts=p.w*p.score/sw);
  // largest-remainder rounding to 0.1 so shown points sum to shown raw
  const tgt=Math.round(raw*10);let fl=known.map(p=>Math.floor(p.pts*10));let rem=tgt-fl.reduce((a,b)=>a+b,0);
  known.map((p,i)=>[p.pts*10-fl[i],i]).sort((a,b)=>b[0]-a[0]).slice(0,rem).forEach(([_,i])=>fl[i]++);
  known.forEach((p,i)=>p.shown=fl[i]/10);
  return {overall:s.overall,band:s.assessment.flex.blocked?'HOLD':bandOf(s.overall),rank:rank(s.overall),confidence:s.confidence,factor:+factor.toFixed(3),raw:+raw.toFixed(2),rawShown:tgt/10,parts,flexClass:s.assessment.flex.class,flexMod:s.assessment.flex.modifier,gate:s.screenGate}}

const hist={};elig.forEach(v=>hist[v]=(hist[v]||0)+1);
const out={hist,cfg:{rev:24,weights:cfg.weights,salary:cfg.salary},cuts,show:{}};
for(const k in show)out.show[k]=Object.assign({title:show[k].TITLE,company:show[k].COMPANY,location:show[k].LOCATION,bucket:show[k].BUCKET},detail(show[k]));
console.log(JSON.stringify(out,null,1));
