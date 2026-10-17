/**
 * Pipeline de datos de AETHER (T21).
 *
 * Descarga los 60 indicadores del registro de sus cinco fuentes oficiales y
 * escribe dos ficheros:
 *
 *   data/aether-AAAA-MM-DD.json   la instantánea de hoy, que se conserva
 *   data/latest.json              la misma, y es la que leen las páginas
 *
 * Cada indicador de cada país se guarda con valor, unidad, año, fuente, enlace
 * y momento de descarga. Esa es la diferencia con lo que había: antes el
 * dashboard llevaba 1.600 indicadores escritos a mano y no se podía saber de
 * dónde salía ninguno.
 *
 * Uso:
 *   node tools/fetch-data.mjs              descarga todo
 *   node tools/fetch-data.mjs --solo wb    solo una fuente (para depurar)
 *   node tools/fetch-data.mjs --dry        no escribe nada, solo informa
 *
 * El trabajo semanal de .github/workflows/datos.yml lo ejecuta y valida la
 * salida contra data/schema/aether-datos.schema.json antes de confirmarla.
 *
 * Si una fuente se cae, sus indicadores se quedan sin valor y eso aparece en
 * el informe y en `avisos` del propio fichero. Lo que no hace es escribir un
 * fichero a medias sin decirlo: con menos del 60 % de la cobertura esperada,
 * aborta y deja el anterior en su sitio.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INDICADORES, CATEGORIAS, FUENTES, urlIndicador, comprobarRegistro } from './data/registry.mjs';
import { listaPaises, ultimoValor } from './data/worldbank.mjs';
import * as inform from './data/inform.mjs';
import * as ndgain from './data/ndgain.mjs';
import * as cofer from './data/cofer.mjs';
import * as tic from './data/tic.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');

const args = process.argv.slice(2);
const soloFuente = (() => {
  const i = args.indexOf('--solo');
  return i >= 0 ? args[i + 1] : null;
})();
const enSeco = args.includes('--dry');

/**
 * Códigos que AETHER usa y el Banco Mundial escribe de otra forma.
 * Kosovo es el único caso real: el Banco Mundial lo publica como XKX.
 */
const ALIAS = { KOS: 'XKX' };

/**
 * Territorios que el panel incluye y para los que NO hay serie oficial
 * comparable en ninguna de las cinco fuentes. Se dejan anotados para que la
 * ausencia sea una decisión documentada y no un hueco inexplicado.
 */
const SIN_FUENTE = {
  TWN: 'Taiwán no es miembro del Banco Mundial ni del FMI; no hay serie en ninguna de las cinco fuentes.',
  ESH: 'Sáhara Occidental: sin serie propia; el Banco Mundial no lo publica por separado.',
  GUF: 'Guayana Francesa: departamento de Francia, sin serie propia.',
};

const porcentaje = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

async function main() {
  const problemas = comprobarRegistro();
  if (problemas.length) {
    console.error('El registro de indicadores tiene problemas:\n  ' + problemas.join('\n  '));
    process.exit(1);
  }

  const inicio = Date.now();
  const ahora = new Date().toISOString();
  console.log(`AETHER · pipeline de datos · ${ahora}`);
  console.log(`${INDICADORES.length} indicadores, ${CATEGORIAS.length} categorías\n`);

  // ── Países ───────────────────────────────────────────────────────────────
  const { paises, agregados } = await listaPaises();
  const iso3 = paises.map((p) => p.iso3);
  console.log(`países del Banco Mundial: ${paises.length} (y ${agregados.length} agregados)`);

  // ── Descarga por fuente ──────────────────────────────────────────────────
  const avisos = [];
  const versiones = {};

  /** Mapa fuente -> (codigo -> Map(iso3 -> {valor, anio})) */
  const datos = { wb: new Map(), wgi: new Map(), uhc: new Map(), inform: new Map(), ndgain: new Map() };

  const usa = (f) => !soloFuente || soloFuente === f;

  // Banco Mundial (WDI, WGI, UHC): un bloque de peticiones por indicador.
  for (const catalogo of ['wb', 'wgi', 'uhc']) {
    if (!usa(catalogo)) continue;
    const lista = INDICADORES.filter((i) => i.fuente === catalogo);
    for (const ind of lista) {
      try {
        const r = await ultimoValor(ind.codigo, iso3, catalogo);
        datos[catalogo].set(ind.codigo, r.valores);
        if (r.actualizado) versiones[catalogo] = { actualizado: r.actualizado };
        console.log(`  ${catalogo.padEnd(6)} ${ind.id.padEnd(26)} ${String(r.valores.size).padStart(3)} países`);
      } catch (err) {
        avisos.push(`${ind.id}: ${err.message}`);
        console.log(`  ${catalogo.padEnd(6)} ${ind.id.padEnd(26)} FALLO · ${err.message}`);
      }
    }
  }

  // INFORM: una sola petición para todas sus dimensiones.
  if (usa('inform') && INDICADORES.some((i) => i.fuente === 'inform')) {
    try {
      const r = await inform.descargar();
      datos.inform = r.porIndicador;
      versiones.inform = r.version;
      console.log(`  inform ${r.version.nombre} (publicado ${r.version.publicado}) · ${r.porIndicador.size} indicadores`);
    } catch (err) {
      avisos.push(`INFORM: ${err.message}`);
      console.log(`  inform FALLO · ${err.message}`);
    }
  }

  // ND-GAIN: un zip con los tres índices.
  if (usa('ndgain') && INDICADORES.some((i) => i.fuente === 'ndgain')) {
    try {
      const r = await ndgain.descargar();
      datos.ndgain = r.porIndicador;
      versiones.ndgain = r.version;
      console.log(`  ndgain ${r.version.nombre} · último año ${r.version.ultimoAnio}`);
    } catch (err) {
      avisos.push(`ND-GAIN: ${err.message}`);
      console.log(`  ndgain FALLO · ${err.message}`);
    }
  }

  // ── Agregados globales: COFER y TIC ──────────────────────────────────────
  let coferDatos = null;
  if (usa('cofer')) {
    try {
      coferDatos = await cofer.descargar();
      console.log(`  cofer  ${coferDatos.periodo} (publicado ${coferDatos.publicado}) · ${Object.keys(coferDatos.monedas).length} series`);
    } catch (err) {
      avisos.push(`COFER: ${err.message}`);
      console.log(`  cofer  FALLO · ${err.message}`);
    }
  }

  let ticDatos = null;
  if (usa('tic')) {
    try {
      ticDatos = await tic.descargar();
      console.log(`  tic    ${ticDatos.periodo} · ${ticDatos.tenedores.length} tenedores`);
    } catch (err) {
      avisos.push(`TIC: ${err.message}`);
      console.log(`  tic    FALLO · ${err.message}`);
    }
  }

  // ── Montaje del fichero ──────────────────────────────────────────────────
  const salida = {
    esquema: 1,
    generado: ahora,
    fuentes: {},
    versiones,
    indicadores: {},
    paises: {},
    global: {},
    avisos,
    sin_fuente: SIN_FUENTE,
  };

  for (const [clave, f] of Object.entries(FUENTES)) {
    salida.fuentes[clave] = {
      nombre: f.nombre,
      corto: f.corto,
      url: f.url,
      licencia: f.licencia,
      licencia_url: f.licenciaUrl,
    };
  }

  for (const ind of INDICADORES) {
    salida.indicadores[ind.id] = {
      categoria: ind.cat,
      etiqueta: ind.etiqueta,
      unidad: ind.unidad,
      fuente: ind.fuente,
      codigo: ind.codigo,
      direccion: ind.dir,
      decimales: ind.decimales,
      escala: ind.escala || 'lineal',
      url: urlIndicador(ind),
    };
    if (ind.nota) salida.indicadores[ind.id].nota = ind.nota;
  }

  salida.categorias = CATEGORIAS.map((c) => ({ ...c }));

  const cobertura = {};
  for (const p of paises) {
    const codigoFuente = ALIAS[p.iso3] || p.iso3;
    const entrada = { nombre: p.nombre, iso2: p.iso2, region: p.region, ingreso: p.ingreso, indicadores: {} };
    for (const ind of INDICADORES) {
      const tabla = datos[ind.fuente] && datos[ind.fuente].get(ind.codigo);
      const v = tabla && tabla.get(codigoFuente);
      if (!v) continue;
      entrada.indicadores[ind.id] = {
        value: Number(v.valor.toFixed(Math.max(ind.decimales, 4))),
        unit: ind.unidad,
        year: v.anio,
        source: FUENTES[ind.fuente].corto,
        url: urlIndicador(ind),
        fetched_at: ahora,
      };
      cobertura[ind.id] = (cobertura[ind.id] || 0) + 1;
    }
    salida.paises[p.iso3] = entrada;
  }

  if (coferDatos) {
    salida.global.cofer = {
      periodo: coferDatos.periodo,
      publicado: coferDatos.publicado,
      source: FUENTES.cofer.corto,
      url: FUENTES.cofer.url,
      fetched_at: ahora,
      monedas: coferDatos.monedas,
    };
  }
  if (ticDatos) {
    salida.global.tic = {
      periodo: ticDatos.periodo,
      unit: ticDatos.unidad,
      source: FUENTES.tic.corto,
      url: FUENTES.tic.url,
      fetched_at: ahora,
      tenedores: ticDatos.tenedores,
      totales: ticDatos.totales,
    };
  }

  salida.cobertura = cobertura;

  // ── Informe y control de calidad ─────────────────────────────────────────
  console.log('\ncobertura por indicador:');
  const flojos = [];
  for (const ind of INDICADORES) {
    const n = cobertura[ind.id] || 0;
    const pct = porcentaje(n, paises.length);
    if (pct < 50) flojos.push(`${ind.id} (${pct} %)`);
    console.log(`  ${String(n).padStart(3)} / ${paises.length}  ${String(pct).padStart(5)} %  ${ind.id}`);
  }

  const totalCeldas = Object.values(cobertura).reduce((a, b) => a + b, 0);
  const esperado = paises.length * INDICADORES.length;
  const pctGlobal = porcentaje(totalCeldas, esperado);
  console.log(`\ntotal: ${totalCeldas} de ${esperado} posibles (${pctGlobal} %)`);
  if (flojos.length) console.log(`indicadores por debajo del 50 %: ${flojos.join(', ')}`);
  if (avisos.length) console.log(`avisos: ${avisos.length}\n  ` + avisos.join('\n  '));

  // Umbral de seguridad: por debajo de esto algo ha ido mal de verdad y es
  // mejor conservar el fichero anterior que sustituirlo por uno peor.
  if (!soloFuente && pctGlobal < 60) {
    console.error(`\nABORTA: solo ${pctGlobal} % de cobertura, se esperaba al menos 60 %.`);
    console.error('No se escribe nada; el fichero anterior sigue siendo válido.');
    process.exit(1);
  }

  if (enSeco) {
    console.log('\n--dry: no se escribe nada.');
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const dia = ahora.slice(0, 10);
  const instantanea = path.join(DATA_DIR, `aether-${dia}.json`);
  const texto = JSON.stringify(salida, null, 1);
  fs.writeFileSync(instantanea, texto);
  fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), texto);

  const kb = Math.round(texto.length / 1024);
  console.log(`\nescrito data/aether-${dia}.json y data/latest.json (${kb} KB)`);
  console.log(`en ${Math.round((Date.now() - inicio) / 1000)} s`);
}

main().catch((err) => {
  console.error('\nel pipeline ha fallado:', err && err.stack ? err.stack : err);
  process.exit(1);
});
