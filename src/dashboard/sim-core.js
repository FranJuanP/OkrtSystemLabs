/**
 * Núcleo de simulación, sin DOM y sin estado global (T28).
 *
 * Es el mismo cálculo que estaba dentro del motor, con una diferencia que es
 * la razón de existir de este fichero: **no lee nada de fuera**. Todo lo que
 * necesita —las puntuaciones del país, sus velocidades, su resiliencia, la
 * matriz de propagación— le llega en un objeto `modelo` que se puede
 * serializar y enviar a un Web Worker con `postMessage`.
 *
 * Antes el Monte Carlo corría en el hilo principal y bloqueaba 86 ms medidos
 * cada vez que se cambiaba de región: una tarea larga, por encima del umbral
 * de 50 ms, suficiente para que se note el tirón. Con el worker el hilo
 * principal queda libre para pintar.
 *
 * El modelo se construye con `modeloDe()` en el hilo principal, que es quien
 * tiene DATA y las matrices.
 */

/** mulberry32, duplicado aquí para que el worker no dependa de nada más. */
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function siguiente() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianaCon(aleatorio) {
  return function gaussiana(media, sigma) {
    let u = 0;
    let v = 0;
    while (u === 0) u = aleatorio();
    while (v === 0) v = aleatorio();
    return media + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/**
 * Una pasada de la cascada, semana a semana.
 *
 * Unidades: las puntuaciones van de 0 a 100 y el `ritmo` de cada categoría
 * en PUNTOS POR AÑO (src/core/scoring.js). Cada semana se suma ritmo/52.
 * Antes se sumaba `velocidad × 0,4` cada semana, con la velocidad como
 * cambio relativo anual de los indicadores brutos: otra unidad.
 *
 * Shocks. Una categoría manda shocks a las que dependen de ella según
 * PROP_MATRIX: {s: fuerza, l: semanas de retardo, d: fracción que se pierde
 * cada semana}. Los origina:
 *   - su ritmo: lo que se mueve en un año empuja a las dependientes;
 *   - con `opciones.propagar`, la diferencia entre el estado inicial y la
 *     puntuación del país: es lo que hace el Shock Simulator. Antes esos
 *     shocks solo cambiaban el punto de partida y NO se propagaban; una
 *     pandemia subía SALUD y BIOSEG pero no llegaba a la economía.
 * Al llegar, un shock de segundo orden sale hacia las dependientes del
 * destino con la mitad de fuerza, y así sucesivamente mientras supere 1,5.
 *
 * Decaimiento (T26, corregido). Un shock que llega se mantiene entero esa
 * semana y a partir de la siguiente pierde la fracción `d` cada semana:
 * con d = 0,05 conserva el 95 %. Antes se conservaba `d` (el 5 %) y desde
 * la misma semana de llegada, así que un shock de +20 se veía como +1
 * durante una semana y desaparecía.
 *
 * @param {object} modelo  {catKeys, scores, ritmo, resiliencia, prop}
 * @param {number} semanas
 * @param {object} [overrides]       estado inicial alterado
 * @param {object} [ritmoOverrides]  ritmos alterados (Monte Carlo)
 * @param {{propagar?: boolean}} [opciones]
 */
export function simularCascada(modelo, semanas, overrides = {}, ritmoOverrides = null, opciones = {}) {
  const { catKeys, scores, prop, resiliencia } = modelo;
  const ritmo = ritmoOverrides || modelo.ritmo || {};

  const estado = {};
  for (const k of catKeys) estado[k] = scores[k] != null ? scores[k] : 50;
  const base = Object.assign({}, estado);
  Object.assign(estado, overrides);

  const historia = [Object.assign({}, estado, { week: 0 })];
  const pendientes = [];
  const residuos = [];

  const lanzar = (origen, magnitud) => {
    const props = prop[origen];
    if (!props) return;
    for (const [destino, par] of Object.entries(props)) {
      const delta = magnitud * par.s * (1 - resiliencia * 0.6);
      if (Math.abs(delta) < 0.3) continue;
      pendientes.push({ target: destino, delta, arrivalWeek: Math.max(1, Math.round(par.l)), decay: par.d, source: origen });
    }
  };

  // Shocks iniciales: por el ritmo de cada categoría y, si se pide, por el
  // estado inicial alterado.
  for (const origen of catKeys) {
    const r = ritmo[origen] || 0;
    if (Math.abs(r) >= 0.25) lanzar(origen, r);
    if (opciones.propagar) {
      const salto = estado[origen] - base[origen];
      if (Math.abs(salto) >= 1) lanzar(origen, salto);
    }
  }

  for (let semana = 1; semana <= semanas; semana++) {
    const nuevo = Object.assign({}, estado);

    // Decaimiento de lo que llegó en semanas anteriores.
    for (let i = residuos.length - 1; i >= 0; i--) {
      const r = residuos[i];
      const d = (typeof r.decay === 'number' && r.decay > 0 && r.decay < 1) ? r.decay : 0.08;
      const siguiente = r.delta * (1 - d);
      nuevo[r.target] = Math.max(0, Math.min(100, nuevo[r.target] - (r.delta - siguiente)));
      r.delta = siguiente;
      if (Math.abs(r.delta) < 0.1) residuos.splice(i, 1);
    }

    // Tendencia: el ritmo anual repartido por semanas.
    for (const k of catKeys) {
      const deriva = ((ritmo[k] || 0) / 52) * (1 - resiliencia * 0.5);
      nuevo[k] = Math.max(0, Math.min(100, nuevo[k] + deriva));
    }

    // Shocks que llegan esta semana.
    for (const shock of pendientes) {
      if (shock.arrivalWeek !== semana) continue;
      const amortiguado = shock.delta * (1 - resiliencia * 0.4);
      const antes = nuevo[shock.target];
      nuevo[shock.target] = Math.max(0, Math.min(100, antes + amortiguado));
      // Lo que de verdad ha entrado, por si el tope de 0 o 100 lo ha recortado.
      const efectivo = nuevo[shock.target] - antes;
      if (Math.abs(efectivo) >= 0.1) residuos.push({ target: shock.target, delta: efectivo, decay: shock.decay });

      // Segundo orden y siguientes.
      const props2 = prop[shock.target];
      if (props2 && Math.abs(amortiguado) > 1.5) {
        for (const [destino2, par] of Object.entries(props2)) {
          if (destino2 === shock.source) continue;
          pendientes.push({
            target: destino2,
            delta: amortiguado * par.s * 0.5,
            arrivalWeek: semana + Math.max(1, Math.round(par.l * 0.7)),
            decay: par.d,
            source: shock.target,
          });
        }
      }
    }

    for (const k of catKeys) estado[k] = nuevo[k];
    historia.push(Object.assign({}, estado, { week: semana }));
  }

  return historia;
}

/** Las semanas que se guardan de cada simulación. */
export const fotogramas = (semanas) => [
  0,
  Math.floor(semanas * 0.25),
  Math.floor(semanas * 0.5),
  Math.floor(semanas * 0.75),
  semanas,
];

/**
 * Monte Carlo: n simulaciones con el estado inicial y las velocidades
 * perturbadas, y los percentiles de la puntuación media por semana clave.
 */
export function monteCarlo(modelo, semanas, nSims, semilla) {
  const { catKeys, scores, sigmas } = modelo;
  const ritmo = modelo.ritmo || {};
  const resultados = [];
  const claves = fotogramas(semanas);

  for (let sim = 0; sim < nSims; sim++) {
    const gaussiana = gaussianaCon(mulberry32((semilla + sim * 0x9E3779B1) >>> 0));

    const overrides = {};
    for (const k of catKeys) {
      const base = scores[k] != null ? scores[k] : 50;
      overrides[k] = Math.max(0, Math.min(100, base + gaussiana(0, sigmas[k])));
    }

    // La incertidumbre del estado inicial es de MEDIDA, no un suceso: no se
    // propaga como shock. La del ritmo sí cambia la trayectoria.
    const ritmoPerturbado = {};
    for (const k of catKeys) ritmoPerturbado[k] = (ritmo[k] || 0) + gaussiana(0, modelo.sigmaRitmo || 0);

    const historia = simularCascada(modelo, semanas, overrides, ritmoPerturbado);
    const uno = {};
    for (const w of claves) {
      const cuadro = historia[Math.min(w, historia.length - 1)];
      let total = 0;
      for (const k of catKeys) total += (cuadro[k] || 50);
      uno[w] = total / catKeys.length;
    }
    resultados.push(uno);
  }

  const bandas = {};
  for (const w of claves) {
    const valores = resultados.map((r) => r[w]).sort((a, b) => a - b);
    bandas[w] = {
      p10: valores[Math.floor(nSims * 0.10)],
      p25: valores[Math.floor(nSims * 0.25)],
      p50: valores[Math.floor(nSims * 0.50)],
      p75: valores[Math.floor(nSims * 0.75)],
      p90: valores[Math.floor(nSims * 0.90)],
    };
  }

  return { bands: bandas, keyFrames: claves, semilla, simulaciones: nSims };
}
