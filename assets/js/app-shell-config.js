(function(){
  const cfg = Object.freeze({
    branding: Object.freeze({
      brand: 'AETHER',
      version: '1.0',
      lab: 'OkrtSystem Labs',
      productTitle: 'AETHER — Global Intelligence System · OkrtSystem Labs',
      shortTitle: 'AETHER — Global Intelligence System',
      htmlComment: '© OkrtSystem Labs · AETHER Global Intelligence System · franjuanp.github.io/OkrtSystemLabs'
    }),
    pages: Object.freeze({
      landing: 'page-landing',
      aether: 'page-aether'
    }),
    stylesheets: Object.freeze({
      landing: 'css-landing',
      aether: 'css-aether',
      router: 'css-router'
    }),
    selectors: Object.freeze({
      cursor: '#cur',
      cursorRing: '#cur2',
      landingCanvas: '#tc',
      systemTime: '#s-time',
      loadingBar: '#lf',
      loadingMessage: '#lm',
      loadingOverlay: '#loader',
      landingButton: '[data-launch-aether]'
    }),
    labels: Object.freeze({
      launchCta: 'Launch AETHER',
      systemActive: 'SISTEMA ACTIVO',
      booting: 'INICIANDO SISTEMA...',
      bootingModules: 'CARGANDO MÓDULOS...',
      analyzingVector: 'ANALIZANDO VECTOR GLOBAL...'
    }),
    timings: Object.freeze({
      loaderFadeDelayMs: 350,
      routerKickoffDelayMs: 700,
      initialBootDelayMs: 300
    }),
    runtime: Object.freeze({
      cardsEngine: 'assets/js/app-core.js',
      routerLegacy: 'assets/js/app-router-legacy.js',
      guard: 'assets/js/runtime-guard.js'
    })
  });

  window.AETHER_SHELL_CONFIG = cfg;
})();
