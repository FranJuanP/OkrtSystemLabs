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
