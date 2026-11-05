'use strict';
const test=require('node:test'),a=require('node:assert/strict'),{classify}=require('./outcome.cjs');
const confirmation='Hi Timothy, Thank you for your interest in Shield AI! We wanted to let you know we received your application for Head of Operational Excellence, and we are delighted that you would consider joining our team.';
const footer='*Please note - should you advance through our interview process and you do not receive timely email responses from our team, please double check your spam folder as they may get caught in there. Thank you!';
test('Lever receipt with conditional interview delivery footer is an application confirmation',()=>{
 const r=classify({body:confirmation+' '+footer,fullBody:true});a.equal(r.owner,'CODE');a.equal(r.type,'APPLICATION_CONFIRMED');
});
test('actual interview invitations, mixed outcomes, and incomplete sources still require review',()=>{
 for(const body of [confirmation+' We invite you to an interview. '+footer,confirmation+' We will not be moving forward with your application.',footer])a.equal(classify({body,fullBody:true}).owner,'AI');
 a.equal(classify({body:confirmation,fullBody:false}).reason,'FULL_MESSAGE_REQUIRED');
});
