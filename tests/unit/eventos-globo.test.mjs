/**
 * Capa de eventos del globo: de qué tipo es cada evento y dónde se pinta.
 */
import { describe, it, expect } from 'vitest';
import { tipoDe, situarEventos, TIPOS, ESCALA } from '../../src/globe/eventos-situar.js';

describe('tipoDe', () => {
  it('usa la familia de la fuente, y si no la categoría', () => {
    expect(tipoDe({ familia: 'volcan', cat: 'seismic' })).toBe('volcan');
    expect(tipoDe({ familia: 'sismo' })).toBe('sismo');
    expect(tipoDe({ cat: 'health' })).toBe('salud');
    expect(tipoDe({ cat: 'seismic' })).toBe('sismo');
    expect(tipoDe({ familia: 'inventada', cat: 'geo' })).toBe('otro');
    expect(tipoDe({ cat: 'conflict' })).toBe('conflicto');
  });
  it('todo tipo tiene color y nombre, y toda severidad una escala', () => {
    for (const t of Object.values(TIPOS)) expect(t.color).toMatch(/^#[0-9A-F]{6}$/i);
    for (const k of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) expect(ESCALA[k]).toBeGreaterThan(0);
  });
});

describe('situarEventos', () => {
  const capitales = new Map([['SDN', { lat: 15.5, lng: 32.5 }]]);

  it('con coordenadas, en su punto, aunque no tenga país (un sismo en el océano)', () => {
    const [p] = situarEventos([{ id: 'a', lat: -0.5, lng: -20.1, paises: [] }], capitales);
    expect(p).toMatchObject({ lat: -0.5, lng: -20.1, aproximado: false });
  });

  it('sin coordenadas, junto a la capital, separados para no taparse', () => {
    const out = situarEventos([
      { id: 'b', paises: ['SDN'] },
      { id: 'c', paises: ['SDN'] },
    ], capitales);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ lat: 15.5, lng: 32.5, aproximado: true });
    expect(out[1].aproximado).toBe(true);
    expect(Math.hypot(out[1].lat - 15.5, out[1].lng - 32.5)).toBeGreaterThan(0.5);
  });

  it('sin coordenadas ni país conocido (GDELT) no se pinta', () => {
    expect(situarEventos([{ id: 'd', paises: [] }, { id: 'e', paises: ['XXX'] }], capitales)).toEqual([]);
  });
});
