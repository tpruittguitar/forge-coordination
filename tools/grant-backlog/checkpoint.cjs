'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function save(file,value,injection={}) {
  try {
    const tmp=file+'.tmp-'+crypto.randomUUID(),fd=fs.openSync(tmp,'wx',0o600);
    try {fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    if((injection.platform||process.platform)==='win32') {
      // Loading the addon does not call context() or read(). No secret in dry-run.
      const native=injection.native||require('./native/build/Release/forge_wincred.node');
      native.replaceCheckpoint(path.resolve(tmp),path.resolve(file));
    } else {
      fs.renameSync(tmp,file);const dir=fs.openSync(path.dirname(file),'r');
      try {fs.fsyncSync(dir);} finally {fs.closeSync(dir);}
    }
  } catch {throw Error('CHECKPOINT_DURABILITY_FAILURE');}
}
module.exports={save};
