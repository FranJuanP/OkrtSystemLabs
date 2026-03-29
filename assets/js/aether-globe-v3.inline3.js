
// ── TOUCH SUPPORT PATCH ──
// Se ejecuta tras el script principal. Añade rotación táctil,
// pinch-zoom y tap-to-select país. Cero modificaciones al código original.
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
      autoRot = false;
      isDrag  = true;
      prevX   = e.touches[0].clientX;
      prevY   = e.touches[0].clientY;
    } else if(e.touches.length === 2){
      isDrag     = false;
      touch2Dist = dist2(e);
    }
  }, {passive:true});

  window.addEventListener('touchmove', function(e){
    if(e.touches.length === 1 && isDrag){
      var dx = e.touches[0].clientX - prevX;
      var dy = e.touches[0].clientY - prevY;
      if(Math.abs(dx) + Math.abs(dy) > 3) touchDidDrag = true;
      tRotY += dx * 0.005;
      tRotX += dy * 0.005;
      tRotX  = Math.max(-1.35, Math.min(1.35, tRotX));
      prevX  = e.touches[0].clientX;
      prevY  = e.touches[0].clientY;
      if(arcTooltip){ arcTooltip.classList.remove('show'); tooltipActive = false; }
    } else if(e.touches.length === 2){
      var d     = dist2(e);
      var delta = touch2Dist - d;
      camera.position.z = Math.max(1.55, Math.min(6.0, camera.position.z + delta * 0.012));
      touch2Dist = d;
    }
  }, {passive:true});

  window.addEventListener('touchend', function(e){
    isDrag = false;
    // Exponer didDrag al listener de click existente para que lo descarte si fue drag
    didDrag = touchDidDrag;
    touchAutoRotTimer = setTimeout(function(){ autoRot = true; }, 2800);

    // Tap limpio → actualizar mouse para que el listener de click existente funcione
    if(!touchDidDrag && e.changedTouches.length === 1){
      var tx = e.changedTouches[0].clientX;
      var ty = e.changedTouches[0].clientY;
      mouse.x =  (tx / innerWidth)  * 2 - 1;
      mouse.y = -(ty / innerHeight) * 2 + 1;
      // El listener 'click' del código original se disparará tras este touchend
      // y encontrará las coordenadas correctas en `mouse`.
    }
  }, {passive:true});

})();
