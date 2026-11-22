'use strict';
// No verified common serialization exists between TIMMAY and the Ubuntu ATS
// last-POST handoff. A local lock or earlier published fence cannot prove it.
// Deliberately no release/config/callback switch can override this barrier.
function check(){throw Error('CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN');}
module.exports={check};
