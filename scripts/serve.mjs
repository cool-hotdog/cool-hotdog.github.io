import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from './sync-notes.mjs';
const base = path.join(root, 'dist');
const port = Number(process.env.PORT || 4321);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png', '.pdf':'application/pdf', '.woff2':'font/woff2', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(base, '.' + pathname);
    if (file !== base && !file.startsWith(base + path.sep)) throw new Error('Invalid path');
    let stat = await fs.stat(file).catch(() => null);
    if (stat?.isDirectory()) { file = path.join(file, 'index.html'); stat = await fs.stat(file).catch(() => null); }
    // Mirrors Pages clean URLs without masking missing resources as a successful page.
    if (!stat && !path.extname(file)) { file += '.html'; stat = await fs.stat(file).catch(() => null); }
    if (!stat?.isFile()) { res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }); res.end(await fs.readFile(path.join(base,'404.html'))); return; }
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://localhost:${port}`));
