import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { root } from './sync-notes.mjs';

const dist = path.resolve(process.env.HOMEPAGE_DIST_DIR || path.join(root, 'dist'));
const content = path.resolve(process.env.HOMEPAGE_CONTENT_DIR || path.join(root, 'content'));
const origin = 'https://cool-hotdog.github.io';
const errors = [];
let references = 0;
async function files(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else result.push(full);
  }
  return result;
}
const outputs = await files(dist);
const available = new Set(outputs.map(f => '/' + path.relative(dist, f).split(path.sep).join('/')));
function targetFor(url) {
  let name;
  try { name = decodeURIComponent(url.pathname); } catch { return null; }
  if (available.has(name)) return name;
  if (available.has(name.replace(/\/$/, '') + '/index.html')) return name.replace(/\/$/, '') + '/index.html';
  if (available.has(name + '.html')) return name + '.html';
  return null;
}
for (const file of outputs.filter(f => f.endsWith('.html'))) {
  const rel = '/' + path.relative(dist, file).split(path.sep).join('/');
  const tree = parse(await fs.readFile(file, 'utf8'));
  const statsIds = new Map();
  let statsLoaders = 0, statsStyles = 0, redirects = false;
  const visit = node => {
    const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
    if (attrs.id?.startsWith('busuanzi_')) statsIds.set(attrs.id, (statsIds.get(attrs.id) || 0) + 1);
    if (node.tagName === 'script' && attrs.src === '/assets/stats.js') statsLoaders++;
    if (node.tagName === 'link' && attrs.href === '/assets/stats.css') statsStyles++;
    if (node.tagName === 'meta' && attrs['http-equiv']?.toLowerCase() === 'refresh') redirects = true;
    if (attrs.property === 'og:image') attrs.src = attrs.content;
    for (const key of ['href', 'src', 'poster']) {
      const value = attrs[key];
      if (!value || value.startsWith('#') || /^(?:data:|mailto:|tel:)/.test(value)) continue;
      const url = new URL(value, origin + rel);
      if (url.origin !== origin) continue;
      references++;
      if (!targetFor(url)) errors.push(`${rel}: missing ${key}=${value}`);
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(tree);
  const shouldCount = !redirects && !rel.endsWith('/404.html');
  if (statsLoaders !== Number(shouldCount) || statsStyles !== Number(shouldCount)) errors.push(`${rel}: incorrect statistics resources`);
  for (const key of ['site_pv', 'site_uv', 'page_pv']) {
    for (const prefix of ['container', 'value']) {
      if ((statsIds.get(`busuanzi_${prefix}_${key}`) || 0) !== Number(shouldCount)) errors.push(`${rel}: incorrect ${prefix} for ${key}`);
    }
  }
}
const manifest = JSON.parse(await fs.readFile(path.join(content, 'manifest.json'), 'utf8'));
const index = JSON.parse(await fs.readFile(path.join(dist, 'notes/static/contentIndex.json'), 'utf8'));
for (const note of manifest.notes) {
  if (!targetFor(new URL(note.url, origin))) errors.push(`Published note missing: ${note.path}`);
  const slug = note.url.slice('/notes/'.length).replace(/\.html$/, '');
  if (!index[slug]) errors.push(`Published note absent from search index: ${note.path}`);
}
// Only generated navigation pages and explicit public notes may enter search/graph.
const permitted = new Set(manifest.notes.map(n => n.url.slice(7).replace(/\.html$/, '')));
for (const slug of Object.keys(index)) {
  if (!permitted.has(slug) && slug !== 'index' && !slug.endsWith('/index') && !slug.startsWith('tags/')) errors.push(`Unexpected search/graph entry: ${slug}`);
}
for (const file of available) if (/\/(?:\.obsidian|Templates)\/|manifest\.json$/.test(file)) errors.push(`Private/config artifact in build: ${file}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`验证通过：${outputs.filter(f => f.endsWith('.html')).length} 个页面、${references} 个内部链接/资源、${manifest.notes.length} 篇公开笔记。`);
