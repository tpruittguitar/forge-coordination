'use strict';
const L=require('../enrich-ats-pay/lib.js');
const Pay=require('../enrich-ats-pay/pay-values.js');
function address(value){if(typeof value==='object')return value;const parts=String(value||'').split(',').map(s=>s.trim()),state=L.stateFrom(value);return{addressLocality:parts[0],addressRegion:state||parts[1]||'',addressCountry:state?'US':undefined};}
function routes(urls){const seen=new Set(),out=[];for(const url of urls){const r=L.atsApi(url);if(r&&!seen.has(r.api)){seen.add(r.api);const u=new URL(r.api),board=u.pathname.match(/^\/v1\/boards\/([^/]+)\/jobs\/(\d+)$/);out.push({...r,...(board?{id:board[2],companyApi:u.origin+'/v1/boards/'+board[1]}:{})});}}return out;}
function annual(range){const pay=Pay.structured(range);return pay?{currency:'USD',value:{unitText:'YEAR',minValue:pay.low,maxValue:pay.high}}:null;}
function apiPosting(route,j,company){
 let title,employer,locations,description,salary=null,url,id;
 if(route.kind==='greenhouse'){
  if(String(j.id)!==String(route.id))throw Error('ATS_POSTING_ID_CONFLICT');title=j.title;employer=company?.name;locations=[j.location?.name];description=j.content;url=j.absolute_url;id=j.id;
 }else if(route.kind==='lever'){
  const expected=new URL(route.api).pathname.split('/').at(-1);if(j.id!==expected)throw Error('ATS_POSTING_ID_CONFLICT');title=j.text;employer=j.company||company?.name;locations=j.categories?.allLocations||[j.categories?.location];description=[j.description,j.additional,...(j.lists||[]).map(l=>'<h3>'+l.text+'</h3>'+l.content)].filter(Boolean).join('\n');salary=annual(j.salaryRange);url=j.hostedUrl;id=j.id;
 }else if(route.kind==='ashby'){
  const hits=(j.jobs||[]).filter(x=>x.id===route.id);if(hits.length!==1)throw Error('ATS_POSTING_ID_CONFLICT');const x=hits[0];title=x.title;employer=j.name||company?.name;locations=[x.location];description=x.descriptionHtml||x.descriptionPlain;url=x.jobUrl;id=x.id;
 }else if(route.kind==='workday'){
  const x=j.jobPostingInfo;if(!x)throw Error('INCOMPLETE_ATS_POSTING');title=x.title;employer=x.companyName||j.hiringOrganization?.name||company?.name;locations=[x.location,...(x.additionalLocations||[])];description=x.jobDescription;url=x.externalUrl||route.page;id=x.jobReqId;
  const expected=route.page.match(/_((?:R-?\d+|JR\d+)(?:-\d+)?)\/?$/i)?.[1];if(expected&&String(id).replace(/-/g,'').toUpperCase()!==expected.replace(/-/g,'').toUpperCase())throw Error('ATS_POSTING_ID_CONFLICT');
 }else throw Error('UNSUPPORTED_ATS_FORMAT');
 if(!title||!employer||!description||!locations.filter(Boolean).length)throw Error('INCOMPLETE_ATS_POSTING_IDENTITY');
 const parsed=L.parseAts(route.kind,j,route.id);salary=parsed?.payFacts?annual({currency:'USD',interval:'YEAR',min:parsed.payFacts.low,max:parsed.payFacts.high}):null;
 return{'@type':'JobPosting',title,hiringOrganization:{name:employer},jobLocation:locations.filter(Boolean).map(x=>({address:address(x)})),description,baseSalary:salary,url,identifier:{value:id}};
}
function degree(description,text){
 const d=require('../enrich-ats-pay/qualification').parse(description);return d?.text==='NOT_STATED'?null:d;
}
module.exports={routes,apiPosting,annual,address,degree};
