'use strict';
function newest(current,incoming){if(incoming.schema!=='forge.employer-pay-sources.v1'||!Number.isFinite(Date.parse(incoming.asOf))||!Array.isArray(incoming.companies))throw Error('Invalid generated source profile');return !current||Date.parse(incoming.asOf)>Date.parse(current.asOf)?incoming:current;}
module.exports={newest};
if(require.main===module){const fs=require('fs'),path=require('path'),target=path.resolve(__dirname,'../../reference/EMPLOYER_PAY_SOURCES.json'),incoming=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),current=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):null,out=newest(current,incoming);if(out!==current)fs.writeFileSync(target,JSON.stringify(out,null,2)+'\n');}
