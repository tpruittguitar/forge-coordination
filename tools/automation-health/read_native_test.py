import importlib.util, json, pathlib, tempfile, unittest
spec=importlib.util.spec_from_file_location('native', pathlib.Path(__file__).with_name('read-native.py'))
native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)

class NativeInventoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=pathlib.Path(self.tmp.name);(self.root/'state').mkdir();(self.root/'control').mkdir();self.directory=self.root/'native';self.directory.mkdir()
        (self.root/'state/AUTOMATION_SCHEDULE_READBACK.json').write_text(json.dumps({'local':[{'id':'old'}]}))
        (self.root/'control/NATIVE_AUTOMATION_BINDINGS.json').write_text(json.dumps({'schema':'forge.native-automation-bindings.v1','bindings':[{'scope':'LOCAL_CODEX','nativeId':'replacement','taskKey':'TASK','provider':'ChatGPT','targetThreadId':'dedicated'}]}))
    def task(self, native_id, key='TASK', provider='ChatGPT', target='dedicated'):
        d=self.directory/native_id;d.mkdir()
        prompt=f'PROVIDER={provider}\nTASK_KEY={key}\nSHARED_ENTRY={native.ENTRY}'
        (d/'automation.toml').write_text(f'id={json.dumps(native_id)}\nstatus="ACTIVE"\nprompt={json.dumps(prompt)}\ntarget_thread_id={json.dumps(target)}\n')
    def test_replacement_discovered_without_prior_id_and_cloud_scope_explicit(self):
        self.task('replacement');result=native.read_native(self.root,self.directory)
        self.assertTrue(result['configurationAligned']);self.assertEqual(result['read'],1)
        saved=json.loads((self.root/'state/AUTOMATION_SCHEDULE_READBACK.json').read_text())
        self.assertEqual(saved['local'][0]['id'],'replacement');self.assertEqual(saved['observationScopes']['CLOUD_AUTOMATIONS']['status'],'NOT_READ')
    def test_duplicate_wrong_identity_and_target_do_not_hide_behind_shared_entry(self):
        self.task('replacement',key='FORGE_WRONG',provider='Other',target='repair-chat');self.task('extra',key='FORGE_WRONG')
        result=native.read_native(self.root,self.directory);codes={x['code'] for x in result['discrepancies']}
        self.assertTrue(result['allSharedEntry']);self.assertFalse(result['configurationAligned'])
        self.assertTrue({'TASK_KEY_MISMATCH','PROVIDER_MISMATCH','TARGET_THREAD_MISMATCH','UNREGISTERED_NATIVE_TASK','DUPLICATE_ACTIVE_TASK_KEY'}<=codes)
    def test_missing_expected_task_reported_and_bad_file_does_not_hide_valid_tasks(self):
        self.task('extra');d=self.directory/'forge-bad';d.mkdir();(d/'automation.toml').write_text('not toml = [')
        result=native.read_native(self.root,self.directory)
        self.assertEqual(result['read'],1);self.assertIn('MISSING_REGISTERED_NATIVE_TASK',{x['code'] for x in result['discrepancies']})
        self.assertIn('UNREADABLE_NATIVE_CONFIGURATION',{x['code'] for x in result['discrepancies']})
    def test_missing_directory_is_not_an_empty_successful_inventory(self):
        with self.assertRaises(ValueError):native.read_native(self.root,self.root/'missing')
    def test_existing_single_line_native_launcher_and_cache_buster(self):
        self.task('replacement');file=self.directory/'replacement/automation.toml'
        prompt=f'PROVIDER=ChatGPT TASK_KEY=TASK. Read fresh {native.ENTRY}?cb=<epoch> and follow the procedure.'
        file.write_text('id="replacement"\nstatus="ACTIVE"\ntarget_thread_id="dedicated"\nprompt='+json.dumps(prompt)+'\n')
        self.assertTrue(native.read_native(self.root,self.directory)['configurationAligned'])
    def test_duplicate_identity_tokens_are_ambiguous(self):
        self.assertIsNone(native.identity('TASK_KEY=FIRST TASK_KEY=SECOND','TASK_KEY'))
        self.assertFalse(native.shared_entry(native.ENTRY+'.evil'))
    def test_compatibility_registry_copy_cannot_silently_disagree_with_current_binding(self):
        self.task('replacement');(self.root/'control/AI_AUTOMATION_TASKS.json').write_text(json.dumps({'tasks':{'TASK':{'nativeId':'retired-id'}}}))
        result=native.read_native(self.root,self.directory)
        self.assertIn('REGISTRY_BINDING_DRIFT',{d['code'] for d in result['discrepancies']})
    def test_ambiguous_expected_binding_fails_instead_of_overwriting_a_mapping(self):
        p=self.root/'control/NATIVE_AUTOMATION_BINDINGS.json';data=json.loads(p.read_text());data['bindings'].append({**data['bindings'][0],'taskKey':'OTHER'});p.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError,'Ambiguous'):native.read_native(self.root,self.directory)
    def test_personal_and_inactive_unregistered_tasks_remain_inventory_only(self):
        self.task('replacement');self.task('personal',key='PERSONAL_REMINDER');self.task('forge-retired',key='FORGE_OLD')
        p=self.directory/'forge-retired/automation.toml';p.write_text(p.read_text().replace('status="ACTIVE"','status="PAUSED"'))
        result=native.read_native(self.root,self.directory);saved=json.loads((self.root/'state/AUTOMATION_SCHEDULE_READBACK.json').read_text())
        self.assertTrue(result['configurationAligned']);self.assertEqual(result['read'],3);self.assertEqual(result['active'],1);self.assertEqual(result['discoveredActive'],2)
        self.assertEqual(len(saved['configurationInformational']),2);self.assertEqual([x['id'] for x in saved['local'] if x['managed']],['replacement'])

if __name__=='__main__':unittest.main()
