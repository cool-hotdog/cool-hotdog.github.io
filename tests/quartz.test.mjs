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
