(function(){
  const shell = window.AETHER_SHELL_CONFIG || {};
  const byId = (id) => document.getElementById(id);
  const q = (sel, root=document) => root.querySelector(sel);

  function applyDocumentBranding(){
    const title = shell.branding && shell.branding.productTitle;
    if (title) document.title = title;

    document.documentElement.dataset.aetherBrand = (shell.branding && shell.branding.brand) || 'AETHER';
    document.documentElement.dataset.aetherLab = (shell.branding && shell.branding.lab) || 'OkrtSystem Labs';
    document.body.dataset.aetherShell = 'phase4';

    let meta = q('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    if (!meta.content) meta.content = '#071018';
  }

  function applyShellLabels(){
    const launchNode = q('[data-launch-aether]');
    if (launchNode && shell.labels && shell.labels.launchCta) {
      const normalized = (launchNode.textContent || '').trim();
      if (!normalized || normalized === 'Launch AETHER') {
        launchNode.textContent = shell.labels.launchCta;
      }
    }
  }

  function publishShellState(){
    window.AETHER_SHELL_STATE = Object.freeze({
      phase: 'IV',
      configLoaded: !!window.AETHER_SHELL_CONFIG,
      timestamp: new Date().toISOString()
    });
  }

  function init(){
    applyDocumentBranding();
    applyShellLabels();
    publishShellState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
