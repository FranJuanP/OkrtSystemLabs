(function(){
  'use strict';

  var state = window.AETHER_DEPENDENCY_STATE = window.AETHER_DEPENDENCY_STATE || {
    page: (location.pathname.split('/').pop() || '').toLowerCase(),
    attempts: [],
    recovered: [],
    unavailable: []
  };

  function remember(kind, label, url){
    try {
      var entry = { kind: kind, label: label, url: url || '', at: new Date().toISOString() };
      if (kind === 'attempt') state.attempts.push(entry);
      else if (kind === 'recovered') state.recovered.push(entry);
      else if (kind === 'unavailable') state.unavailable.push(entry);
    } catch(_) {}
  }

  function loadScript(url){
    return new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src=url;
      s.async=true;
      s.onload=function(){ resolve(url); };
      s.onerror=function(){ s.remove(); reject(new Error('Failed: '+url)); };
      document.head.appendChild(s);
    });
  }

  async function ensureAny(urls, testFn, label){
    if (testFn()) return true;
    for (var i=0;i<urls.length;i++){
      try {
        remember('attempt', label, urls[i]);
        await loadScript(urls[i]);
        if (testFn()) {
          remember('recovered', label, urls[i]);
          return true;
        }
      } catch (_) {}
    }
    remember('unavailable', label, '');
    console.warn('[AETHER] Dependency unavailable:', label);
    return false;
  }

  async function recoverGlobe(){
    await ensureAny([
      'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
      'https://unpkg.com/three@0.128.0/build/three.min.js'
    ], function(){ return !!window.THREE; }, 'THREE');

    await ensureAny([
      'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js',
      'https://unpkg.com/d3@7.8.5/dist/d3.min.js'
    ], function(){ return !!window.d3; }, 'd3');

    await ensureAny([
      'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js',
      'https://unpkg.com/topojson-client@3/dist/topojson-client.min.js',
      'https://cdn.jsdelivr.net/npm/topojson@3/dist/topojson.min.js'
    ], function(){ return !!window.topojson; }, 'topojson');
  }

  async function recoverVector(){
    await ensureAny([
      'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js',
      'https://unpkg.com/d3@7.8.5/dist/d3.min.js'
    ], function(){ return !!window.d3; }, 'd3');
  }

  var page=(location.pathname.split('/').pop()||'').toLowerCase();
  if (page === 'aether-globe-v3.html') {
    recoverGlobe();
  } else if (page === 'aether-vector.html') {
    recoverVector();
  }
})();
