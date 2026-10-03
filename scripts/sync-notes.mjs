import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { slugifyFilePath } from '@quartz-community/utils/path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parser = unified().use(remarkParse);
const posix = p => p.split(path.sep).join('/');
const hash = value => createHash('sha256').update(value).digest('hex');
const escapeMd = value => String(value).replace(/[\\[\]*_`<>]/g, '\\$&');
const external = value => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value);
const forbidden = rel => rel.split('/').some(p => p.startsWith('.') || p === 'Templates');
const slug = value => slugifyFilePath(value);

export function frontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const data = match ? YAML.parse(match[1]) ?? {} : {};
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Frontmatter must be a YAML object');
  return { data, body: match ? raw.slice(match[0].length) : raw };
}

async function inventory(dir, base = dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = posix(path.relative(base, full));
    if (forbidden(rel)) continue;
    if (entry.isSymbolicLink()) continue; // Never follow a link out of the selected vault.
    if (entry.isDirectory()) files.push(...await inventory(full, base));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

function resolveTarget(value, source, files, notes, noteOnly = false) {
  let target = value.split('#')[0].split('?')[0];
  try { target = decodeURIComponent(target); } catch { /* literal percent in filename */ }
  target = target.replace(/\\/g, '/');
  if (!target) return { rel: source, anchorOnly: true };
  const variants = [target.replace(/^\//, ''), path.posix.normalize(path.posix.join(path.posix.dirname(source), target))];
  for (const candidate of variants) {
    const candidates = [candidate, ...(path.posix.extname(candidate) ? [] : [candidate + '.md'])];
    const matches = candidates.filter(p => files.includes(p) && (!noteOnly || notes.has(p)));
    if (matches.length > 1) throw new Error(`${source}: ambiguous target ${value}`);
    if (matches.length === 1) return { rel: matches[0] };
  }
  const matches = files.filter(p => (!noteOnly || notes.has(p)) &&
    (path.posix.basename(p) === target || path.posix.basename(p, '.md') === target || notes.get(p)?.aliases.includes(target)));
  if (matches.length > 1) throw new Error(`${source}: ambiguous target ${value}; use its vault-relative path`);
  return matches.length ? { rel: matches[0] } : null;
}

export async function exportVault({ vaultPath, destination }) {
  const files = await inventory(vaultPath);
  const notes = new Map();
  for (const rel of files.filter(p => p.endsWith('.md'))) {
    const raw = await fs.readFile(path.join(vaultPath, rel), 'utf8');
    const { data, body } = frontmatter(raw);
    notes.set(rel, { data, body, aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : typeof data.alias === 'string' ? [data.alias] : [] });
  }
  const selected = new Set([...notes].filter(([, n]) => n.data.publish === true && n.data.draft !== true).map(([rel]) => rel));
  const assets = new Set();
  const warnings = [];
  const exports = new Map();
  const metadata = [];
  const outputs = new Set(['index']);
  const requireAsset = (value, source) => {
    const resolved = resolveTarget(value, source, files, notes);
    if (!resolved) throw new Error(`${source}: missing attachment ${value}`);
    if (notes.has(resolved.rel)) return resolved;
    if (!/\.(?:png|jpe?g|gif|webp|svg|avif|pdf|mp3|wav|ogg|mp4|webm|csv|txt)$/i.test(resolved.rel))
      throw new Error(`${source}: unsupported public attachment ${value}`);
    assets.add(resolved.rel);
    return resolved;
  };
  for (const rel of selected) {
    const note = notes.get(rel);
    // Obsidian comments are local-only, including any references inside them.
    const body = note.body.replace(/%%[\s\S]*?%%/g, '');
    const tree = parser.parse(body);
    const edits = [];
    visit(tree, node => {
      if (node.type === 'text') {
        const raw = body.slice(node.position.start.offset, node.position.end.offset);
        for (const match of raw.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
          const [all, embed, spec] = match;
          const [target, alias] = spec.split('|');
          const resolved = resolveTarget(target, rel, files, notes);
          const start = node.position.start.offset + match.index;
          if (resolved && !notes.has(resolved.rel)) {
            requireAsset(target, rel);
            const anchor = target.includes('#') ? '#' + target.split('#').slice(1).join('#') : '';
            edits.push({ start, end: start + all.length, value: `${embed}[[${resolved.rel}${anchor}${alias ? '|' + alias : ''}]]` });
          } else if (resolved && selected.has(resolved.rel)) {
            const anchor = target.includes('#') ? '#' + target.split('#').slice(1).join('#') : '';
            edits.push({ start, end: start + all.length, value: `${embed}[[${resolved.rel.replace(/\.md$/, '')}${anchor}${alias ? '|' + alias : ''}]]` });
          } else {
            if (embed) throw new Error(`${rel}: embedded note is missing or unpublished: ${target}`);
            warnings.push(`${rel}: unpublished/missing link converted to text: ${target}`);
            edits.push({ start, end: start + all.length, value: escapeMd(alias || target.split('#')[0]) });
          }
        }
      }
      if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
        if (external(node.url) || node.url.startsWith('#')) return;
        const resolved = requireAsset(node.url, rel);
        if (notes.has(resolved.rel) && !selected.has(resolved.rel)) {
          if (node.type !== 'link') throw new Error(`${rel}: unpublished note referenced by image/definition: ${node.url}`);
          const label = node.children.map(n => n.value || '').join('');
          edits.push({ start: node.position.start.offset, end: node.position.end.offset, value: escapeMd(label) });
          warnings.push(`${rel}: unpublished markdown link converted to text: ${node.url}`);
        } else {
          const raw = body.slice(node.position.start.offset, node.position.end.offset);
          const relative = path.posix.relative(path.posix.dirname(rel), resolved.rel);
          const anchor = node.url.includes('#') ? '#' + node.url.split('#').slice(1).join('#') : '';
          edits.push({ start: node.position.start.offset, end: node.position.end.offset, value: raw.replace(node.url, encodeURI(relative + anchor)) });
        }
      }
      if (node.type === 'html') {
        const raw = body.slice(node.position.start.offset, node.position.end.offset);
        // Raw HTML assets must also be covered by the attachment allowlist.
        let updated = raw.replace(/\b(src|href)\s*=\s*["']([^"']+)["']/gi, (all, attr, value) => {
          if (external(value) || value.startsWith('#')) return all;
          const resolved = requireAsset(value, rel);
          if (notes.has(resolved.rel)) throw new Error(`${rel}: use a Markdown link for note reference ${value}`);
          return `${attr}="${encodeURI(path.posix.relative(path.posix.dirname(rel), resolved.rel))}"`;
        });
        if (/\b(?:srcset|style)\s*=|<\s*(?:script|iframe|object|base)\b/i.test(updated)) throw new Error(`${rel}: unsupported embedded HTML; use Markdown assets`);
        if (updated !== raw) edits.push({ start: node.position.start.offset, end: node.position.end.offset, value: updated });
      }
    });
    let transformed = body;
    for (const edit of edits.sort((a, b) => b.start - a.start)) transformed = transformed.slice(0, edit.start) + edit.value + transformed.slice(edit.end);
    const publicSlug = slug(rel);
    if (outputs.has(publicSlug)) throw new Error(`Duplicate/reserved public URL: ${rel}`);
    outputs.add(publicSlug);
    const stat = await fs.stat(path.join(vaultPath, rel));
    const title = String(note.data.title || path.posix.basename(rel, '.md'));
    const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : stat.mtime.toISOString();
    const fm = { title, publish: true, tags: Array.isArray(note.data.tags) ? note.data.tags : [], created: date(note.data.created), modified: date(note.data.modified || note.data.updated) };
    if (typeof note.data.description === 'string') fm.description = note.data.description;
    const exported = `---\n${YAML.stringify(fm)}---\n${transformed}`;
    exports.set(rel, Buffer.from(exported));
    metadata.push({ path: rel, title, url: `/notes/${publicSlug}.html`, tags: fm.tags, modified: fm.modified, featured: note.data.featured === true, description: fm.description || '', sha256: hash(exported) });
  }
  for (const rel of assets) exports.set(rel, await fs.readFile(path.join(vaultPath, rel)));
  const categories = [
    ['10 Courses', '课程 · Courses'], ['20 Knowledge', '知识 · Knowledge'],
    ['30 Projects', '项目笔记 · Projects'], ['40 Sources', '阅读资料 · Sources'], ['90 Meta/MOCs', '知识地图 · MOCs'],
  ];
  const groups = categories.map(([prefix, label]) => {
    const children = metadata.filter(n => n.path.startsWith(prefix + '/'));
    return children.length ? `## ${label}\n\n${children.map(n => `- [[${n.path.replace(/\.md$/, '')}|${n.title}]]`).join('\n')}` : '';
  }).filter(Boolean);
  const other = metadata.filter(n => !categories.some(([prefix]) => n.path.startsWith(prefix + '/')));
  if (other.length) groups.push(`## 其他笔记 · Other notes\n\n${other.map(n => `- [[${n.path.replace(/\.md$/, '')}|${n.title}]]`).join('\n')}`);
  exports.set('index.md', Buffer.from(`---\ntitle: 公开笔记\npublish: true\n---\n\n经济学、数学与计算机的学习记录。通过课程与知识地图，连接概念、推导和实践。\n\n${groups.join('\n\n') || '笔记整理中。'}\n`));
  // Read every source successfully before replacing the previous public export.
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const staging = await fs.mkdtemp(path.join(path.dirname(destination), '.notes-export-'));
  const backup = `${destination}.previous`;
  try {
    for (const [rel, bytes] of exports) {
      const full = path.join(staging, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, bytes);
    }
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify({ notes: metadata.sort((a, b) => b.modified.localeCompare(a.modified)), assets: [...assets].sort() }, null, 2) + '\n');
    await fs.rm(backup, { recursive: true, force: true });
    try { await fs.rename(destination, backup); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await fs.rename(staging, destination); } catch (e) { await fs.rename(backup, destination).catch(() => {}); throw e; }
    await fs.rm(backup, { recursive: true, force: true });
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
  return { notes: metadata, assets: [...assets], warnings };
}

async function main() {
  const cfg = JSON.parse(await fs.readFile(path.join(root, 'notes.config.json'), 'utf8'));
  const local = await fs.readFile(path.join(root, cfg.localConfig), 'utf8').then(JSON.parse).catch(e => { if (e.code === 'ENOENT') return {}; throw e; });
  const vaultPath = process.env[cfg.vaultPathEnv] || local.vaultPath;
  if (!vaultPath) throw new Error(`Set ${cfg.vaultPathEnv} or vaultPath in ${cfg.localConfig}`);
  const destination = path.join(root, cfg.contentDirectory);
  const previous = await fs.readFile(path.join(destination, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => ({ notes: [] }));
  const result = await exportVault({ vaultPath, destination });
  for (const note of result.notes) {
    const old = previous.notes.find(n => n.path === note.path);
    if (!old || old.sha256 !== note.sha256) console.log(`${old ? '更新' : '新增'}: ${note.path}`);
  }
  for (const note of previous.notes.filter(n => !result.notes.some(p => p.path === n.path))) console.log(`撤下: ${note.path}`);
  for (const warning of result.warnings) console.warn(warning);
  console.log(`已导出 ${result.notes.length} 篇公开笔记、${result.assets.length} 个附件。`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
