'use strict';
// Card 8176bbb (Tim, Nov 18 2026): salary repairs and active estimate reviews spend Writer slots
// only on rows whose pay or degree is the last gap before the #433 decision gate. A row still missing
// another decision input (fit, work arrangement, ...) is skipped this run and stays queued:
// the repair and review queues are rebuilt from the master every run, so nothing is dropped.
// Uses decision-complete.js's own field check; no second copy of the rules.
const {missingFields}=require('./decision-complete');
// Pay and degree are what these SALARY_/DEGREE_ writes fill, so they never count as blockers.
const PAY=new Set(['pay basis and source']);
function blockers(row,evidence){return missingFields(row,evidence).filter(n=>!PAY.has(n));}
// by_missing counts each skipped row once per run, even when both repair and review skip it.
const seen=new WeakMap();
function skip(stats,key,row,evidence){const b=blockers(row,evidence);if(!b.length)return false;stats[key]=(stats[key]||0)+1;const ids=seen.get(stats)||new Set();seen.set(stats,ids);if(!ids.has(row.PRIMARY_ID)){ids.add(row.PRIMARY_ID);for(const n of b)stats.by_missing[n]=(stats.by_missing[n]||0)+1;}return true;}
module.exports={blockers,skip,PAY};
