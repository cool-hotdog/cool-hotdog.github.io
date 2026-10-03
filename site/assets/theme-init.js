try {
  const choice = localStorage.getItem('theme');
  document.documentElement.setAttribute('saved-theme', choice === 'dark' ? 'dark' : 'light');
} catch { document.documentElement.setAttribute('saved-theme', 'light'); }
