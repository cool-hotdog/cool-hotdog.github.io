import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'parse5';
import { exportVault, root } from '../scripts/sync-notes.mjs';

test('Quartz renders public Obsidian links, formulas, code and attachment paths under /notes/', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'homepage-quartz-'));
  try {
    const vault = path.join(tmp, 'vault');
    const content = path.join(tmp, 'content');
    const output = path.join(tmp, 'notes');
    await fs.mkdir(path.join(vault, '20 Knowledge'), { recursive: true });
    await fs.mkdir(path.join(vault, '90 Meta/Attachments'), { recursive: true });
    await fs.writeFile(path.join(vault, '20 Knowledge/First Note.md'), '---\npublish: true\n---\n# Formula\n\n$$x^2 + y^2 = 1$$\n\n```cpp\nint main() { return 0; }\n```\n\n[[Second Note#A heading|Read section]]\n\n![[picture.jpg]]\n\n[Download PDF](../90%20Meta/Attachments/paper.pdf)\n');
    await fs.writeFile(path.join(vault, '20 Knowledge/Second Note.md'), '---\npublish: true\n---\n## A heading\n\nA public section.\n');
    await fs.writeFile(path.join(vault, 'Secret.md'), 'Unpublished secret sentinel.');
    await fs.copyFile(path.join(root, 'site/assets/avatar.jpg'), path.join(vault, '90 Meta/Attachments/picture.jpg'));
    await fs.writeFile(path.join(vault, '90 Meta/Attachments/paper.pdf'), '%PDF-1.4\n%%EOF');
    await exportVault({ vaultPath: vault, destination: content });
    const built = spawnSync(process.execPath, ['quartz/bootstrap-cli.mjs', 'build', '-d', content, '-o', output, '--concurrency', '2'], { cwd: path.join(root, 'quartz-engine'), encoding: 'utf8' });
    assert.equal(built.status, 0, built.stdout + built.stderr);
    const html = await fs.readFile(path.join(output, '20-knowledge/first-note.html'), 'utf8');
    assert.match(html, /class="katex/);
    assert.match(html, /data-language="cpp"/);
    assert.match(html, /second-note#a-heading/);
    assert.doesNotMatch(html, /Unpublished secret sentinel/);
    const assets = [];
    const visit = node => {
      const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
      if (node.tagName === 'img' && attrs.src?.includes('picture')) assets.push(attrs.src);
      if (node.tagName === 'a' && attrs.href?.includes('paper.pdf')) assets.push(attrs.href);
      for (const child of node.childNodes || []) visit(child);
    };
    visit(parse(html));
    assert.equal(assets.length, 2);
    for (const asset of assets) {
      const url = new URL(asset, 'https://example.test/notes/20-knowledge/first-note.html');
      assert.ok(url.pathname.startsWith('/notes/'), asset);
      await fs.access(path.join(output, decodeURIComponent(url.pathname.slice(7))));
    }
    const index = JSON.parse(await fs.readFile(path.join(output, 'static/contentIndex.json'), 'utf8'));
    assert.ok(index['20-knowledge/first-note']);
    assert.ok(index['20-knowledge/second-note']);
    assert.ok(!Object.keys(index).some(key => /secret/i.test(key)));
    assert.doesNotMatch(JSON.stringify(index), /Unpublished secret sentinel/);
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});

test('candidate builds and verification rebuild navigation, search, backlinks and remove old folder pages', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'homepage-mirror-build-'));
  try {
    const vaultPath = path.join(tmp, 'vault'), content = path.join(tmp, 'content'), output = path.join(tmp, 'dist');
    await fs.mkdir(path.join(vaultPath, 'Original/Nested'), { recursive: true });
    await fs.writeFile(path.join(vaultPath, 'Original/Nested/First.md'), '---\npublish: true\n---\n[[Second]]');
    await fs.writeFile(path.join(vaultPath, 'Original/Nested/Second.md'), '---\npublish: true\n---\nA public target');
    await fs.writeFile(path.join(vaultPath, 'Private.md'), 'private-sentinel-must-not-appear');
    const env = { ...process.env, HOMEPAGE_CONTENT_DIR: content, HOMEPAGE_DIST_DIR: output };
    const build = async () => {
      await exportVault({ vaultPath, destination: content });
      for (const script of ['build.mjs', 'verify.mjs']) {
        const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, env, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stdout + result.stderr);
      }
      return JSON.parse(await fs.readFile(path.join(output, 'notes/static/contentIndex.json'), 'utf8'));
    };
    const first = await build();
    assert.ok(first['original/nested/first']);
    await fs.rename(path.join(vaultPath, 'Original'), path.join(vaultPath, 'Renamed'));
    const second = await build();
    assert.ok(second['renamed/nested/first']);
    assert.ok(second['renamed/nested/first'].links.includes('renamed/nested/second'));
    const html = parse(await fs.readFile(path.join(output, 'notes/renamed/nested/second.html'), 'utf8'));
    let backlinkFound = false;
    const inspect = (node, inBacklinks = false) => {
      const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
      inBacklinks ||= (attrs.class || '').split(' ').includes('backlinks');
      if (inBacklinks && node.tagName === 'a' && attrs.href?.includes('first')) backlinkFound = true;
      for (const child of node.childNodes || []) inspect(child, inBacklinks);
    };
    inspect(html); assert.equal(backlinkFound, true);
    assert.ok(!Object.keys(second).some(key => key.startsWith('original/')));
    await assert.rejects(fs.access(path.join(output, 'notes/original')));
    assert.doesNotMatch(JSON.stringify(second), /private-sentinel/);
    await fs.rm(path.join(vaultPath, 'Renamed'), { recursive: true });
    const empty = await build();
    assert.ok(!Object.keys(empty).some(key => key.startsWith('renamed/')));
    await assert.rejects(fs.access(path.join(output, 'notes/renamed')));
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
});
