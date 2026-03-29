(function(){
  'use strict';

  const SAFE_TAGS = new Set(['A','ABBR','B','BR','BUTTON','CODE','DIV','EM','H1','H2','H3','H4','H5','H6','HR','I','IMG','LI','OL','OPTION','OPTGROUP','P','PRE','SECTION','SMALL','SPAN','STRONG','SUB','SUP','TIME','U','UL']);
  const SAFE_ATTRS = new Set(['alt','aria-expanded','aria-haspopup','aria-hidden','class','data-value','disabled','id','loading','referrerpolicy','role','src','srcset','title','type','value']);
  const SAFE_URL_ATTRS = new Set(['href','src','srcset']);
  const SAFE_PROTOCOLS = /^(https?:|data:image\/|blob:|\/|\.\/|\.\.\/|#)/i;
  let busy = false;

  function sanitizeUrl(value){
    const v = String(value || '').trim();
    if (!v) return '';
    return SAFE_PROTOCOLS.test(v) ? v : '';
  }

  function sanitizeStyle(value){
    const raw = String(value || '');
    if (!raw) return '';
    if (/expression\s*\(|javascript\s*:|url\s*\(\s*['"]?javascript:/i.test(raw)) return '';
    return raw;
  }

  function sanitizeNode(node){
    if (!node || node.nodeType !== 1) return;
    const tag = node.tagName.toUpperCase();
    if (!SAFE_TAGS.has(tag)) {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }
    [...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
        return;
      }
      if (name === 'style') {
        const safeStyle = sanitizeStyle(value);
        if (safeStyle) node.setAttribute('style', safeStyle); else node.removeAttribute('style');
        return;
      }
      if (!SAFE_ATTRS.has(name) && !SAFE_URL_ATTRS.has(name)) {
        node.removeAttribute(attr.name);
        return;
      }
      if (SAFE_URL_ATTRS.has(name)) {
        const safeUrl = sanitizeUrl(value);
        if (safeUrl) node.setAttribute(attr.name, safeUrl); else node.removeAttribute(attr.name);
      }
    });
    [...node.childNodes].forEach(child => sanitizeTree(child));
  }

  function sanitizeTree(root){
    if (!root) return;
    if (root.nodeType === 1) sanitizeNode(root);
    else if (root.nodeType === 11 || root.nodeType === 9) [...root.childNodes].forEach(child => sanitizeTree(child));
  }

  function sanitizeHTML(html){
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    sanitizeTree(tpl.content);
    return tpl.innerHTML;
  }

  function safeSetHTML(id, html){
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = sanitizeHTML(html);
  }

  function createFlagNode(code, alt){
    const raw = String(code || '');
    const flagRef = (typeof window.flagRef === 'function') ? window.flagRef(raw) : raw.toLowerCase();
    if (flagRef === '🌍') {
      const span = document.createElement('span');
      span.className = 'okrt-flag okrt-globe';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = '🌍';
      return span;
    }
    const img = document.createElement('img');
    img.className = 'okrt-flag';
    img.src = 'https://flagcdn.com/w20/' + flagRef + '.png';
    img.srcset = 'https://flagcdn.com/w40/' + flagRef + '.png 2x';
    img.alt = alt || raw;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    return img;
  }

  function rebuildFlagSelector(){
    const select = document.getElementById('region-sel');
    if (!select) return;
    const oldShell = select.nextElementSibling && select.nextElementSibling.classList && select.nextElementSibling.classList.contains('okrt-region-shell') ? select.nextElementSibling : null;
    if (oldShell) oldShell.remove();

    const shell = document.createElement('div');
    shell.className = 'okrt-region-shell';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'okrt-region-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const left = document.createElement('span');
    left.className = 'okrt-region-left';
    const chevron = document.createElement('span');
    chevron.className = 'okrt-region-chevron';
    chevron.textContent = '▾';
    btn.append(left, chevron);

    const menu = document.createElement('div');
    menu.className = 'okrt-region-menu';
    menu.setAttribute('role', 'listbox');

    shell.append(btn, menu);
    select.insertAdjacentElement('afterend', shell);

    const groups = (typeof window.extractOptions === 'function') ? window.extractOptions(select) : [];

    groups.forEach(group => {
      const wrap = document.createElement('div');
      wrap.className = 'okrt-region-group';
      if (group.label) {
        const title = document.createElement('div');
        title.className = 'okrt-region-group-title';
        title.textContent = String(group.label).replace(/─/g, '').trim();
        wrap.appendChild(title);
      }
      (group.options || []).forEach(opt => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'okrt-region-item';
        item.dataset.value = opt.value;
        item.appendChild(createFlagNode(opt.value, opt.text));
        const name = document.createElement('span');
        name.className = 'okrt-region-name';
        name.textContent = opt.text;
        item.appendChild(name);
        wrap.appendChild(item);
      });
      menu.appendChild(wrap);
    });

    function sync(){
      const current = select.value || 'WLD';
      const option = select.querySelector('option[value="' + CSS.escape(current) + '"]');
      const text = (typeof window.cleanLabel === 'function') ? window.cleanLabel(option ? option.textContent : current) : (option ? option.textContent : current);
      left.replaceChildren(createFlagNode(current, text), Object.assign(document.createElement('span'), { className:'okrt-region-name', textContent:text }));
      menu.querySelectorAll('.okrt-region-item').forEach(item => item.classList.toggle('active', item.dataset.value === current));
      btn.setAttribute('aria-expanded', shell.classList.contains('open') ? 'true' : 'false');
    }

    btn.addEventListener('click', (e) => { e.stopPropagation(); shell.classList.toggle('open'); sync(); });
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.okrt-region-item');
      if (!item) return;
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles:true }));
      if (typeof window.onRegionChange === 'function') window.onRegionChange();
      shell.classList.remove('open');
      sync();
    });
    document.addEventListener('click', (e) => { if (!shell.contains(e.target)) { shell.classList.remove('open'); sync(); } }, true);
    select.style.display = 'none';
    sync();
  }

  function observeTargets(){
    const targets = [
      'aether-explain-list','aether-top-drivers','aether-explain-note','aether-brief-text','aether-brief-meta','aether-brief-kpis','aether-brief-status','aether-watchlist','aether-health-dock','okrt-aether-data-card','arcList'
    ];
    const observer = new MutationObserver(records => {
      if (busy) return;
      busy = true;
      try {
        for (const record of records) {
          if (record.target) sanitizeTree(record.target);
        }
      } finally {
        busy = false;
      }
    });
    targets.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      sanitizeTree(el);
      observer.observe(el, { childList:true, subtree:true, attributes:true, attributeFilter:['href','src','srcset','style'] });
    });
  }

  function init(){
    window.AetherSafeDOM = { sanitizeHTML, sanitizeTree, safeSetHTML };
    if (typeof window.setHTML === 'function') {
      window.setHTML = safeSetHTML;
    }
    if (document.getElementById('region-sel')) {
      rebuildFlagSelector();
      window.installFlagSelector = rebuildFlagSelector;
    }
    observeTargets();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
