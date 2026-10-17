/**
 * Cliente del worker de simulación, con memoria (T28).
 *
 * Dos cosas, y la segunda importa más que la primera:
 *
 *  1. **Saca el Monte Carlo del hilo principal.** Eran 86 ms de tarea larga
 *     medidos en cada cambio de región.
 *
 *  2. **Memoriza.** El resultado solo depende del país, del horizonte y de la
 *     semilla; con esos tres iguales, el cálculo da exactamente lo mismo
 *     (T26 lo hizo determinista, que es lo que permite memorizarlo). Antes
 *     volver a una región ya vista recalculaba las 400 simulaciones desde
 *     cero. Ahora la segunda vez es una lectura de un Map.
 *
 * Si el navegador no tiene Worker, o si falla al crearse —`file://`, una CSP
 * sin `worker-src`, un navegador antiguo—, se calcula en el hilo principal.
 * Peor, pero funciona; y queda anotado en `ultimoModo` para poder verlo.
 */
import { monteCarlo } from './sim-core.js';

/** Clave de memoria: lo que determina el resultado, y nada más. */
const clave = (code, semanas, nSims, semilla) => `${code}|${semanas}|${nSims}|${semilla}`;

/** Resultados ya calculados. Pocos y pequeños: un objeto de bandas por clave. */
const memoria = new Map();
const MAX_MEMORIA = 60;

let worker = null;
let workerRoto = false;
let siguienteId = 1;
const enVuelo = new Map();

export const estadisticas = { aciertos: 0, fallos: 0, modo: 'sin usar', msUltimo: null };

function crearWorker() {
  if (worker || workerRoto) return worker;
  try {
    // `new URL(..., import.meta.url)` es lo que permite a Vite empaquetar el
    // worker como un fichero aparte con su propio hash.
    worker = new Worker(new URL('./sim-worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (ev) => {
      const { id, ok, resultado, error } = ev.data || {};
      const pendiente = enVuelo.get(id);
      if (!pendiente) return;
      enVuelo.delete(id);
      if (ok) {
        estadisticas.msUltimo = resultado.ms;
        pendiente.resolver(resultado);
      } else {
        pendiente.rechazar(new Error(error || 'el worker no devolvió resultado'));
      }
    });
    worker.addEventListener('error', (ev) => {
      // Un worker que falla no se reintenta: se marca y se pasa al hilo
      // principal, que es la alternativa que siempre funciona.
      console.warn('AETHER: el worker de simulación ha fallado, se calcula en el hilo principal:', ev.message);
      workerRoto = true;
      worker = null;
      for (const [, p] of enVuelo) p.rechazar(new Error('worker caído'));
      enVuelo.clear();
    });
  } catch (err) {
    workerRoto = true;
    worker = null;
  }
  return worker;
}

/**
 * @param {object} modelo   salida de modeloDe()
 * @param {string} code     solo para la clave de memoria
 * @param {number} semanas
 * @param {number} nSims
 * @param {number} semilla
 * @returns {Promise<object>} {bands, keyFrames, semilla, simulaciones}
 */
export function proyectar(modelo, code, semanas, nSims, semilla) {
  const k = clave(code, semanas, nSims, semilla);
  if (memoria.has(k)) {
    estadisticas.aciertos++;
    estadisticas.modo = 'memoria';
    return Promise.resolve(memoria.get(k));
  }
  estadisticas.fallos++;

  const guardar = (r) => {
    // Memoria acotada: se tira la entrada más antigua. Un Map conserva el
    // orden de inserción, así que la primera clave es la más vieja.
    if (memoria.size >= MAX_MEMORIA) memoria.delete(memoria.keys().next().value);
    memoria.set(k, r);
    return r;
  };

  const w = crearWorker();
  if (!w) {
    estadisticas.modo = 'hilo principal';
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    const r = monteCarlo(modelo, semanas, nSims, semilla);
    estadisticas.msUltimo = Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0);
    return Promise.resolve(guardar(r));
  }

  estadisticas.modo = 'worker';
  const id = siguienteId++;
  return new Promise((resolver, rechazar) => {
    enVuelo.set(id, { resolver, rechazar });
    w.postMessage({ id, modelo, semanas, nSims, semilla });
  }).then(guardar).catch((err) => {
    // Si el worker se cae a mitad, se calcula aquí antes que dejar la
    // proyección sin pintar.
    console.warn('AETHER: simulación en el hilo principal tras un fallo del worker:', err.message);
    estadisticas.modo = 'hilo principal (tras fallo)';
    return guardar(monteCarlo(modelo, semanas, nSims, semilla));
  });
}

/** Un resultado ya memorizado, si lo hay. Para poder pintar sin esperar. */
export function enMemoria(code, semanas, nSims, semilla) {
  return memoria.get(clave(code, semanas, nSims, semilla)) || null;
}

export function limpiarMemoria() {
  memoria.clear();
  estadisticas.aciertos = 0;
  estadisticas.fallos = 0;
}
