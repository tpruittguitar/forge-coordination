'use strict';
// Qualification facts retain the governing section and adjacent alternatives.
// Generic uses of "degree" are not academic credentials.
const credential=/\b(?:bachelor'?s?|master'?s?|b\.?\s*[sa]\.?|m\.?\s*s\.?|mba|ph\.?\s?d\.?|associate'?s?\s+degree|(?:advanced|graduate|undergraduate|college|university|four[- ]year|4[- ]year)\s+degree|diploma|ged)\b|\bdegree\s+in\s+[a-z]/i;
const equivalent=/\b(?:or equivalent(?:\s+[a-z-]+){0,4}\s+experience|equivalent (?:work |related )?experience|in lieu of (?:a |the )?(?:bachelor'?s? )?degree|(?:experience|education and experience) (?:may|can|will) (?:be )?(?:substitut\w*|considered)|or equivalent combination of education and experience)\b/i;
function plain(input){return String(input||'').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/?(?:h[1-6]|p|div|li|ul|ol|br)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&#39;|&rsquo;|&#x27;|[’‘]/gi,"'").replace(/&amp;/gi,'&').replace(/[ \t\r]+/g,' ');}
function parse(input){
 const text=plain(input);if(!text.trim())return null;
 const lines=text.split(/\n+|\s*[•·▪●]\s*|(?<!\b[A-Za-z]\.[A-Za-z])(?<!\b[A-Z])(?<=[.!?])\s+(?=[A-Z0-9(])/).map(x=>x.trim()).filter(Boolean);
 let section=null;const facts=[];let optionalWithoutPreference=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],heading=line.replace(/^[#*\s]+|[*\s]+$/g,'');
  if(/^(?:preferred|desired|nice to have)(?:\s+(?:qualifications?|requirements?|education|skills|experience))?\s*:?(?:\s*$)/i.test(heading)){section='PREFERRED';continue;}
  if(/^(?:required|minimum|basic|essential)(?:\s+(?:qualifications?|requirements?|education|skills|experience))?\s*:?(?:\s*$)/i.test(heading)){section='REQUIRED';continue;}
  if(/^(?:responsibilities|benefits|about us|what we offer|equal opportunity)\s*:?$/i.test(heading)){section='NON_QUALIFICATION';continue;}
  if(section==='NON_QUALIFICATION')continue;
  if(!credential.test(line)||/\b(?:without|regardless of|no college|no university)\s+(?:a |an? )?(?:college |university )?degree\b/i.test(line))continue;
  let quote=line,following=lines[i+1]||'';
  if(/^(?:or equivalent|in lieu of|equivalent (?:work |related )?experience|experience may substitute)/i.test(following))quote+=' '+following;
  // Separate credential clauses, not unrelated modifiers in a single clause.
  // A mandatory master's must survive a preceding preferred bachelor's.
  const scoped=quote.replace(/\([^)]*(?:advanced|graduate|master|mba|ph\.?d)[^)]*\b(?:preferred|desired|a plus)[^)]*\)/gi,'').replace(/\(\s*(?:strongly )?preferred\s*\)(?=\s+or\s+(?:a |an? )?(?:closely )?related)/gi,'');
  const clauses=scoped.split(/;|,\s*(?=with\s+technical\s+education)|,\s*(?=(?:an?\s+)?(?:bachelor|master|mba|m\.\s?s|ms|ph\.?\s?d|advanced|graduate))|\s+(?:and|but)\s+(?=(?:an?\s+)?(?:bachelor|master|mba|advanced|graduate))/i).filter(c=>credential.test(c));
  const requirements=[];
  for(const base of clauses){
   const negated=/\b(?:not (?:strictly )?(?:required|necessary|mandatory)|optional|(?:do not|don't|does not|doesn't) require|no requirement for)\b/i.test(base)||/^\s*no\s+(?:bachelor'?s?\s+)?(?:college\s+)?degree\b[^.]{0,40}\brequired\b/i.test(base);
   const required=!negated&&/\brequired|must (?:have|hold)|mandatory\b/i.test(base),preferred=/\bpreferred|a plus|nice to have|desired\b/i.test(base)||/^(?:preferred|desired) qualifications?\s*:/i.test(line);
   if(required&&preferred&&base.search(/\b(?:preferred|desired)|a plus|nice to have\b/i)<base.search(/\brequired|must (?:have|hold)|mandatory\b/i))return null;
   if(negated&&!preferred&&section!=='PREFERRED'&&!equivalent.test(base)){optionalWithoutPreference=true;continue;}
   requirements.push(equivalent.test(base)||/\bexperience may substitute\b/i.test(base)?'PREFERRED':required?'REQUIRED':preferred||section==='PREFERRED'?'PREFERRED':'REQUIRED');
  }
  if(!requirements.length)continue;
  const req=requirements.includes('REQUIRED')?'REQUIRED':'PREFERRED';
  let evidence=quote;
  if(evidence.length>500){const at=evidence.search(credential),start=Math.max(0,at-80);evidence=(start?'…':'')+evidence.slice(start,start+498)+(start+498<evidence.length?'…':'');}
  facts.push({text:evidence,req});
 }
 if(facts.length)return facts.find(f=>f.req==='REQUIRED')||facts[0];
 return optionalWithoutPreference||/\bdegree\b/i.test(text)?null:{text:'NOT_STATED',req:'NOT_STATED'};
}
module.exports={parse,plain};
