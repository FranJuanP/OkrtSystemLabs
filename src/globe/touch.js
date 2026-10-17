// Capa 9 — Touch support patch externalizado
(function(){
  var touchDidDrag = false;
  var touch2Dist   = 0;
  var touchAutoRotTimer = null;

  function dist2(e){
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  window.addEventListener('touchstart', function(e){
    clearTimeout(touchAutoRotTimer);
    if(e.touches.length === 1){
      touchDidDrag = false;
      if(typeof autoRot !== 'undefined') autoRot = false;
      if(typeof isDrag !== 'undefined')  isDrag  = true;
      if(typeof prevX !== 'undefined')   prevX   = e.touches[0].clientX;
      if(typeof prevY !== 'undefined')   prevY   = e.touches[0].clientY;
    } else if(e.touches.length === 2){
      if(typeof isDrag !== 'undefined') isDrag = false;
      touch2Dist = dist2(e);
    }
  }, {passive:true});

  window.addEventListener('touchmove', function(e){
    if(e.touches.length === 1 && typeof isDrag !== 'undefined' && isDrag){
      var dx = e.touches[0].clientX - prevX;
      var dy = e.touches[0].clientY - prevY;
      if(Math.abs(dx) + Math.abs(dy) > 3) touchDidDrag = true;
      if(typeof tRotY !== 'undefined') tRotY += dx * 0.005;
      if(typeof tRotX !== 'undefined'){
        tRotX += dy * 0.005;
        tRotX = Math.max(-1.35, Math.min(1.35, tRotX));
      }
      if(typeof prevX !== 'undefined') prevX = e.touches[0].clientX;
      if(typeof prevY !== 'undefined') prevY = e.touches[0].clientY;
      if(typeof arcTooltip !== 'undefined' && arcTooltip){ arcTooltip.classList.remove('show'); }
      if(typeof tooltipActive !== 'undefined') tooltipActive = false;
    } else if(e.touches.length === 2 && typeof camera !== 'undefined' && camera && camera.position){
      var d     = dist2(e);
      var delta = touch2Dist - d;
      camera.position.z = Math.max(1.55, Math.min(6.0, camera.position.z + delta * 0.012));
      touch2Dist = d;
    }
  }, {passive:true});

  window.addEventListener('touchend', function(e){
    if(typeof isDrag !== 'undefined') isDrag = false;
    if(typeof didDrag !== 'undefined') didDrag = touchDidDrag;
    touchAutoRotTimer = setTimeout(function(){ if(typeof autoRot !== 'undefined') autoRot = true; }, 2800);

    if(!touchDidDrag && e.changedTouches.length === 1 && typeof mouse !== 'undefined' && mouse){
      var tx = e.changedTouches[0].clientX;
      var ty = e.changedTouches[0].clientY;
      mouse.x =  (tx / innerWidth)  * 2 - 1;
      mouse.y = -(ty / innerHeight) * 2 + 1;
    }
  }, {passive:true});
})();
