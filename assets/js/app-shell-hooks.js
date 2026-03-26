(function(){
  const shell = window.AETHER_SHELL_CONFIG || {};
  const labels = shell.labels || {};
  const UI = window.AetherShellUI || {};
  const overlays = window.AetherShellOverlays || {};

  function safeWrapLaunch(){
    if (typeof window.launchAether !== 'function' || window.launchAether.__phase5Wrapped) return;
    const original = window.launchAether;
    function wrappedLaunchAether(evt){
      if (overlays.resetBootLabels) overlays.resetBootLabels();
      if (UI.setCursorBusy) UI.setCursorBusy(true);
      if (UI.setLoadingMessage) UI.setLoadingMessage(labels.booting || 'INICIANDO SISTEMA...');
      return original.call(this, evt);
    }
    wrappedLaunchAether.__phase5Wrapped = true;
    wrappedLaunchAether.__phase5Original = original;
    window.launchAether = wrappedLaunchAether;
  }

  function exposeHistoryHelpers(){
    if (window.AetherShellHistory) return;
    window.AetherShellHistory = Object.freeze({
      pushAether(){
        history.pushState({ page: 'aether' }, 'aether', '#aether');
      },
      clearToLanding(){
        UI.showLanding && UI.showLanding();
      }
    });
  }

  function init(){
    safeWrapLaunch();
    exposeHistoryHelpers();
    window.AETHER_PHASE5 = Object.freeze({
      safeVisualHooks: true,
      nonCriticalRenderHelpers: true,
      timestamp: new Date().toISOString()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
