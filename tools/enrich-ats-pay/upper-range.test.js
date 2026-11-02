const test=require('node:test'),a=require('node:assert/strict'),C=require('./context'),L=require('./lib');
test('peer salaries cannot dilute stronger compatible same-employer ceilings',()=>{
 const points=[{low:180000,high:260000,weight:1,sameEmployer:true},...Array.from({length:3},()=>({low:120000,high:180000,weight:1}))];
 a.equal(C.salaryValue(points,'high'),260000);a.equal(C.salaryValue(points,'low'),150000);
});
test('upper quartile retains high-end evidence without automatically choosing the single extreme',()=>{
 const points=[180000,190000,200000,210000,220000,230000,420000].map(high=>({high,weight:1}));
 a.equal(C.salaryValue(points,'high'),230000);
});
test('manager abbreviations preserve seniority and do not cross-anchor',()=>{
 a.equal(L.level('Sr Mgr Manufacturing'),1.5);a.equal(L.level('Mgr Manufacturing'),1);
 a.equal(L.comparable({TITLE:'Sr Mgr Manufacturing'},{title:'Manufacturing Manager'}),false);
});
