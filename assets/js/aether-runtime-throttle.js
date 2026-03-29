(function(){
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeRAF = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  const hiddenThrottleThreshold = 200;

  function shouldPause(interval){
    return document.hidden && Number(interval || 0) >= hiddenThrottleThreshold;
  }

  window.setInterval = function(cb, interval){
    if (typeof cb !== 'function') return nativeSetInterval(cb, interval);
    return nativeSetInterval(function(){
      if (shouldPause(interval)) return;
      try { cb(); } catch(err){ setTimeout(function(){ throw err; }); }
    }, interval);
  };

  if (nativeRAF) {
    window.requestAnimationFrame = function(cb){
      if (typeof cb !== 'function') return nativeRAF(cb);
      return nativeRAF(function(ts){
        if (document.hidden) {
          nativeSetTimeout(function(){ window.requestAnimationFrame(cb); }, 250);
          return;
        }
        cb(ts);
      });
    };
  }

  document.addEventListener('visibilitychange', function(){
    document.documentElement.toggleAttribute('data-aether-paused', document.hidden);
  }, { passive:true });
})();
