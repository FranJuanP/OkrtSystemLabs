(function(){
  function onReady(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  function bindSignal(){
    var catButtons = document.querySelectorAll('.cat-btn[data-cat]');
    catButtons.forEach(function(btn){
      btn.addEventListener('click', function(){
        if (typeof window.filterCat === 'function') window.filterCat(btn, btn.dataset.cat);
      });
    });

    var sortButtons = document.querySelectorAll('.sort-btn[data-sort]');
    sortButtons.forEach(function(btn){
      btn.addEventListener('click', function(){
        if (typeof window.sortBy === 'function') window.sortBy(btn, btn.dataset.sort);
      });
    });
  }

  function bindVector(){
    var flowButtons = document.querySelectorAll('.flow-btn[data-flow]');
    flowButtons.forEach(function(btn){
      btn.addEventListener('click', function(){
        if (typeof window.setFlow === 'function') window.setFlow(btn, btn.dataset.flow);
      });
    });

    var regionButtons = document.querySelectorAll('.reg-btn[data-region]');
    regionButtons.forEach(function(btn){
      btn.addEventListener('click', function(){
        if (typeof window.setRegion === 'function') window.setRegion(btn, btn.dataset.region);
      });
    });

    var thresholdSlider = document.querySelector('[data-threshold-slider="true"]');
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', function(){
        if (typeof window.setThreshold === 'function') window.setThreshold(thresholdSlider.value);
      });
    }
  }

  onReady(function(){
    if (document.querySelector('.cat-btn[data-cat]') || document.querySelector('.sort-btn[data-sort]')) bindSignal();
    if (document.querySelector('.flow-btn[data-flow]') || document.querySelector('.reg-btn[data-region]') || document.querySelector('[data-threshold-slider="true"]')) bindVector();
  });
})();
