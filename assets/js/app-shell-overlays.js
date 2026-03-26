(function(){
  const UI = window.AetherShellUI || {};
  const shell = window.AETHER_SHELL_CONFIG || {};

  function timings(){
    return shell.timings || {};
  }

  function fadeOutLoader(delayMs){
    const loader = UI.getLoader && UI.getLoader();
    const delay = Number.isFinite(delayMs) ? delayMs : (timings().loaderFadeDelayMs || 350);
    if (!loader) return null;
    loader.style.opacity = '0';
    window.setTimeout(() => {
      loader.style.display = 'none';
    }, delay);
    return loader;
  }

  function showLoader(){
    const loader = UI.getLoader && UI.getLoader();
    if (!loader) return null;
    loader.style.display = '';
    loader.style.opacity = '1';
    return loader;
  }

  function resetBootLabels(){
    const labels = shell.labels || {};
    if (UI.setLoadingMessage) UI.setLoadingMessage(labels.booting || 'INICIANDO SISTEMA...');
    if (UI.setLoadingProgress) UI.setLoadingProgress(0);
  }

  window.AetherShellOverlays = Object.freeze({
    timings,
    showLoader,
    fadeOutLoader,
    resetBootLabels
  });
})();
