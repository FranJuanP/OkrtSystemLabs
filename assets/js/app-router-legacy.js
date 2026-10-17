/**
 * AETHER · entrada a la vista de aplicación desde la portada.
 *
 * BASELINE LEGIBLE. Este fichero iba ofuscado. La fuente sin ofuscar se ha
 * recuperado del monolito del 26/03/2026, tercer bloque <script> inline, y
 * verificado por AST contra el publicado desofuscado con webcrack:
 * launchAether coincide, 0 diferencias reales.
 *
 * El monolito traía además una función openGlobe que el publicado ya no
 * tiene y a la que no llama nadie; no se incorpora.
 */

function launchAether(e) {
  if(e) e.preventDefault();

  const landing = document.getElementById('page-landing');
  const aether  = document.getElementById('page-aether');

  // 1. Activar CSS de AETHER, desactivar el de landing
  document.getElementById('css-aether').removeAttribute('disabled');

  // 2. Restaurar cursor nativo para AETHER (el landing usa cursor:none)
  document.body.style.cursor = 'auto';

  // 3. Animar salida del landing
  landing.classList.add('hidden');

  // 2b. Restaurar cursor nativo
  document.body.style.cursor = "auto";

  // 3. Animar entrada de AETHER
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      aether.classList.add('active');
    });
  });

  // 4. Tras la transición, quitar landing del DOM para liberar memoria
  setTimeout(()=>{
    landing.style.display = 'none';
    // Ocultar cursor personalizado del landing (no aplica en AETHER)
    const curEl  = document.getElementById('cur');
    const curEl2 = document.getElementById('cur2');
    if(curEl)  curEl.style.display  = 'none';
    if(curEl2) curEl2.style.display = 'none';
    // 5. Iniciar AETHER (el DOMContentLoaded ya pasó — llamar init manualmente)
    // Iniciar la app AETHER
    if(typeof initAetherApp === 'function') initAetherApp();
    if(typeof initAetherApp2 === 'function') initAetherApp2();
    // Disparar el loader
    const lf = document.getElementById('lf');
    const lm = document.getElementById('lm');
    if(lf && lm) {
      let p = 0;
      const iv = setInterval(()=>{
        p = Math.min(100, p + Math.random()*15 + 8);
        lf.style.width = p + '%';
        if(p >= 40 && lm.textContent === 'INICIANDO SISTEMA...') lm.textContent='CARGANDO DATOS...';
        if(p >= 75) lm.textContent='INICIALIZANDO MÓDULOS...';
        if(p >= 100){
          clearInterval(iv);
          lm.textContent = 'SISTEMA ACTIVO';
          setTimeout(()=>{
            const loader=document.getElementById('loader');
            if(loader){loader.style.opacity='0';setTimeout(()=>{loader.style.display='none';},500);}
            if(typeof loadRegion==='function') loadRegion();
          if(typeof window._drawGlobeArcs==='function') setTimeout(window._drawGlobeArcs,200);
            if(typeof initClock==='function') initClock();
          }, 600);
        }
      }, 60);
    } else {
      // Sin loader — arrancar directamente
      if(typeof loadRegion==='function') setTimeout(loadRegion, 200);
    }
  }, 700);

  // Actualizar URL sin recargar
  history.pushState({page:'aether'}, 'AETHER', '#app');
}

// ── Back button del navegador ──
window.addEventListener('popstate', function(e) {
  const aether  = document.getElementById('page-aether');
  const landing = document.getElementById('page-landing');
  if(!e.state || e.state.page !== 'aether') {
    aether.classList.remove('active');
    landing.style.display = '';
    landing.classList.remove('hidden');
  }
});

// ── Interceptar el DOMContentLoaded de AETHER ──
// AETHER tiene su propio DOMContentLoaded listener — necesitamos que
// sólo se ejecute cuando se active la página, no al cargar el documento.
// Lo hacemos reemplazando el comportamiento del loader de AETHER.
document.addEventListener('DOMContentLoaded', function() {
  // La página AETHER está oculta — evitar que su init se dispare ahora.
  // El init real ocurre en launchAether() → dispara el evento aether-init.
});

// aether-init listener removed — using direct initAetherApp() call

// ── OPEN GLOBE — export live scores via localStorage ──