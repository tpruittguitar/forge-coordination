'use strict';
const fs=require('node:fs'),path=require('node:path');
const nonempty=s=>typeof s==='string'&&!!s.trim(),sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function valid(p){
 return !!p&&p.schema==='forge.resume-match-profile.v1'&&sha(p.source?.textSha256)&&nonempty(p.source.fileId)&&nonempty(p.source.modifiedAt)&&Number.isFinite(Date.parse(p.source.modifiedAt))&&Array.isArray(p.competencies)&&p.competencies.length>0&&p.competencies.every(c=>c&&nonempty(c.id)&&Array.isArray(c.terms)&&c.terms.length>0&&c.terms.every(nonempty)&&sha(c.resumeEvidenceSha256))&&new Set(p.competencies.map(c=>c.id)).size===p.competencies.length;
}
const defaultProfile=path.resolve(__dirname,'../../control/RESUME_MATCH_PROFILE.json');
function load(file=defaultProfile){
 const p=JSON.parse(fs.readFileSync(file));if(!valid(p))throw Error('GROUNDED_RESUME_PROFILE_REQUIRED');
 // Vocabulary is separate from private resume provenance. Custom caller profiles
 // are never silently extended with aliases grounded in this selected profile.
 if(path.resolve(file)!==defaultProfile)return p;
 const v=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../control/RESUME_MATCH_VARIANTS.json')));
 if(!v||v.schema!=='forge.resume-term-variants.v1'||!Array.isArray(v.competencies)||v.competencies.some(c=>!c||typeof c.id!=='string')||new Set(v.competencies.map(c=>c.id)).size!==v.competencies.length)throw Error('INVALID_RESUME_TERM_VARIANTS');
 for(const c of v.competencies){
  const target=p.competencies.find(x=>x.id===c.id);
  if(!target||!Array.isArray(c.add)||!Array.isArray(c.remove)||![...c.add,...c.remove].every(nonempty)||c.remove.some(t=>!target.terms.includes(t)))throw Error('INVALID_RESUME_TERM_VARIANTS');
  target.terms=[...new Set([...target.terms.filter(t=>!c.remove.includes(t)),...c.add])];
 }
 if(!valid(p))throw Error('GROUNDED_RESUME_PROFILE_REQUIRED');return p;
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const termPattern=term=>escape(term).replace(/[ \t-]+/g,'[\\s\\u2010-\\u2015-]{1,20}');
function observed(text,term){
 const re=new RegExp('(?:^|[^a-z0-9])('+termPattern(term)+')(?=$|[^a-z0-9])','ig');
 return [...text.matchAll(re)].map(m=>({term:m[1],at:m.index+m[0].length-m[1].length}));
}
function match({title='',description=''},profile=load()){
 if(!valid(profile))throw Error('GROUNDED_RESUME_PROFILE_REQUIRED');
 title=String(title||'').trim();description=String(description||'').trim();
 const content=[title,description].join('\n'),matches=[];
 for(const c of profile.competencies){
  const found=new Map();
  for(const hit of c.terms.flatMap(term=>observed(content,term)).sort((a,b)=>a.at-b.at)){const key=hit.term.toLowerCase();if(!found.has(key))found.set(key,hit);}
  const hits=[...found.values()],terms=hits.map(x=>x.term);if(!terms.length)continue;
  const quotes=hits.slice(0,2).map(({term,at})=>{const start=Math.max(content.lastIndexOf('\n',at)+1,at-150);return content.slice(start,Math.max(at+term.length,start+600)).trim().slice(0,600);});
  matches.push({competencyId:c.id,postingTerms:terms,postingQuotes:quotes,resumeEvidenceSha256:c.resumeEvidenceSha256});
 }
 return{schema:'forge.resume-overlap.v1',matcherVersion:'explicit-variants-v2',resumeFileId:profile.source.fileId,resumeVersion:profile.source.modifiedAt,resumeTextSha256:profile.source.textSha256,method:'OBSERVED_TERM_OVERLAP_WITH_RESUME_SUPPORTED_COMPETENCIES',contentBasis:description?'TITLE_AND_ROLE_CONTENT':'TITLE_ONLY',matches,unresolved:description?[]:['ROLE_CONTENT_NOT_REVIEWED'],finalFit:false,automaticRejection:false};
}
module.exports={load,match,valid};
