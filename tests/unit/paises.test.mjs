/**
 * Fase eventos por país: a qué país va cada evento y cómo se agrupan.
 *
 * Los casos de texto son los formatos reales de cada fuente. Lo que más
 * importa es lo que NO debe pasar: que «Papua New Guinea» cuente también
 * como Guinea, que un incendio en Georgia (EEUU) vaya al Cáucaso, o que una
 * noticia de GDELT se asigne al país del periódico.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { crearDiccionario, paisesDeEvento, paisesEnTexto, normalizarNombre } from '../../src/signal/paises.js';
import { agruparPorPais, recientesConPais, haceCuanto } from '../../src/core/eventos-pais.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const paises = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/latest.json'), 'utf8')).paises;
const dic = crearDiccionario(paises);
const de = (ev) => paisesDeEvento(ev, dic);

describe('paisesDeEvento', () => {
  it('USGS: el país al final de place, y los estados de EEUU', () => {
    expect(de({ fuente: 'usgs', location: '95 km SSE of Hachijo-jima, Japan' })).toEqual(['JPN']);
    expect(de({ fuente: 'usgs', location: '12 km NE of Ridgecrest, CA' })).toEqual(['USA']);
    expect(de({ fuente: 'usgs', location: 'Rat Islands, Aleutian Islands, Alaska' })).toEqual(['USA']);
    expect(de({ fuente: 'usgs', location: 'south of the Fiji Islands' })).toEqual(['FJI']);
  });

  it('un mar o una dorsal se quedan sin país', () => {
    expect(de({ fuente: 'usgs', location: 'Central Mid-Atlantic Ridge' })).toEqual([]);
  });

  it('el nombre más largo gana: Papua New Guinea no es también Guinea', () => {
    expect(de({ fuente: 'usgs', location: '45 km W of Lae, Papua New Guinea' })).toEqual(['PNG']);
    expect(de({ fuente: 'gdacs', location: 'Guinea, Guinea-Bissau, Equatorial Guinea' }))
      .toEqual(['GIN', 'GNB', 'GNQ']);
    expect(de({ fuente: 'gdacs', location: 'Sudan, South Sudan, Chad' })).toEqual(['SDN', 'SSD', 'TCD']);
    expect(de({ fuente: 'gdacs', location: 'Niger, Nigeria' })).toEqual(['NER', 'NGA']);
    expect(de({ fuente: 'gdacs', location: 'Dominica, Dominican Republic' })).toEqual(['DMA', 'DOM']);
  });

  it('Georgia: el estado cuando hay condado, el país si no', () => {
    expect(de({ fuente: 'nasa', title: 'Wildfire in Ware County, Georgia' })).toEqual(['USA']);
    expect(de({ fuente: 'nasa', title: 'Wildfires - Tbilisi, Georgia' })).toEqual(['GEO']);
  });

  it('OMS: el país detrás del guion, con sus nombres oficiales', () => {
    expect(de({ fuente: 'who', title: 'Avian Influenza A(H5N1) - Cambodia', location: 'Cambodia' })).toEqual(['KHM']);
    expect(de({ fuente: 'who', location: 'Democratic Republic of the Congo' })).toEqual(['COD']);
    expect(de({ fuente: 'who', location: 'United Republic of Tanzania' })).toEqual(['TZA']);
  });

  it('nombres con tildes, apóstrofos y abreviaturas', () => {
    expect(de({ fuente: 'gdacs', location: "Côte d'Ivoire, Türkiye, Myanmar" })).toEqual(['CIV', 'TUR', 'MMR']);
    expect(de({ fuente: 'gdacs', location: 'Bosnia and Herzegovina, St. Lucia, Saint Kitts and Nevis' }))
      .toEqual(['BIH', 'LCA', 'KNA']);
  });

  it('GDELT no se asigna: su país es el del medio, no el del suceso', () => {
    expect(de({ fuente: 'gdelt', location: 'United Kingdom', title: 'Fighting in Sudan' })).toEqual([]);
  });

  it('todo ISO3 asignado existe en latest.json o es un territorio sin datos conocido', () => {
    const extra = new Set(['TWN']);
    for (const iso of new Set(dic.values())) {
      expect(paises[iso] || extra.has(iso), iso).toBeTruthy();
    }
  });

  it('texto vacío o nulo no rompe', () => {
    expect(paisesEnTexto('', dic)).toEqual([]);
    expect(paisesEnTexto(null, dic)).toEqual([]);
    expect(de(null)).toEqual([]);
    expect(normalizarNombre('São Tomé & Príncipe')).toBe('sao tome and principe');
  });
});

describe('agruparPorPais', () => {
  const ahora = Date.parse('2026-11-15T12:00:00Z');
  const h = (n) => new Date(ahora - n * 3600000).toISOString();
  const eventos = [
    { id: 'a', time: h(1), paises: ['JPN'] },
    { id: 'b', time: h(5), paises: ['SDN', 'SSD'] },
    { id: 'c', time: h(80), paises: ['JPN'] },          // fuera de la ventana
    { id: 'd', time: h(2), paises: [] },                // sin país
    { id: 'e', time: 'no es una fecha', paises: ['JPN'] },
    { id: 'f', time: h(3), paises: ['JPN'] },
  ];

  it('agrupa la ventana de 72 h, del más reciente al más antiguo', () => {
    const g = agruparPorPais(eventos, { ahora });
    expect(g.get('JPN').map((e) => e.id)).toEqual(['a', 'f']);
    expect(g.get('SDN').map((e) => e.id)).toEqual(['b']);
    expect(g.get('SSD').map((e) => e.id)).toEqual(['b']);
  });

  it('la vista global no repite un evento de varios países', () => {
    expect(recientesConPais(eventos, { ahora }).map((e) => e.id)).toEqual(['a', 'f', 'b']);
  });

  it('acepta una entrada vacía o rota', () => {
    expect(agruparPorPais(undefined).size).toBe(0);
    expect(agruparPorPais([null, {}]).size).toBe(0);
  });

  it('antigüedad corta', () => {
    expect(haceCuanto(h(0.5), ahora)).toBe('hace 30 min');
    expect(haceCuanto(h(5), ahora)).toBe('hace 5 h');
    expect(haceCuanto(h(72), ahora)).toBe('hace 3 d');
  });
});
