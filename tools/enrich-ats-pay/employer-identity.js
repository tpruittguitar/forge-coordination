'use strict';
// Attribution is distinct from admission. Never guess an agency's unnamed client.
const BOARDS=/^(biospace|vetjobs|lensa|jobot|jobs via dice|dice|talentify|talentify io|confidential|confidential company)$/i;
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function resolve(row){
 const p=row.p||row.payload||{},explicit=String(p.CLIENT_EMPLOYER||p.ACTUAL_EMPLOYER||'').trim();
 if(explicit&&!/^(unknown|confidential|not stated|n\/a)$/i.test(explicit))return{...row,COMPANY:explicit,advertiser:row.COMPANY};
 if(BOARDS.test(norm(row.COMPANY))||/^RECRUITING_AGENCY$/i.test(p.EMPLOYER_PRIMARY_BUSINESS||'')||/CLIENT=UNKNOWN|AGENCY_POSTING/.test(p.SCOUT_NOTES||''))return{...row,COMPANY:'',advertiser:row.COMPANY,employerUnknown:true};
 return row;
}
module.exports={resolve};
