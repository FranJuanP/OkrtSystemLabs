(function(){
  const shell = window.AETHER_SHELL_CONFIG || {};
  const state = window.AETHER_RUNTIME_STATE || (window.AETHER_RUNTIME_STATE = {
    phase: 'VI',
    startedAt: new Date().toISOString(),
    errors: [],
    warnings: [],
    checks: {},
    events: []
  });

  function record(name, ok, detail){
    state.checks[name] = {
      ok: !!ok,
      detail: detail || '',
      at: new Date().toISOString()
    };
    return state.checks[name];
  }

  function exists(id){
    return !!document.getElementById(id);
  }

  function markBootEvent(name, detail){
    state.events.push({ name, detail: detail || '', at: new Date().toISOString() });
    if (state.events.length > 40) state.events.shift();
  }

  function runDomChecks(){
    const pages = shell.pages || {};
    const selectors = shell.selectors || {};
    const stylesheets = shell.stylesheets || {};

    record('pageLanding', exists(pages.landing || 'page-landing'), pages.landing || 'page-landing');
    record('pageAether', exists(pages.aether || 'page-aether'), pages.aether || 'page-aether');
    record('cursor', !!document.querySelector(selectors.cursor || '#cur'), selectors.cursor || '#cur');
    record('cursorRing', !!document.querySelector(selectors.cursorRing || '#cur2'), selectors.cursorRing || '#cur2');
    record('landingCanvas', !!document.querySelector(selectors.landingCanvas || '#tc'), selectors.landingCanvas || '#tc');
    record('loadingOverlay', !!document.querySelector(selectors.loadingOverlay || '#loader'), selectors.loadingOverlay || '#loader');
    record('loadingBar', !!document.querySelector(selectors.loadingBar || '#lf'), selectors.loadingBar || '#lf');
    record('loadingMessage', !!document.querySelector(selectors.loadingMessage || '#lm'), selectors.loadingMessage || '#lm');
    record('cssLanding', exists(stylesheets.landing || 'css-landing'), stylesheets.landing || 'css-landing');
    record('cssAether', exists(stylesheets.aether || 'css-aether'), stylesheets.aether || 'css-aether');
    record('cssRouter', exists(stylesheets.router || 'css-router'), stylesheets.router || 'css-router');
    markBootEvent('dom-checks-complete');
  }

  function runRuntimeChecks(){
    record('launchAetherFn', typeof window.launchAether === 'function', typeof window.launchAether);
    record('sendChatFn', typeof window.sendChat === 'function', typeof window.sendChat);
    record('shellConfigLoaded', !!window.AETHER_SHELL_CONFIG, 'AETHER_SHELL_CONFIG');
    record('shellStateLoaded', !!window.AETHER_SHELL_STATE, 'AETHER_SHELL_STATE');
    record('phase3Compat', !!window.AETHER_PHASE3, 'AETHER_PHASE3');
    markBootEvent('runtime-checks-complete');
  }

  function softLoaderFallback(){
    const selectors = shell.selectors || {};
    const labels = shell.labels || {};
    const overlay = document.querySelector(selectors.loadingOverlay || '#loader');
    const msg = document.querySelector(selectors.loadingMessage || '#lm');
    const bar = document.querySelector(selectors.loadingBar || '#lf');

    if (!overlay) return;

    window.setTimeout(function(){
      const aetherPage = document.getElementById((shell.pages && shell.pages.aether) || 'page-aether');
      const landingPage = document.getElementById((shell.pages && shell.pages.landing) || 'page-landing');
      const looksBooted = !!(aetherPage && aetherPage.classList.contains('active')) || (landingPage && landingPage.style && landingPage.style.opacity === '0');
      record('bootObservedAfterDelay', looksBooted, looksBooted ? 'booted' : 'not-yet');

      if (!looksBooted && msg && !msg.textContent.trim()) {
        msg.textContent = labels.analyzingVector || 'ANALIZANDO VECTOR GLOBAL...';
      }
      if (!looksBooted && bar && !bar.style.width) {
        bar.style.width = '22%';
      }
    }, (shell.timings && shell.timings.routerKickoffDelayMs || 700) + 1200);
  }

  function init(){
    markBootEvent('phase-vi-init');
    runDomChecks();
    runRuntimeChecks();
    softLoaderFallback();
    document.body.dataset.aetherRuntime = 'phase6';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.AetherShellHealth = Object.freeze({ init, state, record, markBootEvent });
})();
