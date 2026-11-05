'use strict';
// Lightweight discovery evidence, not enrichment or a final eligibility decision.
const crypto=require('node:crypto'),T=require('./lib'),Source=require('../programmed-coordinator/source.cjs');
const TERMS=/\b(?:manufactur\w*|production|plant|factory|assembl\w*|quality|industrializ\w*|process engineering|automation|continuous improvement|operational excellence|launch|commissioning|supply chain)\b/ig;
const LEADERSHIP=/\b(?:lead\w*|manag\w*|direct\w*|responsib\w*|oversee\w*|accountab\w*)\b/ig;
const Preliminary=require('./preliminary-screen');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function hits(text,pattern){return [...new Set((text.match(pattern)||[]).map(s=>s.toLowerCase()))];}
function review(card,{description='',observedAt=new Date().toISOString(),detailStatus='NOT_RETURNED_BY_SOURCE',sourceUrl=card.url,screenContext}={}){
 const text=Source.text(description),family=card.family||T.family(card.title),level=card.level||T.level(card.title),place=card.place||T.usPlace(card.location),titleHits=hits(card.title||'',TERMS),scopeHits=hits(text,TERMS),leadershipHits=hits(text,LEADERSHIP);
 const evidence=[];for(const line of text.split(/\n|(?<=[.!?])\s+/)){if(TERMS.test(line)||LEADERSHIP.test(line)){evidence.push(line.trim().slice(0,600));if(evidence.length===5)break;}TERMS.lastIndex=0;LEADERSHIP.lastIndex=0;}
 const unknowns=[];if(!text)unknowns.push('ROLE_CONTENT');if(!scopeHits.length)unknowns.push('ACTUAL_FUNCTION');if(!leadershipHits.length)unknowns.push('RESPONSIBILITY_SCOPE');
 const preliminaryScreen=Preliminary.screen({...card,description:text},screenContext),resumeMatch=preliminaryScreen.ats;
 const reason=`Title selected as ${family||'UNCLASSIFIED'} / ${level||'UNKNOWN_LEVEL'}; location ${place||'UNKNOWN'}. `+(text?`Source content hits: ${scopeHits.join(', ')||'none'}; responsibility hits: ${leadershipHits.join(', ')||'none'}.`:'Role content unavailable; retain for intake review.')+' Resume-supported hits: '+(resumeMatch.matches.map(m=>m.competencyId).join(', ')||'none observed; retain unknown')+'.';
 return{...card,selectionReason:reason,discoveryReview:{schema:'forge.discovery-review.v1',observedAt,sourceUrl,source:card.source,decision:preliminaryScreen.decision,preliminaryScreen,basis:'PROVISIONAL_TITLE_FAMILY_LEVEL_AND_LOCATION',resumeMatch,checks:{family,level,place},titleHits,scopeHits,leadershipHits,detailStatus:text?'SOURCE_CONTENT_REVIEWED':detailStatus,sourceSha256:text?hash(text):null,evidenceQuotes:evidence,unknowns,canonicalEligibility:false},...(text?{description:text}:{} )};
}
async function reviewAll(cards,{now=()=>Date.now(),deadline=Infinity,detail=async()=>null,screenContext}={}){
 for(let n=0;n<cards.length;n++){
  const card=cards[n];let description=card.description||'',status='NOT_RETURNED_BY_SOURCE';
  if(!description&&card.detailUrl){if(now()>=deadline)status='DEFERRED_RUNTIME_BOUNDARY';else try{const d=await detail(card.detailUrl);description=d?.jobPostingInfo?.jobDescription||'';status=description?'SOURCE_CONTENT_REVIEWED':'DETAIL_CONTENT_UNAVAILABLE';}catch{status='DETAIL_ACCESS_FAILED';}}
  cards[n]=review(card,{description,observedAt:new Date(now()).toISOString(),detailStatus:status,screenContext});delete cards[n].detailUrl;
 }
 return cards;
}
module.exports={review,reviewAll};
