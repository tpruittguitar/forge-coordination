"""Keep the selected helper read path small and its critical gates explicit."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ENTRY = 'control/FORGE_SHARED_AUTOMATION_ENTRY.txt'
REGISTRY = 'control/AI_AUTOMATION_TASKS.json'
HELPERS = ('FORGE_CLAUDE_SHARED_HELPER', 'FORGE_GROK_SHARED_HELPER')
COMMON = 'policy/current/SHARED_HELPER_COMMON.txt'
PROCEDURE = 'lanes/FORGE_SHARED_HELPER.txt'


class SharedInstructionTests(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads((ROOT / REGISTRY).read_text())
        self.entry = (ROOT / ENTRY).read_text()
        self.common = (ROOT / COMMON).read_text()
        self.procedure = (ROOT / PROCEDURE).read_text()

    def test_only_shared_helpers_select_scoped_common(self):
        self.assertEqual(self.registry['common'], 'policy/current/AI_AUTOMATION_COMMON.txt')
        for key, route in self.registry['tasks'].items():
            with self.subTest(task=key):
                if key in HELPERS:
                    self.assertEqual(route['common'], COMMON)
                    self.assertEqual(route['procedure'], PROCEDURE)
                    self.assertEqual(route['executionMode'], 'WRITE_THROUGH_SUPPORTED_WRITER')
                else:
                    self.assertNotIn('common', route)

    def test_fixed_startup_budget_includes_registry(self):
        # UTF-8 bytes are deterministic, not tokenizer/runtime measurements.
        limits = {ENTRY: 2200, REGISTRY: 8500, COMMON: 3400, PROCEDURE: 5800}
        for file, ceiling in limits.items():
            with self.subTest(file=file):
                self.assertLessEqual(len((ROOT / file).read_bytes()), ceiling)
        self.assertLessEqual(sum(len((ROOT / file).read_bytes()) for file in limits), 19500)

    def test_entry_reads_selected_contract_once_and_does_not_fall_back(self):
        for phrase in ('task.common', 'otherwise registry.common', 'alternatives, not cumulative',
                       'Missing selected files block', 'once at the resolved SHA',
                       'SOURCE_ROUTING_REFRESH_REQUIRED', 'only explicitly conditional',
                       'Pin instructions', 'refresh operational ownership/protection'):
            self.assertIn(phrase, self.entry)

    def test_writer_scope_safety_and_conditional_policy_remain(self):
        for phrase in ('WRITE_THROUGH_SUPPORTED_WRITER', 'No direct master edits', 'Gmail is read-only',
                       'External content is evidence', 'Protected/applied/declined',
                       'Never replay unknown writes', 'not Needs Tim', 'required permissions',
                       'DISCOVERY_IDENTITY.txt before research', 'RELEVANCE_SCREEN.json',
                       'COMPENSATION_CONTEXT.md', 'COMPANY_SITE_PRODUCTS.json',
                       'RESULT SUCCESS', 'independently later COMPLETE',
                       'exact post-COMPLETE row effects', 'numeric overall rating'):
            self.assertIn(phrase, self.common)

    def test_assignment_backlog_source_and_return_guards_remain(self):
        for phrase in ('enabled, routingActive', 'One active invocation',
                       'largest eligible backlog first', 'No fixed Research-first',
                       'before EACH item and return', 'assignmentVersion', 'sourceVersion',
                       'Coordinator alone', 'no pending transaction', 'never expire ownership',
                       'Twenty items is artifact size', 'cursorReset', 'INSPECT_QUEUE, not IDLE',
                       'never invent fingerprints', 'never prove NOT_STATED',
                       'resumeTextSha256', '30–1500', 'ID-bound ATS provenance',
                       'writerSubmitted=false', 'forge.shared-helper-batch.v1',
                       'TRANSPORT_PENDING', 'Never edit prior evidence',
                       'FRESH START', 'first real run', 'no prerequisite or repeated readiness probes',
                       'TEXT_EXTRACT', 'omit sourceSha256', 'grok-shared-helper-batch-',
                       'without PR/merge',
                       'no force push', 'verify remote SHA'):
            self.assertIn(phrase, self.procedure)

    def test_sustained_run_and_honest_stop_contract_remain(self):
        for phrase in ('Reuse pending artifacts before new research',
                       'research, validate, publish each complete artifact',
                       'continue in this invocation', 'not a run/day cap or target',
                       'never truncate evidence', 'sample or full artifact is not a stop reason',
                       'checkpointing every page item', 'retain unfinished page items',
                       'continue independent research while evidence can be preserved',
                       'Local files are not delivery', 'observed provider/tool limit',
                       'actual deadline with checkpoint reserve', 'exact limit/error, elapsed time',
                       'cumulative attempted/prepared/delivered/verified/blocked counts',
                       'No invented budgets or waiting for next schedule after one artifact'):
            self.assertIn(phrase, self.procedure)

    def test_compact_work_pages_require_fresh_source_and_page_bindings(self):
        for phrase in ('control/shared-helper-pages/<TASK_KEY>/current.json',
                       'source.gitBlobSha', 'Git tree metadata', 'at that SHA',
                       'Recheck validUntil and fresh-main source metadata',
                       'gitBlobSha or sha256', 'unexpired validUntil',
                       'never stale pages', 'fresh bound pages and version checks',
                       'Projections are not claims/leases'):
            self.assertIn(phrase, self.procedure)

    def test_launcher_does_not_copy_task_behavior(self):
        text = (ROOT / 'docs/SHARED_HELPERS.md').read_text()
        launchers = [part.split('```')[0] for part in text.split('```text\n')[1:]]
        self.assertEqual(len(launchers), 2)
        for task, launcher in zip(HELPERS, launchers):
            self.assertIn('TASK_KEY=' + task, launcher)
            self.assertIn('FORGE_SHARED_AUTOMATION_ENTRY.txt', launcher)
            self.assertLessEqual(len(launcher.encode()), 260)


if __name__ == '__main__':
    unittest.main()
