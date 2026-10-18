/**
 * T29 · Pruebas del registro de indicadores y del fichero de datos.
 *
 * El registro es el documento central de la Fase 3: si un indicador se queda
 * sin dirección de riesgo, o apunta a una categoría que no existe, o una
 * categoría se queda sin ningún indicador que puntúe, el panel sigue
 * funcionando y muestra números sin sentido. Esto lo impide.
 *
 * Y se comprueba el fichero generado contra el registro, porque son dos cosas
 * distintas: el registro dice qué se descarga y el fichero es lo que se
 * descargó. Que coincidan no es automático.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  INDICADORES, CATEGORIAS, FUENTES, urlIndicador, porCategoria, comprobarRegistro,
} from '../../tools/data/registry.mjs';

const RAIZ = path.join(import.meta.dirname, '..', '..');
const leer = (rel) => JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));

describe('registro de indicadores', () => {
  it('no tiene problemas de coherencia', () => {
    expect(comprobarRegistro()).toEqual([]);
  });

  it('declara 16 categorías, las del motor', () => {
    expect(CATEGORIAS).toHaveLength(16);
    const claves = CATEGORIAS.map((c) => c.key);
    expect(claves).toEqual([
      'eco', 'geo', 'health', 'climate', 'social', 'tech', 'food', 'mental',
      'energy', 'demo', 'urban', 'science', 'justice', 'finance', 'ocean', 'bio',
    ]);
  });

  it('ningún identificador se repite', () => {
    const ids = INDICADORES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los identificadores son estables: minúsculas y guion bajo', () => {
    for (const ind of INDICADORES) expect(ind.id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('todos tienen etiqueta, unidad, fuente declarada y dirección válida', () => {
    for (const ind of INDICADORES) {
      expect(ind.etiqueta.length).toBeGreaterThan(2);
      expect(typeof ind.unidad).toBe('string');
      expect(FUENTES[ind.fuente]).toBeTruthy();
      expect(['mas_riesgo', 'menos_riesgo', 'ambiguo']).toContain(ind.dir);
    }
  });

  it('cada categoría tiene al menos un indicador que puntúa', () => {
    for (const [cat, lista] of porCategoria()) {
      const puntuan = lista.filter((i) => i.dir !== 'ambiguo');
      expect(puntuan.length, `la categoría ${cat} no tiene ninguno que puntúe`).toBeGreaterThan(0);
    }
  });

  it('los ambiguos son exactamente los seis documentados', () => {
    const ambiguos = INDICADORES.filter((i) => i.dir === 'ambiguo').map((i) => i.id).sort();
    expect(ambiguos).toEqual([
      'crecimiento_poblacion', 'fecundidad', 'poblacion_urbana',
      'produccion_pesquera', 'remesas_pib', 'saldo_migratorio',
    ]);
  });

  it('cada indicador tiene un enlace https a su ficha', () => {
    for (const ind of INDICADORES) expect(urlIndicador(ind)).toMatch(/^https:\/\//);
  });

  it('cada fuente declara licencia y enlace', () => {
    for (const [clave, f] of Object.entries(FUENTES)) {
      expect(f.nombre.length, clave).toBeGreaterThan(5);
      expect(f.corto.length, clave).toBeGreaterThan(2);
      expect(f.url, clave).toMatch(/^https:\/\//);
      expect(f.licencia.length, clave).toBeGreaterThan(3);
    }
  });

  it('las notas de comparabilidad, cuando están, dicen algo', () => {
    const conNota = INDICADORES.filter((i) => i.nota);
    expect(conNota.length).toBeGreaterThan(5);
    for (const ind of conNota) expect(ind.nota.length).toBeGreaterThan(30);
  });
});

describe('data/latest.json contra el registro', () => {
  const datos = leer('data/latest.json');

  it('declara el esquema 1 y cuándo se generó', () => {
    expect(datos.esquema).toBe(1);
    expect(isNaN(new Date(datos.generado).getTime())).toBe(false);
  });

  it('trae los mismos indicadores que el registro', () => {
    const delFichero = Object.keys(datos.indicadores).sort();
    const delRegistro = INDICADORES.map((i) => i.id).sort();
    expect(delFichero).toEqual(delRegistro);
  });

  it('la dirección y la unidad de cada indicador coinciden con el registro', () => {
    for (const ind of INDICADORES) {
      const f = datos.indicadores[ind.id];
      expect(f.direccion, ind.id).toBe(ind.dir);
      expect(f.unidad, ind.id).toBe(ind.unidad);
      expect(f.categoria, ind.id).toBe(ind.cat);
    }
  });

  it('cada dato lleva las seis claves: valor, unidad, año, fuente, url y descarga', () => {
    let comprobados = 0;
    for (const pais of Object.values(datos.paises)) {
      for (const [id, d] of Object.entries(pais.indicadores)) {
        expect(typeof d.value, id).toBe('number');
        expect(typeof d.unit, id).toBe('string');
        expect(Number.isInteger(d.year), id).toBe(true);
        expect(d.year).toBeGreaterThan(1960);
        expect(typeof d.source, id).toBe('string');
        expect(d.url, id).toMatch(/^https:\/\//);
        expect(isNaN(new Date(d.fetched_at).getTime()), id).toBe(false);
        comprobados++;
      }
    }
    expect(comprobados).toBeGreaterThan(8000);
  });

  it('la cobertura declarada cuadra con los datos que lleva', () => {
    const recuento = {};
    for (const pais of Object.values(datos.paises)) {
      for (const id of Object.keys(pais.indicadores)) recuento[id] = (recuento[id] || 0) + 1;
    }
    for (const [id, n] of Object.entries(datos.cobertura)) expect(recuento[id] || 0, id).toBe(n);
  });

  it('los códigos de país son ISO3', () => {
    for (const iso of Object.keys(datos.paises)) expect(iso).toMatch(/^[A-Z]{3}$/);
  });

  it('los territorios sin fuente llevan su motivo escrito', () => {
    for (const [iso, motivo] of Object.entries(datos.sin_fuente || {})) {
      expect(iso).toMatch(/^[A-Z]{3}$/);
      expect(motivo.length).toBeGreaterThan(20);
    }
  });
});

describe('el bloque de conflicto del UCDP', () => {
  const datos = leer('data/latest.json');
  const paises = Object.entries(datos.paises);

  it('lo llevan los 217 países: un cero es un cero', () => {
    const sin = paises.filter(([, p]) => !p.conflicto).map(([iso]) => iso);
    expect(sin).toEqual([]);
  });

  it('publica el tramo con más muertos, y dice cuál es', () => {
    /* Candidate no es acumulativo, así que la ventana de 12 meses puede
       quedarse corta. La regla es el máximo entre la ventana y el último año
       natural cerrado; esto comprueba que se aplicó país por país. */
    for (const [iso, p] of paises) {
      const c = p.conflicto;
      const mayor = Math.max(c.ventana_12m, c.ultimo_anio_completo);
      expect(c.territorio_12m, iso).toBe(mayor);
      expect(c.base, iso).toBe(c.ultimo_anio_completo > c.ventana_12m ? 'anio_completo' : 'ventana_12m');
    }
  });

  it('el año base acompaña siempre al tramo anual, y solo a él', () => {
    for (const [iso, p] of paises) {
      const c = p.conflicto;
      if (c.base === 'anio_completo') expect(typeof c.anio_base, iso).toBe('number');
      else expect(c.anio_base, iso).toBeNull();
    }
  });

  it('el desglose por tipo no supera su propio total', () => {
    // Es «no supera» y no «suma exacto» porque un evento sin tipo utilizable
    // cuenta en el total y en ningún tipo.
    for (const [iso, p] of paises) {
      const c = p.conflicto;
      const suma = c.estatal_12m + c.no_estatal_12m + c.civiles_12m;
      expect(suma, iso).toBeLessThanOrEqual(c.territorio_12m);
    }
  });

  it('ningún nombre de conflicto es un marcador interno del UCDP', () => {
    // Candidate trae «XXX475» para conflictos aún sin nombre; eso en la ficha
    // parece un error.
    const malos = [];
    for (const [iso, p] of paises) {
      for (const n of p.conflicto.parte_conflictos || []) if (/^XXX/i.test(n)) malos.push(iso + ':' + n);
    }
    expect(malos).toEqual([]);
  });

  it('los tres indicadores del UCDP son tres cosas distintas', () => {
    /* `muertes_conflicto_parte` llegó a escribir la media de tres años, con
       lo que el indicador que entra en GEO era un duplicado del otro. */
    const rus = datos.paises.RUS;
    expect(rus.indicadores.muertes_conflicto.value).toBe(rus.conflicto.territorio_12m);
    expect(rus.indicadores.muertes_conflicto_parte.value).toBe(rus.conflicto.parte_12m);
    expect(rus.indicadores.muertes_conflicto_media.value).toBe(rus.conflicto.media_3anios);
    expect(rus.indicadores.muertes_conflicto_parte.value)
      .not.toBe(rus.indicadores.muertes_conflicto_media.value);
  });
});

describe('data/vector.json', () => {
  const v = leer('data/vector.json');

  it('todos los bloques conservan', () => {
    for (const b of v.bloques) {
      const suma = b.enlaces.filter((l) => l.s === 'TOTAL_' + b.id).reduce((a, l) => a + l.v, 0);
      const tolerancia = Math.max(0.5, b.enlaces.length * 0.05);
      expect(Math.abs(suma - b.total), b.id).toBeLessThanOrEqual(tolerancia);
    }
  });

  it('ningún bloque mezcla saldos con flujos', () => {
    for (const b of v.bloques) expect(['stock', 'flujo']).toContain(b.clase);
  });

  it('la vista por defecto solo lleva flujos', () => {
    expect(v.porDefecto.length).toBeGreaterThan(0);
    for (const id of v.porDefecto) {
      const b = v.bloques.find((x) => x.id === id);
      expect(b.clase, id).toBe('flujo');
    }
  });

  it('cada enlace lleva valor, unidad, periodo, fuente y url', () => {
    for (const b of v.bloques) {
      for (const l of b.enlaces) {
        expect(typeof l.v).toBe('number');
        expect(l.v).toBeGreaterThanOrEqual(0);
        expect(typeof l.unit).toBe('string');
        expect(String(l.year).length).toBeGreaterThan(3);
        expect(typeof l.source).toBe('string');
        expect(l.url).toMatch(/^https:\/\//);
      }
    }
  });
});

/* data/events.json ya no vive en el repositorio: se genera en cada
   despliegue y viaja en el artefacto de Pages. Si esta -porque se ha
   ejecutado `npm run eventos` en local- se comprueba; si no, estas
   pruebas se saltan en vez de fallar por un fichero que no tiene por
   que existir aqui. */
const HAY_EVENTOS = fs.existsSync(path.join(RAIZ, 'data/events.json'));

describe.skipIf(!HAY_EVENTOS)('data/events.json', () => {
  const e = HAY_EVENTOS ? leer('data/events.json') : { eventos: [], fuentes: {} };

  it('declara el esquema, cuándo se descargó y el estado de cada fuente', () => {
    expect(e.esquema).toBe(1);
    expect(isNaN(new Date(e.descargado).getTime())).toBe(false);
    // 'pendiente' es una fuente que no se consulta porque no se puede:
    // ReliefWeb, a la espera de un appname aprobado.
    for (const f of Object.values(e.fuentes)) expect(['ok', 'error', 'pendiente']).toContain(f.estado);
  });

  it('trae eventos con fecha válida, fuente y título', () => {
    expect(e.eventos.length).toBeGreaterThan(9);
    // Una fuente pendiente tiene que explicar el motivo y como resolverlo.
    for (const f of Object.values(e.fuentes)) {
      if (f.estado !== 'pendiente') continue;
      expect(String(f.motivo || '').length).toBeGreaterThan(20);
      expect(String(f.como_arreglarlo || '')).toContain('apidoc');
    }
    for (const ev of e.eventos) {
      expect(isNaN(new Date(ev.time).getTime())).toBe(false);
      expect(typeof ev.fuente).toBe('string');
      expect(typeof ev.title).toBe('string');
    }
  });

  it('vienen ordenados del más reciente al más antiguo', () => {
    for (let i = 1; i < e.eventos.length; i++) {
      expect(new Date(e.eventos[i - 1].time).getTime())
        .toBeGreaterThanOrEqual(new Date(e.eventos[i].time).getTime());
    }
  });
});
