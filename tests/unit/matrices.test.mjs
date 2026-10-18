/**
 * T29 · Pruebas del saneamiento de matrices (T27).
 *
 * Lo que comprueban, y es el motivo de que T27 exista: que una matriz que
 * parece una correlación pero no es semidefinida positiva se detecta, que la
 * proyección la arregla sin deformarla, y que los pesos normalizados suman 1
 * conservando sus proporciones.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  cholesky, esDefinidaPositiva, comprobarCorrelacion,
  jacobiEigen, proyectarAPSD, normalizarPesos,
} from '../../src/dashboard/matrices.js';

const RAIZ = path.join(import.meta.dirname, '..', '..');

/** La matriz que el motor lleva escrita a mano, leída del propio fichero. */
function matrizDelMotor() {
  const src = fs.readFileSync(path.join(RAIZ, 'src', 'dashboard', 'engine.js'), 'utf8');
  const m = src.match(/const CORR_DECLARADA=(\[\[.*?\]\]);/s);
  if (!m) throw new Error('no se encuentra CORR_DECLARADA en el motor');
  return JSON.parse(m[1]);
}

describe('cholesky', () => {
  it('factoriza la identidad', () => {
    const L = cholesky([[1, 0], [0, 1]]);
    expect(L).toEqual([[1, 0], [0, 1]]);
  });

  it('devuelve null si la matriz no es definida positiva', () => {
    // Correlaciones imposibles: A-B 0,9, B-C 0,9, A-C -0,9.
    expect(cholesky([[1, 0.9, -0.9], [0.9, 1, 0.9], [-0.9, 0.9, 1]])).toBeNull();
  });

  it('acepta una matriz de correlación de verdad', () => {
    expect(esDefinidaPositiva([[1, 0.5, 0.3], [0.5, 1, 0.2], [0.3, 0.2, 1]])).toBe(true);
  });
});

describe('jacobiEigen', () => {
  it('encuentra los valores propios de una matriz diagonal', () => {
    const { valores } = jacobiEigen([[3, 0], [0, 7]]);
    expect(valores.slice().sort((a, b) => a - b)).toEqual([3, 7]);
  });

  it('la traza se conserva: la suma de los valores propios es la de la diagonal', () => {
    const A = [[1, 0.5, 0.2], [0.5, 1, 0.3], [0.2, 0.3, 1]];
    const { valores } = jacobiEigen(A);
    expect(valores.reduce((a, b) => a + b, 0)).toBeCloseTo(3, 8);
  });

  it('los vectores propios cumplen A·v = λ·v', () => {
    const A = [[2, 1], [1, 2]];
    const { valores, vectores } = jacobiEigen(A);
    for (let k = 0; k < 2; k++) {
      const v = [vectores[0][k], vectores[1][k]];
      const Av = [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
      expect(Av[0]).toBeCloseTo(valores[k] * v[0], 8);
      expect(Av[1]).toBeCloseTo(valores[k] * v[1], 8);
    }
  });
});

describe('la matriz que lleva el motor', () => {
  const A = matrizDelMotor();

  it('es 16×16', () => {
    expect(A).toHaveLength(16);
    for (const fila of A) expect(fila).toHaveLength(16);
  });

  it('parece una correlación: simétrica, diagonal de unos, valores en rango', () => {
    const c = comprobarCorrelacion(A);
    expect(c.simetrica).toBe(true);
    expect(c.diagonalUnos).toBe(true);
    expect(c.enRango).toBe(true);
  });

  it('pero NO lo es: tiene un valor propio negativo', () => {
    const c = comprobarCorrelacion(A);
    expect(c.definidaPositiva).toBe(false);
    const { valores } = jacobiEigen(A);
    const negativos = valores.filter((v) => v < 0);
    expect(negativos).toHaveLength(1);
    expect(Math.min(...valores)).toBeCloseTo(-0.1484, 3);
  });
});

describe('proyectarAPSD', () => {
  const A = matrizDelMotor();
  const r = proyectarAPSD(A);

  it('deja la matriz del motor convertida en una correlación válida', () => {
    const c = comprobarCorrelacion(r.matriz);
    expect(c.definidaPositiva).toBe(true);
    expect(c.simetrica).toBe(true);
    expect(c.diagonalUnos).toBe(true);
    expect(c.enRango).toBe(true);
  });

  it('recorta exactamente un valor propio', () => {
    expect(r.recortados).toBe(1);
    expect(r.yaEraValida).toBe(false);
  });

  it('no la deforma: ningún elemento se mueve más de 0,06', () => {
    expect(r.cambioMaximo).toBeLessThan(0.06);
  });

  it('no toca una matriz que ya era válida', () => {
    const buena = [[1, 0.4, 0.2], [0.4, 1, 0.3], [0.2, 0.3, 1]];
    const s = proyectarAPSD(buena);
    expect(s.yaEraValida).toBe(true);
    expect(s.cambioMaximo).toBe(0);
    expect(s.matriz).toEqual(buena);
  });

  it('arregla también un caso de libro de correlaciones imposibles', () => {
    const imposible = [[1, 0.9, -0.9], [0.9, 1, 0.9], [-0.9, 0.9, 1]];
    expect(esDefinidaPositiva(imposible)).toBe(false);
    const s = proyectarAPSD(imposible);
    expect(esDefinidaPositiva(s.matriz)).toBe(true);
    expect(comprobarCorrelacion(s.matriz).diagonalUnos).toBe(true);
  });

  it('es idempotente: proyectar lo ya proyectado no cambia nada', () => {
    const otra = proyectarAPSD(r.matriz);
    expect(otra.yaEraValida).toBe(true);
    expect(otra.cambioMaximo).toBe(0);
  });
});

describe('normalizarPesos', () => {
  /** Los pesos declarados en el motor, leídos del fichero. */
  function pesosDelMotor() {
    const src = fs.readFileSync(path.join(RAIZ, 'src', 'dashboard', 'engine.js'), 'utf8');
    const i = src.indexOf('const RESILIENCE_DECLARADOS = {');
    const j = src.indexOf('};', i);
    const bloque = src.slice(i, j);
    const w = {};
    for (const m of bloque.matchAll(/(\w+):\s*([0-9.]+)/g)) w[m[1]] = Number(m[2]);
    return w;
  }

  const declarados = pesosDelMotor();

  it('los pesos del motor están los 16 y sumaban 1,20', () => {
    expect(Object.keys(declarados)).toHaveLength(16);
    expect(Object.values(declarados).reduce((a, b) => a + b, 0)).toBeCloseTo(1.2, 10);
  });

  it('normalizados suman 1', () => {
    const { pesos, sumaOriginal } = normalizarPesos(declarados);
    expect(sumaOriginal).toBeCloseTo(1.2, 10);
    expect(Object.values(pesos).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('conserva las proporciones', () => {
    const { pesos } = normalizarPesos(declarados);
    expect(pesos.science / pesos.food).toBeCloseTo(declarados.science / declarados.food, 10);
  });

  it('se queja si no hay nada que normalizar', () => {
    expect(() => normalizarPesos({})).toThrow();
    expect(() => normalizarPesos({ a: 0, b: 0 })).toThrow();
  });
});
