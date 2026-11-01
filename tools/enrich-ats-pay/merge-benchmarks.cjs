'use strict';
const fs=require('fs'),cp=require('child_process'),B=require('./employer-benchmarks');
const [incoming,output='reference/EMPLOYER_PAY_BENCHMARKS.json']=process.argv.slice(2);
const current=JSON.parse(cp.execFileSync('git',['show','HEAD:reference/EMPLOYER_PAY_BENCHMARKS.json'],{encoding:'utf8',maxBuffer:20000000}));
fs.writeFileSync(output,JSON.stringify(B.merge(current,JSON.parse(fs.readFileSync(incoming,'utf8'))),null,2)+'\n');
