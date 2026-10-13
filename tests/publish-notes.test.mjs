import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { publishNotes, acquireLock, cleanStaleCandidates, isTransientGitError } from '../scripts/publish-notes.mjs';
import { exportVault } from '../scripts/sync-notes.mjs';

async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'notes-publish-test-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const cwd = path.join(base, 'repo'), remote = path.join(base, 'remote.git'), vaultPath = path.join(base, 'vault');
  await fs.mkdir(cwd);
  await fs.mkdir(vaultPath);
  await fs.writeFile(path.join(vaultPath, 'note.md'), '---\npublish: true\n---\nold');
  await fs.writeFile(path.join(cwd, 'notes.config.json'), JSON.stringify({ vaultPathEnv: 'TEST_VAULT_PATH', localConfig: 'notes.local.json', contentDirectory: 'content' }));
  await fs.writeFile(path.join(cwd, 'notes.local.json'), JSON.stringify({ vaultPath }));
  await fs.writeFile(path.join(cwd, '.gitignore'), '.local/\nnotes.local.json\n');
  function git(...args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  await exportVault({ vaultPath, destination: path.join(cwd, 'content') });
  await fs.writeFile(path.join(cwd, 'site.mjs'), 'site');
  git('add', '.'); git('commit', '-m', 'initial');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote); git('push', '-u', 'origin', 'main');
  const calls = [];
  const runner = ({ sync = false, failBuild = false, failPush = false, duringBuild } = {}) => {
    if (sync) writeFileSync(path.join(vaultPath, 'note.md'), '---\npublish: true\n---\nnew');
    return (file, args) => {
    calls.push([file, ...args]);
    if (file === 'npm') {
      if (args.includes('build') && duringBuild) duringBuild();
      if (args.includes('build') && failBuild) throw new Error('build failed');
      return '';
    }
    if (args[0] === 'push' && failPush) throw new Error('push failed');
    return git(...args);
    };
  };
  return { cwd, vaultPath, git, calls, runner };
}

test('publishes only the public export, leaving untracked private files uncommitted', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cwd, 'private.txt'), 'private');
  await publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner({ sync: true }), log() {} });
  assert.match(f.git('show', 'HEAD:content/note.md'), /\nnew$/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.git('rev-parse', 'origin/main'));
  assert.equal(f.git('ls-files', 'private.txt'), '');
});

test('check mode validates without fetching, committing or pushing', async t => {
  const f = await fixture(t), before = f.git('rev-parse', 'HEAD');
  await publishNotes({ cwd: f.cwd, sourceIdentity: null, checkOnly: true, run: f.runner({ sync: true }), log() {} });
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['fetch', 'commit', 'push', 'add'].includes(verb)));
});

test('build failure stops before commit and push', async t => {
  const f = await fixture(t), before = f.git('rev-parse', 'HEAD');
  const previous = await fs.readFile(path.join(f.cwd, 'content/note.md'), 'utf8');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner({ sync: true, failBuild: true }), log() {} }), /build failed/);
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['commit', 'push'].includes(verb)));
  assert.equal(await fs.readFile(path.join(f.cwd, 'content/note.md'), 'utf8'), previous);
});

test('failed push can be retried without losing or duplicating the note commit', async t => {
  const f = await fixture(t);
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner({ sync: true, failPush: true }), log() {} }), /push failed/);
  const pending = f.git('rev-parse', 'HEAD');
  await publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} });
  assert.equal(f.git('rev-parse', 'HEAD'), pending);
  assert.equal(f.git('rev-parse', 'origin/main'), pending);
});

test('no changes create no empty commit or push', async t => {
  const f = await fixture(t);
  await publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} });
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['commit', 'push'].includes(verb)));
  assert.ok(!f.calls.some(([file]) => file === 'npm'));
});

test('changes during candidate validation discard the candidate and preserve the valid export', async t => {
  const f = await fixture(t);
  const previous = await fs.readFile(path.join(f.cwd, 'content/note.md'), 'utf8');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, log() {}, run: f.runner({ sync: true, duringBuild: () => writeFileSync(path.join(f.vaultPath, 'note.md'), '---\npublish: true\n---\nchanged again') }) }), /源文件发生变化/);
  assert.equal(await fs.readFile(path.join(f.cwd, 'content/note.md'), 'utf8'), previous);
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['add', 'commit', 'push'].includes(verb)));
});

test('unrelated code edits during validation stop before replacing or committing the candidate', async t => {
  const f = await fixture(t), previous = await fs.readFile(path.join(f.cwd, 'content/note.md'), 'utf8');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, log() {}, run: f.runner({ sync: true, duringBuild: () => writeFileSync(path.join(f.cwd, 'site.mjs'), 'concurrent code edit') }) }), /网站代码/);
  assert.equal(await fs.readFile(path.join(f.cwd, 'content/note.md'), 'utf8'), previous);
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['add', 'commit', 'push'].includes(verb)));
});

test('private edits and empty folders do not build or fetch; whole-folder moves replace old paths', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.vaultPath, 'private.md'), 'private');
  await fs.mkdir(path.join(f.vaultPath, 'Empty'));
  await publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} });
  assert.ok(!f.calls.some(([file, verb]) => file === 'npm' || (file === 'git' && verb === 'fetch')));
  await fs.mkdir(path.join(f.vaultPath, 'New/Nested'), { recursive: true });
  await fs.rename(path.join(f.vaultPath, 'note.md'), path.join(f.vaultPath, 'New/Nested/note.md'));
  await publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} });
  await assert.rejects(fs.access(path.join(f.cwd, 'content/note.md')));
  assert.match(await fs.readFile(path.join(f.cwd, 'content/New/Nested/note.md'), 'utf8'), /old/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.git('rev-parse', 'origin/main'));
});

test('staged edits and unrelated tracked changes stop before syncing', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cwd, 'site.mjs'), 'changed');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} }), /网站代码/);
  f.git('add', 'site.mjs');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} }), /暂存区/);
  assert.ok(!f.calls.some(([file]) => file === 'npm'));
});

test('staged content-only changes hint at an interrupted previous run', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cwd, 'content/extra.md'), 'leftover');
  f.git('add', 'content');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} }), /git restore --staged content/);
  f.git('reset', '-q');
  await fs.writeFile(path.join(f.cwd, 'site.mjs'), 'changed');
  f.git('add', 'site.mjs');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, run: f.runner(), log() {} }), error => {
    assert.match(error.message, /暂存区/);
    assert.ok(!error.message.includes('restore --staged'));
    return true;
  });
});

test('stale lock states: foreign machine, dead pid, and stuck holder are reclaimed', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-lock-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const lock = path.join(dir, 'test.lock');
  const now = Date.now();
  // Foreign machine: reclaimed without probing the pid.
  await fs.writeFile(lock, `other-host:4242:${now}`);
  const logs = [];
  let handle = await acquireLock(lock, { hostname: 'this-host', now: () => now, kill: () => { throw new Error('must not probe a foreign pid'); }, log: m => logs.push(m) });
  assert.match(logs[0], /other-host/);
  assert.equal(await fs.readFile(lock, 'utf8'), `this-host:${process.pid}:${now}`);
  await handle.close(); await fs.unlink(lock);
  // Dead pid (ESRCH): reclaimed.
  await fs.writeFile(lock, `this-host:4242:${now}`);
  handle = await acquireLock(lock, { hostname: 'this-host', now: () => now, kill: () => { const e = new Error('no such process'); e.code = 'ESRCH'; throw e; }, log() {} });
  await handle.close(); await fs.unlink(lock);
  // Live pid with a recent lock blocks; EPERM (another user's process) also counts as alive.
  await fs.writeFile(lock, `this-host:4242:${now}`);
  await assert.rejects(acquireLock(lock, { hostname: 'this-host', now: () => now, kill: () => {} }), /正在运行/);
  await assert.rejects(acquireLock(lock, { hostname: 'this-host', now: () => now, kill: () => { const e = new Error('not permitted'); e.code = 'EPERM'; throw e; } }), /正在运行/);
  // Live pid stuck past the stale window: SIGTERM, then reclaim (never just unlink a live holder).
  const signals = [];
  await fs.writeFile(lock, `this-host:4242:${now - 31 * 60 * 1000}`);
  handle = await acquireLock(lock, { hostname: 'this-host', now: () => now, kill: (pid, signal) => signals.push(signal), log() {} });
  assert.deepEqual(signals, [0, 'SIGTERM']);
  await handle.close(); await fs.unlink(lock);
});

test('legacy pid-only locks still work; empty locks depend on file age', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-lock-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const lock = path.join(dir, 'test.lock');
  // Legacy format, live pid: blocks.
  await fs.writeFile(lock, '4242');
  await assert.rejects(acquireLock(lock, { kill: () => {} }), /正在运行/);
  // Legacy format, dead pid: reclaimed.
  let handle = await acquireLock(lock, { kill: () => { const e = new Error('gone'); e.code = 'ESRCH'; throw e; }, log() {} });
  await handle.close(); await fs.unlink(lock);
  // Empty fresh lock: another publisher may be mid-startup.
  await fs.writeFile(lock, '');
  await assert.rejects(acquireLock(lock), /正在启动/);
  // Empty lock older than a minute: the writer died before writing.
  const past = new Date(Date.now() - 5 * 60 * 1000);
  await fs.utimes(lock, past, past);
  handle = await acquireLock(lock, { log() {} });
  await handle.close(); await fs.unlink(lock);
});

test('stale candidate directories are removed while fresh ones stay', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'publish-candidates-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const local = path.join(dir, '.local');
  const stale = path.join(local, 'candidate-stale'), fresh = path.join(local, 'candidate-fresh'), other = path.join(local, 'keep-me');
  await fs.mkdir(stale, { recursive: true });
  await fs.mkdir(fresh);
  await fs.mkdir(other);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await fs.utimes(stale, twoHoursAgo, twoHoursAgo);
  await cleanStaleCandidates(local);
  await assert.rejects(fs.access(stale));
  await fs.access(fresh);
  await fs.access(other);
});

test('git transport failure classification', () => {
  for (const transient of [
    "fatal: unable to access 'https://github.com/x/y.git/': Could not resolve hostname: github.com",
    'git@github.com: Permission denied (publickey).\r\nfatal: Could not read from remote repository.',
    'fatal: could not read Username for \'https://github.com\': Device not configured',
    'fatal: unable to connect to github.com: Connection timed out',
    'fatal: Authentication failed for \'https://github.com/x/y.git/\'',
  ]) assert.equal(isTransientGitError(transient), true, transient);
  for (const repo of ['error: failed to push some refs to \'github.com:x/y.git\'', 'fatal: refusing to merge unrelated histories', ''])
    assert.equal(isTransientGitError(repo), false, repo);
});

test('transient fetch failure names the network and keeps the repository untouched', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.vaultPath, 'note.md'), '---\npublish: true\n---\nnew');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, log() {}, run: (file, args) => {
    if (file === 'git' && args[0] === 'fetch') throw new Error("fatal: unable to access 'https://github.com/x/y.git/': Could not resolve hostname: github.com");
    if (file === 'npm') return '';
    return f.git(...args);
  } }), /网络或凭据/);
  assert.equal(f.git('rev-list', '--count', 'origin/main..HEAD'), '0');
});

test('repository push failure demands manual handling and keeps the commit', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.vaultPath, 'note.md'), '---\npublish: true\n---\nnew');
  await assert.rejects(publishNotes({ cwd: f.cwd, sourceIdentity: null, log() {}, run: (file, args) => {
    if (file === 'git' && args[0] === 'push') throw new Error('error: failed to push some refs');
    if (file === 'npm') return '';
    return f.git(...args);
  } }), /需要手工处理/);
  assert.equal(f.git('rev-list', '--count', 'origin/main..HEAD'), '1');
});
