import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

const source = await fs.readFile(new URL('../integrations/obsidian-homepage-publisher/main.js', import.meta.url), 'utf8');
async function fixture() {
  const events = {}, timers = new Map(), children = [], notices = [];
  let startup, id = 0;
  class Plugin {
    async loadData() { return { projectPath: '/project', sourceFolder: 'James-Vault' }; }
    addStatusBarItem() { return { setText() {} }; }
    addCommand() {}
    registerEvent() {}
  }
  const modules = {
    obsidian: { Plugin, Modal: class {}, Notice: class { constructor(text) { notices.push(text); } } },
    child_process: { spawn(...args) { const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); children.push({ child, args }); return child; } },
    fs: { existsSync: () => true, readFileSync: () => JSON.stringify({ notes: [{ path: '公开.md' }], assets: ['图.png'] }), mkdirSync() {}, writeFileSync() {} },
    path,
  };
  const context = { module: { exports: {} }, require: name => modules[name], process: { env: {} }, console,
    setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearTimeout(key) { timers.delete(key); } };
  vm.runInNewContext(source, context);
  const plugin = new context.module.exports();
  plugin.app = {
    vault: { on(name, handler) { events[name] = handler; }, },
    metadataCache: { on(name, handler) { events.metadata = handler; }, getFileCache: file => file.cache },
    workspace: { onLayoutReady(fn) { startup = fn; } },
  };
  await plugin.onload();
  return { plugin, events, timers, children, notices, startup: () => startup() };
}
const note = (name, publish) => ({ path: 'James-Vault/' + name, extension: 'md', cache: { frontmatter: { publish } } });

test('auto publication selects boolean public notes and referenced assets, excluding templates and private notes', async () => {
  const { plugin } = await fixture();
  for (const publish of [false, 'true', undefined]) assert.equal(plugin.shouldSync(note('私人.md', publish), note('私人.md', publish).cache), false);
  assert.equal(plugin.shouldSync(note('新公开.md', true), note('新公开.md', true).cache), true);
  assert.equal(plugin.shouldSync(note('90 Meta/Templates/test.md', true), note('90 Meta/Templates/test.md', true).cache), false);
  assert.equal(plugin.shouldSync(note('.obsidian/test.md', true), note('.obsidian/test.md', true).cache), false);
  assert.equal(plugin.shouldSync(note('新公开.md', true), { frontmatter: { publish: true, draft: true } }), false);
  assert.equal(plugin.shouldSync(note('公开.md', false), note('公开.md', false).cache), true);
  assert.equal(plugin.shouldSync({ path: 'James-Vault/图.png', extension: 'png' }), true);
});

test('rapid saves debounce into one job; startup catches offline changes and unload cancels pending work', async () => {
  const f = await fixture();
  f.startup();
  f.events.modify(note('新公开.md', true));
  f.events.metadata(note('新公开.md', true), '', note('新公开.md', true).cache);
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].delay, 15000);
  f.plugin.onunload();
  assert.equal(f.timers.size, 0);
});

test('withdrawal, deletion and renaming of previously public notes trigger synchronization', async () => {
  const f = await fixture();
  f.events.metadata(note('公开.md', false), '', note('公开.md', false).cache);
  assert.equal(f.timers.size, 1);
  f.events.delete(note('公开.md', true));
  assert.equal(f.timers.size, 1);
  f.events.rename(note('私人.md', false), 'James-Vault/公开.md');
  assert.equal(f.timers.size, 1);
});

test('edits during publication queue a later job; failures back off and show one notification', async () => {
  const f = await fixture();
  f.plugin.publish();
  assert.equal(f.children.length, 1);
  f.plugin.schedule();
  assert.equal(f.plugin.pending, true);
  f.children[0].child.emit('close', 0);
  assert.equal(f.timers.size, 1);
  assert.equal(f.plugin.running, false);
  f.plugin.publish();
  f.children[1].child.emit('close', 1);
  assert.equal(f.notices.length, 1);
  assert.equal([...f.timers.values()].at(-1).delay, 30000);
  f.plugin.publish();
  f.children[2].child.emit('close', 1);
  assert.equal(f.notices.length, 1);
  assert.equal([...f.timers.values()].at(-1).delay, 60000);
  f.plugin.onunload();
});
