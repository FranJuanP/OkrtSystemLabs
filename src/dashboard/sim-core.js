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
 * Una pasada de la cascada.
 *
 * @param {object} modelo  {catKeys, scores, vel, resiliencia, prop}
 * @param {number} semanas
 * @param {object} [overrides]     estado inicial alterado
 * @param {object} [velOverrides]  velocidades alteradas
 */
export function simularCascada(modelo, semanas, overrides = {}, velOverrides = null) {
  const { catKeys, scores, prop, resiliencia } = modelo;
  const vel = velOverrides || modelo.vel;

  const estado = {};
  for (const k of catKeys) estado[k] = scores[k] != null ? scores[k] : 50;
  Object.assign(estado, overrides);

  const historia = [Object.assign({}, estado, { week: 0 })];
  const pendientes = [];
  const residuos = [];

  // Shocks iniciales a partir de las velocidades.
  for (const origen of catKeys) {
    const props = prop[origen];
    if (!props) continue;
    const v = vel[origen] || 0;
    if (Math.abs(v) < 0.05) continue;
    const s0 = estado[origen];
    for (const [destino, par] of Object.entries(props)) {
      const magnitud = s0 * v * par.s * (1 - resiliencia * 0.6);
      if (Math.abs(magnitud) < 0.3) continue;
      pendientes.push({
        target: destino,
        delta: magnitud,
        arrivalWeek: Math.round(par.l),
        decay: par.d,
        source: origen,
      });
    }
  }

  for (let semana = 1; semana <= semanas; semana++) {
    const nuevo = Object.assign({}, estado);

    // Tendencia secular.
    for (const k of catKeys) {
      const deriva = (vel[k] || 0) * 0.4 * (1 - resiliencia * 0.5);
      nuevo[k] = Math.max(0, Math.min(100, nuevo[k] + deriva));
    }

    // Shocks que llegan.
    for (const shock of pendientes) {
      if (shock.arrivalWeek !== semana) continue;
      const amortiguado = shock.delta * (1 - resiliencia * 0.4);
      nuevo[shock.target] = Math.max(0, Math.min(100, nuevo[shock.target] + amortiguado));
      residuos.push({ target: shock.target, delta: amortiguado, decay: shock.decay });

      // Segundo orden.
      const props2 = prop[shock.target];
      if (props2 && Math.abs(amortiguado) > 1.5) {
        for (const [destino2, par] of Object.entries(props2)) {
          if (destino2 === shock.source) continue;
          pendientes.push({
            target: destino2,
            delta: amortiguado * par.s * 0.5,
            arrivalWeek: semana + Math.round(par.l * 0.7),
            decay: par.d,
            source: shock.target,
          });
        }
      }
    }

    // Decaimiento de lo que ya llegó (T26).
    for (let i = residuos.length - 1; i >= 0; i--) {
      const r = residuos[i];
      const dec = (typeof r.decay === 'number' && r.decay > 0 && r.decay < 1) ? r.decay : 0.8;
      const siguiente = r.delta * dec;
      nuevo[r.target] = Math.max(0, Math.min(100, nuevo[r.target] - (r.delta - siguiente)));
      r.delta = siguiente;
      if (Math.abs(r.delta) < 0.1) residuos.splice(i, 1);
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
  const { catKeys, scores, sigmas, vel } = modelo;
  const resultados = [];
  const claves = fotogramas(semanas);

  for (let sim = 0; sim < nSims; sim++) {
    const gaussiana = gaussianaCon(mulberry32((semilla + sim * 0x9E3779B1) >>> 0));

    const overrides = {};
    for (const k of catKeys) {
      const base = scores[k] != null ? scores[k] : 50;
      overrides[k] = Math.max(0, Math.min(100, base + gaussiana(0, sigmas[k])));
    }

    const velPerturbada = {};
    for (const k of catKeys) velPerturbada[k] = (vel[k] || 0) + gaussiana(0, modelo.sigmaVelocidad);

    const historia = simularCascada(modelo, semanas, overrides, velPerturbada);
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
