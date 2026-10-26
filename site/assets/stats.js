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
  let scriptReady = false, countersReady = false, failed = false, pagePending = false;
  const finish = () => {
    if (scriptReady && countersReady && !failed) {
      clearTimeout(deadline);
      status.hidden = !pagePending;
      if (pagePending) status.textContent = stats.dataset.pending;
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
  // All public counters use the account's actual activation date. Keep this
  // fixed: changing it per request would change the range and defeat caching.
  const startDate = document.querySelector('meta[name="goatcounter-start-date"]')?.content;
  const range = startDate ? `?start=${encodeURIComponent(startDate)}` : '';
  const counters = [['site_count', 'TOTAL'], ['page_count', path]];
  Promise.allSettled(counters.map(async ([key, counterPath]) => {
    try {
      const response = await fetch(`${origin}/counter/${encodeURIComponent(counterPath)}.json${range}`, {
        credentials: 'omit', signal: controller.signal,
      });
      // A missing page can remain cached for hours after its first visit is
      // recorded. Only GoatCounter's explicit 404 + zero JSON means pending;
      // permission errors, invalid data, and network errors are still failures.
      if (!response.ok && !(response.status === 404 && key === 'page_count')) throw new Error(`Counter HTTP ${response.status}`);
      const { count } = await response.json();
      const valid = typeof count === 'number'
        ? Number.isSafeInteger(count) && count >= 0
        : typeof count === 'string' && /^\d+(?:,\d{3})*$/.test(count);
      if (!valid || controller.signal.aborted) throw new Error('Invalid counter response');
      if (response.status === 404) {
        if (Number(count) !== 0) throw new Error('Unexpected missing-page count');
        pagePending = true;
        return;
      }
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
