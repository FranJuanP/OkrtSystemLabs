(function(){
  'use strict';

  function onReady(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  function call(name, args){
    const fn = window[name];
    if(typeof fn === 'function'){
      try { return fn.apply(window, args || []); } catch(_) {}
    }
  }

  onReady(function(){
    document.querySelectorAll('[data-action="launch-aether"]').forEach(el => {
      el.addEventListener('click', function(ev){ ev.preventDefault(); call('launchAether', [ev]); });
    });

    document.querySelectorAll('[data-action="open-signal"]').forEach(el => {
      el.addEventListener('click', function(){ window.open('aether-signal.html','_blank'); });
    });
    document.querySelectorAll('[data-action="open-vector"]').forEach(el => {
      el.addEventListener('click', function(){ window.open('aether-vector.html','_blank'); });
    });
    document.querySelectorAll('[data-action="open-globe"]').forEach(el => {
      el.addEventListener('click', function(){ call('openAetherGlobe'); });
    });

    const checkBtn = document.getElementById('check-ollama-btn');
    if(checkBtn) checkBtn.addEventListener('click', function(){ call('checkOllama'); });

    document.querySelectorAll('[data-action="region-change"]').forEach(el => {
      el.addEventListener('change', function(){ call('onRegionChange'); });
    });

    document.querySelectorAll('[data-horizon]').forEach(el => {
      el.addEventListener('click', function(){ call('setHorizon', [el, Number(el.dataset.horizon)]); });
    });

    document.querySelectorAll('[data-action="run-analysis"]').forEach(el => el.addEventListener('click', ()=>call('runAnalysis')));
    document.querySelectorAll('[data-action="run-scenarios"]').forEach(el => el.addEventListener('click', ()=>call('runScenarios')));
    document.querySelectorAll('[data-action="export-pdf"]').forEach(el => el.addEventListener('click', ()=>call('exportPDF')));

    document.querySelectorAll('[data-map-cat]').forEach(el => {
      el.addEventListener('click', function(){ call('setMapCat', [el, el.dataset.mapCat]); });
    });

    document.querySelectorAll('[data-action="toggle-globe-arcs"]').forEach(el => el.addEventListener('click', ()=>call('toggleGlobeArcs')));
    document.querySelectorAll('[data-action="map-zoom-in"]').forEach(el => el.addEventListener('click', ()=>call('mapZoomIn')));
    document.querySelectorAll('[data-action="map-zoom-out"]').forEach(el => el.addEventListener('click', ()=>call('mapZoomOut')));
    document.querySelectorAll('[data-action="map-zoom-reset"]').forEach(el => el.addEventListener('click', ()=>call('mapZoomReset')));

    document.querySelectorAll('[data-arc-type]').forEach(el => {
      el.addEventListener('click', function(){
        const v = el.dataset.arcType;
        call('filterArcType', [v === 'ALL' ? null : v]);
      });
    });

    document.querySelectorAll('[data-action="render-ranking"]').forEach(el => {
      el.addEventListener('change', ()=>call('renderRanking'));
    });

    document.querySelectorAll('[data-action="update-cascade"]').forEach(el => el.addEventListener('click', ()=>call('updateCascadeModule')));
    document.querySelectorAll('[data-action="toggle-shock-sim"]').forEach(el => el.addEventListener('click', ()=>call('toggleShockSimulator')));
    document.querySelectorAll('[data-action="reset-shocks"]').forEach(el => el.addEventListener('click', ()=>call('resetShocks')));

    document.querySelectorAll('[data-scenario]').forEach(el => {
      el.addEventListener('click', function(){ call('showScenario', [el.dataset.scenario, el]); });
    });

    document.querySelectorAll('[data-action="chat-keydown"]').forEach(el => {
      el.addEventListener('keydown', function(event){
        if(event.key === 'Enter' && !event.shiftKey){
          event.preventDefault();
          call('sendChat');
        }
      });
    });
    document.querySelectorAll('[data-action="send-chat"]').forEach(el => el.addEventListener('click', ()=>call('sendChat')));
  });
})();
