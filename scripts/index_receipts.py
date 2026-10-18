"""Build non-authoritative hints to immutable latest receipts; no pending-state inference."""
import argparse
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TOKENS = {'EMAIL':'FORGE_EMAIL_DISCOVERY', 'WEB':'FORGE_WEB_CAREER_DISCOVERY',
          'ENRICH-STRATEGIC':'FORGE_ENRICH_STRATEGIC', 'ENRICH-FEASIBILITY':'FORGE_ENRICH_FEASIBILITY',
          'POSTVAL':'FORGE_POSTING_VALIDATION', 'GOFER':'FORGE_APPLICATION_WRITER_GOFER'}
RUN = re.compile(r'FORGE[-_](ENRICH[-_]STRATEGIC|ENRICH[-_]FEASIBILITY|EMAIL|WEB|POSTVAL|GOFER)[-_](CHATGPT|CLAUDE|GROK)[-_](\d{8})[-_](\d{4})ET', re.I)


def index(root, source_commit):
    latest, email, weekly = {}, [], []
    for path in sorted((root / 'receipts').glob('*.txt')):
        name = path.name
        if name.startswith('EMAIL_BACKFILL_STATE_'):
            match = re.search(r'(\d{8})_(\d{4})ET', name)
            if match:
                email.append(((match[1], match[2], '_CHECKPOINT' in name, name), path.relative_to(root).as_posix()))
            continue
        if name.startswith('FORGE-ZIPR-') and 'START' not in name:
            weekly.append(path.relative_to(root).as_posix())
        if any(word in name.upper() for word in ('_START', '_PREFLIGHT', '_CHECKPOINT', '_EVAL', 'CHANGE_RECORD')):
            continue
        text = path.read_text(encoding='utf-8-sig')
        if 'TERMINAL' not in name.upper() and not re.search(r'(?:RUN_)?TERMINAL_STATUS["\s]*[:=]', text):
            continue
        match = RUN.search(name) or RUN.search(text)
        if not match:
            continue
        task = TOKENS[match[1].upper().replace('_','-')]
        rank = (match[3], match[4], name)
        if task not in latest or rank > latest[task][0]:
            latest[task] = (rank, {'receipt':path.relative_to(root).as_posix(),
                                  'run_id':match[0], 'provider':match[2].upper()})
    return {'schema_version':1, 'source_commit':source_commit,
            'authority':'discovery_hint_only; validate source content and current Writer state',
            'lanes':{k:v[1] for k,v in sorted(latest.items())},
            'latest_email_state':max(email)[1] if email else None,
            'weekly_receipts':weekly}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-commit')
    args = parser.parse_args()
    commit = args.source_commit or subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    result = index(ROOT, commit)
    path = ROOT / 'state/latest.json'
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Indexed latest immutable receipts; no live pending/verification claims.')
