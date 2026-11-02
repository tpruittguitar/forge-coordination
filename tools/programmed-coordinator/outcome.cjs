'use strict';
// Deliberately narrow templates. Source-body retrieval, authenticated identity,
// event persistence and Writer verification remain required by the tracker.
function classify({subject='',body='',fullBody=false}) {
  if(!fullBody) return {owner:'CODE',reason:'FULL_MESSAGE_REQUIRED'};
  const text=(subject+'\n'+body).replace(/\s+/g,' ');
  const confirmation=/\b(?:we have received your application|your application has been received|thank you for applying for the (?:position|role))\b/i.exec(text);
  const rejection=/\b(?:we (?:will not|won't) be (?:moving|proceeding) forward with your application|we have decided (?:not to (?:move|proceed) forward|to move forward with other candidates))\b/i.exec(text);
  if((confirmation&&rejection)||/\b(?:interview|availability|call me|call you|would like to discuss|offer|withdraw)\b/i.test(text)) return {owner:'AI',reason:'CORRESPONDENCE_REQUIRES_INTERPRETATION'};
  if(rejection)return {owner:'CODE',type:'REJECTED_BY_EMPLOYER',quote:rejection[0]};
  if(confirmation)return {owner:'CODE',type:'APPLICATION_CONFIRMED',quote:confirmation[0]};
  return {owner:'AI',reason:'NO_UNAMBIGUOUS_TEMPLATE'};
}
module.exports={classify};
