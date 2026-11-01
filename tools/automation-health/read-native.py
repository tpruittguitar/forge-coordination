"""Read native configuration without changing schedules or claiming execution."""
import argparse, datetime, hashlib, json, os, pathlib, tomllib

def read_native(root, native_dir):
    path = pathlib.Path(root) / 'state/AUTOMATION_SCHEDULE_READBACK.json'
    prior = json.loads(path.read_text(encoding='utf-8'))
    local = []
    for old in prior['local']:
        file = pathlib.Path(native_dir) / old['id'] / 'automation.toml'
        raw = file.read_bytes()
        item = tomllib.loads(raw.decode('utf-8-sig'))
        if item.get('id') != old['id']:
            raise ValueError('Native automation identity mismatch')
        local.append({k: item.get(k) for k in ('id','name','status','rrule','target_thread_id')} | {
            'nativeUpdatedAt': str(item.get('updated_at','')),
            'sharedEntry': 'control/FORGE_SHARED_AUTOMATION_ENTRY.txt' in item.get('prompt',''),
            'nativeConfigurationSha256': hashlib.sha256(raw).hexdigest()})
    prior.update(at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),
                 local=local, executionVerified=False,
                 observationMethod='Read local Codex automation.toml files; configuration only')
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(prior, indent=2)+'\n', encoding='utf-8')
    tmp.replace(path)
    return {'read':len(local),'active':sum(x['status']=='ACTIVE' for x in local),
            'allSharedEntry':all(x['sharedEntry'] for x in local),'at':prior['at']}

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('root',nargs='?',default='.')
    p.add_argument('--native-dir',default=str(pathlib.Path(os.environ.get('CODEX_HOME',pathlib.Path.home()/'.codex'))/'automations'))
    a=p.parse_args();print(json.dumps(read_native(a.root,a.native_dir)))
