const {test}=require('node:test'),a=require('node:assert/strict'),S=require('./screen.cjs');const card=title=>({company:'Example',title,location:'Austin, TX',url:'https://example.com/jobs/123'});
test('only approved sourced off-function titles close; manufacturing and hardware contexts stay eligible',()=>{for(const t of ['Claims Operations Director','Director of Clinical Quality','Restaurant General Manager'])a.equal(S.evaluate(card(t)).outcome,'FUNCTION_MISMATCH');for(const t of ['Software Engineering Director, Manufacturing','Plant Manager, Food Production','Quality Manager','Senior Manager, Engineering'])a.equal(S.evaluate(card(t)).outcome,'ADMIT');a.equal(S.evaluate({title:'Claims Director'}).outcome,'HOLD_SOURCE_IDENTITY');});
test('missing or placeholder company or location is excluded; missing title or a non-https URL stays held',()=>{
 const base={company:'Howmet',title:'VP of Operations',location:'Morristown, TN',url:'https://example.com/jobs/1'};
 for(const patch of [{company:''},{company:'CONFIDENTIAL'},{company:'NOT_STATED'},{location:''},{location:'UNKNOWN'},{location:'-'},{location:'N/A'},{location:'TBD'}])a.equal(S.evaluate({...base,...patch}).outcome,'EXCLUDED',JSON.stringify(patch));
 a.equal(S.evaluate({...base,title:''}).outcome,'HOLD_SOURCE_IDENTITY');
 a.equal(S.evaluate({...base,company:'',title:''}).outcome,'HOLD_SOURCE_IDENTITY');
 a.equal(S.evaluate({...base,url:'http://example.com/jobs/1'}).outcome,'HOLD_SOURCE_IDENTITY');
 a.equal(S.evaluate({...base,url:'http://example.com/jobs/1',location:''}).outcome,'HOLD_SOURCE_IDENTITY');
 a.equal(S.evaluate(base).outcome,'ADMIT');
});
test('agency, manager, unknown pay and geography do not close a candidate',()=>{for(const t of ['Manager, Quality','Manufacturing Manager'])a.equal(S.evaluate({...card(t),company:'Executive Search',location:'Memphis, TN',estimatedPayMax:100000}).outcome,'ADMIT');a.equal(S.evaluate(card('General Manager')).outcome,'ADMIT');a.equal(S.evaluate(card('Director, Data Center Operations')).outcome,'ADMIT');});
test('rank is deterministic, retains every candidate and does not cap output',()=>{const input=Array.from({length:5001},(_,i)=>({...card(i%2?'Plant Manager':'General Manager'),key:String(i)}));const out=S.rank(input);a.equal(out.length,5001);a.equal(out[0].screen.rank,0);a.equal(input[0].screen,undefined);});

test('software paired with hardware stays available for scope review',()=>a.notEqual(S.evaluate(card('Director, Embedded Software & Hardware')).outcome,'FUNCTION_MISMATCH'));

test('a later proven pursued match disables that closure term for independent candidates',()=>{const cfg=S.guarded(S.load(),[{PRIMARY_ID:'V2I-TEST',COMPANY:'A',TITLE:'Claims Operations Director',LOCATION:'Austin',BUCKET:'APPLIED',p:{}}]);a.ok(cfg.disabledRules.includes('FM_CLAIMS'));a.notEqual(S.evaluate(card('Claims Operations Director'),cfg).outcome,'FUNCTION_MISMATCH');});

test('complete cards do not need title-level or speculative function review before intake',()=>{for(const title of ['General Manager','Director, Data Center Operations','Production Engineer','Quality Technician','Technical Program Lead','Operations Specialist']){const screen=S.evaluate(card(title));a.equal(screen.outcome,'ADMIT',title);a.equal(screen.scopeReviewRequired,false);}});
