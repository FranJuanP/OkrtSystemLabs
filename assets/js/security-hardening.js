(() => {
  'use strict';

  function isSafeUrl(raw) {
    if (typeof raw !== 'string') return true;
    const url = raw.trim();
    if (!url) return true;
    return !/^javascript:/i.test(url) && !/^data:text\/html/i.test(url);
  }

  function hardenExternalLinks(scope = document) {
    const nodes = scope.querySelectorAll('a[href], area[href]');
    for (const node of nodes) {
      const href = node.getAttribute('href');
      if (!isSafeUrl(href)) {
        node.removeAttribute('href');
        continue;
      }
      if (node.getAttribute('target') === '_blank') {
        const current = (node.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        const rel = new Set(current);
        rel.add('noopener');
        rel.add('noreferrer');
        node.setAttribute('rel', Array.from(rel).join(' '));
      }
      if (/^https?:\/\//i.test(href) && !node.hasAttribute('referrerpolicy')) {
        node.setAttribute('referrerpolicy', 'no-referrer');
      }
    }
  }

  function hardenForms(scope = document) {
    const forms = scope.querySelectorAll('form[action]');
    for (const form of forms) {
      const action = form.getAttribute('action');
      if (!isSafeUrl(action)) {
        form.setAttribute('action', '');
      }
    }
  }

  const originalOpen = window.open;
  if (typeof originalOpen === 'function') {
    window.open = function patchedOpen(url, target, features) {
      if (!isSafeUrl(typeof url === 'string' ? url : '')) return null;
      const safeTarget = target || '_blank';
      const parts = String(features || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
      const featureSet = new Set(parts);
      featureSet.add('noopener');
      featureSet.add('noreferrer');
      return originalOpen.call(window, url, safeTarget, Array.from(featureSet).join(','));
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      hardenExternalLinks();
      hardenForms();
    }, { once: true });
  } else {
    hardenExternalLinks();
    hardenForms();
  }
})();
