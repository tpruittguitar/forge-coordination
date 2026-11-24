'use strict';
/* Shared Writer health gate for the relevance-screen coordinator.
 * Same rule as tools/source-intake/writer-reader.js after forge-coordination #539:
 * block when freeze is missing or non-null, or errors is not an empty array.
 * Level, including warn, does not block. */
function assertLiveWriterGate(data, request){
 const status=data&&typeof data==='object'?data:{};
 if(!Object.hasOwn(status,'freeze')||status.freeze!=null||!Array.isArray(status.errors)||status.errors.length||request){
  throw Error('Live Writer gate or existing request freeze='+JSON.stringify(status.freeze)+' level='+String(status.level||'')+' errors='+(Array.isArray(status.errors)?status.errors.length:'not-array'));
 }
}
module.exports={assertLiveWriterGate};
