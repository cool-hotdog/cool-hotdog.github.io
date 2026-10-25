(() => {
  const stats = document.querySelector('.site-stats');
  if (!stats) return;
  // Previews, other hosts, and repeated loader execution must not send visits.
  if (location.protocol !== 'https:' || location.hostname !== 'cool-hotdog.github.io') {
    stats.hidden = true;
    return;
  }
  if (window.homepageStatsStarted) return;
  window.homepageStatsStarted = true;

  const status = stats.querySelector('.site-stats-status');
  const unavailable = () => {
    status.textContent = stats.dataset.unavailable;
    status.hidden = false;
  };
  const endpoint = document.querySelector('meta[name="goatcounter-endpoint"]')?.content;
  if (!endpoint || !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.goatcounter\.com\/count$/.test(endpoint)) {
    unavailable();
    return;
  }

  // Use the same path for recording and reading; ignore query strings/hashes.
  const path = location.pathname;
  window.goatcounter = { ...window.goatcounter, path: () => path, no_events: true };
  const controller = new AbortController();
  let scriptReady = false, countersReady = false, failed = false;
  const finish = () => {
    if (scriptReady && countersReady && !failed) {
      clearTimeout(deadline);
      status.hidden = true;
    }
  };
  const deadline = setTimeout(() => {
    failed = true;
    controller.abort();
    unavailable();
  }, 8000);

  // Host the official ISC-licensed client with the site to avoid a second CDN.
  const script = document.createElement('script');
  script.src = '/assets/goatcounter-count.js';
  script.dataset.goatcounter = endpoint;
  script.async = true;
  script.onload = () => { scriptReady = true; finish(); };
  script.onerror = () => { failed = true; clearTimeout(deadline); controller.abort(); unavailable(); };
  document.head.appendChild(script);

  // Public counters are read-only and cached. Never retry the recording call:
  // a missing response does not prove the visit wasn't recorded.
  const origin = new URL(endpoint).origin;
  const counters = [['site_count', 'TOTAL'], ['page_count', path]];
  Promise.allSettled(counters.map(async ([key, counterPath]) => {
    try {
      const response = await fetch(`${origin}/counter/${encodeURIComponent(counterPath)}.json`, {
        credentials: 'omit', signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Counter HTTP ${response.status}`);
      const { count } = await response.json();
      const valid = typeof count === 'number'
        ? Number.isSafeInteger(count) && count >= 0
        : typeof count === 'string' && /^\d+(?:,\d{3})*$/.test(count);
      if (!valid || controller.signal.aborted) throw new Error('Invalid counter response');
      document.getElementById(`goatcounter_value_${key}`).textContent = String(count);
      document.getElementById(`goatcounter_container_${key}`).hidden = false;
    } catch {
      failed = true;
      unavailable();
    }
  })).then(() => {
    countersReady = true;
    if (failed) clearTimeout(deadline);
    finish();
  });
})();
