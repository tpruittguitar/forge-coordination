"""Offline integration tests. All repos and managed pools live in temp directories."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('research_workspace', Path(__file__).resolve().parents[1] / 'scripts/research_workspace.py')
w = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(w)


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.origin = self.base / 'origin'
        self.origin.mkdir()
        self.run_git(self.origin, 'init', '-b', 'main')
        self.run_git(self.origin, 'config', 'user.email', 'test@example.invalid')
        self.run_git(self.origin, 'config', 'user.name', 'Test')
        (self.origin / 'evidence.txt').write_text('retained evidence\n' * 100)
        (self.origin / '.gitignore').write_text('ignored.txt\n')
        self.run_git(self.origin, 'add', '.')
        self.run_git(self.origin, 'commit', '-m', 'initial')
        self.sha = self.run_git(self.origin, 'rev-parse', 'HEAD')
        self.root = self.base / 'pool'
        w.init(self.root, str(self.origin), min_free_bytes=0, max_pool_bytes=10**8)

    def run_git(self, repo, *args):
        return subprocess.check_output(['git', '-C', str(repo), *args], stderr=subprocess.DEVNULL).decode().strip()

    def acquire(self):
        return w.acquire(self.root, 'hourly-task', self.sha, 10000)

    def release(self, lease):
        return w.release(self.root, lease['slot'], lease['token'], True)

    def test_release_reuse_keeps_one_checkout_and_objects(self):
        for _ in range(3):
            lease = self.acquire()
            repo = Path(lease['checkout'])
            self.assertTrue((repo / 'evidence.txt').is_file())
            self.assertEqual(self.run_git(repo, 'rev-parse', '--is-shallow-repository'), 'true')
            self.assertEqual(self.run_git(repo, 'config', '--get', 'gc.auto'), '0')
            self.assertEqual(self.run_git(repo, 'config', '--get', 'maintenance.auto'), 'false')
            self.release(lease)
            self.assertFalse((repo / 'evidence.txt').exists())
            self.assertIn('retained evidence', self.run_git(repo, 'show', f'{self.sha}:evidence.txt'))
        self.assertEqual(len(list(self.root.glob('slot-*'))), 1)

    def test_active_collision_and_stale_token(self):
        lease = self.acquire()
        with self.assertRaisesRegex(w.Unsafe, 'all bounded slots'):
            self.acquire()
        with self.assertRaises(w.Unsafe):
            w.release(self.root, lease['slot'], 'wrong', True)
        with self.assertRaises(w.Unsafe):
            w.release(self.root, lease['slot'], lease['token'])
        self.release(lease)
        new = self.acquire()
        with self.assertRaises(w.Unsafe):
            self.release(lease)
        self.release(new)

    def test_dirty_untracked_ignored_preserved(self):
        lease = self.acquire()
        repo = Path(lease['checkout'])
        for name in ('evidence.txt', 'untracked.txt', 'ignored.txt'):
            p = repo / name
            original = p.read_bytes() if p.exists() else None
            p.write_text('important user data')
            with self.assertRaises(w.Unsafe):
                self.release(lease)
            self.assertEqual(p.read_text(), 'important user data')
            if original is None:
                p.unlink()  # Test fixture cleanup, never production helper behavior.
            else:
                p.write_bytes(original)
        self.release(lease)

    def test_hidden_index_edit_preserved(self):
        lease = self.acquire()
        repo = Path(lease['checkout'])
        self.run_git(repo, 'update-index', '--skip-worktree', 'evidence.txt')
        (repo / 'evidence.txt').write_text('hidden edit')
        with self.assertRaises(w.Unsafe):
            self.release(lease)
        self.assertEqual((repo / 'evidence.txt').read_text(), 'hidden edit')

    def test_unpublished_commit_preserved(self):
        lease = self.acquire()
        repo = Path(lease['checkout'])
        self.run_git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'unpublished')
        unpublished = self.run_git(repo, 'rev-parse', 'HEAD')
        with self.assertRaises(w.Unsafe):
            self.release(lease)
        self.assertEqual(self.run_git(repo, 'rev-parse', 'HEAD'), unpublished)
        self.assertTrue((repo / 'evidence.txt').exists())

    def test_linked_worktree_preserved(self):
        lease = self.acquire()
        repo = Path(lease['checkout'])
        other = self.base / 'user-worktree'
        self.run_git(repo, 'worktree', 'add', '--detach', str(other), 'HEAD')
        with self.assertRaisesRegex(w.Unsafe, 'worktrees'):
            self.release(lease)
        self.assertTrue((other / 'evidence.txt').exists())

    def test_low_disk_and_budget_fail_before_checkout(self):
        with patch.object(w.shutil, 'disk_usage', return_value=type('Disk', (), {'free': 1})()):
            with self.assertRaisesRegex(w.Unsafe, 'disk floor'):
                self.acquire()
        with self.assertRaisesRegex(w.Unsafe, 'byte budget'):
            w.acquire(self.root, 'task', self.sha, 10**9)
        self.assertEqual(list(self.root.glob('slot-*')), [])

    def test_inode_shortage_preserves_failed_slot_without_checkout(self):
        with patch.object(w, 'available_inodes', return_value=1):
            with self.assertRaisesRegex(w.Unsafe, 'inode budget'):
                self.acquire()
        self.assertFalse((self.root / 'slot-0' / 'evidence.txt').exists())
        self.assertEqual(w.read(self.root)['leases']['0']['state'], 'failed')

    def test_actual_tree_budget_checked_before_materialization(self):
        data = w.read(self.root)
        data['max_pool_bytes'] = 100000
        w.save(self.root, data)
        # The caller's estimate cannot bypass checking the actual tracked tree size.
        (self.origin / 'large').write_bytes(b'x' * 200000)
        self.run_git(self.origin, 'add', '.')
        self.run_git(self.origin, 'commit', '-m', 'large')
        self.sha = self.run_git(self.origin, 'rev-parse', 'HEAD')
        with self.assertRaisesRegex(w.Unsafe, 'byte budget'):
            self.acquire()
        self.assertFalse((self.root / 'slot-0' / 'large').exists())
        self.assertEqual(w.read(self.root)['leases']['0']['state'], 'failed')

    def test_failed_fetch_retains_lease_and_never_retries(self):
        data = w.read(self.root)
        data['origin'] = str(self.base / 'absent')
        w.save(self.root, data)
        with self.assertRaisesRegex(w.Unsafe, 'token='):
            self.acquire()
        failed = w.read(self.root)['leases']['0']
        self.assertEqual(failed['state'], 'failed')
        with patch.object(w, 'git', side_effect=AssertionError('must not retry fetch')):
            with self.assertRaisesRegex(w.Unsafe, 'all bounded slots'):
                self.acquire()

    def test_low_free_release_unchanged_head(self):
        lease = self.acquire()
        with patch.object(w.shutil, 'disk_usage', return_value=type('Disk', (), {'free': 0})()):
            self.release(lease)
        self.assertFalse((Path(lease['checkout']) / 'evidence.txt').exists())

    def test_low_free_release_published_tip(self):
        bare = self.base / 'bare.git'
        self.run_git(self.base, 'clone', '--bare', str(self.origin), str(bare))
        data = w.read(self.root)
        data['origin'] = str(bare)
        data['min_free_bytes'] = 1000
        w.save(self.root, data)
        lease = self.acquire()
        repo = Path(lease['checkout'])
        self.run_git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                     'commit', '--allow-empty', '-m', 'published receipt')
        self.run_git(repo, 'push', 'origin', 'HEAD:main')
        with patch.object(w.shutil, 'disk_usage', return_value=type('Disk', (), {'free': 0})()):
            self.release(lease)
        self.assertFalse((repo / 'evidence.txt').exists())

    def test_published_detached_commit_then_remote_advance(self):
        # Use a bare remote so a detached lane commit can push main normally.
        bare = self.base / 'bare.git'
        self.run_git(self.base, 'clone', '--bare', str(self.origin), str(bare))
        data = w.read(self.root)
        data['origin'] = str(bare)
        w.save(self.root, data)
        lease = self.acquire()
        repo = Path(lease['checkout'])
        (repo / 'receipt.txt').write_text('published evidence')
        self.run_git(repo, 'add', 'receipt.txt')
        self.run_git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                     'commit', '-m', 'receipt')
        published = self.run_git(repo, 'rev-parse', 'HEAD')
        self.run_git(repo, 'push', 'origin', 'HEAD:main')
        other = self.base / 'other-lane'
        self.run_git(self.base, 'clone', str(bare), str(other))
        self.run_git(other, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                     'commit', '--allow-empty', '-m', 'other lane')
        self.run_git(other, 'push', 'origin', 'main')
        self.release(lease)
        self.assertFalse((repo / 'receipt.txt').exists())
        self.assertEqual(self.run_git(repo, 'show', published + ':receipt.txt'), 'published evidence')

    def test_acquire_pins_resolved_sha_when_main_advances(self):
        self.run_git(self.origin, 'commit', '--allow-empty', '-m', 'bootstrap race')
        lease = self.acquire()
        self.assertEqual(self.run_git(Path(lease['checkout']), 'rev-parse', 'HEAD'), self.sha)
        self.release(lease)

    def test_release_after_remote_advances(self):
        lease = self.acquire()
        (self.origin / 'new.txt').write_text('new evidence')
        self.run_git(self.origin, 'add', '.')
        self.run_git(self.origin, 'commit', '-m', 'remote advanced')
        self.release(lease)
        self.assertFalse((Path(lease['checkout']) / 'evidence.txt').exists())
        self.sha = self.run_git(self.origin, 'rev-parse', 'HEAD')
        new = self.acquire()
        self.assertTrue((Path(new['checkout']) / 'new.txt').exists())
        self.release(new)

    def test_release_after_remote_diverges_preserves(self):
        lease = self.acquire()
        repo = Path(lease['checkout'])
        self.run_git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                     'commit', '--allow-empty', '-m', 'unpublished')
        self.run_git(self.origin, 'checkout', '--orphan', 'replacement')
        self.run_git(self.origin, 'commit', '-m', 'unrelated history')
        self.run_git(self.origin, 'branch', '-M', 'main')
        with self.assertRaisesRegex(w.Unsafe, 'ancestry unproven'):
            self.release(lease)
        self.assertTrue((Path(lease['checkout']) / 'evidence.txt').exists())
        self.assertEqual(w.read(self.root)['leases']['0']['state'], 'active')

    def test_release_fetch_failure_preserves(self):
        lease = self.acquire()
        repo = Path(lease['checkout'])
        self.run_git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                     'commit', '--allow-empty', '-m', 'unpublished')
        with patch.object(w, 'git', wraps=w.git) as mock_git:
            def fail_fetch(repo, *args):
                if args[0] == 'fetch':
                    raise w.Unsafe('fetch unavailable')
                return mock_git._mock_wraps(repo, *args)
            mock_git.side_effect = fail_fetch
            with self.assertRaisesRegex(w.Unsafe, 'fetch unavailable'):
                self.release(lease)
            self.assertEqual(sum(c.args[1] == 'fetch' for c in mock_git.call_args_list), 1)
        self.assertTrue((Path(lease['checkout']) / 'evidence.txt').exists())

    def test_unavailable_exact_sha_preserves(self):
        with self.assertRaisesRegex(w.Unsafe, 'fetch failed'):
            w.acquire(self.root, 'task', 'a' * 40, 10000)
        self.assertFalse((self.root / 'slot-0' / 'evidence.txt').exists())

    def test_no_legacy_cleanup_or_adoption(self):
        legacy = self.base / 'old-research-19990101'
        legacy.mkdir()
        evidence = legacy / 'notes'
        evidence.write_text('keep')
        with self.assertRaises(FileExistsError):
            w.init(legacy, str(self.origin))
        lease = self.acquire()
        self.release(lease)
        self.assertEqual(evidence.read_text(), 'keep')
        (self.root / 'unknown').write_text('keep too')
        with self.assertRaisesRegex(w.Unsafe, 'unknown pool contents'):
            self.acquire()

    def test_symlink_root_and_pool_entry_rejected(self):
        link = self.base / 'alias'
        try:
            link.symlink_to(self.root, target_is_directory=True)
        except OSError:
            self.skipTest('symlink creation unavailable')
        with self.assertRaises(w.Unsafe):
            w.read(link)
        lease = self.acquire()
        repo = Path(lease['checkout'])
        (repo / 'external').symlink_to(self.origin, target_is_directory=True)
        with self.assertRaisesRegex(w.Unsafe, 'symlink'):
            self.release(lease)

    def test_lock_not_stolen(self):
        (self.root / '.lock').mkdir()
        with self.assertRaisesRegex(w.Unsafe, 'never steal'):
            self.acquire()
        self.assertTrue((self.root / '.lock').is_dir())

    def test_preflight_read_only(self):
        before = (self.root / 'manifest.json').read_bytes()
        w.preflight(self.root, w.read(self.root), 10000)
        self.assertEqual((self.root / 'manifest.json').read_bytes(), before)
        self.assertEqual(list(self.root.iterdir()), [self.root / 'manifest.json'])


if __name__ == '__main__':
    unittest.main()
