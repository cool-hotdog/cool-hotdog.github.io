// Shared by the standalone pages and the generated Quartz note pages.
export const statsHead = '<link rel="stylesheet" href="/assets/stats.css"><script src="/assets/stats.js" defer></script>';

export function renderStats(lang = 'zh') {
  const labels = lang === 'en'
    ? ['Site views', 'Visitors', 'Page views', 'Visitor counts are estimates provided by Busuanzi.']
    : ['全站浏览', '访客', '本页阅读', '访客数按不蒜子服务口径估算，不等同于实际人数。'];
  return `<div class="site-stats" aria-label="${lang === 'en' ? 'Visit statistics' : '访问统计'}" title="${labels[3]}">${['site_pv', 'site_uv', 'page_pv'].map((key, i) => `<span id="busuanzi_container_${key}" style="display:none">${labels[i]} <span id="busuanzi_value_${key}"></span></span>`).join('')}</div>`;
}
