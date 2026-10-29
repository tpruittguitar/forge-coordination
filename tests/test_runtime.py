import copy
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


r = module('build_runtime')
i = module('index_receipts')


class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outputs, cls.manifest = r.build()

    def test_build_reproducible_and_all_lanes_verify(self):
        self.assertEqual(r.build(), (self.outputs, self.manifest))
        for task,lane in self.manifest['lanes'].items():
            path = 'runtime/releases/' + self.manifest['release_id'] + '/' + lane['file']
            self.assertTrue(r.verify_packet(self.manifest,task,lane['owner'],self.outputs[path]))

    def test_wrong_provider_or_changed_bytes_rejected(self):
        task = 'FORGE_EMAIL_DISCOVERY'
        data = self.outputs['runtime/releases/'+self.manifest['release_id']+'/'+task+'.txt']
        with self.assertRaisesRegex(ValueError,'own lane'):
            r.verify_packet(self.manifest,task,'Grok',data)
        with self.assertRaisesRegex(ValueError,'hash mismatch'):
            r.verify_packet(self.manifest,task,'ChatGPT',data+b'\n')

    def test_even_rehashed_mixed_release_rejected(self):
        task='FORGE_POSTING_VALIDATION'
        data=self.outputs['runtime/releases/'+self.manifest['release_id']+'/'+task+'.txt']
        data=data.replace(self.manifest['release_id'].encode(),b'0'*20,1)
        m=copy.deepcopy(self.manifest)
        m['lanes'][task].update(sha256=r.digest(data),blob_sha=r.blob_sha(data))
        with self.assertRaisesRegex(ValueError,'mixed release'):
            r.verify_packet(m,task,'ChatGPT',data)

    def test_traversal_missing_lane_unknown_schema_rejected(self):
        for alter in (lambda m:m['lanes']['FORGE_POSTING_VALIDATION'].update(file='../CONTROL.txt'),
                      lambda m:m['lanes'].pop('FORGE_EMAIL_DISCOVERY'),
                      lambda m:m.update(schema_version=2)):
            m=copy.deepcopy(self.manifest)
            alter(m)
            with self.assertRaises(ValueError): r.validate_manifest(m)

    def test_temporary_chatgpt_ownership_and_legacy_provider_rejection(self):
        for task, lane in self.manifest['lanes'].items():
            self.assertEqual(lane['owner'], 'ChatGPT')
            self.assertTrue(r.select_task(self.manifest, 'ChatGPT', task, 0)[1])
            for former_provider in ('Claude', 'Grok'):
                self.assertFalse(r.select_task(self.manifest, former_provider, task, 0)[1])
        self.assertEqual(self.manifest['addons'], {})

    def test_chatgpt_rotation_preserves_slots_and_legacy_launcher_map(self):
        expected = {
            1: 'FORGE_APPLICATION_WRITER_GOFER',
            9: 'FORGE_APPLICATION_WRITER_GOFER',
            17: 'FORGE_APPLICATION_WRITER_GOFER',
            5: 'FORGE_POSTING_VALIDATION',
            13: 'FORGE_POSTING_VALIDATION',
            21: 'FORGE_POSTING_VALIDATION',
        }
        for h in range(24):
            for provider in ('ChatGPT', 'Grok'):
                if h in expected:
                    task, owned = r.select_task(self.manifest, provider, 'ROTATION', h)
                    self.assertEqual(task, expected[h])
                    self.assertEqual(owned, provider == 'ChatGPT')
                else:
                    with self.assertRaises(ValueError):
                        r.select_task(self.manifest, provider, 'ROTATION', h)
        # The existing ChatGPT launcher resolves rotations.Grok then uses its actual provider.
        for h, task in expected.items():
            legacy_task = self.manifest['rotations']['Grok'][str(h)]
            self.assertEqual(legacy_task, task)
            self.assertTrue(r.select_task(self.manifest, 'ChatGPT', legacy_task, h)[1])
        for h in range(0, 24, 3):
            self.assertFalse(r.select_task(self.manifest, 'Claude', 'ROTATION', h)[1])

    def test_false_complete_or_readback_before_complete_never_verified(self):
        self.assertTrue(r.verified(True,True,True,True))
        for position in range(4):
            flags=[True]*4
            flags[position]=False
            self.assertFalse(r.verified(*flags))
        self.assertFalse(r.verified(True,'COMPLETE',True,True))

    def test_immutable_release_and_stale_output(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            r.publish(root,self.outputs)
            r.publish(root,self.outputs,check=True)
            one=next(k for k in self.outputs if k.endswith('FORGE_POSTING_VALIDATION.txt'))
            (root/one).write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'immutable release'):
                r.publish(root,self.outputs)
            with self.assertRaisesRegex(ValueError,'stale'):
                r.publish(root,self.outputs,check=True)

    def test_invalid_source_cannot_publish_partial_release(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for folder in ('policy','examples','scripts','schemas','control','directives'):
                shutil.copytree(ROOT/folder,root/folder)
            config=root/'policy/current/registry.json'
            data=json.loads(config.read_text())
            data['lanes']['FORGE_EMAIL_DISCOVERY']['max_estimated_tokens']=1
            config.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'exceeds'): r.build(root)
            self.assertFalse((root/'runtime/current.json').exists())


class PayloadTests(unittest.TestCase):
    def example(self,name):
        text=(ROOT/'examples'/name).read_text()
        for k,v in {'ACTOR':'CLAUDE','PROVIDER':'Claude','RUN_ID':'FORGE-TEST-CLAUDE-20261018-1500ET'}.items():
            text=text.replace('{{'+k+'}}',v)
        return json.loads(text)

    def test_all_examples_valid(self):
        for file in (ROOT/'examples').glob('*.json'):
            r.validate_payload(self.example(file.name))

    def test_old_flat_ruling_rejected(self):
        with self.assertRaisesRegex(ValueError,'nested'):
            r.validate_payload({'action':'ruling','primaryId':'V2I-1','kind':'ENRICH'})

    def test_duplicates_protected_state_and_invalid_url_rejected(self):
        for defect in ('duplicate','protected','url'):
            payload=self.example('enrich.json')
            if defect=='duplicate': payload['requests']*=2
            elif defect=='protected': payload['requests'][0]['ruling']['fields']['DISPOSITION']='APPLIED'
            else: payload['requests'][0]['ruling']['fields']['LIVENESS_EVIDENCE_URL']='not-a-url'
            with self.assertRaises(ValueError): r.validate_payload(payload)

    def test_omitted_gross_candidates_cannot_hide_as_smaller_denominator(self):
        payload=self.example('intake.json')
        payload['run']['GROSS_FOUND']=0
        with self.assertRaisesRegex(ValueError,'GROSS_FOUND'): r.validate_payload(payload)
        payload['run']['GROSS_FOUND']=True
        with self.assertRaises(ValueError): r.validate_payload(payload)

    def test_batch_26_rejected(self):
        payload=self.example('application.json')
        payload['events']*=26
        with self.assertRaisesRegex(ValueError,'1..25'): r.validate_payload(payload)

    def test_gross_excess_needs_reconciled_disposition_ledger(self):
        payload=self.example('intake.json')
        payload['run']['GROSS_FOUND']=3
        with self.assertRaisesRegex(ValueError,'ledger'): r.validate_payload(payload)
        ledger={'submitted':1,'existing':1,'excluded':0,'held':1,'unresolved':0,'separately_submitted':0}
        r.validate_payload(payload,ledger)
        ledger['held']=0
        with self.assertRaisesRegex(ValueError,'mismatch'): r.validate_payload(payload,ledger)


class IndexTests(unittest.TestCase):
    def test_latest_terminal_selected_not_start_and_not_verification(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); receipts=root/'receipts'; receipts.mkdir()
            (receipts/'AI_REASON_RUN_RECEIPT_FORGE-WEB-CHATGPT-20261018-0546ET_TERMINAL.txt').write_text('RUN_TERMINAL_STATUS=PARTIAL_WITH_WORK\nWRITTEN_REQUEST_IDS=abc')
            (receipts/'AI_REASON_RUN_RECEIPT_FORGE-WEB-CHATGPT-20261018-0846ET_START.txt').write_text('RUN_TERMINAL_STATUS=COMPLETE')
            (receipts/'EMAIL_BACKFILL_STATE_20261018_0602ET.txt').write_text('QUEUE_REQUEST_IDS_PENDING=abc')
            (receipts/'FORGE-ZIPR-CHATGPT-2026W42-20261013-1737ET-START.txt').write_text('START')
            result=i.index(root,'source123')
            self.assertIn('0546ET',result['lanes']['FORGE_WEB_CAREER_DISCOVERY']['receipt'])
            self.assertEqual(result['weekly_receipts'],[])
            self.assertNotIn('verified',json.dumps(result).lower())
            self.assertNotIn('pending',result)
            self.assertEqual(result['source_commit'],'source123')

    def test_missing_hints_are_explicit_not_fake_empty_queues(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); (root/'receipts').mkdir()
            result=i.index(root,'empty')
            self.assertEqual(result['lanes'],{})
            self.assertIsNone(result['latest_email_state'])
            self.assertIn('discovery_hint_only',result['authority'])


if __name__=='__main__': unittest.main()
