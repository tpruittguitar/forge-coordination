"""Keep source reuse and estimate routing consistent across live instructions."""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]

class SalarySourceInputs(unittest.TestCase):
    def test_current_common_contracts_keep_provider_equivalence_and_estimate_provenance(self):
        for name in ('COMMON.txt', 'COMMON_CORE.txt', 'AI_AUTOMATION_COMMON.txt', 'SHARED_HELPER_COMMON.txt'):
            with self.subTest(name=name):
                text = (ROOT / 'policy/current' / name).read_text()
                for provider in ('JobSpy', 'HiringCafe', 'LinkedIn'):
                    self.assertIn(provider, text)
                self.assertIn('employer salary lookup', text)
                self.assertIn('model', text.lower())
                self.assertNotIn('stamp SALARY_POSTED_LOW/HIGH', text)

    def test_lane_no_longer_requires_employer_salary_lookup_for_source_estimates(self):
        text = (ROOT / 'policy/current/FORGE_ENRICH_FEASIBILITY.txt').read_text()
        self.assertIn('trusted source-labeled estimate is already available', text)
        self.assertIn('MODEL_INPUTS_REQUIRED', text)
        self.assertIn('not the final range', text)
        self.assertNotIn("Open the employer's own post first", text)
        self.assertNotIn('cross-check only', text)
        self.assertIn('A PAY_POSTED field or board location alone does not prove employer disclosure', text)
        self.assertNotIn('FORGE-est is only an est from employer-posted ranges', text)
