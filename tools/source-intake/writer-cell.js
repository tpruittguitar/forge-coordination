'use strict';
// Exactly the master Writer clean_ encoding. Stable request IDs still use the original record.
const normalizeCell=x=>String(x??'').replace(/[\r\n]+/g,' ').replace(/; /g,', ').replace(/ \| /g,' / ').trim().toLowerCase();
module.exports={normalizeCell};
