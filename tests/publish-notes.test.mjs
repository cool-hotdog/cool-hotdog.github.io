import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { publishNotes } from '../scripts/publish-notes.mjs';
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
