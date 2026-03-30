(function(){
  function setDvh(){
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', vh + 'px');
  }

  function detectDeviceTier(){
    var w = Math.min(window.innerWidth || 0, screen.width || window.innerWidth || 0) || window.innerWidth || 0;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || coarse;
    if (w <= 820) return 'mobile';
    if (touch && w <= 1366) return 'tablet';
    return 'desktop';
  }

  function flagBody(){
    var path = (location.pathname || '').toLowerCase();
    var body = document.body;
    if(!body) return;
    var tier = detectDeviceTier();
    body.classList.remove('mobile-optimized','tablet-optimized','signal-mobile','vector-mobile','globe-mobile','signal-tablet','vector-tablet','globe-tablet');
    if (tier === 'mobile') body.classList.add('mobile-optimized');
    if (tier === 'tablet') body.classList.add('tablet-optimized');
    if(path.indexOf('aether-signal') !== -1){
      if (tier === 'mobile') body.classList.add('signal-mobile');
      if (tier === 'tablet') body.classList.add('signal-tablet');
    }
    if(path.indexOf('aether-vector') !== -1){
      if (tier === 'mobile') body.classList.add('vector-mobile');
      if (tier === 'tablet') body.classList.add('vector-tablet');
    }
    if(path.indexOf('aether-globe') !== -1){
      if (tier === 'mobile') body.classList.add('globe-mobile');
      if (tier === 'tablet') body.classList.add('globe-tablet');
    }
  }

  setDvh();
  document.addEventListener('DOMContentLoaded', flagBody, {once:true});
  window.addEventListener('resize', function(){ setDvh(); flagBody(); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(function(){ setDvh(); flagBody(); }, 60); }, {passive:true});
})();
