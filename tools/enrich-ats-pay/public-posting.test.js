const {test}=require('node:test'),a=require('node:assert/strict'),P=require('./public-posting');
const row={COMPANY:'Acme Corporation',TITLE:'Director of Quality'},desc='Lead manufacturing quality and production teams. '.repeat(12)+'Bachelor degree required.';
const page=j=>'<script type="application/ld+json">'+JSON.stringify(j)+'</script>';
const job={'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:'Acme Corp'},description:desc};
test('full uniquely matching JobPosting is reusable posting evidence',()=>{a.equal(P.parse(page({'@graph':[job]}),row).text,desc);});
test('reject other employer, title, truncated description, ambiguous or absent postings',()=>{for(const j of [{...job,title:'Engineer'},{...job,hiringOrganization:{name:'Other'}},{...job,description:'Degree not stated'},[job,job]])a.equal(P.parse(page(j),row),null);a.equal(P.parse('<p>'+desc+'</p>',row),null);});
test('retry incomplete rows after six hours and immediately when missing fields change',()=>{let l={submitted:{X:'2026-10-31T00:00:00Z'},tried:{},needs:{X:'SALARY,DEGREE'}};a.equal(P.retryDue(l,'X','DEGREE',Date.parse('2026-10-31T01:00Z')),true);a.equal(P.retryDue(l,'X','SALARY,DEGREE',Date.parse('2026-10-31T01:00Z')),false);a.equal(P.retryDue(l,'X','SALARY,DEGREE',Date.parse('2026-10-31T06:00Z')),true);});
test('reject non-public or credential-bearing source URLs',()=>{for(const u of ['file:///x','http://x','https://localhost/x','https://127.0.0.1/x','https://a:b@example.com'])a.equal(P.publicUrl(u),null);});
