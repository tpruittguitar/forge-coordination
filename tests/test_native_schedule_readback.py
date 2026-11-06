import importlib.util, json, pathlib, tempfile, unittest

spec=importlib.util.spec_from_file_location('read_native',pathlib.Path(__file__).parents[1]/'tools/automation-health/read-native.py')
native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)

class NativeReadback(unittest.TestCase):
    def test_configuration_is_read_without_modification_or_execution_claim(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);(root/'state').mkdir();(root/'control').mkdir();(root/'native/lane').mkdir(parents=True)
            file=root/'native/lane/automation.toml'
            prompt='PROVIDER=ChatGPT TASK_KEY=FORGE_TEST. Read fresh '+native.ENTRY+'?cb=<epoch>'
            raw=('id="lane"\nname="Lane"\nstatus="ACTIVE"\nrrule="RRULE:FREQ=HOURLY;BYMINUTE=22"\nprompt='+json.dumps(prompt)+'\ntarget_thread_id="dedicated"\nupdated_at=123\n').encode()
            file.write_bytes(raw)
            (root/'control/NATIVE_AUTOMATION_BINDINGS.json').write_text(json.dumps({'schema':'forge.native-automation-bindings.v1','bindings':[{'scope':'LOCAL_CODEX','nativeId':'lane','taskKey':'FORGE_TEST','provider':'ChatGPT','targetThreadId':'dedicated'}]}))
            (root/'state/AUTOMATION_SCHEDULE_READBACK.json').write_text(json.dumps({'local':[{'id':'lane'}],'executionVerified':True}))
            result=native.read_native(root,root/'native')
            saved=json.loads((root/'state/AUTOMATION_SCHEDULE_READBACK.json').read_text())
            self.assertEqual(file.read_bytes(),raw);self.assertFalse(saved['executionVerified'])
            self.assertEqual(result['active'],1);self.assertTrue(result['allSharedEntry'])
            self.assertTrue(result['configurationAligned']);self.assertTrue(saved['local'][0]['managed'])
            self.assertEqual(len(saved['local'][0]['nativeConfigurationSha256']),64)

    def test_missing_native_file_preserves_prior_evidence(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);(root/'state').mkdir()
            file=root/'state/AUTOMATION_SCHEDULE_READBACK.json';raw=json.dumps({'local':[{'id':'missing'}]})
            file.write_text(raw)
            with self.assertRaisesRegex(ValueError,'directory unavailable'):native.read_native(root,root/'native')
            self.assertEqual(file.read_text(),raw)
