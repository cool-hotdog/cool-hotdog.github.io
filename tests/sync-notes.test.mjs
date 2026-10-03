import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exportVault } from '../scripts/sync-notes.mjs';

async function fixture(t, files) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'homepage-notes-test-'));
  t.after(() => fs.rm(base, { recursive:true, force:true }));
  const vaultPath = path.join(base, 'vault'), destination = path.join(base,'public');
  await fs.mkdir(vaultPath);
  for (const [name, content] of Object.entries(files)) { const full=path.join(vaultPath,name); await fs.mkdir(path.dirname(full),{recursive:true}); await fs.writeFile(full,content); }
  return { vaultPath, destination };
}
const pub = body => '---\npublish: true\n---\n' + body;
test('only boolean publish:true notes and referenced assets are exported; private links become text', async t => {
  const f=await fixture(t,{'20 Knowledge/公开.md':pub('[[目标|概念]] [[私有|私人笔记]] ![[图.png]] [PDF](../40%20Sources/资料.pdf)\n```cpp\n// [[代码中的链接]]\n```\n%%secret comment%%'), '20 Knowledge/目标.md':pub('$$x^2$$'), '私有.md':'private secret', '字符串.md':'---\npublish: "true"\n---\nnot public', '图.png':'public image', '40 Sources/资料.pdf':'public pdf', '未引用.png':'private image', '.obsidian/config.json':'private config', '90 Meta/Templates/template.md':pub('private template')});
  const r=await exportVault(f);
  assert.equal(r.notes.length,2); assert.deepEqual(r.assets.sort(),['40 Sources/资料.pdf','图.png']);
  const text=await fs.readFile(path.join(f.destination,'20 Knowledge/公开.md'),'utf8');
  assert.match(text,/\[\[20 Knowledge\/目标\|概念\]\]/); assert.match(text,/私人笔记/); assert.doesNotMatch(text,/\[\[私有/);
  assert.match(text,/\[\[代码中的链接\]\]/); assert.doesNotMatch(text,/secret comment/);
  assert.equal(r.notes.find(n=>n.title==='公开').url,'/notes/20-Knowledge/公开.html'.toLowerCase());
  for (const name of ['私有.md','字符串.md','未引用.png','.obsidian/config.json','90 Meta/Templates/template.md']) await assert.rejects(fs.access(path.join(f.destination,name)));
});
test('withdrawal removes note and orphan attachment', async t => {
  const f=await fixture(t,{'公开.md':pub('![[图.png]]'),'图.png':'image'});
  await exportVault(f); await fs.writeFile(path.join(f.vaultPath,'公开.md'),'private'); await exportVault(f);
  await assert.rejects(fs.access(path.join(f.destination,'公开.md'))); await assert.rejects(fs.access(path.join(f.destination,'图.png')));
});
test('missing asset or source directory preserves the last valid export', async t => {
  const f=await fixture(t,{'公开.md':pub('version one')}); await exportVault(f);
  const before=await fs.readFile(path.join(f.destination,'公开.md'),'utf8');
  await fs.writeFile(path.join(f.vaultPath,'公开.md'),pub('![[不存在.png]]'));
  await assert.rejects(exportVault(f),/missing or unpublished|missing attachment/);
  assert.equal(await fs.readFile(path.join(f.destination,'公开.md'),'utf8'),before);
  await assert.rejects(exportVault({...f,vaultPath:path.join(f.vaultPath,'missing')}));
  assert.equal(await fs.readFile(path.join(f.destination,'公开.md'),'utf8'),before);
});
test('unpublished embedded notes and ambiguous names stop publication', async t => {
  const f=await fixture(t,{'公开.md':pub('![[秘密]]'),'秘密.md':'private'});
  await assert.rejects(exportVault(f),/embedded note/);
  await fs.mkdir(path.join(f.vaultPath,'A')); await fs.mkdir(path.join(f.vaultPath,'B'));
  await fs.writeFile(path.join(f.vaultPath,'A/同名.md'),pub('a')); await fs.writeFile(path.join(f.vaultPath,'B/同名.md'),pub('b'));
  await fs.writeFile(path.join(f.vaultPath,'公开.md'),pub('[[同名]]'));
  await assert.rejects(exportVault(f),/ambiguous/);
});
test('aliases resolve, heading links survive and case-colliding URLs are rejected', async t => {
  const f=await fixture(t,{'公开.md':pub('[[别名#推导|推导]]'),'目标.md':'---\npublish: true\naliases: [别名]\n---\n## 推导'});
  await exportVault(f); assert.match(await fs.readFile(path.join(f.destination,'公开.md'),'utf8'),/\[\[目标#推导\|推导\]\]/);
  await fs.writeFile(path.join(f.vaultPath,'A B.md'),pub('one')); await fs.writeFile(path.join(f.vaultPath,'A-B.md'),pub('two'));
  await assert.rejects(exportVault(f),/Duplicate/);
});
test('HTML attachment references are selected and symlinks cannot export files outside vault', async t => {
  const f=await fixture(t,{'公开.md':pub('<img src="图.png">'),'图.png':'public'});
  await exportVault(f); await fs.symlink(path.join(f.destination,'图.png'),path.join(f.vaultPath,'越界.png'));
  await fs.writeFile(path.join(f.vaultPath,'公开.md'),pub('![[越界.png]]'));
  await assert.rejects(exportVault(f));
});
