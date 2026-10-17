/**
 * Descarga del ND-GAIN Country Index (University of Notre Dame) (T21).
 *
 * Aporta las dos mitades del riesgo climático que ninguna otra fuente da
 * juntas y comparables: vulnerabilidad (exposición y sensibilidad al cambio
 * climático) y preparación (capacidad económica, de gobernanza y social para
 * adaptarse). 192 países, series desde 1995.
 *
 * No hay API: hay un zip. Y la URL del zip lleva dentro un número de
 * artefacto que cambia con cada edición anual
 * (`/assets/647440/ndgain_countryindex_2026.zip`), así que fijarla a mano es
 * garantizar que el pipeline se rompa el año que viene. Se lee el enlace de
 * la página de descargas, que sí es estable, y la URL fija queda solo como
 * respaldo.
 *
 * El servidor rechaza las peticiones sin «user-agent» de navegador con un
 * 403; `pedir()` ya manda uno identificando el proyecto.
 *
 * Licencia: CC BY-NC-SA 4.0. Es no comercial, y AETHER no lo es, pero conviene
 * tenerlo anotado: está en el campo `licencia` de la fuente y en
 * METHODOLOGY.md.
 */
import { pedir } from './http.mjs';
import { inflateRawSync } from 'node:zlib';

const PAGINA = 'https://gain.nd.edu/our-work/country-index/download-data/';
const RESPALDO = 'https://gain.nd.edu/assets/647440/ndgain_countryindex_2026.zip';

/** Busca en la página de descargas el enlace al zip de datos. */
async function urlDelZip() {
  try {
    const html = await pedir(PAGINA, { como: 'text', timeoutMs: 45000 });
    const m = html.match(/href="([^"]*ndgain[^"]*\.zip)"/i) || html.match(/href="([^"]*\.zip)"/i);
    if (m) return new URL(m[1], PAGINA).href;
  } catch (err) {
    // La página puede caerse; el respaldo sigue sirviendo el año en curso.
  }
  return RESPALDO;
}

/**
 * Lee un zip sin dependencias externas.
 *
 * Node trae inflateRawSync, que es lo único que hace falta para un zip
 * normal. Es bastante menos código que arrastrar una librería de zip para
 * leer tres CSV.
 *
 * Hay que recorrer el directorio central (PK\x01\x02), no los encabezados
 * locales: este zip viene hecho con macOS y guarda los tamaños en un
 * descriptor posterior a los datos, de modo que los 550 encabezados locales
 * dan tamaño comprimido 0. Las entradas del directorio central sí traen el
 * tamaño real y el desplazamiento del encabezado local.
 */
function leerDelZip(buf, filtro) {
  const salida = new Map();
  for (let i = 0; i < buf.length - 45; i++) {
    if (buf[i] !== 0x50 || buf[i + 1] !== 0x4b || buf[i + 2] !== 0x01 || buf[i + 3] !== 0x02) continue;
    const metodo = buf.readUInt16LE(i + 10);
    const tamComp = buf.readUInt32LE(i + 20);
    const tamNombre = buf.readUInt16LE(i + 28);
    const tamExtra = buf.readUInt16LE(i + 30);
    const tamComent = buf.readUInt16LE(i + 32);
    const desplLocal = buf.readUInt32LE(i + 42);
    const nombre = buf.toString('utf8', i + 46, i + 46 + tamNombre);
    i += 45 + tamNombre + tamExtra + tamComent;
    if (!filtro(nombre) || tamComp === 0) continue;

    // En el encabezado local, los datos empiezan tras el nombre y los extras,
    // que pueden no coincidir en longitud con los del directorio central.
    const nLocal = buf.readUInt16LE(desplLocal + 26);
    const eLocal = buf.readUInt16LE(desplLocal + 28);
    const inicio = desplLocal + 30 + nLocal + eLocal;
    const comprimido = buf.subarray(inicio, inicio + tamComp);
    try {
      salida.set(nombre, metodo === 0 ? comprimido : inflateRawSync(comprimido));
    } catch (err) {
      // Entrada ilegible: se ignora y se nota al faltar el indicador.
    }
  }
  return salida;
}

/** Divide una línea de CSV respetando las comillas. */
function campos(linea) {
  const out = [];
  let actual = '';
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { dentro = !dentro; continue; }
    if (c === ',' && !dentro) { out.push(actual); actual = ''; continue; }
    actual += c;
  }
  out.push(actual);
  return out;
}

/**
 * Para cada país, el valor del último año con dato de ese CSV.
 * Las columnas son los años (1995…2024) y las filas los países.
 */
function ultimoAnio(csv) {
  const lineas = csv.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const cabecera = campos(lineas[0]);
  const anios = cabecera.map((c, i) => ({ i, anio: Number(c) })).filter((c) => Number.isFinite(c.anio) && c.anio > 1900);
  const valores = new Map();
  for (const linea of lineas.slice(1)) {
    const f = campos(linea);
    const iso = (f[0] || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iso)) continue;
    // De derecha a izquierda: el primer año con valor es el más reciente.
    for (let k = anios.length - 1; k >= 0; k--) {
      const bruto = (f[anios[k].i] || '').trim();
      if (bruto === '') continue;
      const v = Number(bruto);
      if (!Number.isFinite(v)) continue;
      valores.set(iso, { valor: v, anio: anios[k].anio });
      break;
    }
  }
  return valores;
}

/**
 * @returns {Promise<{version:object, porIndicador: Map<string, Map<string,{valor:number,anio:number}>>}>}
 *   con los indicadores 'vulnerability', 'readiness' y 'gain'.
 */
export async function descargar() {
  const url = await urlDelZip();
  const zip = await pedir(url, { como: 'buffer', timeoutMs: 120000 });

  const quiero = /(vulnerability|readiness|gain)\/\1\.csv$/i;
  const ficheros = leerDelZip(zip, (n) => !n.includes('__MACOSX') && quiero.test(n));

  const porIndicador = new Map();
  let anioMax = 0;
  for (const [nombre, contenido] of ficheros) {
    const cual = nombre.match(/(vulnerability|readiness|gain)\.csv$/i)[1].toLowerCase();
    const valores = ultimoAnio(contenido);
    if (!valores.size) continue;
    porIndicador.set(cual, valores);
    for (const v of valores.values()) if (v.anio > anioMax) anioMax = v.anio;
  }
  if (!porIndicador.size) throw new Error('ND-GAIN: el zip no traía ninguno de los CSV esperados');

  return {
    version: {
      nombre: 'ND-GAIN Country Index',
      url,
      // La edición se nombra por el año de publicación; el último año con
      // dato va, además, en cada valor.
      ultimoAnio: anioMax,
    },
    porIndicador,
  };
}
