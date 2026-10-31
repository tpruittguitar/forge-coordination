'use strict';
const {execFileSync}=require('node:child_process');
const files=['state/source-trial-report.json','state/board-discovery-report.json'];
function summarize(reports,now){
 const urls=new Set(),seen=new Set();let passes=0;
 for(const r of reports){const at=Date.parse(r?.summary?.at);if(!Number.isFinite(at)||at<now-36*3600000||at>now||!Array.isArray(r.new_roles))continue;const key=r.summary.at+JSON.stringify(r.new_roles);if(seen.has(key))continue;seen.add(key);passes++;
 for(const job of r.new_roles){try{const u=new URL(job.url);if(u.protocol!=='https:')continue;u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^trk$|^trackingId$/.test(k))u.searchParams.delete(k);urls.add(u.href);}catch{}}
 }
 return {count:urls.size,perHour:urls.size/36,passes,scope:'Automatic source and employer board reports; email candidate history not included'};
}
function build(root,now){
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
 if(git(['rev-parse','--is-shallow-repository']).trim()==='true')throw Error('Discovery rate requires complete report history');
 const revisions=git(['log','--since='+new Date(now-48*3600000).toISOString(),'--format=%H','--',...files]).trim().split(/\s+/).filter(Boolean);
 if(revisions.length>300)throw Error('Discovery history budget exceeded');
 const reports=[];for(const sha of revisions)for(const file of files){try{reports.push(JSON.parse(git(['show',sha+':'+file])));}catch(e){if(!String(e.stderr||'').includes('does not exist'))throw e;}}
 return summarize(reports,now);
}
module.exports={build,summarize};
