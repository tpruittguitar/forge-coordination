'use strict';
const {degree}=require('../programmed-coordinator/posting-formats.cjs');
// Narrow zero-cost fast path using Forge's current parser. Never infer absence
// or equate equivalency to preference. Other saved evidence belongs to the host's
// existing Source.verify/capturedSource path, before considering an API request.
function reuseDegree(current) {
  if(!current.missingGroups.includes('DEGREE')) return null;
  const text=current.evidence.text;
  if(/equivalent|in lieu of|or comparable/i.test(text)) return null;
  const parsed=degree(text);
  if(!parsed||!['REQUIRED','PREFERRED'].includes(parsed.req)||!text.includes(parsed.text)) return null;
  return {fields:{DEGREE_TEXT:parsed.text,DEGREE_REQ:parsed.req},quotes:{DEGREE:parsed.text},
    degree:{requirement:parsed.req,equivalence:'UNKNOWN',confidence:'HIGH',quote:parsed.text}};
}
module.exports={reuseDegree};
