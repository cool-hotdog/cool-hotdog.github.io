import analytics from './analytics.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const endpoint = analytics.goatcounterEndpoint;
const startDate = analytics.counterStartDate;
if (typeof endpoint !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.goatcounter\.com\/count$/.test(endpoint)) {
  throw new Error('GoatCounter 地址应为 https://账户名.goatcounter.com/count');
}
if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(Date.parse(startDate)) || new Date(startDate).toISOString().slice(0, 10) !== startDate) {
  throw new Error('GoatCounter 统计起始日期应为 YYYY-MM-DD');
}

// Shared by the standalone pages and the generated Quartz note pages.
const loaderVersion = createHash('sha256').update(readFileSync(new URL('./assets/stats.js', import.meta.url))).digest('hex').slice(0, 12);
export const statsHead = `<meta name="goatcounter-endpoint" content="${endpoint}"><meta name="goatcounter-start-date" content="${startDate}"><link rel="stylesheet" href="/assets/stats.css"><script src="/assets/stats.js?v=${loaderVersion}" defer></script>`;

export function renderStats(lang = 'zh') {
  const labels = lang === 'en'
    ? ['Site visits', 'Page visits', `Visits since ${startDate}, counted by GoatCounter; totals may be cached for up to four hours.`, 'Loading statistics…', 'Statistics temporarily unavailable', 'Page statistics updating']
    : ['全站访问', '本页访问', `自 ${startDate} 起按 GoatCounter 服务口径统计访问次数，默认会话去重；公开数字可能延迟最多四小时。`, '统计加载中…', '统计暂不可用', '本页统计更新中'];
  return `<div class="site-stats" aria-label="${lang === 'en' ? 'Visit statistics' : '访问统计'}" title="${labels[2]}" data-unavailable="${labels[4]}" data-pending="${labels[5]}">${['site_count', 'page_count'].map((key, i) => `<span id="goatcounter_container_${key}" hidden>${labels[i]} <span id="goatcounter_value_${key}"></span></span>`).join('')}<span class="site-stats-status" role="status">${labels[3]}</span></div>`;
}
