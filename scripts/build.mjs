import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { root } from './sync-notes.mjs';
import { render } from '../site/render.mjs';

const dist = path.resolve(process.env.HOMEPAGE_DIST_DIR || path.join(root, 'dist'));
const content = path.resolve(process.env.HOMEPAGE_CONTENT_DIR || path.join(root, 'content'));
if (dist === root || content === dist || content.startsWith(dist + path.sep) || dist.startsWith(content + path.sep)) throw new Error('构建目录不能覆盖源内容或项目根目录。');
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(content, 'manifest.json'), 'utf8'));
const engine = path.join(root, 'quartz-engine');
// Quartz honors ancestor .gitignore files. Candidate snapshots live in ignored
// .local/, so build an isolated copy where that ignore rule cannot hide notes.
let isolated, input = content, result;
try {
  if (process.env.HOMEPAGE_CONTENT_DIR) {
    isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'homepage-build-'));
    input = path.join(isolated, 'content');
    await fs.cp(content, input, { recursive: true });
  }
  result = spawnSync(process.execPath, ['quartz/bootstrap-cli.mjs', 'build', '-d', input, '-o', path.join(dist, 'notes'), '--concurrency', '2'], { cwd: engine, stdio: 'inherit' });
} finally { if (isolated) await fs.rm(isolated, { recursive: true, force: true }); }
if (result.status !== 0) process.exit(result.status || 1);
async function addNotesNavigation(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await addNotesNavigation(full);
    else if (entry.name.endsWith('.html')) {
      let html = await fs.readFile(full, 'utf8');
      html = html.replace('</head>', '<script src="/assets/theme-init.js"></script></head>');
      html = html.replace(/(<body[^>]*>)/, '$1<nav class="notes-home-nav" aria-label="网站导航"><a class="notes-brand" href="/">James Liang <span aria-hidden="true">/</span> Notes</a><div><a href="/">中文主页</a><a href="/en/">English</a><a href="/about/">关于 ↗</a></div></nav>');
      await fs.writeFile(full, html);
    }
  }
}
await addNotesNavigation(path.join(dist, 'notes'));
await fs.cp(path.join(root, 'site/assets'), path.join(dist, 'assets'), { recursive: true });
for (const lang of ['zh', 'en']) {
  for (const page of ['', 'about']) {
    const output = path.join(dist, lang === 'en' ? 'en' : '', page);
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'index.html'), render(lang, page, manifest.notes));
  }
}
// Preserve old bookmarks without publishing project details.
for (const lang of ['zh', 'en']) {
  const target = lang === 'en' ? '/en/' : '/';
  const output = path.join(dist, lang === 'en' ? 'en' : '', 'projects');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="${lang === 'en' ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target}"><title>James Liang</title><link rel="canonical" href="https://cool-hotdog.github.io${target}"></head><body><a href="${target}">${lang === 'en' ? 'Home' : '返回首页'}</a></body></html>`);
}
await fs.writeFile(path.join(dist, 'about-cn.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/about/"><title>关于 James</title><link rel="canonical" href="https://cool-hotdog.github.io/about/"></head><body><a href="/about/">关于 James</a></body></html>');
await fs.writeFile(path.join(dist, '.nojekyll'), '');
await fs.writeFile(path.join(dist, '404.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面未找到 · James Liang</title><link rel="stylesheet" href="/assets/site.css"></head><body><main class="site-main"><div class="page-heading"><div class="micro">404 / NOT FOUND</div><h1>这条路径尚未写下。</h1><p>Page not found.</p></div><a class="button" href="/">返回首页 / Home ↗</a></main></body></html>');
const urls = ['/', '/en/', '/about/', '/en/about/'];
await fs.writeFile(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>https://cool-hotdog.github.io${u}</loc></url>`).join('')}</urlset>`);
await fs.writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://cool-hotdog.github.io/sitemap.xml\nSitemap: https://cool-hotdog.github.io/notes/sitemap.xml\n');
console.log('展示页与笔记库已构建到 dist/');
