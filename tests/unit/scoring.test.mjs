/**
 * T29 · Pruebas del cálculo de puntuaciones.
 *
 * Esto es lo que la prueba de humo no puede comprobar: que el método hace lo
 * que dice METHODOLOGY.md. La prueba de humo ve que la página no se rompe;
 * esta ve que el percentil de un país empatado cae en el centro del tramo,
 * que invertir la dirección invierte el orden, y que una categoría sin dato
 * da null en vez de un 50 de relleno.
 */
import { describe, it, expect } from 'vitest';
import {
  percentiles, confianzaDe, nivelDe, calcular,
  PESOS_CATEGORIA, PESOS_INDICADOR, NIVELES,
} from '../../src/core/scoring.js';

describe('percentiles', () => {
  it('ordena de menos a más riesgo cuando un valor alto es más riesgo', () => {
    const p = percentiles([
      { iso: 'A', valor: 1 },
      { iso: 'B', valor: 2 },
      { iso: 'C', valor: 3 },
    ], 'mas_riesgo');
    expect(p.get('A')).toBeLessThan(p.get('B'));
    expect(p.get('B')).toBeLessThan(p.get('C'));
  });

  it('invierte el orden cuando un valor alto es menos riesgo', () => {
    const obs = [{ iso: 'A', valor: 1 }, { iso: 'B', valor: 2 }, { iso: 'C', valor: 3 }];
    const sube = percentiles(obs, 'mas_riesgo');
    const baja = percentiles(obs, 'menos_riesgo');
    expect(baja.get('A')).toBeGreaterThan(baja.get('C'));
    // El que estaba arriba en un sentido está abajo en el otro.
    expect(sube.get('C')).toBeCloseTo(baja.get('A'), 10);
  });

  it('pone a los empatados en el centro de su tramo', () => {
    // C y D empatan en la tercera y cuarta posición de cuatro: su percentil
    // es el punto medio de ese tramo, no el principio ni el final.
    const p = percentiles([
      { iso: 'A', valor: 1 },
      { iso: 'B', valor: 2 },
      { iso: 'C', valor: 3 },
      { iso: 'D', valor: 3 },
    ], 'mas_riesgo');
    expect(p.get('C')).toBeCloseTo(75, 10);
    expect(p.get('D')).toBeCloseTo(75, 10);
    expect(p.get('A')).toBeCloseTo(12.5, 10);
    expect(p.get('B')).toBeCloseTo(37.5, 10);
  });

  it('nunca da exactamente 0 ni exactamente 100', () => {
    // Nadie está por debajo de sí mismo: el extremo inferior es 0,5/n.
    const p = percentiles(
      Array.from({ length: 50 }, (_, i) => ({ iso: 'P' + i, valor: i })),
      'mas_riesgo',
    );
    const vals = [...p.values()];
    expect(Math.min(...vals)).toBeGreaterThan(0);
    expect(Math.max(...vals)).toBeLessThan(100);
  });

  it('con un solo país lo pone en el centro', () => {
    const p = percentiles([{ iso: 'A', valor: 7 }], 'mas_riesgo');
    expect(p.get('A')).toBeCloseTo(50, 10);
  });

  it('con la lista vacía devuelve un mapa vacío', () => {
    expect(percentiles([], 'mas_riesgo').size).toBe(0);
  });

  it('es invariante a transformaciones monótonas, que es por lo que escala:log no influye', () => {
    const obs = [{ iso: 'A', valor: 1 }, { iso: 'B', valor: 100 }, { iso: 'C', valor: 1000000 }];
    const lineal = percentiles(obs, 'mas_riesgo');
    const log = percentiles(obs.map((o) => ({ iso: o.iso, valor: Math.log(o.valor) })), 'mas_riesgo');
    for (const iso of ['A', 'B', 'C']) expect(log.get(iso)).toBeCloseTo(lineal.get(iso), 10);
  });
});

describe('confianza', () => {
  it('es alta con cobertura completa y datos recientes', () => {
    const c = confianzaDe(4, 4, [2025, 2025, 2024, 2025], 2026);
    expect(c.nivel).toBe('alta');
    expect(c.motivo).toBe('completo y reciente');
  });

  it('baja a media cuando faltan indicadores', () => {
    expect(confianzaDe(2, 4, [2025, 2025], 2026).nivel).toBe('media');
  });

  it('baja a media cuando los datos tienen más de 4 años', () => {
    const c = confianzaDe(4, 4, [2021, 2021, 2021, 2021], 2026);
    expect(c.nivel).toBe('media');
    expect(c.motivo).toContain('2021');
  });

  it('baja a baja con menos de la mitad de los indicadores', () => {
    expect(confianzaDe(1, 4, [2025], 2026).nivel).toBe('baja');
  });

  it('baja a baja con datos de más de 8 años', () => {
    expect(confianzaDe(4, 4, [2014, 2014, 2014, 2014], 2026).nivel).toBe('baja');
  });

  it('dice «ninguna» y no revienta sin ningún dato', () => {
    const c = confianzaDe(0, 4, [], 2026);
    expect(c.nivel).toBe('ninguna');
    expect(c.motivo).toBe('sin ningún dato');
  });

  it('explica el motivo, no solo el nivel', () => {
    const c = confianzaDe(2, 5, [2019, 2020], 2026);
    expect(c.motivo).toContain('2 de 5 indicadores');
  });
});

describe('niveles', () => {
  it('reparte las puntuaciones en los cuatro tramos', () => {
    expect(nivelDe(10).clave).toBe('LOW');
    expect(nivelDe(35).clave).toBe('LOW');
    expect(nivelDe(36).clave).toBe('MEDIUM');
    expect(nivelDe(55).clave).toBe('MEDIUM');
    expect(nivelDe(56).clave).toBe('HIGH');
    expect(nivelDe(75).clave).toBe('HIGH');
    expect(nivelDe(76).clave).toBe('CRITICAL');
  });

  it('no deja huecos entre tramos', () => {
    for (let s = 0; s <= 100; s++) expect(nivelDe(s)).toBeTruthy();
    const topes = NIVELES.map((n) => n.max);
    expect(topes[topes.length - 1]).toBe(Infinity);
  });
});

describe('pesos', () => {
  it('declara las 16 categorías', () => {
    expect(Object.keys(PESOS_CATEGORIA)).toHaveLength(16);
  });

  it('las 16 pesan igual, que es la decisión documentada', () => {
    const valores = new Set(Object.values(PESOS_CATEGORIA));
    expect(valores.size).toBe(1);
  });

  it('solo los índices compuestos pesan doble', () => {
    expect(PESOS_INDICADOR.inform_riesgo).toBe(2);
    expect(PESOS_INDICADOR.vulnerabilidad_clima).toBe(2);
    expect(Object.keys(PESOS_INDICADOR)).toHaveLength(2);
  });
});

/** Un fichero de datos mínimo, con lo justo para ejercitar calcular(). */
function datosDePrueba() {
  const dato = (value, year = 2025) => ({
    value, unit: 'u', year, source: 'Prueba', url: 'https://ejemplo.org', fetched_at: '2026-10-17T00:00:00Z',
  });
  return {
    esquema: 1,
    generado: '2026-10-17T00:00:00Z',
    categorias: [
      { key: 'eco', etiqueta: 'ECO', nombre: 'Economía' },
      { key: 'geo', etiqueta: 'GEO', nombre: 'Geopolítica' },
    ],
    fuentes: { prueba: { nombre: 'Prueba', corto: 'Prueba', url: 'https://ejemplo.org', licencia: 'CC0' } },
    indicadores: {
      malo_sube: { categoria: 'eco', etiqueta: 'Malo si sube', unidad: 'u', fuente: 'prueba', codigo: 'A', direccion: 'mas_riesgo', decimales: 1, escala: 'lineal', url: 'https://ejemplo.org' },
      bueno_sube: { categoria: 'eco', etiqueta: 'Bueno si sube', unidad: 'u', fuente: 'prueba', codigo: 'B', direccion: 'menos_riesgo', decimales: 1, escala: 'lineal', url: 'https://ejemplo.org' },
      sin_direccion: { categoria: 'eco', etiqueta: 'Ambiguo', unidad: 'u', fuente: 'prueba', codigo: 'C', direccion: 'ambiguo', decimales: 1, escala: 'lineal', url: 'https://ejemplo.org' },
      solo_geo: { categoria: 'geo', etiqueta: 'Solo geo', unidad: 'u', fuente: 'prueba', codigo: 'D', direccion: 'mas_riesgo', decimales: 1, escala: 'lineal', url: 'https://ejemplo.org' },
    },
    paises: {
      AAA: { nombre: 'Alfa', lat: 1, lng: 1, indicadores: { malo_sube: dato(10), bueno_sube: dato(90), sin_direccion: dato(5), solo_geo: dato(1) } },
      BBB: { nombre: 'Beta', lat: 2, lng: 2, indicadores: { malo_sube: dato(50), bueno_sube: dato(50), sin_direccion: dato(5), solo_geo: dato(5) } },
      CCC: { nombre: 'Gamma', lat: 3, lng: 3, indicadores: { malo_sube: dato(90), bueno_sube: dato(10), sin_direccion: dato(5), solo_geo: dato(9) } },
      // Sin ningún dato de la categoría geo: su puntuación debe ser null.
      DDD: { nombre: 'Delta', lat: 4, lng: 4, indicadores: { malo_sube: dato(50), bueno_sube: dato(50) } },
    },
    agregados: {
      WLD: { nombre: 'Mundo', indicadores: { malo_sube: dato(50), bueno_sube: dato(50), solo_geo: dato(5) } },
    },
    cobertura: {},
    sin_fuente: { ZZZ: 'Territorio de prueba sin ninguna fuente oficial.' },
  };
}

describe('calcular', () => {
  const r = calcular(datosDePrueba());

  it('puntúa los cuatro países', () => {
    expect(Object.keys(r.paises)).toHaveLength(4);
    for (const p of Object.values(r.paises)) expect(typeof p.score).toBe('number');
  });

  it('el país peor en todo tiene más riesgo que el mejor en todo', () => {
    expect(r.paises.CCC.score).toBeGreaterThan(r.paises.AAA.score);
  });

  it('deja en null la categoría sin ningún dato, en vez de rellenarla', () => {
    expect(r.paises.DDD.categorias.geo.score).toBeNull();
    expect(r.paises.DDD.categorias.eco.score).not.toBeNull();
  });

  it('muestra el indicador ambiguo pero no lo puntúa', () => {
    const inds = r.paises.AAA.categorias.eco.indicadores;
    const amb = inds.find((i) => i.id === 'sin_direccion');
    expect(amb).toBeTruthy();
    expect(amb.puntua).toBe(false);
    expect(amb.riesgo).toBeNull();
  });

  it('da puesto a cada país y el peor es el primero', () => {
    expect(r.paises.CCC.puesto).toBe(1);
    expect(r.paises.CCC.deTotal).toBe(4);
  });

  it('no destaca una categoría que se apoye en un solo indicador', () => {
    // geo tiene un solo indicador en este fichero, así que no puede titular.
    for (const p of Object.values(r.paises)) {
      if (p.peorCategoria) expect(p.peorCategoria.cat).not.toBe('geo');
    }
  });

  it('puntúa los agregados sin meterlos en la distribución de los países', () => {
    expect(r.agregados.WLD).toBeTruthy();
    expect(typeof r.agregados.WLD.score).toBe('number');
    // El mundo no ocupa puesto entre los países.
    expect(r.agregados.WLD.puesto).toBeUndefined();
    expect(r.paises.WLD).toBeUndefined();
  });

  it('el agregado con valores centrales queda en mitad de la distribución', () => {
    const wld = r.agregados.WLD.categorias.eco.score;
    expect(wld).toBeGreaterThan(r.paises.AAA.categorias.eco.score);
    expect(wld).toBeLessThan(r.paises.CCC.categorias.eco.score);
  });

  it('elige como año de los datos el más frecuente', () => {
    expect(r.anioDatos).toBe(2025);
  });

  it('se queja si el fichero no tiene la forma esperada', () => {
    expect(() => calcular(null)).toThrow();
    expect(() => calcular({})).toThrow();
  });
});
