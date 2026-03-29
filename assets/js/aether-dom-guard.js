(function(){
  function sanitizeElementTree(root){
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('*').forEach(function(node){
      [...node.attributes].forEach(function(attr){
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');
        if (name.startsWith('on')) node.removeAttribute(attr.name);
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });
    root.querySelectorAll('script, iframe:not([src^="https://www.youtube.com/"])').forEach(function(node){ node.remove(); });
  }

  window.AETHERDomGuard = { sanitizeElementTree };
  const observer = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(node){
        if (node.nodeType === 1) sanitizeElementTree(node);
      });
    });
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ sanitizeElementTree(document.body); }, { once:true });
  } else {
    sanitizeElementTree(document.body);
  }
})();
