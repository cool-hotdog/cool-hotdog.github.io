// Do not record localhost previews or other hosts in the production counters.
if (location.protocol === 'https:' && location.hostname === 'cool-hotdog.github.io') {
  const script = document.createElement('script');
  script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  script.async = true;
  document.head.appendChild(script);
}
