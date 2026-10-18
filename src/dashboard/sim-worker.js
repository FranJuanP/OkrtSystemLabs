/**
 * Web Worker del Monte Carlo (T28).
 *
 * Recibe un modelo completo —sin referencias a DATA ni a las matrices— y
 * devuelve las bandas de percentiles. Lo único que hace es sacar del hilo
 * principal una tarea de unos 70 ms que, medida con PerformanceObserver,
 * producía una tarea larga de 86 ms cada vez que se cambiaba de región.
 *
 * El protocolo es deliberadamente mínimo: un mensaje de entrada con un `id`
 * y uno de salida con el mismo `id`, para que el cliente pueda tener varias
 * peticiones en vuelo sin confundirlas.
 */
import { monteCarlo } from './sim-core.js';

self.addEventListener('message', (ev) => {
  const { id, modelo, semanas, nSims, semilla } = ev.data || {};
  try {
    const inicio = performance.now();
    const resultado = monteCarlo(modelo, semanas, nSims, semilla);
    resultado.ms = Math.round(performance.now() - inicio);
    self.postMessage({ id, ok: true, resultado });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err && err.message) || String(err) });
  }
});
