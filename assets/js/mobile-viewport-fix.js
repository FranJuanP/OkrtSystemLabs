(function(){
  function setDvh(){
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', vh + 'px');
  }
  function isIPadLike(){
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    var maxTP = navigator.maxTouchPoints || 0;
    return /iPad/i.test(ua) || (platform === 'MacIntel' && maxTP > 1);
  }
  function classify(){
    var w = Math.min(window.innerWidth || 0, screen.width || 0) || window.innerWidth || 0;
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
    if (isIPadLike()) return 'tablet';
    if (touch && w <= 767) return 'mobile';
    if (touch && w <= 1180) return 'tablet';
    return 'desktop';
  }
  function flagBody(){
    var path = (location.pathname || '').toLowerCase();
    var body = document.body;
    if(!body) return;
    body.classList.remove('mobile-optimized','tablet-optimized','desktop-optimized','signal-mobile','vector-mobile','globe-mobile','signal-tablet','vector-tablet','globe-tablet');
    var mode = classify();
    body.classList.add(mode + '-optimized');
    if(path.indexOf('aether-signal') !== -1) body.classList.add('signal-' + mode);
    if(path.indexOf('aether-vector') !== -1) body.classList.add('vector-' + mode);
    if(path.indexOf('aether-globe') !== -1) body.classList.add('globe-' + mode);
  }
  setDvh();
  document.addEventListener('DOMContentLoaded', flagBody, {once:true});
  window.addEventListener('resize', function(){ setDvh(); flagBody(); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(function(){ setDvh(); flagBody(); }, 60); }, {passive:true});
})();
