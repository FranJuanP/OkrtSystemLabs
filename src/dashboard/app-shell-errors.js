(function(){
  const state = window.AETHER_RUNTIME_STATE || {
    phase: 'VI',
    startedAt: new Date().toISOString(),
    errors: [],
    warnings: [],
    checks: {},
    events: []
  };

  function pushError(type, payload){
    try {
      state.errors.push({ type, payload, at: new Date().toISOString() });
      if (state.errors.length > 20) state.errors.shift();
    } catch (_) {}
  }

  function pushWarning(type, payload){
    try {
      state.warnings.push({ type, payload, at: new Date().toISOString() });
      if (state.warnings.length > 20) state.warnings.shift();
    } catch (_) {}
  }

  window.addEventListener('error', function(event){
    pushError('error', {
      message: event && event.message ? event.message : 'Unknown error',
      filename: event && event.filename ? event.filename : '',
      lineno: event && event.lineno ? event.lineno : 0,
      colno: event && event.colno ? event.colno : 0
    });
  });

  window.addEventListener('unhandledrejection', function(event){
    let reason = '';
    try {
      reason = event && event.reason ? String(event.reason) : 'Unhandled rejection';
    } catch (_) {
      reason = 'Unhandled rejection';
    }
    pushError('unhandledrejection', { reason });
  });

  window.AETHER_RUNTIME_STATE = state;
  window.AetherShellErrors = Object.freeze({ pushError, pushWarning, state });
})();
