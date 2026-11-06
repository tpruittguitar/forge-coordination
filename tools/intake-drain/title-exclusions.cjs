'use strict';
// Only unambiguous primary functions under active NC-005/006. Not a general
// keyword blacklist; mixed/technical/client-serving titles require research.
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs');
const FILE='reference/EXCLUSION_TITLE_RULES.json';
const sha=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
function matches(root,card){
 const title=String(card?.title||'').trim();
 if(!title||!card?.company||!card?.url)return[];
 if(/\b(?:recruit\w*|placement|talent|sales|marketing|software|engineer|architect|developer|systems?|IT|technology|implementation|project|consulting|consultant|production controller|quality audit|financial systems?|finance systems?|finance transformation)\b/i.test(title))return[];
 if(/\b(?:finance|accounting)\s*(?:and|&)\s*(?:operations|manufacturing|production|facilities)\b/i.test(title))return[];
 const cfg=S.read(root,FILE,{rules:[]});
 if(cfg.schema!=='forge.title-exclusion-rules.v1')return[];
 return cfg.rules.filter(b=>['NC-005','NC-006'].includes(b.ruleId)&&Array.isArray(b.patterns)&&b.patterns.some(p=>new RegExp(p,'i').test(title))).filter(b=>b.ruleId!=='NC-006'||! /\b(?:plant|manufacturing|factory|industrial|production|maintenance|capital projects)\b/i.test(title));
}
function proposal(root,card){const list=matches(root,card);if(list.length!==1)return null;const b=list[0];return{kind:'TITLE_RULE',ruleId:b.ruleId,company:card.company,title:card.title,url:card.url,quote:card.title};}
function binding(root,rules,e,card){
 if(rules?.status!=='ACTIVE'||!rules.raw)throw Error('CURRENT_CANONICAL_RULES_REQUIRED');
 const list=matches(root,card),b=list.length===1?list[0]:null;
 if(!b||e.kind!=='TITLE_RULE'||e.ruleId!==b.ruleId||e.company!==card.company||e.title!==card.title||e.quote!==card.title||e.url!==card.url)throw Error('EXACT_UNAMBIGUOUS_TITLE_RULE_REQUIRED');
 const defs=rules.raw.split(/\r?\n/).filter(l=>l.startsWith('- '+b.ruleId+' '));
 if(defs.length!==1||sha(defs[0])!==b.definitionSha256||!defs[0].startsWith('- '+b.ruleId+' '+b.category+':'))throw Error('ACTIVE_MATCHING_ROLE_RULE_REQUIRED');
 Source.publicUrl(card.url);
 return{...b,...e};
}
module.exports={matches,proposal,binding};
