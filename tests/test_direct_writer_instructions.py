"""Write-through instructions preserve transport truth, ownership and safety gates."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
DIRECT = {
    'FORGE_CHATGPT_ENRICHMENT_RESEARCH',
    'FORGE_INTAKE_SCOPE_REVIEW', 'FORGE_INTAKE_SOURCE_RECOVERY',
    'FORGE_INTAKE_HELD_RECONCILIATION',
    'FORGE_CLAUDE_SHARED_HELPER', 'FORGE_GROK_SHARED_HELPER',
    'FORGE_CLAUDE_INTAKE_A', 'FORGE_CLAUDE_INTAKE_B',
    'FORGE_CLAUDE_ENRICHMENT', 'FORGE_CLAUDE_RELEVANCE_REVIEW',
}
RETIRED = {
    'FORGE_GROK_INTAKE_HELPER', 'FORGE_GROK_ENRICHMENT',
    'FORGE_GROK_APPLICATION_OUTCOME_HELPER',
}


class DirectWriterInstructionTests(unittest.TestCase):
    def setUp(self):
        self.tasks = json.loads((ROOT / 'control/AI_AUTOMATION_TASKS.json').read_text())['tasks']
        self.doc = (ROOT / 'docs/DIRECT_WRITER_PROCESSING.md').read_text()

    def test_only_non_retired_job_detail_routes_change_mode(self):
        selected = {key for key, task in self.tasks.items()
                    if task.get('executionMode') == 'WRITE_THROUGH_SUPPORTED_WRITER'}
        self.assertEqual(selected, DIRECT)
        for key in RETIRED:
            self.assertIs(self.tasks[key]['retired'], True)
            self.assertEqual(self.tasks[key]['executionMode'], 'EVIDENCE_ONLY')
        self.assertEqual(self.tasks['FORGE_CLAUDE_RELEVANCE_REVIEW']['owner'], 'ChatGPT')

    def test_each_procedure_routes_ready_facts_without_manual_relay(self):
        for path in {self.tasks[key]['procedure'] for key in DIRECT}:
            with self.subTest(path=path):
                text = (ROOT / path).read_text()
                for required in ('WRITE_THROUGH_SUPPORTED_WRITER', 'docs/DIRECT_WRITER_PROCESSING.md',
                                 'writerSubmitted=false'):
                    # JSON examples use the literal envelope spelling.
                    self.assertIn(required, text.replace('"writerSubmitted":false', 'writerSubmitted=false'))
                self.assertNotIn('for Tim to relay', text)
                self.assertNotIn('submitted/verified are zero', text)
                self.assertNotIn('MODE=EVIDENCE_ONLY', text)

    def test_adapter_paths_do_not_invent_provider_access(self):
        for required in ('launch.ps1', '-ReturnsOnly', '-Batch', 'source-intake-auto.yml',
                         'Do not send a drain review to the helper-batch adapter',
                         'existing authorized automatic delivery', 'TRANSPORT_PENDING',
                         'do not create a new cloud Writer endpoint', 'writerSubmitted=false',
                         'RESULT SUCCESS', 'independently later COMPLETE', 'after COMPLETE',
                         'original request IDs fenced', 'No manual relay, approval, evidence PR',
                         'dormant', 'stay retired'):
            self.assertIn(required, self.doc)

    def test_grok_direct_queue_precedes_helper_adapter_without_new_access(self):
        guide = (ROOT / 'docs/GROK_DIRECT_WRITER.md').read_text()
        for phrase in ('AI_Coordination/WRITER_QUEUE', 'dispatchWrite_',
                       'No local', 'helper coordinator', 'new endpoint',
                       'not an edit of the master file', 'No local',
                       'Existing access to the parent is not proof',
                       'Do not change sharing', 'first real eligible submission',
                       'never also deliver a write-through helper batch',
                       'Previously captured helper returns',
                       'durably excluding it from the previous',
                       'SUBMISSION_ATTEMPTED_OUTCOME_UNKNOWN',
                       'not `forge-helper-', 'Never rename, overwrite, move, delete',
                       'original parent/child request IDs', 's=COMPLETE',
                       'old Drive receipt index is a frozen', 'row_readback',
                       'after the COMPLETE observation', 'Externalized evidence',
                       'RESUME_MATCH_PROFILE.json', 'fallback adapter is not running',
                       'RESULT__<request-basename-without-extension>.json',
                       'Tim-authorized DECLINE', 'DECLINED_BY_TIM', 'authorizedBy',
                       'NEVER_CONSIDER — PHARMA_MEDICAL', 'Never mix the two kinds',
                       'does not claim live Grok access'):
            self.assertIn(phrase, guide)
        for path in ('policy/current/SHARED_HELPER_COMMON.txt', 'lanes/FORGE_SHARED_HELPER.txt'):
            text = (ROOT / path).read_text()
            self.assertIn('docs/GROK_DIRECT_WRITER.md', text)
            self.assertIn('WRITER_QUEUE', text)
        self.assertLess(self.doc.index('## Grok direct submission'),
                        self.doc.index('## Existing supported execution paths'))

    def test_dormant_procedures_do_not_reactivate_work(self):
        for path in ('lanes/CLAUDE_FORGE_SUPPLEMENTAL_INTAKE.txt',
                     'lanes/CLAUDE_FORGE_SUPPLEMENTAL_ENRICHMENT.txt',
                     'lanes/CLAUDE_RELEVANCE_REVIEW.txt'):
            self.assertIn('dormant route stays dormant', (ROOT / path).read_text())
        self.assertFalse(json.loads((ROOT / 'control/CLAUDE_HELPER_WORK.json').read_text())['enabled'])


if __name__ == '__main__':
    unittest.main()
