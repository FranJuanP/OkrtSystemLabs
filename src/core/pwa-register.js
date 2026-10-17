(function(){
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;
  if (!/^https?:$/i.test(location.protocol)) return;

  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(function(err){
      console.warn('[AETHER PWA] Service worker registration failed:', err);
    });
  });
})();
