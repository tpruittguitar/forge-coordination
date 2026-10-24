import json, tempfile, subprocess, textwrap, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
YAML=(ROOT/'.github/workflows/apply-edit-requests.yml').read_text(encoding='utf-8')
SCRIPT=textwrap.dedent(YAML.split("<<'PY'",1)[1].split('\n          PY',1)[0])
class SuggestionDelivery(unittest.TestCase):
 def evaluate(self,body,initial='HEADER\n'):
  with tempfile.TemporaryDirectory() as td:
   p=pathlib.Path(td)
   (p/'control').mkdir()
   (p/'edit-requests').mkdir()
   (p/'control/SUGGESTIONS.txt').write_text(initial)
   subprocess.run(['git','init','-q'],cwd=p,check=True,capture_output=True)
   subprocess.run(['git','add','.'],cwd=p,check=True,capture_output=True)
   subprocess.run(['git','-c','user.name=test','-c','user.email=t@example.com','commit','-qm','init'],cwd=p,check=True)
   sha=subprocess.check_output(['git','rev-parse','HEAD:control/SUGGESTIONS.txt'],cwd=p,text=True).strip()
   request={'target':'control/SUGGESTIONS.txt','mode':'append','content':body,'requested_by':'CHATGPT test','base_blob_sha':sha}
   f=p/'edit-requests/in.json';f.write_text(json.dumps(request))
   result=subprocess.run(['python','-c',SCRIPT,str(f)],cwd=p,text=True,capture_output=True)
   return result.stdout.strip(),(p/'control/SUGGESTIONS.txt').read_text()
 def body(self,status='OPEN',id='SUG-20261024-CHATGPT-99'):
  return '\n'.join([f'ID={id}','DATE=2026-10-24','BY=CHATGPT FORGE-TEST','COMPONENT=repo','SEVERITY=LOW','EVIDENCE=receipt','PROBLEM=Example','PROPOSED_FIX=Review','SUGGESTED_BUILDER=UNASSIGNED',f'STATUS={status}','TIM_DECISION='])+'\n'
 def test_valid_append(self):
  output,data=self.evaluate(self.body())
  self.assertTrue(output.startswith('APPLIED append'),output)
  self.assertIn('ID=SUG-20261024-CHATGPT-99',data)
 def test_cannot_approve(self):
  output,data=self.evaluate(self.body('APPROVED'))
  self.assertIn('REJECT invalid suggestion',output)
  self.assertEqual(data,'HEADER\n')
 def test_duplicate_id(self):
  body=self.body()
  output,_=self.evaluate(body,'HEADER\n'+body)
  self.assertIn('REJECT duplicate suggestion ID',output)
if __name__=='__main__':unittest.main()
