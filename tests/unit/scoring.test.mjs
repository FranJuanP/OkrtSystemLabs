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
  percentiles, confianzaDe, nivelDe, nivelPorFraccion, calcular,
  PESOS_CATEGORIA, PESOS_INDICADOR, NIVELES, ETIQUETA_RELATIVA,
  PESO_CONJUNTO, PESO_PEORES, CUANTAS_PEORES, velocidadDeIndicador,
  UMBRALES_UCDP, suelosPorConflicto,
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
  it('declara los cuatro tramos y cubren toda la distribución', () => {
    expect(NIVELES).toHaveLength(4);
    expect(NIVELES[NIVELES.length - 1].hasta).toBe(1);
    // Los cortes van en aumento y sin huecos.
    for (let i = 1; i < NIVELES.length; i++) {
      expect(NIVELES[i].hasta).toBeGreaterThan(NIVELES[i - 1].hasta);
    }
  });

  it('clasifica por posición en la distribución, no por umbral', () => {
    expect(nivelPorFraccion(0.01).clave).toBe('CRITICAL');
    expect(nivelPorFraccion(0.05).clave).toBe('CRITICAL');
    expect(nivelPorFraccion(0.06).clave).toBe('HIGH');
    expect(nivelPorFraccion(0.20).clave).toBe('HIGH');
    expect(nivelPorFraccion(0.21).clave).toBe('MEDIUM');
    expect(nivelPorFraccion(0.50).clave).toBe('MEDIUM');
    expect(nivelPorFraccion(0.51).clave).toBe('LOW');
    expect(nivelPorFraccion(1).clave).toBe('LOW');
  });

  it('sitúa una puntuación frente a una distribución dada', () => {
    // Cien países de 1 a 100: el 100 está en el 5 % de arriba.
    const dist = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(nivelDe(100, dist).clave).toBe('CRITICAL');
    expect(nivelDe(90, dist).clave).toBe('HIGH');
    expect(nivelDe(70, dist).clave).toBe('MEDIUM');
    expect(nivelDe(10, dist).clave).toBe('LOW');
  });

  it('da el mismo nivel a dos puntuaciones iguales', () => {
    // El caso que hubo que arreglar: Papua Nueva Guinea y Corea del Norte
    // empataban a 79 y salían una CRÍTICO y la otra ALTO, porque el corte
    // caía justo entre las dos posiciones de la lista.
    const dist = [100, 95, 90, 79, 79, 50, 40, 30, 20, 10];
    expect(nivelDe(79, dist).clave).toBe(nivelDe(79, dist).clave);
    const niveles = dist.filter((v) => v === 79).map((v) => nivelDe(v, dist).clave);
    expect(new Set(niveles).size).toBe(1);
  });

  it('sin distribución no revienta', () => {
    expect(nivelDe(50, []).clave).toBe('LOW');
    expect(nivelDe(50, null).clave).toBe('LOW');
  });

  it('la etiqueta relativa dice que la clasificación es relativa', () => {
    expect(ETIQUETA_RELATIVA).toMatch(/relativ/i);
  });
});

describe('nivel mínimo por conflicto (UCDP)', () => {
  /** El bloque `conflicto` de un país, con lo que no se diga a cero. */
  const conf = (o) => ({
    territorio_12m: 0, estatal_12m: 0, no_estatal_12m: 0, civiles_12m: 0,
    parte_12m: 0, media_3anios: 0, ...o,
  });

  it('tiene las cinco reglas, y solo la estatal llega a CRÍTICO', () => {
    expect(UMBRALES_UCDP).toHaveLength(5);
    const criticas = UMBRALES_UCDP.filter((u) => u.nivel === 'CRITICAL');
    expect(criticas).toHaveLength(1);
    expect(criticas[0].id).toBe('estatal');
    expect(criticas[0].desde).toBe(1000);
    // Todas las reglas traen ámbito y las dos descripciones que usa la interfaz.
    for (const u of UMBRALES_UCDP) {
      expect(['territorio', 'parte']).toContain(u.ambito);
      expect(typeof u.tipo).toBe('string');
      expect(typeof u.descripcion).toBe('string');
    }
  });

  it('1.000 muertos de violencia estatal en el territorio es guerra', () => {
    const r = suelosPorConflicto(conf({ territorio_12m: 1000, estatal_12m: 1000 }));
    expect(r.nivel).toBe('CRITICAL');
    expect(r.etiqueta).toBe('guerra');
    expect(r.ambito).toBe('territorio');
    expect(suelosPorConflicto(conf({ estatal_12m: 47667 })).nivel).toBe('CRITICAL');
  });

  it('la misma cifra en violencia no estatal se queda en ALTO', () => {
    // Es el caso de México: 4.404 muertos entre grupos criminales no son una
    // guerra, y con un umbral sobre el total salía CRÍTICO.
    const r = suelosPorConflicto(conf({ territorio_12m: 4432, no_estatal_12m: 4404, estatal_12m: 4, civiles_12m: 24 }));
    expect(r.nivel).toBe('HIGH');
    expect(r.id).toBe('no_estatal');
    expect(r.muertos).toBe(4404);
  });

  it('la violencia contra civiles también se queda en ALTO', () => {
    const r = suelosPorConflicto(conf({ territorio_12m: 61926, civiles_12m: 59863 }));
    expect(r.nivel).toBe('HIGH');
    expect(r.id).toBe('civiles');
  });

  it('ser parte en un conflicto estatal de 1.000 o más da ALTO', () => {
    // Rusia: 266 muertos en su territorio, 47.931 en la guerra en la que es parte.
    const r = suelosPorConflicto(conf({ territorio_12m: 266, estatal_12m: 264, parte_12m: 47931 }));
    expect(r.nivel).toBe('HIGH');
    expect(r.id).toBe('parte');
    expect(r.ambito).toBe('parte');
    expect(r.muertos).toBe(47931);
  });

  it('ser parte de menos de 1.000 no impone nada por sí solo', () => {
    expect(suelosPorConflicto(conf({ parte_12m: 999 }))).toBeNull();
  });

  it('gana la regla más severa cuando se cumplen varias', () => {
    // Ucrania cumple «estatal» y «parte»; manda la primera, que es CRÍTICO.
    const r = suelosPorConflicto(conf({ territorio_12m: 47686, estatal_12m: 47667, parte_12m: 47928 }));
    expect(r.nivel).toBe('CRITICAL');
    expect(r.id).toBe('estatal');
  });

  it('a igual nivel gana la de más muertos', () => {
    const r = suelosPorConflicto(conf({ territorio_12m: 3000, no_estatal_12m: 1200, civiles_12m: 1800 }));
    expect(r.nivel).toBe('HIGH');
    expect(r.id).toBe('civiles');
    expect(r.muertos).toBe(1800);
  });

  it('de 25 a 999 de cualquier tipo es conflicto menor', () => {
    expect(suelosPorConflicto(conf({ territorio_12m: 25, civiles_12m: 25 })).nivel).toBe('HIGH');
    const r = suelosPorConflicto(conf({ territorio_12m: 999, estatal_12m: 999 }));
    expect(r.nivel).toBe('HIGH');
    expect(r.etiqueta).toBe('conflicto menor');
  });

  it('«conflicto menor» no se aplica a partir de mil: lo describen las reglas por tipo', () => {
    const r = suelosPorConflicto(conf({ territorio_12m: 1500, estatal_12m: 1500 }));
    expect(r.id).toBe('estatal');
    expect(r.etiqueta).toBe('guerra');
  });

  it('por debajo de 25 no impone nada', () => {
    expect(suelosPorConflicto(conf({ territorio_12m: 24, estatal_12m: 24 }))).toBeNull();
    expect(suelosPorConflicto(conf({}))).toBeNull();
  });

  it('no revienta sin dato', () => {
    expect(suelosPorConflicto(null)).toBeNull();
    expect(suelosPorConflicto(undefined)).toBeNull();
    expect(suelosPorConflicto({})).toBeNull();
    expect(suelosPorConflicto(conf({ estatal_12m: NaN }))).toBeNull();
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

  it('el índice es mitad el conjunto y mitad las tres peores', () => {
    for (const p of Object.values(r.paises)) {
      if (p.score === null) continue;
      const esperado = Math.round(PESO_CONJUNTO * p.desglose.media + PESO_PEORES * p.desglose.peores);
      expect(p.score).toBe(esperado);
    }
  });

  it('publica cuáles son las categorías peores que entran en el índice', () => {
    const esp = r.paises.AAA;
    expect(esp.desglose.categoriasPeores.length).toBeLessThanOrEqual(CUANTAS_PEORES);
    // Vienen ordenadas de más a menos riesgo.
    const scores = esp.desglose.categoriasPeores.map((c) => c.score);
    expect(scores).toEqual(scores.slice().sort((a, b) => b - a));
  });

  it('cada categoría lleva su velocidad y de cuántos indicadores sale', () => {
    for (const p of Object.values(r.paises)) {
      for (const c of Object.values(p.categorias)) {
        expect(typeof c.velocidad).toBe('number');
        expect(Number.isInteger(c.velocidadDe)).toBe(true);
      }
    }
  });

  /** El bloque que escribe tools/fetch-data.mjs por país. */
  const bloqueConflicto = (o) => ({
    territorio_12m: 0, estatal_12m: 0, no_estatal_12m: 0, civiles_12m: 0,
    parte_12m: 0, parte_conflictos: [], media_3anios: 0,
    desde: '2025-09-09', hasta: '2026-09-09',
    source: 'UCDP', url: 'https://ucdp.uu.se/downloads/', version: 'GED 26.1',
    ...o,
  });

  it('el conflicto eleva el nivel pero nunca lo baja', () => {
    const d = datosDePrueba();
    // AAA es el de MENOS riesgo del fichero de prueba, y aun asi esta en guerra.
    d.paises.AAA.conflicto = bloqueConflicto({ territorio_12m: 5000, estatal_12m: 5000 });
    // CCC es el de MAS riesgo y no tiene conflicto: no debe bajar de nivel.
    d.paises.CCC.conflicto = bloqueConflicto({});
    const calc = calcular(d);

    expect(calc.paises.AAA.nivel.clave).toBe('CRITICAL');
    expect(calc.paises.AAA.elevadoPorConflicto).toBeTruthy();
    expect(calc.paises.AAA.elevadoPorConflicto.motivo).toMatch(/conflicto activo \(UCDP\)/);
    // Y guarda donde caia por percentil, para poder ensenarlo.
    expect(calc.paises.AAA.nivelPorPercentil).toBeTruthy();

    // El que ya estaba arriba no se toca.
    expect(calc.paises.CCC.elevadoPorConflicto).toBeUndefined();
  });

  it('las dos cifras llegan a la ficha aunque el suelo no ate', () => {
    const d = datosDePrueba();
    d.paises.AAA.conflicto = bloqueConflicto({ territorio_12m: 10, estatal_12m: 10, parte_12m: 7 });
    const calc = calcular(d);
    // Sin elevacion: 10 muertos no llegan a ningun umbral.
    expect(calc.paises.AAA.elevadoPorConflicto).toBeUndefined();
    // Pero el bloque va igual, porque la ficha ensena las dos cifras siempre.
    expect(calc.paises.AAA.conflicto.territorio).toBe(10);
    expect(calc.paises.AAA.conflicto.parte).toBe(7);
  });

  it('ser parte eleva a ALTO y lo dice con su propio motivo', () => {
    const d = datosDePrueba();
    // Rusia: casi nada en su territorio, una guerra entera como parte.
    d.paises.AAA.conflicto = bloqueConflicto({
      territorio_12m: 266, estatal_12m: 264, parte_12m: 47931,
      parte_conflictos: ['Russia - Ukraine'],
    });
    const calc = calcular(d);
    expect(calc.paises.AAA.nivel.clave).toBe('HIGH');
    expect(calc.paises.AAA.elevadoPorConflicto.regla).toBe('parte');
    expect(calc.paises.AAA.elevadoPorConflicto.motivo).toMatch(/^parte en conflicto armado activo \(UCDP\)/);
    expect(calc.paises.AAA.conflicto.conflictos).toEqual(['Russia - Ukraine']);
  });

  it('el tipo decide el techo del suelo: no estatal no llega a CRÍTICO', () => {
    const d = datosDePrueba();
    d.paises.AAA.conflicto = bloqueConflicto({
      territorio_12m: 4432, estatal_12m: 4, no_estatal_12m: 4404, civiles_12m: 24,
    });
    const calc = calcular(d);
    expect(calc.paises.AAA.nivel.clave).toBe('HIGH');
    expect(calc.paises.AAA.elevadoPorConflicto.regla).toBe('no_estatal');
  });

  it('se queja si el fichero no tiene la forma esperada', () => {
    expect(() => calcular(null)).toThrow();
    expect(() => calcular({})).toThrow();
  });
});
