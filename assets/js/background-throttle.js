
(function(){
  'use strict';
  const MIN_INTERVAL_TO_THROTTLE = 0;
  const FAST_INTERVAL_MS = 5000;
  const originalSetInterval = window.setInterval.bind(window);
  const originalClearInterval = window.clearInterval.bind(window);
  const originalRAF = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  const originalCAF = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null;
  const intervalMeta = new Map();

  function shouldSkip(meta){
    if (!document.hidden) return false;
    if (!meta) return false;
    return meta.delay >= MIN_INTERVAL_TO_THROTTLE && meta.delay <= FAST_INTERVAL_MS;
  }

  window.setInterval = function(callback, delay, ...args){
    const wrapped = function(...cbArgs){
      const meta = intervalMeta.get(id);
      if (shouldSkip(meta)) return;
      return callback.apply(this, cbArgs);
    };
    const id = originalSetInterval(wrapped, delay, ...args);
    intervalMeta.set(id, { delay: Number(delay) || 0 });
    return id;
  };

  window.clearInterval = function(id){
    intervalMeta.delete(id);
    return originalClearInterval(id);
  };

  if (originalRAF) {
    window.requestAnimationFrame = function(callback){
      const wrapped = function(ts){
        if (document.hidden) return;
        return callback(ts);
      };
      return originalRAF(wrapped);
    };
  }
  if (originalCAF) {
    window.cancelAnimationFrame = function(id){
      return originalCAF(id);
    };
  }

  document.addEventListener('visibilitychange', function(){
    document.documentElement.toggleAttribute('data-aether-hidden', document.hidden);
  }, { passive: true });
})();
