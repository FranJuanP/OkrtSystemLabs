/**
 * Fuentes nuevas de la fase datos de OSIRIS: GDELT geolocalizado,
 * mercados de predicción y clima espacial. Con muestras del formato real.
 */
import fs from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, it, expect } from 'vitest';

import { crearDiccionario } from '../../src/signal/paises.js';
import { parsearExportacion, resumirPorPais, eventosDestacados, urlsHaciaAtras } from '../../src/signal/gdelt-geo.js';
import { parsearPolymarket, parsearManifold, mercadosPorPais } from '../../src/signal/mercados.js';
import { normalizarSWPC } from '../../src/signal/normalizar.js';
import { abrirZip } from '../../tools/data/gdelt.mjs';

const paises = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/latest.json'), 'utf8')).paises;
const dic = crearDiccionario(paises);

/** Una fila de 61 columnas con lo que importa en su sitio. */
function fila({ id = '1', raiz = '19', quad = 4, gold = -10, art = 10, fuentes = 3, lugar = 'Khartoum, Khartoum, Sudan', lat = 15.55, lng = 32.53, fecha = '20261115120000', url = 'https://ejemplo.org/a' } = {}) {
  const c = new Array(61).fill('');
  Object.assign(c, { 0: id, 28: raiz, 29: String(quad), 30: String(gold), 32: String(fuentes), 33: String(art), 52: lugar, 56: String(lat), 57: String(lng), 59: fecha, 60: url });
  return c.join('\t');
}

describe('GDELT geolocalizado', () => {
  const csv = [
    fila({ id: '1' }),
    fila({ id: '2', art: 30 }),                                   // mismo sitio y raíz: se agrupa
    fila({ id: '3', raiz: '20', lugar: 'Kharkiv, Kharkivs\'ka Oblast\', Ukraine', lat: 49.98, lng: 36.25, art: 5 }),
    fila({ id: '4', raiz: '04', quad: 1, gold: 3, lugar: 'Paris, Ile-de-France, France', lat: 48.85, lng: 2.35 }),
    fila({ id: '5', raiz: '11', quad: 3, gold: -2, lugar: 'Sudan', lat: 15, lng: 30 }),
    fila({ id: '6', lugar: 'Atlantis' }),                         // sin país: fuera
    'corta\tfila',
  ].join('\n');
  const filas = parsearExportacion(csv, dic);

  it('asigna el país del SUCESO a partir del nombre del lugar', () => {
    expect(filas.map((f) => f.pais)).toEqual(['SDN', 'SDN', 'UKR', 'FRA', 'SDN']);
  });

  it('resume por país y tipo', () => {
    const r = resumirPorPais(filas);
    expect(r.SDN).toMatchObject({ conflicto_material: 2, conflicto_verbal: 1, cooperacion: 0, total: 3 });
    expect(r.FRA.cooperacion).toBe(1);
  });

  it('los destacados son solo violencia, agrupados y con su país', () => {
    const d = eventosDestacados(filas);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ fuente: 'gdeltgeo', familia: 'conflicto', paises: ['SDN'] });
    expect(d[0].impacts['ARTÍCULOS']).toBe('40');
    expect(d.find((e) => e.paises[0] === 'UKR').severity).toBe('CRITICAL'); // violencia masiva
  });

  it('calcula las URL de las exportaciones hacia atrás cada 15 minutos', () => {
    const u = urlsHaciaAtras('http://data.gdeltproject.org/gdeltv2/20261115120000.export.CSV.zip', 1);
    expect(u).toHaveLength(4);
    expect(u[1]).toMatch(/20261115114500\.export\.CSV\.zip$/);
    expect(u[3]).toMatch(/20261115111500\.export\.CSV\.zip$/);
  });

  it('abre un ZIP de una entrada', () => {
    const datos = Buffer.from(csv);
    const comp = deflateRawSync(datos);
    const nombre = Buffer.from('x.CSV');
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(8, 8); cab.writeUInt32LE(comp.length, 18);
    cab.writeUInt32LE(datos.length, 22); cab.writeUInt16LE(nombre.length, 26);
    expect(abrirZip(Buffer.concat([cab, nombre, comp])).toString()).toBe(csv);
    expect(() => abrirZip(Buffer.from('no'))).toThrow();
  });
});

describe('mercados de predicción', () => {
  const poly = [{
    slug: 'sudan-ceasefire', title: 'Sudan ceasefire in 2026?', volume: 50000,
    markets: [
      { question: 'Sudan ceasefire by June 30?', outcomes: '["Yes","No"]', outcomePrices: '["0.18","0.82"]', volumeNum: 40000, endDate: '2026-06-30T00:00:00Z' },
      { question: 'Closed one', outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]', closed: true },
    ],
  }];
  const mani = [
    { url: 'https://manifold.markets/x/russia-ukraine', outcomeType: 'BINARY', probability: 0.3, question: 'Will Russia and Ukraine sign a ceasefire?', volume: 900 },
    { url: 'https://evil.example/x', outcomeType: 'BINARY', probability: 0.3, question: 'Fake Sudan', volume: 900 },
  ];

  it('lee Polymarket (lista o {events}) y Manifold, y descarta lo cerrado o ajeno', () => {
    expect(parsearPolymarket(poly)).toHaveLength(1);
    expect(parsearPolymarket({ events: poly })).toHaveLength(1);
    expect(parsearManifold(mani)).toHaveLength(1);
    expect(parsearPolymarket('basura')).toEqual([]);
  });

  it('agrupa por los países que nombra la pregunta', () => {
    const m = mercadosPorPais([...parsearPolymarket(poly), ...parsearManifold(mani)], dic);
    expect(m.SDN[0]).toMatchObject({ plataforma: 'Polymarket', probabilidad: 0.18 });
    expect(m.RUS).toHaveLength(1);
    expect(m.UKR).toHaveLength(1);
  });

  it('Georgia en una pregunta de política de EEUU es EEUU', () => {
    const m = mercadosPorPais(parsearManifold([{ url: 'https://manifold.markets/g', outcomeType: 'BINARY', probability: 0.5, question: 'Will Democrats win the Georgia Senate race?', volume: 500 }]), dic);
    expect(m.GEO).toBeUndefined();
    expect(m.USA).toHaveLength(1);
  });
});

describe('clima espacial NOAA', () => {
  it('convierte en evento solo las escalas activas', () => {
    const d = { '0': { DateStamp: '2026-11-15', TimeStamp: '12:00:00', R: { Scale: '0' }, S: { Scale: '1' }, G: { Scale: '3' } } };
    const ev = normalizarSWPC(d);
    expect(ev.map((e) => e.impacts.ESCALA).sort()).toEqual(['G3', 'S1']);
    expect(ev.find((e) => e.impacts.ESCALA === 'G3').severity).toBe('HIGH');
    expect(normalizarSWPC({})).toEqual([]);
  });
});
