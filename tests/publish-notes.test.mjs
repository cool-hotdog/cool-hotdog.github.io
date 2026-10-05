import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { publishNotes } from '../scripts/publish-notes.mjs';

async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'notes-publish-test-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const cwd = path.join(base, 'repo'), remote = path.join(base, 'remote.git');
  await fs.mkdir(cwd);
  function git(...args) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  await fs.mkdir(path.join(cwd, 'content'));
  await fs.writeFile(path.join(cwd, 'content/note.md'), 'old');
  await fs.writeFile(path.join(cwd, 'site.mjs'), 'site');
  git('add', '.'); git('commit', '-m', 'initial');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote); git('push', '-u', 'origin', 'main');
  const calls = [];
  const runner = ({ sync = false, failBuild = false, failPush = false } = {}) => (file, args) => {
    calls.push([file, ...args]);
    if (file === 'npm') {
      if (args.includes('notes:sync') && sync) writeFileSync(path.join(cwd, 'content/note.md'), 'new');
      if (args.includes('build') && failBuild) throw new Error('build failed');
      return '';
    }
    if (args[0] === 'push' && failPush) throw new Error('push failed');
    return git(...args);
  };
  return { cwd, git, calls, runner };
}

test('publishes only the public export, leaving untracked private files uncommitted', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cwd, 'private.txt'), 'private');
  await publishNotes({ cwd: f.cwd, run: f.runner({ sync: true }), log() {} });
  assert.equal(f.git('show', 'HEAD:content/note.md'), 'new');
  assert.equal(f.git('rev-parse', 'HEAD'), f.git('rev-parse', 'origin/main'));
  assert.equal(f.git('ls-files', 'private.txt'), '');
});

test('check mode validates without fetching, committing or pushing', async t => {
  const f = await fixture(t), before = f.git('rev-parse', 'HEAD');
  await publishNotes({ cwd: f.cwd, checkOnly: true, run: f.runner({ sync: true }), log() {} });
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['fetch', 'commit', 'push', 'add'].includes(verb)));
});

test('build failure stops before commit and push', async t => {
  const f = await fixture(t), before = f.git('rev-parse', 'HEAD');
  await assert.rejects(publishNotes({ cwd: f.cwd, run: f.runner({ sync: true, failBuild: true }), log() {} }), /build failed/);
  assert.equal(f.git('rev-parse', 'HEAD'), before);
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['commit', 'push'].includes(verb)));
});

test('failed push can be retried without losing or duplicating the note commit', async t => {
  const f = await fixture(t);
  await assert.rejects(publishNotes({ cwd: f.cwd, run: f.runner({ sync: true, failPush: true }), log() {} }), /push failed/);
  const pending = f.git('rev-parse', 'HEAD');
  await publishNotes({ cwd: f.cwd, run: f.runner(), log() {} });
  assert.equal(f.git('rev-parse', 'HEAD'), pending);
  assert.equal(f.git('rev-parse', 'origin/main'), pending);
});

test('no changes create no empty commit or push', async t => {
  const f = await fixture(t);
  await publishNotes({ cwd: f.cwd, run: f.runner(), log() {} });
  assert.ok(!f.calls.some(([file, verb]) => file === 'git' && ['commit', 'push'].includes(verb)));
});

test('staged edits and unrelated tracked changes stop before syncing', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.cwd, 'site.mjs'), 'changed');
  await assert.rejects(publishNotes({ cwd: f.cwd, run: f.runner(), log() {} }), /网站代码/);
  f.git('add', 'site.mjs');
  await assert.rejects(publishNotes({ cwd: f.cwd, run: f.runner(), log() {} }), /暂存区/);
  assert.ok(!f.calls.some(([file]) => file === 'npm'));
});
