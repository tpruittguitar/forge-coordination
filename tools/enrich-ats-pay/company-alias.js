'use strict';
// Company alias normalizer (pay v6 fix A, item 2). Table-driven: add a row, not a regex branch.
// A name is cleaned (legal suffixes, parenthetical country tags and generic corporate words removed),
// then matched against each row's names. Only a whole cleaned name matches, so titles and locations
// passing through the same normalizer are never rewritten.
const ALIASES=[
 {key:'schindler',names:['schindler','schindler elevator','schindler elevator company','schindler elevator corp','schindler group','schindler holding']},
 {key:'usta',names:['usta','united states tennis association','usta national campus','usta player development']},
];
const GENERIC=/\b(incorporated|inc|llc|l l c|ltd|limited|corp|corporation|company|co|the|plc|holdings?|group|usa|u s a|us|u s|na|n a|north america|americas)\b/g;
function clean(s){
 return String(s||'').toLowerCase().replace(/\(.*?\)/g,' ').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(GENERIC,' ').replace(/\s+/g,' ').trim();
}
const INDEX=new Map();
for(const row of ALIASES)for(const n of [row.key,...row.names]){const k=clean(n);if(k)INDEX.set(k,row.key);}
/** Canonical company key for a known alias, else null. */
function canonical(name){const k=clean(name);return k&&INDEX.get(k)||null;}
module.exports={ALIASES,clean,canonical};
