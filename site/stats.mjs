import analytics from './analytics.json' with { type: 'json' };

// An empty endpoint is allowed while preparing an account, but sends no data.
const endpoint = analytics.goatcounterEndpoint;
if (typeof endpoint !== 'string' || (endpoint && !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.goatcounter\.com\/count$/.test(endpoint))) {
  throw new Error('GoatCounter 地址应为 https://账户名.goatcounter.com/count');
}

// Shared by the standalone pages and the generated Quartz note pages.
export const statsHead = `<meta name="goatcounter-endpoint" content="${endpoint}"><link rel="stylesheet" href="/assets/stats.css"><script src="/assets/stats.js" defer></script>`;

export function renderStats(lang = 'zh') {
  const labels = lang === 'en'
    ? ['Site visits', 'Page visits', 'Visits counted by GoatCounter; totals may be cached for up to four hours.', 'Loading statistics…', 'Statistics temporarily unavailable']
    : ['全站访问', '本页访问', '按 GoatCounter 服务口径统计访问次数，默认会话去重；公开数字可能延迟最多四小时。', '统计加载中…', '统计暂不可用'];
  return `<div class="site-stats" aria-label="${lang === 'en' ? 'Visit statistics' : '访问统计'}" title="${labels[2]}" data-unavailable="${labels[4]}">${['site_count', 'page_count'].map((key, i) => `<span id="goatcounter_container_${key}" hidden>${labels[i]} <span id="goatcounter_value_${key}"></span></span>`).join('')}<span class="site-stats-status" role="status">${labels[3]}</span></div>`;
}
