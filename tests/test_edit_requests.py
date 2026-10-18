"""Exercise the workflow's actual embedded handler against isolated file fixtures."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT=Path(__file__).resolve().parents[1]
WORKFLOW=(ROOT/'.github/workflows/apply-edit-requests.yml').read_text()
HANDLER=textwrap.dedent(WORKFLOW.split("<<'PY'\n",1)[1].split('\n          PY',1)[0])


class EditRequestTests(unittest.TestCase):
    def run_request(self,request,existing=None):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            if existing is not None:
                target=root/request['target']
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_text(existing,encoding='utf-8')
            (root/'request.json').write_text(json.dumps(request),encoding='utf-8')
            result=subprocess.run([sys.executable,'-c',HANDLER,'request.json'],cwd=root,capture_output=True,text=True,check=True)
            target=root/request['target']
            return result.stdout,target.read_text(encoding='utf-8') if target.is_file() else None

    def test_cannot_replace_live_authority_or_immutable_receipt(self):
        for target in ('control/FORGE_AUTOMATION_ENTRY.txt','runtime/current.json','state/latest.json','receipts/old.txt'):
            verdict,content=self.run_request({'target':target,'mode':'replace','content':'bad','requested_by':'CLAUDE claimed'},'original')
            self.assertIn('REJECT target not allowed',verdict)
            self.assertEqual(content,'original')

    def test_existing_target_requires_revision(self):
        verdict,content=self.run_request({'target':'proposals/a.txt','mode':'replace','content':'new','requested_by':'CHATGPT run'},'original')
        self.assertIn('requires base_blob_sha',verdict)
        self.assertEqual(content,'original')

    def test_allowed_new_proposal_remains_supported(self):
        verdict,content=self.run_request({'target':'proposals/a.txt','mode':'append','content':'proposal\n','requested_by':'CHATGPT run'})
        self.assertIn('APPLIED',verdict)
        self.assertEqual(content,'proposal\n')

    def test_traversal_does_not_create_file(self):
        verdict,_=self.run_request({'target':'proposals/../control/new.txt','mode':'replace','content':'bad','requested_by':'CHATGPT run'})
        self.assertIn('REJECT',verdict)


if __name__=='__main__': unittest.main()
