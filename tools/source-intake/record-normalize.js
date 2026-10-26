'use strict';
/* Record normalization shared by every intake path (Claude 2026-10-26, Tim: yes).
 * Master rows are " | "-delimited, and the Writer's identity compare keeps only the text before " | " as the employer
 * (2026-10-23: "CEIS | Critical Energy Infrastructure Services" was compared as "ceis" and its insert went to
 * INSERT_IDENTITY_MISMATCH). So the employer sent to the Writer is the first segment that is not a generic board label.
 * The full original name is returned separately so callers can keep it as evidence. */
const GENERIC=/^(?:careers?|jobs?|hiring|job openings?|we(?:'| a)re hiring|join us|work with us|linkedin|indeed)$/i;

function normalizeCompany(name){
 const raw=String(name||'').replace(/\s+/g,' ').trim();
 if(!/[|｜]/.test(raw))return {company:raw,original:raw,changed:false};
 const parts=raw.split(/\s*[|｜]\s*/).map(s=>s.trim()).filter(Boolean);
 const pick=parts.find(p=>!GENERIC.test(p))||parts[0]||raw;
 return {company:pick,original:raw,changed:pick!==raw};
}
module.exports={normalizeCompany};
