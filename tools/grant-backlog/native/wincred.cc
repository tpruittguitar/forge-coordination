// No credential enumeration, write, stdout, subprocess, environment or file export.
#ifndef _WIN32
#error This addon is only supported on Windows.
#endif
#include <node_api.h>
#include <windows.h>
#include <wincred.h>
#include <sddl.h>
#include <string>
#include <vector>
#include <stdexcept>

static const wchar_t* Target=L"Forge/OpenAI/Default/Responses";
struct Handle { HANDLE h=nullptr; ~Handle(){if(h)CloseHandle(h);} };
struct Credential {
  PCREDENTIALW p=nullptr;
  ~Credential(){if(p){if(p->CredentialBlob)SecureZeroMemory(p->CredentialBlob,p->CredentialBlobSize);CredFree(p);}}
};
struct Local { LPWSTR p=nullptr; ~Local(){if(p)LocalFree(p);} };
static void ok(napi_status s){if(s!=napi_ok)throw std::runtime_error("NATIVE_FAILURE");}
static napi_value error(napi_env e,const char* code){napi_throw_error(e,code,code);return nullptr;}
static napi_value string(napi_env e,const wchar_t* text){napi_value v;ok(napi_create_string_utf16(e,reinterpret_cast<const char16_t*>(text),NAPI_AUTO_LENGTH,&v));return v;}
static void set(napi_env e,napi_value obj,const char* key,napi_value v){ok(napi_set_named_property(e,obj,key,v));}
static void number(napi_env e,napi_value obj,const char* key,uint32_t n){napi_value v;ok(napi_create_uint32(e,n,&v));set(e,obj,key,v);}
static std::wstring host(){wchar_t name[MAX_COMPUTERNAME_LENGTH+1];DWORD n=MAX_COMPUTERNAME_LENGTH+1;
  if(!GetComputerNameW(name,&n)||std::wstring(name)!=L"TIMMAY")throw std::runtime_error("HOST_MISMATCH");return name;}
static std::wstring sid(){
  Handle thread;
  if(OpenThreadToken(GetCurrentThread(),TOKEN_QUERY,TRUE,&thread.h)||GetLastError()!=ERROR_NO_TOKEN)throw std::runtime_error("IMPERSONATION_FORBIDDEN");
  Handle token;if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token.h))throw std::runtime_error("TOKEN_UNAVAILABLE");
  DWORD size=0;GetTokenInformation(token.h,TokenUser,nullptr,0,&size);
  if(!size||size>65536)throw std::runtime_error("TOKEN_UNAVAILABLE");
  std::vector<BYTE> bytes(size);
  if(!GetTokenInformation(token.h,TokenUser,bytes.data(),size,&size))throw std::runtime_error("TOKEN_UNAVAILABLE");
  Local result;if(!ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(bytes.data())->User.Sid,&result.p))throw std::runtime_error("TOKEN_UNAVAILABLE");
  return result.p;
}
static napi_value Context(napi_env e,napi_callback_info info){
  try{auto h=host(),s=sid();napi_value obj,v;ok(napi_create_object(e,&obj));set(e,obj,"host",string(e,h.c_str()));set(e,obj,"sid",string(e,s.c_str()));
    ok(napi_get_boolean(e,false,&v));set(e,obj,"impersonating",v);return obj;
  }catch(...){return error(e,"NATIVE_CONTEXT_REJECTED");}
}
static napi_value Read(napi_env e,napi_callback_info info){
  try{
    host();sid(); // Native checks also protect direct binding invocation.
    Credential c;
    if(!CredReadW(Target,CRED_TYPE_GENERIC,0,&c.p))return error(e,GetLastError()==ERROR_NOT_FOUND?"CREDENTIAL_ABSENT":"CREDENTIAL_READ_FAILED");
    if(!c.p||!c.p->TargetName||wcscmp(c.p->TargetName,Target)||c.p->Type!=CRED_TYPE_GENERIC||
       c.p->Flags!=0||c.p->AttributeCount!=0||!c.p->UserName||wcscmp(c.p->UserName,L"Default")||
       (c.p->Persist!=CRED_PERSIST_LOCAL_MACHINE&&c.p->Persist!=CRED_PERSIST_ENTERPRISE)||
       !c.p->CredentialBlob||c.p->CredentialBlobSize<48||c.p->CredentialBlobSize>1024||c.p->CredentialBlobSize%2)
      return error(e,"CREDENTIAL_UNTRUSTED");
    // Validate ASCII UTF-16LE before copying anything to JavaScript.
    for(DWORD i=0;i<c.p->CredentialBlobSize;i+=2)
      if(c.p->CredentialBlob[i+1]||c.p->CredentialBlob[i]<33||c.p->CredentialBlob[i]>126)return error(e,"CREDENTIAL_ENCODING");
    napi_value obj,blob;ok(napi_create_object(e,&obj));
    set(e,obj,"target",string(e,Target));set(e,obj,"userName",string(e,L"Default"));
    number(e,obj,"type",c.p->Type);number(e,obj,"flags",c.p->Flags);number(e,obj,"persist",c.p->Persist);number(e,obj,"attributeCount",0);
    ok(napi_create_buffer_copy(e,c.p->CredentialBlobSize,c.p->CredentialBlob,nullptr,&blob));
    set(e,obj,"blob",blob);return obj; // RAII zeros native blob and calls CredFree.
  }catch(...){return error(e,"CREDENTIAL_NATIVE_FAILURE");}
}
static std::wstring arg(napi_env e,napi_value v){size_t size=0;ok(napi_get_value_string_utf16(e,v,nullptr,0,&size));
  if(size==0||size>32760)throw std::runtime_error("PATH_INVALID");std::vector<char16_t> b(size+1);
  ok(napi_get_value_string_utf16(e,v,b.data(),b.size(),&size));
  for(size_t i=0;i<size;i++)if(b[i]==0)throw std::runtime_error("PATH_INVALID");return std::wstring(reinterpret_cast<wchar_t*>(b.data()),size);}
static napi_value Replace(napi_env e,napi_callback_info info){
  try{size_t n=2;napi_value args[2],v;ok(napi_get_cb_info(e,info,&n,args,nullptr,nullptr));if(n!=2)throw std::runtime_error("PATH_INVALID");
    auto from=arg(e,args[0]),to=arg(e,args[1]);
    // Caller fsyncs source bytes first. Do not copy/delete or weaken on failure.
    if(!MoveFileExW(from.c_str(),to.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH))return error(e,"CHECKPOINT_REPLACE_FAILED");
    ok(napi_get_undefined(e,&v));return v;
  }catch(...){return error(e,"CHECKPOINT_REPLACE_FAILED");}
}
static napi_value Init(napi_env e,napi_value exports){napi_property_descriptor p[]={
  {"context",nullptr,Context,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"read",nullptr,Read,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"replaceCheckpoint",nullptr,Replace,nullptr,nullptr,nullptr,napi_default,nullptr}};
  if(napi_define_properties(e,exports,3,p)!=napi_ok)return error(e,"NATIVE_INIT_FAILED");return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,Init)
