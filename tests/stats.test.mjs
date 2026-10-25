import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'parse5';
import { renderStats } from '../site/stats.mjs';

const loader = await fs.readFile(new URL('../site/assets/stats.js', import.meta.url), 'utf8');
const client = await fs.readFile(new URL('../site/assets/goatcounter-count.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({ origin = 'https://cool-hotdog.github.io', path = '/notes/%E4%B8%AD%E6%96%87.html', endpoint = 'https://test-account.goatcounter.com/count', respond, lang = 'zh' } = {}) {
  const ids = new Map();
  let stats, status;
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
    const element = { hidden: 'hidden' in attrs, textContent: '', dataset: {} };
    if (attrs.id) ids.set(attrs.id, element);
    if (attrs.class === 'site-stats') {
      stats = element;
      stats.dataset.unavailable = attrs['data-unavailable'];
    }
    if (attrs.class === 'site-stats-status') status = element;
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(renderStats(lang)));
  stats.querySelector = () => status;
  const scripts = [], requests = [], beacons = [], timers = new Map();
  const location = new URL(origin + path + '?utm_source=test#section');
  const document = {
    title: 'Test page', referrer: '', visibilityState: 'visible',
    body: { appendChild() {} },
    head: { appendChild: script => scripts.push(script) },
    querySelector(selector) {
      if (selector === '.site-stats') return stats;
      if (selector === 'meta[name="goatcounter-endpoint"]') return { content: endpoint };
      if (selector === 'script[data-goatcounter]') return scripts[0];
      return null;
    },
    querySelectorAll: () => [],
    getElementById: id => ids.get(id),
    createElement: () => ({ dataset: {}, style: {}, setAttribute() {} }),
  };
  const context = vm.createContext({
    document, location, URL, AbortController, console,
    parent: { location }, screen: { width: 1280 },
    localStorage: { getItem: () => null },
    navigator: { sendBeacon: url => { beacons.push(url); return true; } },
    setTimeout: fn => { const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (respond) return respond(url, options);
      return { ok: true, json: async () => ({ count: url.includes('/TOTAL.') ? '1,234' : '7' }) };
    },
  });
  context.window = context;
  const run = () => vm.runInContext(loader, context);
  run();
  return {
    stats, status, ids, scripts, requests, beacons, context, timers, run,
    loadClient() { vm.runInContext(client, context); scripts[0].onload(); },
    expire() { for (const fn of [...timers.values()]) fn(); },
  };
}

test('shared bilingual footer replaces Busuanzi without inventing a unique-person count', () => {
  for (const lang of ['zh', 'en']) {
    const html = renderStats(lang);
    assert.doesNotMatch(html, /busuanzi|site_uv|page_pv/);
    assert.match(html, /role="status"/);
    assert.match(html, /goatcounter_container_site_count/);
    assert.match(html, /goatcounter_container_page_count/);
  }
});

test('official client records once and public counters use exactly the same encoded page path', async () => {
  const h = harness();
  h.loadClient();
  await flush();
  assert.equal(h.scripts[0].src, '/assets/goatcounter-count.js');
  assert.equal(h.beacons.length, 1);
  const recorded = new URL(h.beacons[0]);
  assert.equal(recorded.origin, 'https://test-account.goatcounter.com');
  assert.equal(recorded.pathname, '/count');
  const countedPath = recorded.searchParams.get('p');
  assert.equal(countedPath, '/notes/%E4%B8%AD%E6%96%87.html');
  assert.ok(h.requests.some(r => r.url.endsWith(`/counter/${encodeURIComponent(countedPath)}.json`)));
  assert.ok(h.requests.some(r => r.url.endsWith('/counter/TOTAL.json')));
  assert.equal(h.ids.get('goatcounter_value_site_count').textContent, '1,234');
  assert.equal(h.ids.get('goatcounter_container_page_count').hidden, false);
  assert.equal(h.status.hidden, true);
  assert.equal(h.timers.size, 0);
  h.run();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.requests.length, 2);
  assert.equal(h.beacons.length, 1);
});

test('previews and other origins send neither recording nor counter requests', async () => {
  for (const origin of ['http://localhost:4321', 'https://example.com', 'http://cool-hotdog.github.io']) {
    const h = harness({ origin });
    await flush();
    assert.equal(h.stats.hidden, true);
    assert.equal(h.scripts.length, 0);
    assert.equal(h.requests.length, 0);
  }
});

test('missing or malformed account address fails visibly without external requests', () => {
  for (const endpoint of ['', 'https://example.com/count', 'https://user:secret@test.goatcounter.com/count']) {
    const h = harness({ endpoint });
    assert.equal(h.status.textContent, '统计暂不可用');
    assert.equal(h.scripts.length, 0);
    assert.equal(h.requests.length, 0);
  }
});

test('disabled public counters fail visibly but do not block visit recording', async () => {
  const h = harness({ respond: async () => ({ ok: false, status: 403 }) });
  h.loadClient();
  await flush();
  assert.equal(h.beacons.length, 1);
  assert.equal(h.status.textContent, '统计暂不可用');
  assert.equal(h.status.hidden, false);
  assert.equal(h.ids.get('goatcounter_container_site_count').hidden, true);
  assert.equal(h.ids.get('goatcounter_value_site_count').textContent, '');
});

test('a new or unavailable page never becomes a fabricated zero; valid total stays visible', async () => {
  const h = harness({ respond: async url => url.includes('/TOTAL.')
    ? { ok: true, json: async () => ({ count: '12' }) }
    : { ok: false, status: 404 } });
  h.loadClient();
  await flush();
  assert.equal(h.ids.get('goatcounter_value_site_count').textContent, '12');
  assert.equal(h.ids.get('goatcounter_container_site_count').hidden, false);
  assert.equal(h.ids.get('goatcounter_container_page_count').hidden, true);
  assert.equal(h.status.textContent, '统计暂不可用');
});

test('hung public requests are aborted at timeout without retrying recording', async () => {
  const h = harness({ respond: (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  }) });
  h.loadClient();
  h.expire();
  await flush();
  assert.equal(h.beacons.length, 1);
  assert.equal(h.status.textContent, '统计暂不可用');
  assert.ok(h.requests.every(r => r.options.signal.aborted));
  assert.equal(h.ids.get('goatcounter_value_page_count').textContent, '');
});

test('script failure is visible in English and does not claim counters are healthy', async () => {
  const h = harness({ lang: 'en' });
  h.scripts[0].onerror();
  await flush();
  assert.equal(h.status.textContent, 'Statistics temporarily unavailable');
  assert.equal(h.status.hidden, false);
});

test('malformed counter data is rejected while a genuine zero is accepted', async () => {
  const h = harness({ respond: async url => ({ ok: true, json: async () => ({ count: url.includes('/TOTAL.') ? 0 : '<b>10</b>' }) }) });
  h.loadClient();
  await flush();
  assert.equal(h.ids.get('goatcounter_value_site_count').textContent, '0');
  assert.equal(h.ids.get('goatcounter_container_site_count').hidden, false);
  assert.equal(h.ids.get('goatcounter_container_page_count').hidden, true);
  assert.equal(h.status.textContent, '统计暂不可用');
});
