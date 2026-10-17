/**
 * Centroides de Natural Earth para los países sin coordenadas (B-e).
 *
 * El globo coloca cada marcador en las coordenadas de la capital, que publica
 * el Banco Mundial. Seis territorios no las traen y por eso no se dibujaban:
 * Palestina —que tiene dos arcos de tensión y no salía—, las Islas del Canal,
 * Curazao, Gibraltar, San Martín y Sint Maarten.
 *
 * Aquí se calcula el centroide de su geometría a partir de Natural Earth, que
 * es cartografía de dominio público y la misma base que usan los mapas del
 * panel. No es la capital: es el centro del territorio. Se marca como tal en
 * el fichero de datos (`origen_coordenadas`) para que no se confunda con el
 * resto.
 *
 * Se usa la resolución 1:50m y no la 1:110m, aunque para colocar un punto
 * sobre un globo de 900 píxeles la segunda sobraría: a 1:110m los
 * territorios diminutos no existen. De los seis que faltaban solo aparecía
 * Palestina; Gibraltar, Curazao, San Martín, Sint Maarten y las Islas del
 * Canal no están en ese fichero. Son 3 MB en vez de 0,8, y solo se descargan
 * al generar los datos.
 */
import { pedir } from './http.mjs';

/* Dos resoluciones, y se usa la segunda solo si hace falta.

   A 1:50m aparecen cinco de los seis territorios que faltaban. Gibraltar no:
   son 6,8 km2 y a esa escala no existe. Para lo que quede se baja a 1:10m,
   que si lo tiene pero pesa unas ocho veces mas. Asi el caso normal descarga
   3 MB y solo se paga el fichero grande cuando queda algo por resolver. */
const URL_NE = [
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson',
];

/**
 * Natural Earth y el Banco Mundial no siempre usan el mismo ISO3.
 *
 * Natural Earth marca algunos territorios con -99 en ISO_A3 porque su estatus
 * está disputado o no tienen código propio asignado; para esos se empareja
 * por el nombre que usa su campo `NAME` o `ADMIN`.
 */
const POR_NOMBRE = {
  PSE: ['Palestine', 'West Bank', 'Gaza'],
  CHI: ['Jersey', 'Guernsey', 'Channel Islands'],
  CUW: ['Curaçao', 'Curacao'],
  GIB: ['Gibraltar'],
  MAF: ['Saint Martin', 'St-Martin'],
  SXM: ['Sint Maarten'],
  XKX: ['Kosovo'],
};

/**
 * Centroide de un anillo de coordenadas, por área (fórmula del polígono).
 *
 * La media aritmética de los vértices no sirve: un país con la costa muy
 * detallada y el interior liso tendría su «centro» desplazado hacia la costa,
 * porque ahí hay más puntos. Esta pondera por área.
 */
function centroideDeAnillo(anillo) {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [x0, y0] = anillo[j];
    const [x1, y1] = anillo[i];
    const cruz = x0 * y1 - x1 * y0;
    area2 += cruz;
    cx += (x0 + x1) * cruz;
    cy += (y0 + y1) * cruz;
  }
  if (Math.abs(area2) < 1e-12) {
    // Un anillo degenerado (una isla diminuta): vale la media de sus puntos.
    const n = anillo.length || 1;
    return {
      lng: anillo.reduce((a, p) => a + p[0], 0) / n,
      lat: anillo.reduce((a, p) => a + p[1], 0) / n,
      area: 0,
    };
  }
  const area = area2 / 2;
  return { lng: cx / (3 * area2), lat: cy / (3 * area2), area: Math.abs(area) };
}

/**
 * Centroide de una geometría, quedándose con su parte más grande.
 *
 * Para un país con varias piezas —Palestina son Cisjordania y Gaza— el
 * centroide del conjunto caería entre las dos, posiblemente fuera del
 * territorio. Se usa el centroide de la pieza de mayor área, que siempre cae
 * dentro de algo real.
 */
function centroideDeGeometria(geom) {
  if (!geom) return null;
  const poligonos = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates
      : [];
  let mejor = null;
  for (const poli of poligonos) {
    const exterior = poli[0];
    if (!Array.isArray(exterior) || exterior.length < 3) continue;
    const c = centroideDeAnillo(exterior);
    if (!mejor || c.area > mejor.area) mejor = c;
  }
  if (!mejor) return null;
  return { lat: Math.round(mejor.lat * 10000) / 10000, lng: Math.round(mejor.lng * 10000) / 10000 };
}

/**
 * @param {string[]} iso3 territorios que necesitan coordenadas
 * @returns {Promise<Map<string,{lat:number,lng:number,nombre:string}>>}
 */
export async function centroidesDe(iso3) {
  const quiero = new Set(iso3);
  if (!quiero.size) return new Map();

  const salida = new Map();
  for (const url of URL_NE) {
    if (salida.size === quiero.size) break;
    await buscarEn(url, quiero, salida);
  }
  return salida;
}

async function buscarEn(url, quiero, salida) {
  const geo = await pedir(url, { timeoutMs: 120000 });

  for (const f of geo.features || []) {
    const p = f.properties || {};
    const codigos = [p.ISO_A3, p.ISO_A3_EH, p.ADM0_A3, p.SOV_A3, p.GU_A3]
      .filter((c) => typeof c === 'string' && /^[A-Z]{3}$/.test(c) && c !== '-99');

    let iso = codigos.find((c) => quiero.has(c)) || null;

    if (!iso) {
      // Por nombre, para los que Natural Earth deja sin ISO3 utilizable.
      const nombres = [p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.BRK_NAME]
        .filter((n) => typeof n === 'string');
      for (const [codigo, alias] of Object.entries(POR_NOMBRE)) {
        if (!quiero.has(codigo)) continue;
        if (nombres.some((n) => alias.some((a) => n.toLowerCase().includes(a.toLowerCase())))) {
          iso = codigo;
          break;
        }
      }
    }

    if (!iso || salida.has(iso)) continue;
    const c = centroideDeGeometria(f.geometry);
    if (c) salida.set(iso, { ...c, nombre: p.NAME || p.ADMIN || iso });
  }
}
