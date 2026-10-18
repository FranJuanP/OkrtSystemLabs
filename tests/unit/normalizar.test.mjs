/**
 * T29 · Pruebas de la conversión de las fuentes de Signal (T24).
 *
 * Importan por un motivo concreto: esta conversión la usan DOS cosas —la
 * página y el trabajo automático que escribe `data/events.json`—, así que un
 * cambio que la rompa rompe las dos a la vez y en silencio. Las pruebas
 * trabajan sobre los mismos fixtures que la prueba de humo, de modo que lo
 * que se comprueba aquí es exactamente lo que ve el navegador.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizarUSGS, normalizarEONET, normalizarReliefWeb, normalizarGDELT,
  CONSULTAS_GDELT, urlGDELT, URLS, rehidratar, FUENTES_PENDIENTES, normalizarWHO,
  normalizarGDACS, fueraDuplicadosGeo, urlGDACS, LIMITES_GDACS, ATRIBUCION_GDACS,
} from '../../src/signal/normalizar.js';

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures');
const fixture = (n) => JSON.parse(fs.readFileSync(path.join(FIXTURES, n), 'utf8'));

/** Instante fijo, el mismo que usa la prueba de humo. */
const AHORA = Date.UTC(2026, 9, 17, 12, 0, 0);

/** Lo que la interfaz da por hecho de cualquier evento. */
function pareceUnEvento(ev) {
  expect(typeof ev.id).toBe('string');
  expect(ev.id.length).toBeGreaterThan(3);
  expect(typeof ev.source).toBe('string');
  expect(typeof ev.cat).toBe('string');
  expect(typeof ev.title).toBe('string');
  expect(ev.time instanceof Date).toBe(true);
  expect(isNaN(ev.time.getTime())).toBe(false);
  expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(ev.severity);
  expect(typeof ev.impacts).toBe('object');
  expect(typeof ev.isNew).toBe('boolean');
}

describe('USGS', () => {
  const out = normalizarUSGS(fixture('usgs.json'), AHORA);

  it('convierte los terremotos del fixture', () => {
    expect(out.length).toBeGreaterThan(0);
    out.forEach(pareceUnEvento);
  });

  it('clasifica la gravedad por magnitud', () => {
    const uno = (mag) => normalizarUSGS({
      features: [{ id: 'x', properties: { mag, place: 'Sitio', time: AHORA, status: 'reviewed' }, geometry: { coordinates: [0, 0, 10] } }],
    }, AHORA)[0];
    expect(uno(7.2).severity).toBe('CRITICAL');
    expect(uno(6.1).severity).toBe('HIGH');
    expect(uno(5.4).severity).toBe('MEDIUM');
    expect(uno(4.6).severity).toBe('LOW');
  });

  it('pone la magnitud en el título con un decimal', () => {
    const ev = normalizarUSGS({
      features: [{ id: 'x', properties: { mag: 6, place: 'Chile', time: AHORA }, geometry: { coordinates: [0, 0, 5] } }],
    }, AHORA)[0];
    expect(ev.title).toBe('M6.0 — Chile');
  });

  it('marca como nuevo solo lo de la última hora', () => {
    const hace30min = AHORA - 30 * 60 * 1000;
    const hace5h = AHORA - 5 * 3600 * 1000;
    const hechos = normalizarUSGS({
      features: [
        { id: 'a', properties: { mag: 5, place: 'A', time: hace30min }, geometry: { coordinates: [0, 0, 1] } },
        { id: 'b', properties: { mag: 5, place: 'B', time: hace5h }, geometry: { coordinates: [0, 0, 1] } },
      ],
    }, AHORA);
    expect(hechos[0].isNew).toBe(true);
    expect(hechos[1].isNew).toBe(false);
  });

  it('no se cae con una respuesta vacía ni con campos ausentes', () => {
    expect(normalizarUSGS({}, AHORA)).toEqual([]);
    expect(normalizarUSGS({ features: [] }, AHORA)).toEqual([]);
    const sinNada = normalizarUSGS({ features: [{ id: 'z', properties: {}, geometry: {} }] }, AHORA);
    expect(sinNada).toHaveLength(1);
    expect(sinNada[0].title).toContain('Desconocido');
  });

  it('no devuelve más de 30 eventos', () => {
    const muchos = { features: Array.from({ length: 80 }, (_, i) => ({ id: 'e' + i, properties: { mag: 5, place: 'P', time: AHORA }, geometry: { coordinates: [0, 0, 1] } })) };
    expect(normalizarUSGS(muchos, AHORA)).toHaveLength(30);
  });
});

describe('NASA EONET', () => {
  const out = normalizarEONET(fixture('eonet.json'), AHORA);

  it('convierte los eventos del fixture', () => {
    expect(out.length).toBeGreaterThan(0);
    out.forEach(pareceUnEvento);
  });

  it('traduce la categoría de la fuente a la del feed', () => {
    const uno = (titulo) => normalizarEONET({
      events: [{ id: 'x', title: 'T', categories: [{ title: titulo }], geometry: [{ date: new Date(AHORA).toISOString() }] }],
    }, AHORA)[0];
    expect(uno('Wildfires').cat).toBe('climate');
    expect(uno('Volcanoes').cat).toBe('seismic');
    expect(uno('Earthquakes').cat).toBe('seismic');
    // Lo que no esté en la tabla cae en clima, que es lo que publica EONET.
    expect(uno('Algo nuevo').cat).toBe('climate');
  });

  it('no se cae sin geometría', () => {
    const ev = normalizarEONET({ events: [{ id: 'x', title: 'T', categories: [{ title: 'Floods' }] }] }, AHORA)[0];
    expect(isNaN(ev.time.getTime())).toBe(false);
  });
});

describe('ReliefWeb', () => {
  const out = normalizarReliefWeb(fixture('reliefweb.json'), AHORA);

  it('convierte los informes del fixture', () => {
    expect(out.length).toBeGreaterThan(0);
    out.forEach(pareceUnEvento);
  });

  it('traduce el tipo de desastre a la categoría del feed', () => {
    const uno = (tipo) => normalizarReliefWeb({
      data: [{ id: 1, fields: { title: 'T', disaster_type: [{ name: tipo }], country: [{ name: 'País' }], date: { created: new Date(AHORA).toISOString() } } }],
    }, AHORA)[0];
    expect(uno('Conflict').cat).toBe('conflict');
    expect(uno('Epidemic').cat).toBe('health');
    expect(uno('Flood').cat).toBe('climate');
    expect(uno('Lo que sea').cat).toBe('humanitarian');
  });

  it('construye la url del informe sobre el dominio de ReliefWeb', () => {
    const ev = normalizarReliefWeb({
      data: [{ id: 1, fields: { title: 'T', url_alias: '/report/x', date: { created: new Date(AHORA).toISOString() } } }],
    }, AHORA)[0];
    expect(ev.url).toBe('https://reliefweb.int/report/x');
  });
});

describe('GDELT', () => {
  it('convierte los artículos del fixture', () => {
    const out = normalizarGDELT(fixture('gdelt.json'), 0, AHORA);
    expect(out.length).toBeGreaterThan(0);
    out.forEach(pareceUnEvento);
  });

  it('da a cada consulta su categoría', () => {
    const art = { articles: [{ title: 'T', seendate: '20261017T120000Z', domain: 'x.com' }] };
    expect(normalizarGDELT(art, 0, AHORA)[0].cat).toBe('conflict');
    expect(normalizarGDELT(art, 1, AHORA)[0].cat).toBe('geo');
    expect(normalizarGDELT(art, 2, AHORA)[0].cat).toBe('eco');
  });

  it('entiende el formato de fecha de GDELT', () => {
    const ev = normalizarGDELT({ articles: [{ title: 'T', seendate: '20261017T083000Z' }] }, 0, AHORA)[0];
    expect(ev.time.toISOString()).toBe('2026-10-17T08:30:00.000Z');
  });

  it('las tres consultas están declaradas y su url se construye bien', () => {
    expect(CONSULTAS_GDELT).toHaveLength(3);
    for (const c of CONSULTAS_GDELT) {
      expect(urlGDELT(c.q)).toMatch(/^https:\/\/api\.gdeltproject\.org\//);
      expect(urlGDELT(c.q)).toContain(c.q);
    }
  });
});

describe('OMS · Disease Outbreak News', () => {
  const muestra = {
    value: [
      { Id: 'a1', Title: 'Ebola disease - Democratic Republic of the Congo',
        PublicationDateAndTime: '2026-10-16T12:00:00Z', UrlName: '2026-DON619',
        Summary: '<p>On 2 October 2026, WHO was informed&nbsp;of a cluster.</p>' },
      { Id: 'a2', Title: 'Cholera - Global situation',
        PublicationDateAndTime: '2026-08-01T12:00:00Z', UrlName: '2026-DON600', Summary: '' },
    ],
  };
  const out = normalizarWHO(muestra, AHORA);

  it('convierte los brotes', () => {
    expect(out).toHaveLength(2);
    out.forEach(pareceUnEvento);
  });

  it('los pone en la categoría de salud, que se había quedado sin fuente', () => {
    for (const ev of out) expect(ev.cat).toBe('health');
  });

  it('usa la fecha de publicación real, no la de ahora', () => {
    expect(out[0].time.toISOString()).toBe('2026-10-16T12:00:00.000Z');
  });

  it('gradúa la gravedad por lo reciente que sea el informe', () => {
    expect(out[0].severity).toBe('HIGH');   // un día
    expect(out[1].severity).toBe('LOW');    // dos meses y medio
  });

  it('construye el enlace al informe de la OMS', () => {
    expect(out[0].url).toBe('https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON619');
  });

  it('limpia el HTML y los espacios finos del resumen', () => {
    expect(out[0].detail).not.toMatch(/<[^>]+>/);
    expect(out[0].detail).not.toMatch(/&nbsp;|\u00a0/);
    expect(out[0].detail).toContain('cluster');
  });

  it('no se cae con una respuesta vacía', () => {
    expect(normalizarWHO({}, AHORA)).toEqual([]);
  });
});

describe('rehidratar', () => {
  it('devuelve la fecha a Date y marca el evento como última lectura', () => {
    const guardado = { id: 'x', title: 'T', time: '2026-10-17T10:00:00.000Z', isNew: true };
    const ev = rehidratar(guardado, '2026-10-17T11:00:00.000Z');
    expect(ev.time instanceof Date).toBe(true);
    expect(ev.time.toISOString()).toBe('2026-10-17T10:00:00.000Z');
    // Lo que viene del fichero NO puede presentarse como recién traído.
    expect(ev.isNew).toBe(false);
    expect(ev.stale).toBe(true);
    expect(ev.fetchedAt.toISOString()).toBe('2026-10-17T11:00:00.000Z');
  });

  it('aguanta que no haya hora de descarga', () => {
    const ev = rehidratar({ id: 'x', time: '2026-10-17T10:00:00.000Z' }, null);
    expect(ev.fetchedAt).toBeNull();
    expect(ev.stale).toBe(true);
  });
});

describe('fuentes', () => {
  it('las urls de las fuentes son https', () => {
    for (const u of Object.values(URLS)) expect(u).toMatch(/^https:\/\//);
  });

  it('ReliefWeb está declarada como pendiente, con el motivo y cómo arreglarlo', () => {
    expect(FUENTES_PENDIENTES.relief).toBeTruthy();
    expect(FUENTES_PENDIENTES.relief.motivo).toMatch(/410|v1|appname/i);
    expect(FUENTES_PENDIENTES.relief.comoArreglarlo).toContain('apidoc.reliefweb.int');
  });

  it('las fuentes que sí funcionan no están marcadas como pendientes', () => {
    for (const id of ['usgs', 'nasa', 'gdelt', 'who']) expect(FUENTES_PENDIENTES[id]).toBeUndefined();
  });

  it('no queda ninguna URL de ReliefWeb que se pueda llamar por descuido', () => {
    expect(URLS.reliefweb).toBeUndefined();
  });
});

describe('GDACS', () => {
  /** Un evento como los que devuelve la API, con lo justo. */
  const evento = (o) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [o.lng ?? 0, o.lat ?? 0] },
    properties: {
      eventtype: 'EQ', eventid: 1, episodeid: 0, alertlevel: 'Orange',
      country: 'Panama', fromdate: '2026-10-09T17:56:06',
      datemodified: '2026-10-09T18:10:00',
      severitydata: { severitytext: 'Magnitude 7.7M, Depth:12.647km' },
      url: { report: 'https://www.gdacs.org/report.aspx?eventid=1' },
      ...o,
    },
  });
  const coleccion = (...evs) => ({ type: 'FeatureCollection', features: evs });

  it('traduce el nivel de alerta a la escala del feed', () => {
    const d = coleccion(
      evento({ eventid: 1, alertlevel: 'Red' }),
      evento({ eventid: 2, alertlevel: 'Orange' }),
      evento({ eventid: 3, alertlevel: 'Green' }),
    );
    const sev = normalizarGDACS(d).map((e) => e.severity);
    expect(sev).toContain('CRITICAL');
    expect(sev).toContain('HIGH');
    expect(sev).toContain('LOW');
  });

  it('usa la fecha del evento, no la de publicación', () => {
    /* Una sequía en curso empezó cuando empezó; fecharla con `datemodified`
       la haría parecer una noticia de hoy. */
    const [e] = normalizarGDACS(coleccion(evento({})));
    expect(e.time.toISOString()).toContain('2026-10-09T17:56');
  });

  it('lee las fechas como UTC aunque no lleven zona', () => {
    /* GDACS las manda sin sufijo y `new Date()` las tomaría como hora local:
       el mismo evento saldría con una hora distinta según dónde corra el
       proceso, y cerca de medianoche con un día distinto. */
    const [e] = normalizarGDACS(coleccion(evento({ fromdate: '2026-10-09T00:30:00' })));
    expect(e.time.toISOString()).toBe('2026-10-09T00:30:00.000Z');
  });

  it('respeta la zona si la trae', () => {
    const [e] = normalizarGDACS(coleccion(evento({ fromdate: '2026-10-09T02:30:00+02:00' })));
    expect(e.time.toISOString()).toBe('2026-10-09T00:30:00.000Z');
  });

  it('enlaza a la ficha del evento', () => {
    const [e] = normalizarGDACS(coleccion(evento({})));
    expect(e.url).toBe('https://www.gdacs.org/report.aspx?eventid=1');
  });

  it('se inventa el enlace si la API no lo trae', () => {
    const [e] = normalizarGDACS(coleccion(evento({ url: null, eventtype: 'TC', eventid: 42 })));
    expect(e.url).toBe('https://www.gdacs.org/report.aspx?eventtype=TC&eventid=42');
  });

  it('va a la categoría humanitaria, sea cual sea el fenómeno', () => {
    // GDACS no mide el suceso sino si hace falta ayuda internacional.
    const cats = normalizarGDACS(coleccion(
      evento({ eventid: 1, eventtype: 'EQ' }),
      evento({ eventid: 2, eventtype: 'DR' }),
    )).map((e) => e.cat);
    expect(new Set(cats)).toEqual(new Set(['humanitarian']));
  });

  it('distingue dos eventos del mismo tipo y país', () => {
    /* Dos volcanes filipinos salían los dos como «Volcán — Philippines» y la
       deduplicación por título del feed se comía el segundo. */
    const t = normalizarGDACS(coleccion(
      evento({ eventid: 1, eventtype: 'VO', eventname: 'Kanlaon', country: 'Philippines', severitydata: {} }),
      evento({ eventid: 2, eventtype: 'VO', eventname: 'Taal', country: 'Philippines', severitydata: {} }),
    )).map((e) => e.title);
    expect(new Set(t).size).toBe(2);
    expect(t.join(' ')).toContain('Kanlaon');
    expect(t.join(' ')).toContain('Taal');
  });

  it('acorta la lista de países de una sequía', () => {
    const [e] = normalizarGDACS(coleccion(evento({
      eventtype: 'DR', country: 'Kenya, Uganda, Tanzania, Somalia', severitydata: {},
    })));
    expect(e.title).toContain('Kenya y 3 más');
    // Pero la lista entera sigue estando, para quien la quiera.
    expect(e.location).toBe('Kenya, Uganda, Tanzania, Somalia');
  });

  it('dice que la alerta es automática', () => {
    const [e] = normalizarGDACS(coleccion(evento({})));
    expect(e.detail).toContain('sin revisión humana');
  });

  it('respeta el límite de eventos y se queda con los más recientes', () => {
    const d = coleccion(
      evento({ eventid: 1, fromdate: '2026-01-01T00:00:00' }),
      evento({ eventid: 2, fromdate: '2026-10-01T00:00:00' }),
      evento({ eventid: 3, fromdate: '2026-05-01T00:00:00' }),
    );
    const r = normalizarGDACS(d, Date.now(), 2);
    expect(r).toHaveLength(2);
    expect(r[0].time.getUTCMonth()).toBe(9);
  });

  it('la URL pide un solo nivel y los seis tipos', () => {
    const u = urlGDACS('Red', '2026-09-18', '2026-10-18');
    expect(u).toContain('alertlevel=Red');
    expect(u).toContain('fromDate=2026-09-18');
    expect(u).toContain('EQ;TC;FL;VO;DR;WF');
  });

  it('reparte el cupo poniéndolo en la gravedad', () => {
    expect(LIMITES_GDACS.Red).toBeGreaterThanOrEqual(LIMITES_GDACS.Green);
    expect(Object.values(LIMITES_GDACS).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(30);
  });

  it('trae a quién hay que acreditar', () => {
    expect(ATRIBUCION_GDACS.quien).toContain('Naciones Unidas');
    expect(ATRIBUCION_GDACS.quien).toContain('Comisión Europea');
    expect(ATRIBUCION_GDACS.url).toMatch(/^https:\/\/www\.gdacs\.org/);
  });
});

describe('duplicados entre fuentes', () => {
  const usgs = {
    id: 'usgs_1', familia: 'sismo', lat: 7.58, lng: -80.77,
    time: new Date('2026-10-09T17:56:00Z'),
  };
  const gdacs = (o) => ({
    id: 'gdacs_1', familia: 'sismo', lat: 7.59, lng: -80.76,
    time: new Date('2026-10-09T18:10:00Z'), ...o,
  });

  it('quita el que ya cuenta otra fuente', () => {
    const { conservados, duplicados } = fueraDuplicadosGeo([gdacs({})], [usgs]);
    expect(conservados).toHaveLength(0);
    expect(duplicados[0].duplicadoDe).toBe('usgs_1');
  });

  it('no funde dos fenómenos distintos aunque coincidan en sitio y hora', () => {
    // Un terremoto y un incendio cercanos el mismo día son dos sucesos.
    const { conservados } = fueraDuplicadosGeo([gdacs({ familia: 'incendio' })], [usgs]);
    expect(conservados).toHaveLength(1);
  });

  it('no funde dos sismos lejanos', () => {
    const { conservados } = fueraDuplicadosGeo([gdacs({ lat: 40, lng: 3 })], [usgs]);
    expect(conservados).toHaveLength(1);
  });

  it('no funde dos sismos separados por días', () => {
    const { conservados } = fueraDuplicadosGeo(
      [gdacs({ time: new Date('2026-10-14T18:10:00Z') })], [usgs]);
    expect(conservados).toHaveLength(1);
  });

  it('conserva lo que no trae coordenadas en vez de adivinar', () => {
    const { conservados } = fueraDuplicadosGeo([gdacs({ lat: null, lng: null })], [usgs]);
    expect(conservados).toHaveLength(1);
  });

  it('no revienta con listas vacías', () => {
    expect(fueraDuplicadosGeo([], []).conservados).toEqual([]);
    expect(fueraDuplicadosGeo(null, null).conservados).toEqual([]);
  });
});
