(function(){
  function setDvh(){
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', vh + 'px');
  }
  function isTouch(){
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  }
  function classify(){
    var w = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    var h = Math.max(window.innerWidth || 0, window.innerHeight || 0);
    if(!isTouch()) return 'desktop';
    if(w <= 767) return 'mobile';
    if(w >= 768 && h >= 900) return 'tablet';
    return 'desktop';
  }
  function flagBody(){
    var path = (location.pathname || '').toLowerCase();
    var body = document.body;
    if(!body) return;
    var cls = classify();
    body.classList.remove('mobile-optimized','tablet-optimized','signal-mobile','vector-mobile','globe-mobile','signal-tablet','vector-tablet','globe-tablet');
    if(cls === 'mobile') body.classList.add('mobile-optimized');
    if(cls === 'tablet') body.classList.add('tablet-optimized');
    if(path.indexOf('aether-signal') !== -1){
      body.classList.add(cls === 'mobile' ? 'signal-mobile' : (cls === 'tablet' ? 'signal-tablet' : 'signal-desktop'));
    }
    if(path.indexOf('aether-vector') !== -1){
      body.classList.add(cls === 'mobile' ? 'vector-mobile' : (cls === 'tablet' ? 'vector-tablet' : 'vector-desktop'));
    }
    if(path.indexOf('aether-globe') !== -1){
      body.classList.add(cls === 'mobile' ? 'globe-mobile' : (cls === 'tablet' ? 'globe-tablet' : 'globe-desktop'));
    }
  }
  setDvh();
  document.addEventListener('DOMContentLoaded', flagBody, {once:true});
  window.addEventListener('resize', function(){ setDvh(); flagBody(); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(function(){ setDvh(); flagBody(); }, 80); }, {passive:true});
})();
