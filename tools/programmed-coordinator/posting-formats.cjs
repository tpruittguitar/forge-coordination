'use strict';
const L=require('../enrich-ats-pay/lib.js');
function address(value){if(typeof value==='object')return value;const parts=String(value||'').split(',').map(s=>s.trim()),state=L.stateFrom(value);return{addressLocality:parts[0],addressRegion:state||parts[1]||'',addressCountry:state?'US':undefined};}
function routes(urls){const seen=new Set(),out=[];for(const url of urls){const r=L.atsApi(url);if(r&&!seen.has(r.api)){seen.add(r.api);const u=new URL(r.api),board=u.pathname.match(/^\/v1\/boards\/([^/]+)\/jobs\/(\d+)$/);out.push({...r,...(board?{id:board[2],companyApi:u.origin+'/v1/boards/'+board[1]}:{})});}}return out;}
function annual(range){if(!range||range.currency!=='USD'||!/^(YEAR|ANNUAL|per-year-salary|yearly)$/i.test(range.interval||range.unitText||''))return null;const low=Number(range.min??range.minValue),high=Number(range.max??range.maxValue);return low>=40000&&high>=low&&high<=2000000?{currency:'USD',value:{unitText:'YEAR',minValue:low,maxValue:high}}:null;}
function apiPosting(route,j,company){
 let title,employer,locations,description,salary=null,url,id;
 if(route.kind==='greenhouse'){
  if(String(j.id)!==String(route.id))throw Error('ATS_POSTING_ID_CONFLICT');title=j.title;employer=company?.name;locations=[j.location?.name];description=j.content;url=j.absolute_url;id=j.id;
  const ranges=(j.pay_input_ranges||[]).filter(r=>r.currency_type==='USD');
  // A salary label with an explicit annual period is required. Hourly bands,
  // multiple location bands and compensation totals are not guessed.
  if(ranges.length===1&&/annual|per year|yearly/i.test(ranges[0].title+' '+ranges[0].blurb)&&!/total compensation|equity|hour/i.test(ranges[0].title||''))salary=annual({currency:'USD',interval:'YEAR',min:ranges[0].min_cents/100,max:ranges[0].max_cents/100});
 }else if(route.kind==='lever'){
  const expected=new URL(route.api).pathname.split('/').at(-1);if(j.id!==expected)throw Error('ATS_POSTING_ID_CONFLICT');title=j.text;employer=j.company||company?.name;locations=j.categories?.allLocations||[j.categories?.location];description=[j.description,j.additional,...(j.lists||[]).map(l=>'<h3>'+l.text+'</h3>'+l.content)].filter(Boolean).join('\n');salary=annual(j.salaryRange);url=j.hostedUrl;id=j.id;
 }else if(route.kind==='ashby'){
  const hits=(j.jobs||[]).filter(x=>x.id===route.id);if(hits.length!==1)throw Error('ATS_POSTING_ID_CONFLICT');const x=hits[0];title=x.title;employer=j.name||company?.name;locations=[x.location];description=x.descriptionHtml||x.descriptionPlain;url=x.jobUrl;id=x.id;
  const c=x.compensation?.summaryComponents?.filter(c=>c.currency==='USD'&&/salary/i.test(c.compensationType||''))||[];if(c.length===1)salary=annual({...c[0],min:c[0].minValue,max:c[0].maxValue});
 }else if(route.kind==='workday'){
  const x=j.jobPostingInfo;if(!x)throw Error('INCOMPLETE_ATS_POSTING');title=x.title;employer=x.companyName||j.hiringOrganization?.name;locations=[x.location,...(x.additionalLocations||[])];description=x.jobDescription;url=x.externalUrl||route.page;id=x.jobReqId;
  const expected=route.page.match(/_((?:R-?\d+|JR\d+)(?:-\d+)?)\/?$/i)?.[1];if(expected&&String(id).replace(/-/g,'').toUpperCase()!==expected.replace(/-/g,'').toUpperCase())throw Error('ATS_POSTING_ID_CONFLICT');
 }else throw Error('UNSUPPORTED_ATS_FORMAT');
 if(!title||!employer||!description||!locations.filter(Boolean).length)throw Error('INCOMPLETE_ATS_POSTING_IDENTITY');
 return{'@type':'JobPosting',title,hiringOrganization:{name:employer},jobLocation:locations.filter(Boolean).map(x=>({address:address(x)})),description,baseSalary:salary,url,identifier:{value:id}};
}
function degree(description,text){
 const normalized=String(description).replace(/[’‘]/g,"'");const plain=text(normalized),lines=plain.split(/\n+/).map(s=>s.trim()).filter(Boolean),found=lines.find(s=>/bachelor|master|\bdegree\b|diploma|GED/i.test(s));
 if(!found)return null;const d=L.degreeFromText(found);if(d?.text==='NOT_STATED')return null;
 const equivalent=/\bin lieu of (?:a |the )?degree\b|\bor equivalent (?:work )?experience\b/i.test(found);
 return d?{text:found.length<=800?found:d.text,req:equivalent?'PREFERRED':d.req}:null;
}
module.exports={routes,apiPosting,annual,address,degree};
