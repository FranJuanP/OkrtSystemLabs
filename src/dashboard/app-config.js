(function(){
  const shell = window.AETHER_SHELL_CONFIG || {};
  const cfg = Object.freeze({
    brand: shell.branding?.brand || 'AETHER',
    version: shell.branding?.version || '1.0',
    lab: shell.branding?.lab || 'OkrtSystem Labs',
    pages: Object.freeze({
      landing: shell.pages?.landing || 'page-landing',
      aether: shell.pages?.aether || 'page-aether'
    }),
    stylesheets: Object.freeze({
      landing: shell.stylesheets?.landing || 'css-landing',
      aether: shell.stylesheets?.aether || 'css-aether',
      router: shell.stylesheets?.router || 'css-router'
    }),
    runtime: Object.freeze({
      cardsEngine: shell.runtime?.cardsEngine || 'assets/js/app-core.js',
      routerLegacy: shell.runtime?.routerLegacy || 'assets/js/app-router-legacy.js'
    })
  });

  window.AETHER_CONFIG = cfg;
})();
