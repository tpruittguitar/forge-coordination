'use strict';
// Preserve concurrent curated company/site facts and append learned role facts by source date.
const fs=require('fs'),cp=require('child_process'),C=require('./context');
const [incoming,output='reference/COMPANY_SITE_CONTEXT.json']=process.argv.slice(2);
const current=JSON.parse(cp.execFileSync('git',['show','HEAD:reference/COMPANY_SITE_CONTEXT.json'],{encoding:'utf8',maxBuffer:20000000}));
fs.writeFileSync(output,JSON.stringify(C.merge(current,JSON.parse(fs.readFileSync(incoming,'utf8'))),null,2)+'\n');
