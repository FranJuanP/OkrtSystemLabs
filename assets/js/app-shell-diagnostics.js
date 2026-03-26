(function(){
  const shell = window.AETHER_SHELL_CONFIG || {};
  const state = window.AETHER_RUNTIME_STATE || {};

  function getSummary(){
    const checks = state.checks || {};
    const okChecks = Object.values(checks).filter(v => v && v.ok).length;
    const totalChecks = Object.keys(checks).length;
    return {
      brand: shell.branding && shell.branding.brand || 'AETHER',
      version: shell.branding && shell.branding.version || '1.0',
      phase: 'X',
      documentTitle: document.title,
      page: document.getElementById('page-aether')?.classList.contains('active') ? 'aether' : 'landing',
      totalChecks,
      okChecks,
      warnings: (state.warnings || []).length,
      errors: (state.errors || []).length,
      cards: document.body.dataset.aetherCards || '',
      panels: document.body.dataset.aetherPanels || '',
      timestamp: new Date().toISOString()
    };
  }

  function exportJson(){
    return JSON.stringify(getSummary(), null, 2);
  }

  function init(){
    window.AetherDiagnostics = Object.freeze({ getSummary, exportJson, state });
    window.AETHER_REFACTOR_FINAL = Object.freeze({
      completed: true,
      scope: 'perimeter-shell-refactor',
      deepCoreUntouched: true,
      timestamp: new Date().toISOString()
    });
    document.body.dataset.aetherRefactor = 'final';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();