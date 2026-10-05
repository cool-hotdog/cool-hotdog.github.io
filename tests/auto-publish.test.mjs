import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
const require = createRequire(import.meta.url);
const sourceRoot = require('../integrations/obsidian-homepage-publisher/source-root.cjs');
const source = await fs.readFile(new URL('../integrations/obsidian-homepage-publisher/main.js', import.meta.url), 'utf8');
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'publisher-plugin-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const vaultRoot = path.join(base, 'vault'), project = path.join(base, 'project');
  await fs.mkdir(path.join(vaultRoot, 'James-Vault'), { recursive: true });
  await fs.mkdir(path.join(project, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(project, 'scripts/publish-notes.mjs'), '');
  const events = {}, timers = new Map(), intervals = new Map(), children = [], notices = [], statuses = [];
  let startup, id = 0;
  class Plugin {
    async loadData() { return { projectPath: project, sourceFolder: 'James-Vault' }; }
    async saveData(data) { this.saved = { ...data }; }
    addStatusBarItem() { return { setText(text) { statuses.push(text); } }; }
    addCommand() {} addSettingTab() {} registerEvent() {}
  }
  const modules = {
    obsidian: { Plugin, PluginSettingTab: class {}, Setting: class {}, Modal: class {}, Notice: class { constructor(text) { notices.push(text); } } },
    child_process: { spawn(...args) { const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); children.push({ child, args }); return child; } },
    fs: fsSync, path, './source-root': sourceRoot,
  };
  const context = { module: { exports: {} }, require: name => name.endsWith('source-root.cjs') ? sourceRoot : modules[name], process: { env: {} }, console,
    setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearTimeout(key) { timers.delete(key); },
    setInterval(fn, delay) { intervals.set(++id, { fn, delay }); return id; }, clearInterval(key) { intervals.delete(key); } };
  vm.runInNewContext(source, context);
  const plugin = new context.module.exports();
  plugin.app = {
    vault: { adapter: { getBasePath: () => vaultRoot }, on(name, handler) { events[name] = handler; } },
    metadataCache: { on(name, handler) { events.metadata = handler; } },
    workspace: { onLayoutReady(fn) { startup = fn; } },
  };
  plugin.manifest = { dir: '.obsidian/plugins/homepage-publisher' };
  await plugin.onload();
  t.after(() => plugin.onunload());
  return { plugin, events, timers, intervals, children, notices, statuses, vaultRoot, project, startup: () => startup() };
}

test('any source content or folder event schedules a complete check, including private notes and ancestors', async t => {
  const f = await fixture(t);
  for (const p of ['James-Vault/private.md', 'James-Vault/10 Courses', 'James-Vault']) {
    for (const event of ['create', 'modify', 'delete']) { f.events[event]({ path: p }); assert.equal(f.timers.size, 1); }
  }
  assert.equal(f.plugin.affectsSource('James-Vault/90 Meta/Templates/test.md'), false);
  assert.equal(f.plugin.affectsSource('James-Vault/.hidden/file'), false);
  assert.equal(f.plugin.affectsSource('Other/file.md'), false);
  f.plugin.settings.sourceFolder = 'Parent/James-Vault';
  assert.equal(f.plugin.affectsSource('Parent'), true);
  f.events.rename({ path: 'Moved' }, 'Parent');
  assert.equal(f.timers.size, 1);
});

test('startup and periodic fallback check without extending an editing debounce; unload cancels timers', async t => {
  const f = await fixture(t);
  f.startup();
  assert.equal([...f.intervals.values()][0].delay, 60000);
  assert.equal([...f.timers.values()][0].delay, 15000);
  f.events.metadata({ path: 'James-Vault/new.md' });
  const timer = f.plugin.timer;
  [...f.intervals.values()][0].fn();
  assert.equal(f.plugin.timer, timer);
  f.timers.delete(timer); f.plugin.timer = null;
  await f.plugin.publish();
  assert.equal(f.children.length, 1);
  f.children[0].child.emit('close', 0);
  [...f.intervals.values()][0].fn();
  // Await the async filesystem preparation invoked by the interval.
  while (f.children.length < 2 && f.plugin.running) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.children.length, 2);
  f.children[1].child.emit('close', 0);
  f.plugin.onunload();
  assert.equal(f.timers.size, 0); assert.equal(f.intervals.size, 0);
});

test('whole root and parent moves are followed and passed explicitly to publisher and local config', async t => {
  const f = await fixture(t);
  await f.plugin.publish(); f.children[0].child.emit('close', 0);
  const id = f.plugin.settings.sourceId;
  await fs.mkdir(path.join(f.vaultRoot, 'Parent'));
  await fs.rename(path.join(f.vaultRoot, 'James-Vault'), path.join(f.vaultRoot, 'Parent/Renamed'));
  f.events.rename({ path: 'Parent/Renamed' }, 'James-Vault');
  await f.plugin.publish(); f.children[1].child.emit('close', 0);
  assert.equal(f.plugin.settings.sourceFolder, 'Parent/Renamed'); assert.equal(f.plugin.settings.sourceId, id);
  await fs.rename(path.join(f.vaultRoot, 'Parent'), path.join(f.vaultRoot, 'Moved'));
  // No event: startup/periodic resolution must also recover.
  await f.plugin.publish(); f.children[2].child.emit('close', 0);
  const expected = await fs.realpath(path.join(f.vaultRoot, 'Moved/Renamed'));
  assert.equal(f.plugin.settings.sourceFolder, 'Moved/Renamed');
  assert.equal(f.children[2].args[2].env.OBSIDIAN_VAULT_PATH, expected);
  assert.equal(JSON.parse(await fs.readFile(path.join(f.project, 'notes.local.json'), 'utf8')).vaultPath, expected);
});

test('missing or duplicate source pauses without spawning a publisher; restores recover automatically', async t => {
  const f = await fixture(t);
  await f.plugin.publish(); f.children[0].child.emit('close', 0);
  await fs.cp(path.join(f.vaultRoot, 'James-Vault'), path.join(f.vaultRoot, 'Copy'), { recursive: true });
  await f.plugin.publish();
  assert.equal(f.children.length, 1); assert.match(f.statuses.at(-1), /已暂停/);
  assert.equal(f.timers.size, 0);
  await fs.rm(path.join(f.vaultRoot, 'Copy'), { recursive: true });
  await fs.rename(path.join(f.vaultRoot, 'James-Vault'), path.join(path.dirname(f.vaultRoot), 'Outside'));
  await f.plugin.publish(); assert.equal(f.children.length, 1);
  await fs.rename(path.join(path.dirname(f.vaultRoot), 'Outside'), path.join(f.vaultRoot, 'Back'));
  await f.plugin.publish(); assert.equal(f.children.length, 2);
  f.children[1].child.emit('close', 0);
  assert.equal(f.plugin.settings.sourceFolder, 'Back');
});

test('edits queue one later job and failed pushes retry with backoff; success says waiting for deployment', async t => {
  const f = await fixture(t);
  await f.plugin.publish();
  f.plugin.schedule(); await f.plugin.publish();
  assert.equal(f.children.length, 1); assert.equal(f.plugin.pending, true);
  f.children[0].child.emit('close', 0);
  assert.equal(f.timers.size, 1);
  await f.plugin.publish(); f.children[1].child.emit('close', 1);
  assert.equal(f.notices.length, 1); assert.equal([...f.timers.values()].at(-1).delay, 30000);
  await f.plugin.publish(); f.children[2].child.emit('close', 1);
  assert.equal(f.notices.length, 1); assert.equal([...f.timers.values()].at(-1).delay, 60000);
  await f.plugin.publish(); f.children[3].child.stdout.emit('data', Buffer.from('推送成功'));
  f.children[3].child.emit('close', 0);
  assert.match(f.statuses.at(-1), /等待网站部署/);
});

test('binding a copied source assigns a new identity without modifying note contents', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.vaultRoot, 'James-Vault/note.md'), 'private original');
  await f.plugin.publish(); f.children[0].child.emit('close', 0);
  await fs.cp(path.join(f.vaultRoot, 'James-Vault'), path.join(f.vaultRoot, 'Copy'), { recursive: true });
  const resolved = await sourceRoot.bindSource(f.vaultRoot, 'Copy');
  assert.notEqual(resolved.sourceId, f.plugin.settings.sourceId);
  assert.equal(resolved.sourceFolder, 'Copy');
  assert.equal(await fs.readFile(path.join(resolved.vaultPath, 'note.md'), 'utf8'), 'private original');
  await assert.rejects(sourceRoot.bindSource(f.vaultRoot, '../Outside'));
});
