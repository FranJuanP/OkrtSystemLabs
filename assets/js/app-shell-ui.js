(function(){
  const DOM = window.AetherDOM || {};
  const shell = window.AETHER_SHELL_CONFIG || {};
  const byId = DOM.byId || ((id)=>document.getElementById(id));

  function selectors(){
    return shell.selectors || {};
  }

  function pages(){
    return shell.pages || {};
  }

  function getPageNodes(){
    const p = pages();
    return {
      landing: byId(p.landing || 'page-landing'),
      aether: byId(p.aether || 'page-aether')
    };
  }

  function setCursorBusy(isBusy){
    document.body.style.cursor = isBusy ? 'wait' : 'default';
    return isBusy;
  }

  function showLanding(){
    const nodes = getPageNodes();
    if (nodes.aether) nodes.aether.classList.remove('active');
    if (nodes.landing) {
      nodes.landing.style.display = '';
      nodes.landing.classList.add('active');
    }
    setCursorBusy(false);
    return nodes;
  }

  function showAether(){
    const nodes = getPageNodes();
    if (nodes.landing) nodes.landing.classList.remove('active');
    if (nodes.aether) nodes.aether.classList.add('active');
    setCursorBusy(false);
    return nodes;
  }

  function setLoadingMessage(message){
    const node = byId((selectors().loadingMessage || '#lm').replace(/^#/, ''));
    if (node && typeof message === 'string' && message.trim()) node.textContent = message;
    return node;
  }

  function setLoadingProgress(value){
    const node = byId((selectors().loadingBar || '#lf').replace(/^#/, ''));
    if (node && Number.isFinite(value)) {
      const pct = Math.max(0, Math.min(100, value));
      node.style.width = `${pct}%`;
    }
    return node;
  }

  function getLoader(){
    return byId((selectors().loadingOverlay || '#loader').replace(/^#/, ''));
  }

  window.AetherShellUI = Object.freeze({
    selectors,
    pages,
    getPageNodes,
    getLoader,
    setCursorBusy,
    showLanding,
    showAether,
    setLoadingMessage,
    setLoadingProgress
  });
})();
