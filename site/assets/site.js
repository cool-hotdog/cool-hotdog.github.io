document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('saved-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('saved-theme', theme);
  try { localStorage.setItem('theme', theme); } catch { /* theme still works without storage */ }
});
