'use strict';
// Test-only: the source-trial stub plus Workday job-search hosts. TRIAL_WD_STATUS maps host -> HTTP status (default 200).
require('./mock-fetch');
const base=globalThis.fetch,status=JSON.parse(process.env.TRIAL_WD_STATUS||'{}');
globalThis.fetch=async(url,opts)=>{
 const m=String(url).match(/^https:\/\/([^/]+\.myworkdayjobs\.com)\/wday\/cxs\//);
 if(!m)return base(url,opts);
 if(process.env.TRIAL_FETCH_LOG)require('fs').appendFileSync(process.env.TRIAL_FETCH_LOG,String(url)+'\n');
 const s=status[m[1]]||200,b={jobPostings:[]};
 return {ok:s===200,status:s,headers:{get:()=>null},json:async()=>b,text:async()=>JSON.stringify(b)};
};
