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
import { centroidesDe } from './data/centroides.mjs';
import * as ucdp from './data/ucdp.mjs';

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
 * Agregados que el panel usa como referencia: «Global» es su vista por
 * defecto y la Unión Europea aparece en el selector. Se descargan igual que
 * los países pero se guardan aparte, y NO entran en la distribución con la
 * que se calculan los percentiles: el mundo es la media de todos, meterlo en
 * la muestra desplazaría el centro de todas las comparaciones.
 */
const AGREGADOS = ['WLD', 'EUU'];

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
  // Los agregados se piden en la misma tanda; separarlos después es barato.
  const aPedir = iso3.concat(AGREGADOS);
  const metaAgregados = AGREGADOS.map(
    (code) => agregados.find((a) => a.iso3 === code) || { iso3: code, nombre: code },
  );
  console.log(`países del Banco Mundial: ${paises.length}, más ${AGREGADOS.join(' y ')} como referencia`);

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
        const r = await ultimoValor(ind.codigo, aPedir, catalogo);
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

  // UCDP: muertos por violencia organizada.
  let datosUcdp = null;
  if (usa('ucdp') && INDICADORES.some((i) => i.fuente === 'ucdp')) {
    try {
      datosUcdp = await ucdp.descargar(iso3);
      versiones.ucdp = datosUcdp.version;
      avisos.push(...datosUcdp.avisos);
      console.log(`  ucdp   GED ${datosUcdp.version.ged} + Candidate ${datosUcdp.version.candidate} · `
        + `${datosUcdp.version.desde} a ${datosUcdp.version.hasta} · ${datosUcdp.porPais.size} países con eventos`);
    } catch (err) {
      avisos.push(`UCDP: ${err.message}`);
      console.log(`  ucdp   FALLO · ${err.message}`);
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

  /** Monta la entrada de un país o agregado con todos sus indicadores. */
  function montar(p, contarCobertura) {
    const codigoFuente = ALIAS[p.iso3] || p.iso3;
    const entrada = { nombre: p.nombre, indicadores: {} };
    if (p.iso2) entrada.iso2 = p.iso2;
    if (p.region) entrada.region = p.region;
    if (p.ingreso) entrada.ingreso = p.ingreso;
    if (p.capital) entrada.capital = p.capital;
    if (p.lat != null && p.lng != null) {
      entrada.lat = p.lat;
      entrada.lng = p.lng;
      // 'capital' (Banco Mundial) o 'centroide' (Natural Earth). Son cosas
      // distintas y el que lea el fichero tiene derecho a saber cual es.
      entrada.origen_coordenadas = p.origenCoordenadas || 'capital';
    }

    for (const ind of INDICADORES) {
      /* UCDP no viene de la misma maquinaria que el resto: son dos cifras
         calculadas de sus ficheros de eventos. Y un pais sin eventos vale
         CERO, no «sin dato»: que el UCDP no registre violencia organizada en
         Noruega es información, no una laguna. Por eso se rellenan los 217 y
         no solo los 113 que aparecen en sus ficheros. */
      if (ind.fuente === 'ucdp') {
        if (!datosUcdp || !p.iso3) continue;
        const u = datosUcdp.porPais.get(p.iso3);
        const valor = ind.id === 'muertes_conflicto' ? (u ? u.muertos : 0)
          : ind.id === 'muertes_conflicto_parte' ? (u ? u.parte : 0)
            : (u ? u.media3anios : 0);
        entrada.indicadores[ind.id] = {
          value: valor,
          unit: ind.unidad,
          year: Number(datosUcdp.version.hasta.slice(0, 4)),
          source: FUENTES.ucdp.corto,
          url: urlIndicador(ind),
          fetched_at: ahora,
        };
        if (contarCobertura) cobertura[ind.id] = (cobertura[ind.id] || 0) + 1;
        continue;
      }

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
      /* El valor anterior, cuando la fuente lo da: es lo que permite saber
         hacia donde se mueve el indicador. La velocidad de cada categoria
         sale de aqui, y ya no de una tabla escrita a mano. */
      if (v.previo) {
        entrada.indicadores[ind.id].prev_value =
          Number(v.previo.valor.toFixed(Math.max(ind.decimales, 4)));
        entrada.indicadores[ind.id].prev_year = v.previo.anio;
      }
      if (contarCobertura) cobertura[ind.id] = (cobertura[ind.id] || 0) + 1;
    }
    /* El desglose del conflicto va aparte de los indicadores porque no se
       puntua: lo usan las reglas de nivel minimo, que necesitan saber de QUE
       son los muertos. Mil muertos de una guerra entre un Estado y un grupo
       armado, de enfrentamientos entre bandas o de una campana contra
       civiles no significan lo mismo. */
    if (datosUcdp && p.iso3) {
      const u = datosUcdp.porPais.get(p.iso3);
      /* De qué tramo sale la cifra.

         Candidate NO es acumulativo: la versión vigente trae seis semanas,
         no el año en curso. Con solo eso, la «ventana de 12 meses» se queda
         sin los siete meses que median entre el final de GED y el principio
         de Candidate, y todos los países en guerra parecen haberse calmado.
         Cuando el último año natural cerrado de GED da más muertos que la
         ventana, se publica ESE año y se dice cuál se ha usado. */
      const base = u ? u.base : 'ventana_12m';
      const periodo = base === 'anio_completo'
        ? { desde: `${u.anioBase}-01-01`, hasta: `${u.anioBase}-12-31` }
        : { desde: datosUcdp.version.desde, hasta: datosUcdp.version.hasta };

      entrada.conflicto = {
        territorio_12m: u ? u.muertos : 0,
        estatal_12m: u ? u.porTipo.estatal : 0,
        no_estatal_12m: u ? u.porTipo.noEstatal : 0,
        civiles_12m: u ? u.porTipo.civiles : 0,
        parte_12m: u ? u.parte : 0,
        parte_conflictos: u ? u.parteConflictos : [],
        media_3anios: u ? u.media3anios : 0,
        base,
        anio_base: u && u.anioBase != null ? u.anioBase : null,
        ventana_12m: u ? u.muertosVentana : 0,
        ultimo_anio_completo: u ? u.muertosAnual : 0,
        desde: periodo.desde,
        hasta: periodo.hasta,
        candidate_desde: datosUcdp.version.candidateDesde,
        source: FUENTES.ucdp.corto,
        url: FUENTES.ucdp.url,
        version: `GED ${datosUcdp.version.ged} · Candidate ${datosUcdp.version.candidate}`,
      };
    }

    return entrada;
  }

  /* Los territorios sin coordenadas de capital se colocan con el centroide de
     su geometria segun Natural Earth. El globo no los dibujaba, y entre ellos
     estaba Palestina, que ademas tiene dos arcos de tension. Se marca de donde
     salen las coordenadas: una capital y un centroide no son lo mismo. */
  const sinCoordenadas = paises.filter((p) => p.lat == null || p.lng == null).map((p) => p.iso3);
  let centroides = new Map();
  if (sinCoordenadas.length) {
    try {
      centroides = await centroidesDe(sinCoordenadas);
      console.log(`  centroides de Natural Earth: ${centroides.size} de ${sinCoordenadas.length} (${sinCoordenadas.join(' ')})`);
    } catch (err) {
      avisos.push(`centroides: ${err.message}`);
      console.log(`  centroides FALLO · ${err.message}`);
    }
  }
  for (const p of paises) {
    if (p.lat != null && p.lng != null) continue;
    const c = centroides.get(p.iso3);
    if (!c) continue;
    p.lat = c.lat;
    p.lng = c.lng;
    p.origenCoordenadas = 'centroide';
  }

  for (const p of paises) salida.paises[p.iso3] = montar(p, true);

  salida.agregados = {};
  for (const a of metaAgregados) salida.agregados[a.iso3] = montar(a, false);

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
