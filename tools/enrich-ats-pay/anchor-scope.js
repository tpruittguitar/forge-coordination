'use strict';
// Title evidence describes work, not an assumed company pay premium.
function family(title){
 const t=String(title||'');
 if(/supply chain|logistics|procurement|purchasing/i.test(t))return 'SUPPLY_CHAIN';
 if(/quality/i.test(t))return 'QUALITY';
 if(/manufactur\w*.*(?:engineering|technology|systems|enablement)|(?:engineering|technology).*manufactur|industrialization|automation|robotic|machine development/i.test(t))return 'MANUFACTURING_TECHNOLOGY';
 if(/plant (?:manager|director|operations)|(?:director|manager).*plant|general manager|site (?:leader|lead)|value stream/i.test(t))return 'PLANT_OPERATIONS';
 if(/manufactur|production|assembly|fabrication/i.test(t))return 'MANUFACTURING_OPERATIONS';
 if(/engineering/i.test(t))return 'ENGINEERING';
 if(/program|project/i.test(t))return 'PROGRAM';
 if(/operations?|\bops\b/i.test(t))return 'OPERATIONS';
 return 'OTHER';
}
function executiveScope(title){
 const t=String(title||'');
 if(/\b(chief|ceo|coo|cto|cqo)\b/i.test(t))return 'CHIEF';
 if(/\b(svp|evp|senior vice president|executive vice president)\b/i.test(t))return 'SENIOR_VP';
 return 'STANDARD';
}
module.exports={family,executiveScope};
