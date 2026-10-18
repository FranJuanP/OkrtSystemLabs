/**
 * Generador aleatorio con semilla para el Monte Carlo (T26).
 *
 * El Monte Carlo usaba `Math.random()`, que no se puede sembrar. Eso tiene
 * dos consecuencias prácticas:
 *
 *  - **Nadie puede reproducir una proyección.** Dos ejecuciones seguidas con
 *    los mismos datos dan bandas distintas, y no hay forma de saber si la
 *    diferencia viene del cambio que acabas de hacer o del azar.
 *  - **No se puede probar.** Una prueba sobre una simulación aleatoria solo
 *    puede comprobar que el número está «por ahí».
 *
 * Con semilla las dos cosas se arreglan: la semilla se muestra en el panel y
 * se puede fijar con `?seed=` en la URL, así que una proyección concreta se
 * puede volver a mirar, compartir y comparar.
 *
 * mulberry32: 32 bits de estado, periodo 2^32, pasa las pruebas de gsl-rng
 * para lo que aquí se le pide. No es criptográfico y no pretende serlo.
 */

/** @param {number} semilla  entero de 32 bits */
export function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function siguiente() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normal estándar por Box-Muller, con el generador que se le pase.
 *
 * Se devuelve una función en vez de usar una global para que cada simulación
 * pueda tener su propia secuencia sin interferir con otra.
 */
export function gaussianaCon(aleatorio) {
  return function gaussiana(media = 0, sigma = 1) {
    let u = 0;
    let v = 0;
    while (u === 0) u = aleatorio();
    while (v === 0) v = aleatorio();
    return media + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/**
 * La semilla de esta sesión.
 *
 * Con `?seed=12345` se fija; sin ella se elige una al azar **una sola vez** y
 * se conserva mientras la página esté abierta, de modo que repetir la
 * proyección da el mismo resultado y el usuario puede anotar la semilla si
 * quiere volver a ella.
 */
let semillaActual = null;

export function semilla() {
  if (semillaActual != null) return semillaActual;
  let deUrl = null;
  try {
    const p = new URLSearchParams(window.location.search).get('seed');
    if (p != null && /^\d{1,10}$/.test(p)) deUrl = Number(p) >>> 0;
  } catch (err) { /* sin window, en pruebas */ }
  semillaActual = deUrl != null ? deUrl : (Math.floor(Math.random() * 4294967296) >>> 0);
  return semillaActual;
}

/** Fija la semilla (las pruebas y el enlace «repetir» la usan). */
export function fijarSemilla(n) {
  semillaActual = Number(n) >>> 0;
  return semillaActual;
}

/**
 * Un generador para una simulación concreta.
 *
 * La semilla de cada simulación se deriva de la de la sesión y del índice, de
 * forma que las 400 simulaciones son independientes entre sí pero el conjunto
 * entero se repite con la misma semilla.
 */
export function generadorDeSimulacion(indice) {
  return mulberry32((semilla() + indice * 0x9E3779B1) >>> 0);
}
