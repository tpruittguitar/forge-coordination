'use strict';
const Identity=require('../source-trial/job-identity');
const {publicUrl}=require('./public-posting');

function identityKey(row){
 if(row.IDENTITY_EVIDENCE_CONFLICT||row.p?.IDENTITY_EVIDENCE_CONFLICT)return null;
 const key=Identity.identityKey(row.company||row.COMPANY,row.title||row.TITLE,row.location||row.LOCATION);
 return key.split('|').every(Boolean)?key:null;
}
function aggregator(url){
 try{return /(?:^|\.)(?:linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+|hiring\.cafe|hiringcafe\.com|buildsubmarines\.com|ziprecruiter\.com|lensa\.com|theladders\.com|simplyhired\.com|talent\.com|jooble\.org|jobright\.ai)$/.test(new URL(url).hostname);}catch{return false;}
}
function employerUrl(url){
 return !!publicUrl(url)&&!aggregator(url)&&!/(?:^|\.)(?:recruitics\.com|sendgrid\.net|t\.ladders\.com)$|^email\./i.test(new URL(url).hostname);
}
function recoveryUrls(next){
 return [...new Set((String(next||'').match(/https:\/\/[^\s;|"<>)\]]+/g)||[]).map(s=>s.replace(/[,.]+$/,'')).filter(employerUrl))];
}
module.exports={identityKey,aggregator,employerUrl,recoveryUrls};
