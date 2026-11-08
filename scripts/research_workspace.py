#!/usr/bin/env python3
"""Fail-closed, bounded research checkouts. No age-based cleanup or lease stealing.

Run this helper from OUTSIDE the managed checkout: release parks tracked files.
The caller must bootstrap this helper from the exact resolved main SHA and supply
that SHA to acquire. A lease token is a capability; keep the JSON response private.
Failures retain the checkout and lease for inspection, never retry automatically.
Failed acquisition has no automated recovery: an operator must inspect the pool;
this helper never abandons a failed slot, steals its lease, or deletes its data.
"""
import argparse
from contextlib import contextmanager
import json
import hashlib
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys

VERSION = 1
GIB = 1024 ** 3


class Unsafe(RuntimeError):
    pass


def git(repo, *args):
    targeting = {'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
                 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
                 'GIT_NAMESPACE', 'GIT_PREFIX', 'GIT_SHALLOW_FILE',
                 'GIT_CEILING_DIRECTORIES'}
    env = {k: v for k, v in os.environ.items() if k not in targeting}
    env['GIT_TERMINAL_PROMPT'] = '0'
    result = subprocess.run(['git', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false',
                             '-c', 'core.autocrlf=false', '-c', 'core.hooksPath=' + os.devnull,
                             '-C', str(repo), *args], env=env, capture_output=True)
    if result.returncode:
        # Git stderr can contain credential-bearing remote URLs. Do not echo it
        # into lease manifests or task logs.
        raise Unsafe(f'git {args[0]} failed (exit {result.returncode}); checkout retained')
    return result.stdout.decode('utf-8', errors='surrogateescape').strip()


def safe_path(path):
    path = Path(path)
    if not path.is_absolute() or path != path.resolve():
        raise Unsafe('root must be an absolute resolved path without symlinks')
    return path


def size(root):
    total = 0
    for directory, dirs, files in os.walk(root):
        for name in dirs + files:
            p = Path(directory) / name
            if p.is_symlink():
                raise Unsafe('symlink in managed pool: ' + str(p))
        total += sum((Path(directory) / f).stat().st_size for f in files)
    return total


def save(root, data):
    temporary = root / 'manifest.tmp'
    with temporary.open('x') as stream:
        json.dump(data, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, root / 'manifest.json')


def read(root):
    root = safe_path(root)
    if not (root / 'manifest.json').is_file() or (root / 'manifest.json').is_symlink():
        raise Unsafe('not an initialized managed pool')
    data = json.loads((root / 'manifest.json').read_text())
    if data['version'] != VERSION or data['root'] != str(root):
        raise Unsafe('pool identity mismatch')
    allowed = {'manifest.json', '.lock'} | {f'slot-{n}' for n in data['leases']}
    if any(p.name not in allowed for p in root.iterdir()):
        raise Unsafe('unknown pool contents; preserve for manual inspection')
    size(root)
    return data


@contextmanager
def locked(root):
    root = safe_path(root)
    read(root)
    lock = root / '.lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise Unsafe('pool operation already locked; never steal a lock')
    try:
        yield read(root)
    finally:
        lock.rmdir()


def init(root, origin, slots=1, min_free_bytes=GIB, max_pool_bytes=3 * GIB):
    root = safe_path(root)
    if slots < 1 or min_free_bytes < 0 or max_pool_bytes < 1:
        raise Unsafe('invalid pool limits')
    # Do not adopt any existing directory, even an apparently empty one.
    root.mkdir()
    data = dict(version=VERSION, root=str(root), origin=origin, slots=slots,
                min_free_bytes=min_free_bytes, max_pool_bytes=max_pool_bytes, leases={})
    save(root, data)
    return data


def available_inodes(root):
    if not hasattr(os, 'statvfs'):
        return None
    stats = os.statvfs(root)
    # Some filesystems expose no inode accounting.
    return stats.f_favail if stats.f_files else None


def preflight(root, data, projected_bytes, projected_files=0):
    if projected_bytes < 0:
        raise Unsafe('negative projection')
    used = size(root)
    free = shutil.disk_usage(root).free
    if free - projected_bytes < data['min_free_bytes']:
        raise Unsafe('free disk floor would be violated')
    if used + projected_bytes > data['max_pool_bytes']:
        raise Unsafe('pool byte budget would be exceeded')
    inodes = available_inodes(root)
    if projected_files and inodes is not None and inodes < projected_files * 2 + 256:
        raise Unsafe('available inode budget would be exceeded')
    return dict(pool_bytes=used, free_bytes=free, projected_bytes=projected_bytes,
                available_inodes=inodes)


def clean(repo, origin):
    if not (repo / '.git').is_dir() or (repo / '.git').is_symlink():
        raise Unsafe('linked or external git directory refused')
    if Path(git(repo, 'rev-parse', '--show-toplevel')).resolve() != repo:
        raise Unsafe('repository root mismatch')
    if git(repo, 'rev-parse', '--git-common-dir') != '.git':
        raise Unsafe('external common directory refused')
    if git(repo, 'config', '--get', 'remote.origin.url') != origin:
        raise Unsafe('origin changed')
    if git(repo, 'worktree', 'list', '--porcelain').count('worktree ') != 1:
        raise Unsafe('linked worktrees present')
    if git(repo, 'status', '--porcelain=v1', '--untracked-files=all', '--ignored'):
        raise Unsafe('dirty, untracked or ignored files present; preserved')
    # Compare every present tracked file, even if skip-worktree hides edits.
    for entry in git(repo, 'ls-files', '--stage', '-z').split('\0'):
        if not entry:
            continue
        metadata, name = entry.split('\t', 1)
        mode, blob, stage = metadata.split()
        path = repo / name
        if path.exists():
            digest = hashlib.sha1()
            digest.update(b'blob ' + str(path.stat().st_size).encode('ascii') + b'\0')
            with path.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(block)
            if digest.hexdigest() != blob:
                raise Unsafe('tracked content differs, including hidden index edits')
    refs = git(repo, 'for-each-ref', '--format=%(refname)').splitlines()
    if any(ref != 'refs/remotes/origin/main' for ref in refs):
        raise Unsafe('local branches, tags, stashes or other refs present')
    # Assume-unchanged can hide edits from status; refuse those flags outright.
    if any(line[:1].islower() for line in git(repo, 'ls-files', '-v').splitlines()):
        raise Unsafe('assume-unchanged index flags present')
    for name in ('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge',
                 'rebase-apply', 'objects/info/alternates', 'info/grafts'):
        if (repo / '.git' / name).exists():
            raise Unsafe('in-progress operation or external object dependency')


def acquire(root, task, expected_main_sha, projected_bytes):
    root = safe_path(root)
    if not re.fullmatch('[0-9a-f]{40}', expected_main_sha):
        raise Unsafe('expected-main-sha must be a full SHA-1 commit ID')
    with locked(root) as data:
        idle = [n for n, lease in data['leases'].items() if lease['state'] == 'idle']
        if idle:
            slot = idle[0]
            clean(root / ('slot-' + slot), data['origin'])
        elif len(data['leases']) < data['slots']:
            slot = str(len(data['leases']))
        else:
            raise Unsafe('all bounded slots leased or failed; no new checkout created')
        preflight(root, data, projected_bytes)
        token = secrets.token_hex(24)
        lease = dict(state='active', token=token, task=task, main_sha=expected_main_sha)
        data['leases'][slot] = lease
        save(root, data)
        repo = root / ('slot-' + slot)
        try:
            if not repo.exists():
                repo.mkdir()
                git(repo, 'init', '--quiet')
                git(repo, 'config', 'core.autocrlf', 'false')
                git(repo, 'remote', 'add', 'origin', data['origin'])
            # Caller resolved main immediately before fetching this helper from
            # that same SHA. Do not race a moving branch or silently change it.
            git(repo, 'fetch', '--depth=1', '--no-tags', 'origin',
                '+' + expected_main_sha + ':refs/remotes/origin/main')
            sha = git(repo, 'rev-parse', 'refs/remotes/origin/main')
            if sha != expected_main_sha:
                raise Unsafe('bootstrap SHA mismatch; no checkout performed')
            entries = git(repo, 'ls-tree', '-rl', sha).splitlines()
            tracked_bytes = 0
            for entry in entries:
                fields = entry.split(None, 4)
                if fields[0] != '100644' and fields[0] != '100755':
                    raise Unsafe('symlink or submodule tree entries refused')
                tracked_bytes += int(fields[3])
            preflight(root, data, max(projected_bytes, tracked_bytes), len(entries))
            # Park first, so changing HEAD never materializes a full tree prematurely.
            git(repo, 'sparse-checkout', 'set', '--no-cone', '!/*')
            git(repo, 'checkout', '--detach', sha)
            git(repo, 'sparse-checkout', 'disable')
            preflight(root, data, 0)
            return dict(slot=slot, token=token, checkout=str(repo), main_sha=sha)
        except Exception as exc:
            lease['state'] = 'failed'
            lease['error'] = str(exc)
            save(root, data)
            raise Unsafe(f'{exc}; retained slot={slot} token={token}') from exc


def release(root, slot, token, complete=False):
    root = safe_path(root)
    with locked(root) as data:
        lease = data['leases'].get(str(slot))
        if not complete or not lease or lease['state'] != 'active' or not secrets.compare_digest(lease['token'], token):
            raise Unsafe('explicit completion and current active lease token required')
        repo = root / ('slot-' + str(slot))
        clean(repo, data['origin'])
        head = git(repo, 'rev-parse', 'HEAD')
        # The exact acquisition commit was already fetched from the origin.
        # Parking never destroys its objects, so it needs no fresh fetch or free
        # space floor. This is also the important low-disk/no-work fast path.
        if head != lease['main_sha']:
            remote = git(repo, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main')
            if remote.split()[0] != head:
                # Bounded history proves published evidence followed by another
                # lane's commits. Ambiguous shallow history remains leased.
                preflight(root, data, 0)
                git(repo, 'fetch', '--depth=128', '--no-tags', 'origin',
                    '+refs/heads/main:refs/remotes/origin/main')
                preflight(root, data, 0)
                try:
                    git(repo, 'merge-base', '--is-ancestor', head, 'refs/remotes/origin/main')
                except Unsafe as exc:
                    raise Unsafe('remote ancestry unproven within 128 commits; preserve for review') from exc
        # No reset/clean/delete/GC: Git parks only clean tracked files, retaining objects.
        git(repo, 'sparse-checkout', 'set', '--no-cone', '!/*')
        clean(repo, data['origin'])
        lease['state'] = 'idle'
        lease.pop('token')
        save(root, data)
        return dict(slot=str(slot), state='idle', pool_bytes=size(root))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('init', 'inspect', 'preflight', 'acquire', 'release'):
        p = sub.add_parser(name)
        p.add_argument('--root', required=True, type=Path)
        if name == 'init':
            p.add_argument('--origin', required=True)
            p.add_argument('--slots', type=int, default=1)
            p.add_argument('--min-free-bytes', type=int, default=GIB)
            p.add_argument('--max-pool-bytes', type=int, default=3 * GIB)
        if name in ('preflight', 'acquire'):
            p.add_argument('--projected-bytes', type=int, required=True)
        if name == 'acquire':
            p.add_argument('--task', required=True)
            p.add_argument('--expected-main-sha', required=True)
        if name == 'release':
            p.add_argument('--slot', required=True)
            p.add_argument('--token', required=True)
            p.add_argument('--complete', action='store_true')
    args = vars(parser.parse_args())
    command = args.pop('command')
    try:
        if command in ('inspect', 'preflight'):
            data = read(args['root'])
            result = (preflight(args['root'], data, args['projected_bytes'])
                      if command == 'preflight' else
                      dict(pool_bytes=size(args['root']), free_bytes=shutil.disk_usage(args['root']).free,
                           available_inodes=available_inodes(args['root'])))
            result['limits'] = {key: data[key] for key in
                                ('slots', 'min_free_bytes', 'max_pool_bytes')}
            result['slot_bytes'] = {n: size(args['root'] / ('slot-' + n))
                                    for n in data['leases']}
            result['slots'] = {n: {k: v for k, v in x.items() if k not in ('token', 'error')}
                               for n, x in data['leases'].items()}
        else:
            result = globals()[command](**args)
        print(json.dumps(result))
    except (Unsafe, OSError, ValueError, KeyError) as exc:
        print(json.dumps({'error': str(exc)}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
