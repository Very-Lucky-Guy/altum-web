(() => {
  const key = 'altum.language';
  const supported = value => typeof value === 'string' && /^(es|en)(-|$)/i.test(value) ? value.slice(0, 2).toLowerCase() : null;
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  let current = ['es', 'en'].includes(saved) ? saved :
    (navigator.languages || [navigator.language]).map(supported).find(Boolean) || 'en';
  document.documentElement.lang = current;
  window.AltumLanguage = {
    get: () => current,
    set(value) {
      if (!['es', 'en'].includes(value)) return;
      current = value;
      document.documentElement.lang = value;
      try { localStorage.setItem(key, value); } catch {}
    }
  };
})();
