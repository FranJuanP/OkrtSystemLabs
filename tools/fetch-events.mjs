/**
 * Descarga de eventos para Signal (T24).
 *
 * Escribe `data/events.json` con los eventos de las cuatro fuentes
 * normalizados. El trabajo `.github/workflows/eventos.yml` lo ejecuta cada
 * media hora.
 *
 * Para qué sirve, concretamente: hasta ahora, si una fuente no respondía
 * desde el navegador —porque estaba caída, porque bloqueaba la petición
 * desde el origen de la página, o porque el visitante tenía la red
 * filtrada—, Signal solo podía recurrir a la última lectura guardada en ESE
 * navegador. Quien entraba por primera vez con la fuente caída no veía nada.
 * Con este fichero hay una lectura reciente para todo el mundo, con su hora.
 *
 * La conversión de cada fuente NO está aquí: está en
 * `src/signal/normalizar.js`, que es el mismo módulo que usa la página. Si
 * viviera en dos sitios, los dos divergirían, y Signal acabaría mostrando
 * una cosa en vivo y otra de la copia.
 *
 * Uso:
 *   node tools/fetch-events.mjs
 *   node tools/fetch-events.mjs --dry    no escribe, solo informa
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pedir } from './data/http.mjs';
import {
  normalizarUSGS, normalizarEONET, normalizarGDELT,
  CONSULTAS_GDELT, urlGDELT, URLS, FUENTES_PENDIENTES,
} from '../src/signal/normalizar.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(ROOT, 'data', 'events.json');
const enSeco = process.argv.includes('--dry');

/** Cuántos eventos como mínimo para considerar la descarga aprovechable. */
const MINIMO = 10;

async function main() {
  const ahora = Date.now();
  const momento = new Date(ahora).toISOString();
  console.log(`AETHER · eventos · ${momento}`);

  const fuentes = {};
  const eventos = [];

  /** Descarga una fuente y anota qué pasó, sin dejar que tumbe al resto. */
  async function intentar(id, etiqueta, fn) {
    try {
      const lista = await fn();
      fuentes[id] = { estado: 'ok', eventos: lista.length, etiqueta };
      for (const ev of lista) {
        // `time` llega como Date; en el fichero va como texto ISO.
        eventos.push(Object.assign({}, ev, { fuente: id, time: new Date(ev.time).toISOString() }));
      }
      console.log(`  ${id.padEnd(8)} ${String(lista.length).padStart(3)} eventos`);
    } catch (err) {
      fuentes[id] = { estado: 'error', eventos: 0, etiqueta, error: err.message };
      console.log(`  ${id.padEnd(8)} FALLO · ${err.message}`);
    }
  }

  await intentar('usgs', 'USGS', async () =>
    normalizarUSGS(await pedir(URLS.usgs, { timeoutMs: 30000 }), ahora));

  await intentar('nasa', 'NASA EONET', async () =>
    normalizarEONET(await pedir(URLS.eonet, { timeoutMs: 30000 }), ahora));

  /* ReliefWeb no se descarga: su v1 devuelve 410 y la v2 exige un appname
     aprobado. Se anota en el fichero para que la pagina pueda decir por que
     esa fuente aparece en gris, en vez de dar a entender que fallo hoy. */
  fuentes.relief = {
    estado: 'pendiente',
    eventos: 0,
    etiqueta: 'ReliefWeb OCHA',
    motivo: FUENTES_PENDIENTES.relief.motivo,
    como_arreglarlo: FUENTES_PENDIENTES.relief.comoArreglarlo,
  };
  console.log('  relief   PENDIENTE · ' + FUENTES_PENDIENTES.relief.motivo);

  await intentar('gdelt', 'GDELT', async () => {
    let out = [];
    let falladas = 0;
    for (let qi = 0; qi < CONSULTAS_GDELT.length; qi++) {
      try {
        const d = await pedir(urlGDELT(CONSULTAS_GDELT[qi].q), { timeoutMs: 30000 });
        out = out.concat(normalizarGDELT(d, qi, ahora));
      } catch (err) {
        falladas++;
      }
    }
    // Que falle una de las tres consultas es admisible; las tres, no.
    if (falladas === CONSULTAS_GDELT.length) throw new Error('las tres consultas han fallado');
    return out;
  });

  // Mismo criterio de deduplicación que la página, para que la copia no
  // traiga repetidos que en vivo no se ven.
  const vistos = new Set();
  const unicos = eventos.filter((e) => {
    const clave = String(e.title).slice(0, 40).toLowerCase();
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
  unicos.sort((a, b) => new Date(b.time) - new Date(a.time));

  const caidas = Object.values(fuentes).filter((f) => f.estado !== 'ok').length;
  console.log(`total: ${unicos.length} eventos (${eventos.length - unicos.length} repetidos fuera), ${caidas} fuentes caídas`);

  // Si han caído todas, es mejor dejar el fichero anterior: será de hace una
  // hora, pero es una lectura real, y lo que escribiríamos ahora sería un
  // fichero vacío que la página mostraría como «no hay eventos».
  if (unicos.length < MINIMO) {
    console.error(`ABORTA: solo ${unicos.length} eventos, se esperaban al menos ${MINIMO}.`);
    console.error('No se escribe nada; el fichero anterior sigue siendo una lectura real.');
    process.exit(1);
  }

  const salida = {
    esquema: 1,
    descargado: momento,
    fuentes,
    eventos: unicos,
  };

  if (enSeco) { console.log('--dry: no se escribe nada.'); return; }

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1));
  console.log(`escrito data/events.json (${Math.round(JSON.stringify(salida).length / 1024)} KB)`);
}

main().catch((err) => {
  console.error('la descarga de eventos ha fallado:', err && err.stack ? err.stack : err);
  process.exit(1);
});
