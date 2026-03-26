(function(){
  const state = window.AETHER_RUNTIME_STATE || (window.AETHER_RUNTIME_STATE = {
    phase: 'IX', startedAt: new Date().toISOString(), errors: [], warnings: [], checks: {}, events: []
  });

  const t0 = performance && performance.now ? performance.now() : Date.now();

  function push(name, detail){
    state.events = state.events || [];
    state.events.push({ name, detail: detail || '', at: new Date().toISOString() });
    if (state.events.length > 80) state.events.shift();
  }

  function wrapHistory(method){
    const original = history[method];
    if (typeof original !== 'function' || original.__aetherWrapped) return;
    history[method] = function(){
      try { push(`history:${method}`, arguments[2] || ''); } catch (_) {}
      return original.apply(this, arguments);
    };
    history[method].__aetherWrapped = true;
  }

  function init(){
    wrapHistory('pushState');
    wrapHistory('replaceState');
    push('telemetry:init', 'phase-ix');
    window.setTimeout(function(){
      const t1 = performance && performance.now ? performance.now() : Date.now();
      state.metrics = state.metrics || {};
      state.metrics.shellReadyMs = Math.round(t1 - t0);
      push('telemetry:shell-ready', String(state.metrics.shellReadyMs));
    }, 0);
    window.AetherShellTelemetry = Object.freeze({ push, state });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();