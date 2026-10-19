"""Build coherent, content-addressed instruction packets. Python stdlib; no network."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
RAW = 'https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/'
PROVIDERS = {'ChatGPT': 'CHATGPT', 'Claude': 'CLAUDE', 'Grok': 'GROK'}
TASKS = {'FORGE_EMAIL_DISCOVERY', 'FORGE_WEB_CAREER_DISCOVERY', 'FORGE_ENRICH_STRATEGIC',
         'FORGE_ENRICH_FEASIBILITY', 'FORGE_APPLICATION_WRITER_GOFER', 'FORGE_POSTING_VALIDATION',
         'FORGE_ZIPRECRUITER_WEEKLY'}
FORBIDDEN = {'COMPANY', 'TITLE', 'LOCATION', 'REQ', 'BUCKET', 'DISPOSITION', 'PRIMARY_ID', 'STATE_SOURCE', 'STATE_UPDATED_AT'}


def canonical(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False) + '\n').encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def https(value):
    return isinstance(value, str) and bool(re.fullmatch(r'https://[^\s/]+(?:/[^\s]*)?', value))


def validate_payload(value, accounting=None):
    """Check documented producer invariants; Writer remains final admission authority."""
    require(isinstance(value, dict), 'payload must be an object')
    action = value.get('action')
    if action == 'intake':
        require(bool(value.get('requestId')), 'intake requestId required')
        run, records = value.get('run'), value.get('records')
        require(isinstance(run, dict) and bool(run.get('SCOUT_RUN_ID')), 'SCOUT_RUN_ID required')
        require(isinstance(records, list) and 1 <= len(records) <= 25, 'intake batch must contain 1..25 records')
        gross = run.get('GROSS_FOUND')
        require(type(gross) is int and gross >= len(records), 'GROSS_FOUND must cover submitted records')
        if gross > len(records):
            require(isinstance(accounting, dict), 'separate candidate accounting ledger required')
            keys = {'submitted','existing','excluded','held','unresolved','separately_submitted'}
            require(set(accounting) == keys and all(type(n) is int and n >= 0 for n in accounting.values()), 'invalid candidate accounting')
            require(accounting['submitted'] == len(records) and sum(accounting.values()) == gross, 'candidate accounting mismatch')
        for record in records:
            require(isinstance(record, dict), 'record must be an object')
            require(bool(record.get('COMPANY')) and bool(record.get('TITLE')), 'company/title required')
            require(https(record.get('SOURCE_URL')), 'valid source URL required')
    elif action == 'batch':
        require(bool(value.get('requestId')), 'batch requestId required')
        requests = value.get('requests')
        require(isinstance(requests, list) and 1 <= len(requests) <= 25, 'batch must contain 1..25 requests')
        ids = []
        for request in requests:
            require(isinstance(request, dict) and request.get('action') == 'ruling', 'homogeneous ENRICH batch required')
            validate_payload(request)
            ids.append(request['ruling']['requestId'])
        require(len(ids) == len(set(ids)), 'duplicate request identities')
    elif action == 'ruling':
        ruling = value.get('ruling')
        require(isinstance(ruling, dict), 'ruling fields must be nested')
        require(ruling.get('kind') == 'ENRICH', 'only ENRICH examples allowed')
        require(bool(ruling.get('requestId')) and bool(ruling.get('primaryId')), 'request/primary identity required')
        require(ruling.get('actor') in PROVIDERS.values(), 'invalid actor')
        fields = ruling.get('fields')
        require(isinstance(fields, dict) and bool(fields), 'nonempty fields required')
        for key, val in fields.items():
            require(isinstance(key, str) and re.fullmatch(r'[A-Z][A-Z0-9_]*', key), 'upper-case keys required')
            require(key not in FORBIDDEN, 'protected identity/state field: ' + key)
            if key == 'SOURCE_URL' or key.endswith('_URL'):
                require(https(val), 'invalid evidence URL: ' + key)
    elif action == 'upsert_application':
        events = value.get('events')
        require(isinstance(events, list) and 1 <= len(events) <= 25, 'application batch must contain 1..25 events')
        ids = []
        for event in events:
            require(isinstance(event, dict), 'event must be an object')
            require(event.get('STATE') in ('APPLIED', 'REJECTED_BY_EMPLOYER'), 'invalid application state')
            require(all(event.get(k) for k in ('requestId', 'COMPANY', 'TITLE', 'EVENT_DATE', 'EVIDENCE')), 'application identity/evidence missing')
            require(https(event.get('SOURCE_URL')), 'valid application evidence URL required')
            ids.append(event['requestId'])
        require(len(ids) == len(set(ids)), 'duplicate application identities')
    else:
        raise ValueError('unsupported producer action: ' + str(action))


def select_task(manifest, provider, task, et_hour):
    require(provider in PROVIDERS, 'unknown provider')
    if task == 'ROTATION':
        require(type(et_hour) is int and 0 <= et_hour < 24, 'America/New_York hour required')
        task = manifest['rotations'].get(provider, {}).get(str(et_hour))
        require(task is not None, 'no rotation slot; do not guess a lane')
    require(task in manifest['lanes'], 'unknown task')
    lane = manifest['lanes'][task]
    return task, lane['owner'] == provider


def verified(result_success, index_complete, after_complete, row_matches):
    # Flags must be independent observed facts, not truthy status strings.
    return all(v is True for v in (result_success, index_complete, after_complete, row_matches))


def build(root=ROOT):
    source = root / 'policy/current'
    registry = json.loads((source / 'registry.json').read_text(encoding='utf-8'))
    require(set(registry['lanes']) == TASKS, 'all six production lanes required')
    require(set(registry['adapters']) == set(PROVIDERS), 'all provider adapters required')
    for rule in registry['provenance']:
        require(rule['classification'] in ('audit_only', 'conditional'), 'unbounded instruction dependency')
        require((root / rule['path']).is_file(), 'missing provenance source')
    for provider, hours in registry['rotations'].items():
        require(provider in PROVIDERS, 'invalid rotation provider')
        require(all(h.isdigit() and 0 <= int(h) < 24 and t in TASKS for h, t in hours.items()), 'invalid rotation mapping')
    inputs = sorted([p for p in source.rglob('*') if p.is_file()] +
                    list((root / 'examples').glob('*.json')) +
                    [root / 'scripts/build_runtime.py', root / 'schemas/runtime-manifest.schema.json'])
    input_hashes = {p.relative_to(root).as_posix(): digest(p.read_bytes()) for p in inputs}
    release = digest(canonical(input_hashes))[:20]
    prefix = f'runtime/releases/{release}/'
    outputs = {}

    def render(name, provider, task):
        path = PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and path.suffix == '.txt', 'invalid source path')
        text = (source / name).read_text(encoding='utf-8')
        values = {'PROVIDER': provider, 'ACTOR': PROVIDERS[provider], 'TASK_KEY': task,
                  'RUN_ID': 'FORGE-EXAMPLE-' + PROVIDERS[provider] + '-20261018-1500ET'}
        for key, value in values.items():
            text = text.replace('{{' + key + '}}', value)
        require('{{' not in text, 'unresolved template in ' + name)
        return text.strip() + '\n'

    packet_meta = {}
    for provider, name in registry['adapters'].items():
        render(name, provider, 'ADAPTER')
    for task, lane in registry['lanes'].items():
        owner = lane['owner']
        require(owner in PROVIDERS, 'invalid lane owner')
        chunks = [f'RELEASE_ID={release}\nTASK_KEY={task}\nPROVIDER={owner}\nPOLICY_REVISION={registry["policy_revision"]}\n']
        chunks.extend(render(name, owner, task) for name in registry['common'])
        chunks.append(render(registry['adapters'][owner], owner, task))
        chunks.append(render(lane['source'], owner, task))
        for example in lane['examples']:
            text = (root / 'examples' / example).read_text(encoding='utf-8')
            for key, value in {'ACTOR': PROVIDERS[owner], 'PROVIDER': owner, 'RUN_ID': 'FORGE-EXAMPLE-' + PROVIDERS[owner] + '-20261018-1500ET'}.items():
                text = text.replace('{{' + key + '}}', value)
            validate_payload(json.loads(text))
            chunks.append('PAYLOAD EXAMPLE (replace observed values and run identity):\n' + text)
        data = ('\n'.join(chunks)).encode()
        estimated = (len(data.decode()) + 3) // 4
        require(estimated <= lane['max_estimated_tokens'], f'{task}: {estimated} estimated tokens exceeds {lane["max_estimated_tokens"]}')
        require(b'RESULT SUCCESS' in data and b'COMPLETE' in data and b'AFTER COMPLETE' in data, 'missing three-proof contract')
        require(b'read the full CONTROL' not in data and b'full READ ORDER' not in data, 'recursive fallback')
        path = prefix + task + '.txt'
        outputs[path] = data
        packet_meta[task] = {'owner': owner, 'file': task + '.txt', 'sha256': digest(data), 'blob_sha': blob_sha(data), 'estimated_tokens': estimated}
    addons = {}
    for key, addon in registry['addons'].items():
        require(addon['parent'] in TASKS and registry['lanes'][addon['parent']]['owner'] == addon['owner'], 'addon ownership drift')
        data = (f'RELEASE_ID={release}\nPARENT_TASK={addon["parent"]}\n' + render(addon['source'], addon['owner'], addon['parent'])).encode()
        require((len(data.decode()) + 3) // 4 <= addon['max_estimated_tokens'], 'addon size budget')
        outputs[prefix + key + '.txt'] = data
        addons[key] = {'parent': addon['parent'], 'file': key + '.txt', 'sha256': digest(data), 'blob_sha': blob_sha(data)}
    manifest = {'schema_version': 1, 'release_id': release, 'policy_revision': registry['policy_revision'],
                'base_url': RAW + prefix, 'writer_minimum': registry['writer_minimum'],
                'external_rules': registry['external_rules'],
                'rotations': registry['rotations'], 'lanes': packet_meta, 'addons': addons}
    validate_manifest(manifest)
    outputs[prefix + 'manifest.json'] = canonical(manifest)
    outputs[prefix + 'provenance.json'] = canonical({'inputs': input_hashes, 'basis': registry['source_basis'], 'references': registry['provenance']})
    outputs['runtime/current.json'] = canonical(manifest)
    outputs['control/FORGE_AUTOMATION_ENTRY.txt'] = (source / 'ENTRY.txt').read_bytes()
    legacy = {
        'COMMON_GROK.txt': None,
        'GROK_FORGE_ENRICH_STRATEGIC.txt': 'FORGE_ENRICH_STRATEGIC',
        'GROK_FORGE_ENRICH_FEASIBILITY.txt': 'FORGE_ENRICH_FEASIBILITY',
        'GROK_FORGE_WEB_CAREER_DISCOVERY.txt': 'FORGE_WEB_CAREER_DISCOVERY',
        'CHATGPT_FORGE_POSTING_VALIDATION.txt': 'FORGE_POSTING_VALIDATION',
        'CHATGPT_ZIPRECRUITER_PASS.txt': 'FORGE_ZIPRECRUITER_WEEKLY',
    }
    for filename, task in legacy.items():
        target = task or 'your assigned TASK_KEY (ROTATION resolves through the manifest)'
        outputs['lanes/' + filename] = (
            'LEGACY POINTER; generated, do not edit.\n'
            'Use control/FORGE_AUTOMATION_ENTRY.txt VERSION ' + registry['policy_revision'] + '.\n'
            'PROVIDER remains the actual executing provider; TASK_KEY=' + target + '.\n'
            'Read the fresh runtime/current.json manifest and only its selected immutable packet.\n'
            'This file grants no ownership and adds no full CONTROL/STANDARD read or cached fallback.\n'
            'ZipRecruiter is its own weekly ChatGPT lane, FORGE_ZIPRECRUITER_WEEKLY (REV-021).\n'
        ).encode()
    return outputs, manifest


def validate_manifest(manifest):
    required = {'schema_version', 'release_id', 'policy_revision', 'base_url', 'writer_minimum', 'external_rules', 'rotations', 'lanes', 'addons'}
    require(set(manifest) == required, 'missing or unknown manifest fields')
    require(manifest.get('schema_version') == 1, 'unsupported manifest schema')
    require(bool(re.fullmatch(r'[0-9a-f]{20}', manifest.get('release_id', ''))), 'invalid release id')
    require(manifest.get('base_url') == RAW + 'runtime/releases/' + manifest['release_id'] + '/', 'invalid release URL')
    require(set(manifest.get('lanes', {})) == TASKS, 'missing lane')
    rules = manifest['external_rules']
    require(rules.get('repository') == 'tpruittguitar/forge-policy' and rules.get('path') == 'rules/TIM_PIPELINE_RULES_CANONICAL.txt', 'invalid policy binding')
    require(bool(re.fullmatch(r'[0-9a-f]{40}', rules.get('blob_sha', ''))), 'invalid policy fingerprint')
    for task, lane in manifest['lanes'].items():
        require(lane.get('owner') in PROVIDERS, 'invalid owner')
        require(lane.get('file') == task + '.txt', 'packet traversal or task mismatch')
        require(bool(re.fullmatch(r'[0-9a-f]{64}', lane.get('sha256', ''))), 'invalid packet hash')
        require(bool(re.fullmatch(r'[0-9a-f]{40}', lane.get('blob_sha', ''))), 'invalid packet blob SHA')
        require(type(lane.get('estimated_tokens')) is int and lane['estimated_tokens'] > 0, 'invalid size estimate')
    for addon in manifest['addons'].values():
        require(addon.get('parent') in TASKS, 'unknown addon parent')
        require(re.fullmatch(r'[A-Z_]+\.txt', addon.get('file','')), 'invalid addon file')
        require(re.fullmatch(r'[0-9a-f]{64}', addon.get('sha256','')), 'invalid addon hash')
    for provider, hours in manifest['rotations'].items():
        require(provider in PROVIDERS and all(h.isdigit() and 0 <= int(h) < 24 and t in TASKS for h,t in hours.items()), 'invalid rotation')


def verify_packet(manifest, task, provider, data):
    validate_manifest(manifest)
    require(task in manifest['lanes'], 'unknown task')
    lane = manifest['lanes'][task]
    require(lane['owner'] == provider, 'provider does not own lane')
    require(digest(data) == lane['sha256'] and blob_sha(data) == lane['blob_sha'], 'packet hash mismatch')
    text = data.decode('utf-8')
    require(text.startswith(f'RELEASE_ID={manifest["release_id"]}\nTASK_KEY={task}\nPROVIDER={provider}\n'), 'mixed release/task/provider')
    return True


def publish(root, outputs, check=False):
    # Validate everything before writing; current.json is always published last.
    for name, data in outputs.items():
        path = root / name
        if check:
            require(path.is_file() and path.read_bytes() == data, 'generated file stale: ' + name)
        elif name.startswith('runtime/releases/'):
            require(not path.exists() or path.read_bytes() == data, 'immutable release changed: ' + name)
    if not check:
        for name in sorted(outputs, key=lambda n: n == 'runtime/current.json'):
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(outputs[name])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        outputs, manifest = build()
        publish(ROOT, outputs, args.check)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        print('RUNTIME INVALID: ' + str(exc), file=sys.stderr)
        return 1
    print(('Checked ' if args.check else 'Built ') + manifest['release_id'])
    for task, lane in manifest['lanes'].items():
        print(f'{task}: {lane["owner"]}, ~{lane["estimated_tokens"]} tokens')
    return 0


if __name__ == '__main__':
    sys.exit(main())
