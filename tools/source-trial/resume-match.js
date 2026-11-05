'use strict';
const fs=require('node:fs'),path=require('node:path');
function load(file=path.resolve(__dirname,'../../control/RESUME_MATCH_PROFILE.json')){
 const p=JSON.parse(fs.readFileSync(file));if(p.schema!=='forge.resume-match-profile.v1'||!/^[a-f0-9]{64}$/.test(p.source?.textSha256||'')||!p.source.fileId||!Array.isArray(p.competencies)||!p.competencies.length||p.competencies.some(c=>!c.id||!Array.isArray(c.terms)||!c.terms.length||!/^[a-f0-9]{64}$/.test(c.resumeEvidenceSha256||'')))throw Error('GROUNDED_RESUME_PROFILE_REQUIRED');return p;
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function match({title='',description=''},profile=load()){
 const content=[title,description].join('\n'),matches=[];
 for(const c of profile.competencies){const terms=c.terms.filter(term=>new RegExp('(?:^|[^a-z0-9])'+escape(term)+'(?=$|[^a-z0-9])','i').test(content));if(!terms.length)continue;
  const quotes=content.split(/\n|(?<=[.!?])\s+/).filter(q=>terms.some(term=>new RegExp('(?:^|[^a-z0-9])'+escape(term)+'(?=$|[^a-z0-9])','i').test(q))).slice(0,2).map(q=>q.trim().slice(0,600));
  matches.push({competencyId:c.id,postingTerms:terms,postingQuotes:quotes,resumeEvidenceSha256:c.resumeEvidenceSha256});
 }
 return{schema:'forge.resume-overlap.v1',resumeFileId:profile.source.fileId,resumeVersion:profile.source.modifiedAt,resumeTextSha256:profile.source.textSha256,method:'OBSERVED_TERM_OVERLAP_WITH_RESUME_SUPPORTED_COMPETENCIES',contentBasis:description?'TITLE_AND_ROLE_CONTENT':'TITLE_ONLY',matches,unresolved:description?[]:['ROLE_CONTENT_NOT_REVIEWED'],finalFit:false,automaticRejection:false};
}
module.exports={load,match};
