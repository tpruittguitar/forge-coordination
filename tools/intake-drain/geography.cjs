'use strict';
// One authorized backlog snapshot, not a standing canonical exclusion rule.
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs');
const FILE='reference/GEOGRAPHY_CLEANUP_AUTHORIZATION.json',ID='TIM-NORTHEAST-BACKLOG-20261106';
const STATES={NY:'New York',PA:'Pennsylvania',CT:'Connecticut',ME:'Maine',MA:'Massachusetts',NH:'New Hampshire',NJ:'New Jersey',RI:'Rhode Island',VT:'Vermont'};
// Recognize out-of-scope states too: any conflicting worksite must be held.
const REGION_NAMES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
const REGION_BY_NAME=Object.fromEntries(Object.entries(REGION_NAMES).map(([code,name])=>[name.toLowerCase(),code]));
const FULL_REGION=new RegExp('\\b('+Object.values(REGION_NAMES).join('|')+')\\b','gi');
function state(location){
 if(typeof location!=='string'||/remote|hybrid|telecommut|multiple|various|nationwide|\bor\b|[;\/|]/i.test(location))return null;
 const clean=location.trim().replace(/,?\s+(?:USA|US|United States)\s*$/i,'').replace(/\s+\d{5}(?:-\d{4})?$/,'');
 const parts=clean.split(',').map(x=>x.trim());if(parts.length!==2||!parts[0]||!/^[\p{L} .'-]+$/u.test(parts[0]))return null;
 return Object.keys(STATES).find(k=>parts[1].toLowerCase()===k.toLowerCase()||parts[1].toLowerCase()===STATES[k].toLowerCase())||null;
}
function binding(root,e,card){
 const auth=S.read(root,FILE,{}),st=state(card?.location);
 if(auth.id!==ID||auth.status!=='ACTIVE'||!st||auth.states?.length!==9||Object.keys(STATES).some(k=>!auth.states.includes(k)))throw Error('ACTIVE_TASK_GEOGRAPHY_AUTHORIZATION_REQUIRED');
 const b=auth.entries?.find(x=>x.key===e.key&&x.sourceVersion===e.sourceVersion&&x.cardSha256===S.hash(card));
 if(!b||e.kind!=='TASK_GEOGRAPHY'||e.ruleId!==ID||e.company!==card.company||e.url!==card.url||e.quote!==card.location||b.state!==st)throw Error('EXACT_AUTHORIZED_GEOGRAPHY_SNAPSHOT_REQUIRED');
 Source.publicUrl(e.url);return{...b,kind:e.kind,ruleId:ID,url:e.url,company:card.company,title:card.title,location:card.location,authorizationSha256:S.hash(auth)};
}
function inspect(raw,card,now){
 const visible=Source.text(raw);
 if(/remote|hybrid|telecommut|multiple locations|various locations|work from home/i.test(visible))throw Error('REMOTE_OR_MULTILOCATION_REQUIRES_REVIEW');
 const matches=Source.postings(raw).filter(j=>Source.norm(j.title)===Source.norm(card.title)&&Source.employer(j.hiringOrganization?.name)===Source.employer(card.company));
 if(matches.length!==1)throw Error('EXACT_SINGLE_GEOGRAPHY_POSTING_REQUIRED');
 const j=matches[0];
 const prose=visible+' '+Source.text(j.description);
 const regions=[...prose.matchAll(/,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/g)].map(m=>m[1]);
 regions.push(...[...prose.matchAll(FULL_REGION)].map(m=>REGION_BY_NAME[m[1].toLowerCase()]));
 if(regions.length>1||regions.some(st=>st!==state(card.location))||/\b(?:locations|offices|sites|choose|choice|flexible location|location options)\b/i.test(prose)||/(?:based|worksite|located|locations?|offices?|sites?)[^.!?\n]{0,120}\bor\b/i.test(prose))throw Error('REMOTE_OR_MULTILOCATION_REQUIRES_REVIEW');
 for(const url of [j.url,j['@id']].filter(Boolean)){
  if(typeof url!=='string'||!/^https:\/\//.test(url)||require('../pipeline-observability/upstream-flow').key(url)!==require('../pipeline-observability/upstream-flow').key(card.url))throw Error('CONFLICTING_STRUCTURED_JOB_URL');
 }
 if(Source.text(j.description).length<30)throw Error('INCOMPLETE_GEOGRAPHY_POSTING');
 const locations=[].concat(j.jobLocation||[]),a=locations[0]?.address||{},country=typeof a.addressCountry==='string'?a.addressCountry:a.addressCountry?.name;
 // Remote flexibility anywhere in this posting is a hold, even if one office is in scope.
 if(j.jobLocationType||j.applicantLocationRequirements||/remote|hybrid|telecommut|multiple locations|various locations|work from home/i.test(JSON.stringify(j)))throw Error('REMOTE_OR_MULTILOCATION_REQUIRES_REVIEW');
 if(locations.length!==1||! /^(US|USA|United States)$/i.test(country||''))throw Error('SINGLE_US_WORKSITE_REQUIRED');
 const location=[a.addressLocality,a.addressRegion].filter(Boolean).join(', ');
 if(!state(location)||state(location)!==state(card.location)||Source.location(location)!==Source.location(card.location))throw Error('EXACT_GEOGRAPHY_LOCATION_REQUIRED');
 if(j.validThrough&&(!Number.isFinite(Date.parse(j.validThrough))||Date.parse(j.validThrough)<now))throw Error('POSTING_EXPIRED');
 return location;
}
function entryHash(e){return S.hash({company:e.company,title:e.title,location:e.location,sourceUrl:e.sourceUrl,evidenceStatus:e.evidenceStatus,proof:e.proof,screenRuleId:e.screenRuleId,sourceSha256:e.discoveryReview?.sourceSha256,sources:e.sources});}
function identity(root,item){const ledger=S.read(root,'state/UPSTREAM_LEDGER.json',{entries:{}}),keys=[...new Set([item.key,...item.aliases||[]])].sort(),entries={};for(const key of keys){if(!ledger.entries[key])throw Error('CURRENT_GEOGRAPHY_SOURCE_ENTRY_REQUIRED');entries[key]=entryHash(ledger.entries[key]);}return{cardSha256:S.hash(item.card),entries};}
module.exports={entryHash,identity,FILE,ID,STATES,state,binding,inspect};
