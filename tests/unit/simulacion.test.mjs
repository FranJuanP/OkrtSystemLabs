/**
 * T29 · Pruebas de la simulación y del generador con semilla.
 *
 * Estas son las pruebas que T26 hizo posibles. Antes el Monte Carlo usaba
 * `Math.random()` y lo único que se podía comprobar de él era que el número
 * estaba «por ahí». Con semilla se puede exigir el resultado exacto, y con la
 * simulación en un módulo puro se puede exigir el comportamiento: que un
 * shock decae, que las velocidades perturbadas cambian la trayectoria, que
 * las bandas están ordenadas.
 */
import { describe, it, expect } from 'vitest';
import { mulberry32, gaussianaCon } from '../../src/dashboard/rng.js';
import { simularCascada, monteCarlo, fotogramas } from '../../src/dashboard/sim-core.js';

describe('mulberry32', () => {
  it('con la misma semilla da la misma secuencia', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('con semillas distintas da secuencias distintas', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    let iguales = 0;
    for (let i = 0; i < 100; i++) if (a() === b()) iguales++;
    expect(iguales).toBe(0);
  });

  it('devuelve valores en [0, 1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('reparte razonablemente: la media de 20.000 tiradas se acerca a 0,5', () => {
    const r = mulberry32(7);
    let suma = 0;
    for (let i = 0; i < 20000; i++) suma += r();
    expect(suma / 20000).toBeCloseTo(0.5, 2);
  });
});

describe('gaussianaCon', () => {
  it('produce una normal con la media y la desviación pedidas', () => {
    const g = gaussianaCon(mulberry32(42));
    const n = 20000;
    let suma = 0;
    let suma2 = 0;
    for (let i = 0; i < n; i++) {
      const v = g(10, 3);
      suma += v;
      suma2 += v * v;
    }
    const media = suma / n;
    const sigma = Math.sqrt(suma2 / n - media * media);
    expect(media).toBeCloseTo(10, 1);
    expect(sigma).toBeCloseTo(3, 0);
  });

  it('es reproducible con la misma semilla', () => {
    const a = gaussianaCon(mulberry32(5))(0, 1);
    const b = gaussianaCon(mulberry32(5))(0, 1);
    expect(a).toBe(b);
  });
});

/** Un modelo mínimo: dos categorías, una propaga a la otra. */
function modeloDePrueba(extra = {}) {
  return Object.assign({
    catKeys: ['eco', 'geo'],
    scores: { eco: 50, geo: 40 },
    sigmas: { eco: 3, geo: 3 },
    ritmo: { eco: 0, geo: 0 },
    resiliencia: 0.5,
    sigmaRitmo: 1,
    prop: { eco: { geo: { s: 0.8, l: 3, d: 0.1 } } },
  }, extra);
}

describe('simularCascada', () => {
  it('sin ritmo ni shocks no pasa nada', () => {
    const h = simularCascada(modeloDePrueba(), 10);
    expect(h).toHaveLength(11);
    for (const cuadro of h) {
      expect(cuadro.eco).toBeCloseTo(50, 6);
      expect(cuadro.geo).toBeCloseTo(40, 6);
    }
  });

  it('el ritmo va en puntos por año: en 52 semanas se suma el ritmo anual (sin resiliencia)', () => {
    const h = simularCascada(modeloDePrueba({ ritmo: { eco: 5.2, geo: 0 }, resiliencia: 0, prop: {} }), 52);
    expect(h[52].eco - 50).toBeCloseTo(5.2, 6);
  });

  it('un ritmo en eco manda un shock a geo en la semana que dice el retardo', () => {
    const h = simularCascada(modeloDePrueba({ ritmo: { eco: 8, geo: 0 } }), 12);
    expect(h[2].geo).toBeCloseTo(40, 6);
    expect(h[3].geo).toBeGreaterThan(40.5);
  });

  it('el shock llega ENTERO y pierde la fracción d cada semana a partir de la siguiente', () => {
    // Shock limpio: sin resiliencia, sin ritmo, solo el salto inicial de eco.
    const m = modeloDePrueba({ resiliencia: 0, prop: { eco: { geo: { s: 1, l: 2, d: 0.1 } } } });
    const h = simularCascada(m, 6, { eco: 70 }, null, { propagar: true });
    const g = h.map((f) => f.geo - 40);
    expect(g[1]).toBeCloseTo(0, 6);
    expect(g[2]).toBeCloseTo(20, 6);        // llega +20 entero
    expect(g[3]).toBeCloseTo(18, 6);        // conserva el 90 %
    expect(g[4]).toBeCloseTo(16.2, 6);
    expect(g[6]).toBeLessThan(g[2]);
  });

  it('sin propagar, el estado inicial alterado NO viaja (Monte Carlo); con propagar, sí (Shock Simulator)', () => {
    const m = modeloDePrueba({ resiliencia: 0 });
    const quieto = simularCascada(m, 6, { eco: 80 });
    const viaja = simularCascada(m, 6, { eco: 80 }, null, { propagar: true });
    expect(quieto[6].geo).toBeCloseTo(40, 6);
    expect(viaja[6].geo).toBeGreaterThan(50);
    expect(viaja[0].eco).toBe(80);
  });

  it('los ritmos perturbados cambian la trayectoria', () => {
    const m = modeloDePrueba();
    const arriba = simularCascada(m, 12, {}, { eco: 6, geo: 6 });
    const abajo = simularCascada(m, 12, {}, { eco: -6, geo: -6 });
    expect(arriba[12].eco).toBeGreaterThan(abajo[12].eco);
  });

  it('el estado inicial alterado se respeta', () => {
    const h = simularCascada(modeloDePrueba(), 5, { eco: 95 });
    expect(h[0].eco).toBe(95);
  });

  it('las puntuaciones se quedan entre 0 y 100', () => {
    const h = simularCascada(modeloDePrueba({ ritmo: { eco: 25, geo: 25 }, resiliencia: 0 }), 200, { eco: 99 }, null, { propagar: true });
    for (const cuadro of h) {
      for (const k of ['eco', 'geo']) {
        expect(cuadro[k]).toBeGreaterThanOrEqual(0);
        expect(cuadro[k]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('más resiliencia amortigua más', () => {
    const blando = simularCascada(modeloDePrueba({ resiliencia: 0.05 }), 12, { eco: 75 }, null, { propagar: true });
    const duro = simularCascada(modeloDePrueba({ resiliencia: 0.9 }), 12, { eco: 75 }, null, { propagar: true });
    const subeBlando = Math.max(...blando.map((f) => f.geo)) - 40;
    const subeDuro = Math.max(...duro.map((f) => f.geo)) - 40;
    expect(subeDuro).toBeLessThan(subeBlando);
  });
});

describe('monteCarlo', () => {
  it('con la misma semilla da exactamente el mismo resultado', () => {
    const a = monteCarlo(modeloDePrueba(), 12, 200, 12345);
    const b = monteCarlo(modeloDePrueba(), 12, 200, 12345);
    expect(JSON.stringify(a.bands)).toBe(JSON.stringify(b.bands));
  });

  it('con otra semilla da otro resultado', () => {
    const a = monteCarlo(modeloDePrueba(), 12, 200, 1);
    const b = monteCarlo(modeloDePrueba(), 12, 200, 2);
    expect(JSON.stringify(a.bands)).not.toBe(JSON.stringify(b.bands));
  });

  it('los percentiles salen ordenados', () => {
    const r = monteCarlo(modeloDePrueba(), 12, 300, 7);
    for (const w of r.keyFrames) {
      const b = r.bands[w];
      expect(b.p10).toBeLessThanOrEqual(b.p25);
      expect(b.p25).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p75);
      expect(b.p75).toBeLessThanOrEqual(b.p90);
    }
  });

  it('más incertidumbre declarada da una banda más ancha', () => {
    const estrecha = monteCarlo(modeloDePrueba({ sigmas: { eco: 1, geo: 1 } }), 12, 400, 3);
    const ancha = monteCarlo(modeloDePrueba({ sigmas: { eco: 12, geo: 12 } }), 12, 400, 3);
    const anchoDe = (r) => r.bands[12].p90 - r.bands[12].p10;
    expect(anchoDe(ancha)).toBeGreaterThan(anchoDe(estrecha));
  });

  it('devuelve la semilla y el número de simulaciones, para poder repetirlo', () => {
    const r = monteCarlo(modeloDePrueba(), 12, 50, 999);
    expect(r.semilla).toBe(999);
    expect(r.simulaciones).toBe(50);
  });

  it('guarda cinco semanas clave, la primera y la última incluidas', () => {
    expect(fotogramas(100)).toEqual([0, 25, 50, 75, 100]);
    const r = monteCarlo(modeloDePrueba(), 100, 20, 1);
    expect(r.keyFrames).toEqual([0, 25, 50, 75, 100]);
  });
});
