"""Discover native configuration; compare bindings without changing native tasks."""
import argparse, datetime, hashlib, json, os, pathlib, re, tomllib, urllib.parse

ENTRY = 'https://raw.githubusercontent.com/tpruittguitar/forge-coordination/main/control/FORGE_SHARED_AUTOMATION_ENTRY.txt'

def identity(prompt, field):
    # Existing local launchers use one line; cloud launchers use separate lines.
    # Parse the exact token, not a prefix or an arbitrary substring of a name.
    matches = re.findall(r'(?:^|\s)' + field + r'=([A-Za-z][A-Za-z0-9_]*)\b', prompt)
    return matches[0].strip() if len(matches) == 1 else None

def shared_entry(prompt):
    for raw in re.findall(r'https://[^\s]+', prompt):
        parsed = urllib.parse.urlsplit(raw.rstrip('.,);'))
        if urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, '', '')) == ENTRY:
            return True
    return False

def read_native(root, native_dir):
    root, native_dir = pathlib.Path(root), pathlib.Path(native_dir)
    path = root / 'state/AUTOMATION_SCHEDULE_READBACK.json'
    prior = json.loads(path.read_text(encoding='utf-8'))
    binding_file = root / 'control/NATIVE_AUTOMATION_BINDINGS.json'
    bindings = json.loads(binding_file.read_text()) if binding_file.exists() else {'bindings': []}
    if bindings.get('schema', 'forge.native-automation-bindings.v1') != 'forge.native-automation-bindings.v1':
        raise ValueError('Unsupported native task bindings')
    enrolled = bindings['bindings']
    if len({(b['scope'], b['nativeId']) for b in enrolled}) != len(enrolled) or len({b['taskKey'] for b in enrolled}) != len(enrolled):
        raise ValueError('Ambiguous native task bindings; no arbitrary binding selected')
    expected = {b['nativeId']: b for b in enrolled if b['scope'] == 'LOCAL_CODEX'}
    local, discrepancies, informational, seen = [], [], [], set()
    if not native_dir.is_dir():
        raise ValueError('Native automation directory unavailable; no empty inventory inferred')
    def problem(code, native_id, **details):
        discrepancies.append({'code': code, 'nativeId': native_id, **details})
    # These compatibility fields describe the same binding, not another source
    # of enrollment authority. Surface drift instead of silently trusting a copy.
    copies = [('control/AI_AUTOMATION_TASKS.json', lambda d, key: d.get('tasks', {}).get(key, {})),
              ('control/ENRICHMENT_RESEARCH_OWNER.json', lambda d, key: d if d.get('taskKey') == key else {}),
              ('control/AUTOMATION_OPERATING_MODEL.json', lambda d, key: d.get('chatgptEnrichmentResearchNative', {}) if d.get('chatgptEnrichmentResearchNative', {}).get('taskKey') == key else {})]
    for relative, select in copies:
        if not (root / relative).exists():
            continue
        data = json.loads((root / relative).read_text())
        for binding in bindings['bindings']:
            copy = select(data, binding['taskKey'])
            if copy.get('nativeId') and copy['nativeId'] != binding['nativeId']:
                problem('REGISTRY_BINDING_DRIFT', binding['nativeId'], taskKey=binding['taskKey'], source=relative,
                        expected=binding['nativeId'], actual=copy['nativeId'])
    for file in sorted(native_dir.glob('*/automation.toml')):
        native_id = file.parent.name
        try:
            raw = file.read_bytes()
            item = tomllib.loads(raw.decode('utf-8-sig'))
            if item.get('id') != native_id:
                raise ValueError('Native directory and task ID differ')
        except (OSError, ValueError) as error:
            if native_id in expected or native_id.startswith(('forge-', 'pe-stack-')):
                problem('UNREADABLE_NATIVE_CONFIGURATION', native_id, reason=str(error))
            else:
                informational.append({'code': 'UNREADABLE_UNMANAGED_CONFIGURATION', 'nativeId': native_id})
            continue
        seen.add(native_id)
        prompt = item.get('prompt', '')
        task_key, provider = identity(prompt, 'TASK_KEY'), identity(prompt, 'PROVIDER')
        shared = shared_entry(prompt)
        observed = {k: item.get(k) for k in ('id', 'name', 'status', 'rrule', 'target_thread_id')}
        observed.update(taskKey=task_key, provider=provider, nativeUpdatedAt=str(item.get('updated_at', '')),
                        sharedEntry=shared, nativeConfigurationSha256=hashlib.sha256(raw).hexdigest())
        binding = expected.get(native_id)
        forge_task = bool(task_key and task_key.startswith(('FORGE_', 'PE_STACK_'))) or native_id.startswith(('forge-', 'pe-stack-')) or str(item.get('name', '')).startswith(('FORGE_', 'PE_STACK_'))
        managed = bool(binding) or (item.get('status') == 'ACTIVE' and forge_task)
        observed['managed'] = managed
        if not binding:
            if managed:
                problem('UNREGISTERED_NATIVE_TASK', native_id, taskKey=task_key)
            else:
                informational.append({'code': 'INACTIVE_UNREGISTERED_TASK' if forge_task else 'OUTSIDE_MANAGED_SCOPE', 'nativeId': native_id, 'taskKey': task_key, 'status': item.get('status')})
        else:
            for field, actual, wanted in [('TASK_KEY', task_key, binding['taskKey']), ('PROVIDER', provider, binding['provider']),
                                         ('TARGET_THREAD', item.get('target_thread_id'), binding['targetThreadId'])]:
                if actual != wanted:
                    problem(field + '_MISMATCH', native_id, expected=wanted, actual=actual)
            if not shared:
                problem('SHARED_ENTRY_MISMATCH', native_id)
        local.append(observed)
    for native_id, binding in expected.items():
        if native_id not in seen:
            problem('MISSING_REGISTERED_NATIVE_TASK', native_id, taskKey=binding['taskKey'])
    by_task = {}
    for item in local:
        if item['managed'] and item['status'] == 'ACTIVE' and item['taskKey']:
            by_task.setdefault(item['taskKey'], []).append(item['id'])
    for task_key, ids in by_task.items():
        if len(ids) > 1:
            problem('DUPLICATE_ACTIVE_TASK_KEY', None, taskKey=task_key, nativeIds=ids)
    at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    prior.update(at=at, local=local, executionVerified=False, configurationReadbackScope='LOCAL_CODEX_ONLY',
                 observationMethod='Enumerated all local automation.toml files; configuration only',
                 configurationDiscrepancies=discrepancies, configurationInformational=informational, configurationAligned=not discrepancies,
                 observationScopes={'LOCAL_CODEX': {'status': 'READ', 'at': at},
                                    'CLOUD_AUTOMATIONS': {'status': 'NOT_READ', 'reason': 'Local files cannot establish cloud task configuration'}})
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(prior, indent=2)+'\n', encoding='utf-8')
    tmp.replace(path)
    managed = [x for x in local if x['managed']]
    return {'read': len(local), 'active': sum(x['status'] == 'ACTIVE' for x in managed),
            'discoveredActive': sum(x['status'] == 'ACTIVE' for x in local),
            'allSharedEntry': bool(managed) and all(x['sharedEntry'] for x in managed),
            'configurationAligned': not discrepancies, 'discrepancies': discrepancies, 'at': at,
            'scope': 'LOCAL_CODEX_ONLY', 'cloudConfigurationVerified': False}

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('root',nargs='?',default='.')
    p.add_argument('--native-dir',default=str(pathlib.Path(os.environ.get('CODEX_HOME',pathlib.Path.home()/'.codex'))/'automations'))
    a=p.parse_args();print(json.dumps(read_native(a.root,a.native_dir)))
