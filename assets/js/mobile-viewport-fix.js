(function(){
  function setDvh(){
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', vh + 'px');
  }
  function flagBody(){
    var path = (location.pathname || '').toLowerCase();
    var body = document.body;
    if(!body) return;
    body.classList.add('mobile-optimized');
    if(path.indexOf('aether-signal') !== -1) body.classList.add('signal-mobile');
    if(path.indexOf('aether-vector') !== -1) body.classList.add('vector-mobile');
    if(path.indexOf('aether-globe') !== -1) body.classList.add('globe-mobile');
  }
  setDvh();
  document.addEventListener('DOMContentLoaded', flagBody, {once:true});
  window.addEventListener('resize', setDvh, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(setDvh, 60); }, {passive:true});
})();
