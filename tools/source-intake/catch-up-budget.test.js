'use strict';
const test=require('node:test'),a=require('node:assert/strict'),{catchUpBudgetMs,budgetSpent}=require('./auto-run');
test('catch-up budget defaults to 45 minutes and honors a positive env override',()=>{
 a.equal(catchUpBudgetMs({}),45*60000);
 a.equal(catchUpBudgetMs({FORGE_CATCHUP_BUDGET_MINUTES:'10'}),10*60000);
 a.equal(catchUpBudgetMs({FORGE_CATCHUP_BUDGET_MINUTES:'0'}),45*60000);
 a.equal(catchUpBudgetMs({FORGE_CATCHUP_BUDGET_MINUTES:'junk'}),45*60000);
});
test('budget stops only catch-up runs, and only once it is spent',()=>{
 const t0=1_000_000,env={};
 a.equal(budgetSpent(['--catch-up'],t0,t0+44*60000,env),false);
 a.equal(budgetSpent(['--catch-up'],t0,t0+45*60000,env),true);
 a.equal(budgetSpent(['--one-transaction'],t0,t0+600*60000,env),false);
 a.equal(budgetSpent(['--catch-up'],t0,t0+11*60000,{FORGE_CATCHUP_BUDGET_MINUTES:'10'}),true);
});
