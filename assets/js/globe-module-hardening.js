(function(){
  function ready(fn){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }
  ready(function(){
    var buttons = document.querySelectorAll('.arc-fbtn[data-type]');
    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){
        var type = btn.getAttribute('data-type');
        if(type==='GLOBAL'){
          if(typeof window.toggleGlobalMode==='function') window.toggleGlobalMode();
          return;
        }
        if(typeof window.setArcFilter==='function') window.setArcFilter(type);
      });
    });
  });
})();
