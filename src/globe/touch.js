/**
 * AETHER Globe · soporte táctil.
 *
 * T12: antes era un parche suelto que reasignaba variables globales del
 * motor (`autoRot`, `isDrag`, `prevX`, `prevY`, `tRotX`, `tRotY`,
 * `didDrag`, `tooltipActive`) y tocaba `camera.position` directamente, cada
 * una protegida con un `typeof x !== 'undefined'` porque no tenía forma de
 * saber si el motor había cargado.
 *
 * Ahora pasa por `pointer`, la API que el motor exporta para esto. El
 * import garantiza el orden de carga, así que sobran las comprobaciones.
 */
import { pointer } from './engine.js';

/** Umbral en píxeles para considerar que el dedo ha arrastrado, no tocado. */
const DRAG_THRESHOLD_PX = 3;
/** Sensibilidad de rotación por píxel arrastrado. */
const ROTATE_PER_PX = 0.005;
/** Sensibilidad del zoom por píxel de pellizco. */
const ZOOM_PER_PX = 0.012;
/** Tiempo sin tocar tras el que vuelve la rotación automática. */
const AUTOROTATE_DELAY_MS = 2800;

let didDrag = false;
let pinchDistance = 0;
let autoRotateTimer = null;

/** Distancia entre los dos primeros dedos. */
function pinchDist(ev) {
  const dx = ev.touches[0].clientX - ev.touches[1].clientX;
  const dy = ev.touches[0].clientY - ev.touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

window.addEventListener('touchstart', (ev) => {
  clearTimeout(autoRotateTimer);
  if (ev.touches.length === 1) {
    didDrag = false;
    pointer.stopAutoRotate();
    pointer.setDragging(true);
    pointer.setLast(ev.touches[0].clientX, ev.touches[0].clientY);
  } else if (ev.touches.length === 2) {
    pointer.setDragging(false);
    pinchDistance = pinchDist(ev);
  }
}, { passive: true });

window.addEventListener('touchmove', (ev) => {
  if (ev.touches.length === 1 && pointer.isDragging()) {
    const dx = ev.touches[0].clientX - pointer.lastX();
    const dy = ev.touches[0].clientY - pointer.lastY();
    if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX) didDrag = true;
    pointer.rotateBy(dx * ROTATE_PER_PX, dy * ROTATE_PER_PX);
    pointer.setLast(ev.touches[0].clientX, ev.touches[0].clientY);
    pointer.hideTooltip();
  } else if (ev.touches.length === 2) {
    const d = pinchDist(ev);
    pointer.zoomBy((pinchDistance - d) * ZOOM_PER_PX);
    pinchDistance = d;
  }
}, { passive: true });

window.addEventListener('touchend', (ev) => {
  pointer.setDragging(false);
  pointer.setDidDrag(didDrag);
  autoRotateTimer = setTimeout(() => pointer.startAutoRotate(), AUTOROTATE_DELAY_MS);

  // Un toque sin arrastre se trata como clic: se apunta el raycaster ahí.
  if (!didDrag && ev.changedTouches.length === 1) {
    pointer.pointAt(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY);
  }
}, { passive: true });
