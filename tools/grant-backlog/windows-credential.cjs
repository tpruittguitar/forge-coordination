'use strict';
const TARGET='Forge/OpenAI/Default/Responses';
const HOST='TIMMAY';
const deny=code=>{throw Error(code);};
function decode(record) {
  const blob=record?.blob;
  try {
    if(record?.target!==TARGET||record.type!==1||record.flags!==0||
       ![2,3].includes(record.persist)||record.userName!=='Default'||record.attributeCount!==0||
       !Buffer.isBuffer(blob)||blob.length<48||blob.length>1024||blob.length%2) deny('CREDENTIAL_UNTRUSTED');
    // Our Generic blob contract is UTF-16LE ASCII, as pasted in the Windows UI.
    // Generic credentials are otherwise opaque; never guess UTF-8/base64/BOM.
    for(let i=0;i<blob.length;i+=2) if(blob[i+1]!==0||blob[i]<33||blob[i]>126) deny('CREDENTIAL_ENCODING');
    const value=blob.toString('utf16le');
    if(!/^sk-(?:proj-)?[A-Za-z0-9_-]{20,500}$/.test(value)) deny('CREDENTIAL_FORMAT');
    return value;
  } finally {if(Buffer.isBuffer(blob))blob.fill(0);}
}
function startup({expectedSid}, injection={}) {
  if((injection.platform||process.platform)!=='win32') deny('WINDOWS_HOST_REQUIRED');
  if(!/^S-1-5-21-(?:\d+-){3}\d+$/.test(expectedSid||'')) deny('EXPECTED_ACCOUNT_SID_REQUIRED');
  let native,context,record;
  try {
    native=injection.native||require('./native/build/Release/forge_wincred.node');
    context=native.context();
  } catch {deny('WINDOWS_NATIVE_CONTEXT_UNAVAILABLE');}
  if(context.host!==HOST||context.sid!==expectedSid||context.impersonating!==false) deny('WINDOWS_HOST_OR_ACCOUNT_MISMATCH');
  try {record=native.read();} catch(e) {
    deny(e.code==='CREDENTIAL_ABSENT'?'CREDENTIAL_ABSENT':'CREDENTIAL_READ_FAILED');
  }
  let secret;
  try {secret=decode(record);} catch(e) {
    deny(['CREDENTIAL_UNTRUSTED','CREDENTIAL_ENCODING','CREDENTIAL_FORMAT'].includes(e.message)?e.message:'CREDENTIAL_UNTRUSTED');
  }
  let closed=false;
  return Object.freeze({
    // Only the trusted fixed Responses transport receives the in-memory value.
    // Never pass user/plugin callbacks here. Never serialize headers/errors.
    async secureRuntime(use) {
      if(closed) deny('CREDENTIAL_CLOSED');
      try {
        const current=native.context();
        if(current.host!==HOST||current.sid!==expectedSid||current.impersonating!==false) deny('CREDENTIAL_CONTEXT_CHANGED');
        const result=await use(secret);
        if(!(result instanceof Response)) deny('CREDENTIAL_CALLBACK_RESULT');
        return result;
      } catch {deny('CREDENTIAL_USE_FAILED');}
    },
    close(){closed=true;secret=null;}
  });
}
module.exports={TARGET,HOST,startup,decode};
