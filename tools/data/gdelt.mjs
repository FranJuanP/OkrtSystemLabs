/**
 * Descarga de las exportaciones de eventos de GDELT 2.0 (fase datos de OSIRIS).
 *
 * lastupdate.txt dice cuál es la última exportación de 15 minutos; desde
 * ahí se piden hacia atrás las de las últimas `horas`. Cada una es un ZIP
 * con un solo CSV, que se abre con zlib sin librerías: la cabecera local
 * del ZIP da el método y el tamaño.
 *
 * La conversión de las filas está en src/signal/gdelt-geo.js, que es puro y
 * tiene pruebas.
 */
import { inflateRawSync } from 'node:zlib';
import { pedir } from './http.mjs';
import { urlsHaciaAtras, parsearExportacion } from '../../src/signal/gdelt-geo.js';

export const LASTUPDATE = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';

/** La primera entrada de un ZIP, descomprimida. */
export function abrirZip(buf) {
  if (!buf || buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('no es un ZIP');
  const metodo = buf.readUInt16LE(8);
  const tam = buf.readUInt32LE(18);
  const inicio = 30 + buf.readUInt16LE(26) + buf.readUInt16LE(28);
  const fin = tam > 0 ? inicio + tam : buf.indexOf('PK\x01\x02', inicio, 'binary');
  const cuerpo = buf.subarray(inicio, fin > inicio ? fin : undefined);
  if (metodo === 8) return inflateRawSync(cuerpo);
  if (metodo === 0) return cuerpo;
  throw new Error('método de compresión ' + metodo);
}

/**
 * Filas de las últimas `horas`. Falla solo si no se ha podido leer ni la
 * mitad de las exportaciones: perder alguna suelta es normal (GDELT a veces
 * anuncia una un momento antes de publicarla).
 */
export async function descargarGdelt(dic, { horas = 24, simultaneas = 8 } = {}) {
  const txt = await pedir(LASTUPDATE, { como: 'text', timeoutMs: 20000 });
  const ultima = String(txt).split('\n').map((l) => l.trim().split(/\s+/).pop()).find((u) => u && u.endsWith('.export.CSV.zip'));
  if (!ultima) throw new Error('lastupdate.txt no lista ninguna exportación');
  const urls = urlsHaciaAtras(ultima, horas);
  const filas = [];
  let leidas = 0;
  for (let i = 0; i < urls.length; i += simultaneas) {
    const lote = urls.slice(i, i + simultaneas);
    const res = await Promise.allSettled(lote.map((u) => pedir(u, { como: 'buffer', timeoutMs: 30000, intentos: 2 })));
    for (const r of res) {
      if (r.status !== 'fulfilled') continue;
      try {
        filas.push(...parsearExportacion(abrirZip(r.value).toString('utf8'), dic));
        leidas++;
      } catch (_e) { /* una exportación rota no tumba el resto */ }
    }
  }
  if (leidas < urls.length / 2) throw new Error(`solo ${leidas} de ${urls.length} exportaciones`);
  return { filas, leidas, pedidas: urls.length, desde: urls[urls.length - 1], hasta: ultima };
}
