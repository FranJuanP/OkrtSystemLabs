/**
 * Datos de Vector (T25).
 *
 * Escribe `data/vector.json` con los flujos y los stocks financieros que
 * dibuja Vector. Lo ejecuta el mismo trabajo semanal que los indicadores.
 *
 * El problema que resuelve no es solo que las 42 cifras del diagrama
 * estuvieran escritas a mano. Es que **mezclaba stocks con flujos**:
 *
 *   «RESERVAS 890»   es un saldo: lo que hay acumulado, en un instante.
 *   «COMERCIO 3.210» es un flujo: lo que se mueve en un año.
 *
 * Sumar las dos cosas en el mismo diagrama, con la misma unidad y la misma
 * escala, no significa nada: son magnitudes de dimensiones distintas. Un
 * stock se mide en dólares; un flujo, en dólares por año.
 *
 * Aquí van separadas y etiquetadas, cada bloque con su periodo:
 *
 *   STOCKS   reservas oficiales por moneda (COFER), deuda del Tesoro de
 *            EEUU por tenedor (TIC), reservas por país (Banco Mundial)
 *   FLUJOS   remesas recibidas, entradas de inversión directa y
 *            exportaciones de bienes y servicios (Banco Mundial)
 *
 * Y cada bloque **conserva**: lo que entra por un lado sale por el otro,
 * porque el reparto se construye como «los N primeros más el resto», y el
 * resto se calcula por diferencia con el total de la propia fuente. El
 * fichero lleva los residuos calculados y `tests/vector.mjs` los comprueba.
 *
 * Uso: node tools/fetch-vector.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listaPaises, ultimoValor } from './data/worldbank.mjs';
import * as cofer from './data/cofer.mjs';
import * as tic from './data/tic.mjs';
import { FUENTES } from './data/registry.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(ROOT, 'data', 'vector.json');
const enSeco = process.argv.includes('--dry');

/** Cuántos destinos se muestran por bloque antes de agrupar en «Resto». */
const TOP = 8;

/** Mil millones de dólares, que es la unidad del diagrama. */
const B = 1e9;

const miles = (n) => Math.round(n * 10) / 10;

/**
 * Bloque de dos columnas: un total a la izquierda y su reparto a la derecha.
 *
 * `resto` se calcula por diferencia, no se estima: es el total de la fuente
 * menos lo que se reparte explícitamente. Así el bloque conserva por
 * construcción y el residuo que publica el fichero es exactamente 0.
 */
function bloqueReparto({ id, clase, tipo, titulo, origen, total, partes, unidad, periodo, publicado, fuente, url, nota }) {
  const nodos = [{ id: 'TOTAL_' + id, label: origen, col: 0, isHub: true }];
  const enlaces = [];

  for (const p of partes) {
    nodos.push({ id: p.id, label: p.label, col: 2, region: p.region || 'XX' });
    enlaces.push({
      s: 'TOTAL_' + id,
      t: p.id,
      v: miles(p.valor),
      type: tipo,
      unit: unidad,
      year: p.anio != null ? p.anio : periodo,
      source: fuente,
      url: p.url || url,
      detail: p.detail || '',
    });
  }

  const repartido = partes.reduce((a, p) => a + p.valor, 0);
  const resto = total - repartido;
  if (resto > 0.5) {
    nodos.push({ id: 'RESTO_' + id, label: 'Resto del mundo', col: 2, region: 'XX' });
    enlaces.push({
      s: 'TOTAL_' + id,
      t: 'RESTO_' + id,
      v: miles(resto),
      type: tipo,
      unit: unidad,
      year: periodo,
      source: fuente,
      url,
      detail: `Diferencia entre el total de la fuente (${miles(total)} ${unidad}) y los ${partes.length} que se muestran. No es una estimación: sale por resta.`,
    });
  }

  return {
    id, clase, tipo, titulo, unidad, periodo, publicado: publicado || null,
    source: fuente, url, nota: nota || null,
    total: miles(total),
    nodos, enlaces,
  };
}

async function main() {
  const ahora = new Date().toISOString();
  console.log(`AETHER · datos de Vector · ${ahora}`);

  const { paises } = await listaPaises();
  const nombre = new Map(paises.map((p) => [p.iso3, p.nombre]));
  const region = new Map(paises.map((p) => [p.iso3, p.region]));
  const iso3 = paises.map((p) => p.iso3);

  /** Región corta, la que usan los filtros de Vector. */
  const REGION_CORTA = {
    'América del Norte': 'NA', 'Europa y Asia central': 'EU',
    'Asia oriental y el Pacífico': 'AS', 'Asia meridional': 'AS',
    'Oriente Medio y Norte de África': 'ME',
    'América Latina y el Caribe': 'LA', 'África al sur del Sahara': 'AF',
  };
  const corta = (iso) => REGION_CORTA[String(region.get(iso) || '').trim()] || 'XX';

  const bloques = [];

  // ── STOCK · reservas oficiales por moneda (COFER) ────────────────────────
  const c = await cofer.descargar();
  const totalCofer = c.monedas.CI_T.valorUsd / B;
  const partesMoneda = Object.entries(c.monedas)
    .filter(([k]) => k !== 'CI_T')
    .map(([k, v]) => ({
      id: 'CCY_' + k.replace('CI_', ''),
      label: v.nombre,
      valor: v.valorUsd / B,
      detail: `${v.nombre}: ${miles(v.valorUsd / B)} B USD, el ${v.porcentaje.toFixed(2)} % de las reservas asignadas. Serie ${k} de COFER.`,
    }))
    .sort((a, b) => b.valor - a.valor);

  bloques.push(bloqueReparto({
    id: 'reservas_moneda', clase: 'stock', tipo: 'reserves',
    titulo: 'Reservas oficiales de divisas, por moneda',
    origen: 'Reservas asignadas',
    total: totalCofer, partes: partesMoneda,
    unidad: 'B USD', periodo: c.periodo, publicado: c.publicado,
    fuente: FUENTES.cofer.corto, url: FUENTES.cofer.url,
    nota: 'Solo reservas asignadas, es decir, aquellas cuya moneda declara el país tenedor. Es un saldo, no un flujo anual.',
  }));
  console.log(`  COFER   ${c.periodo}: ${miles(totalCofer)} B USD en ${partesMoneda.length} monedas`);

  // ── STOCK · deuda del Tesoro de EEUU por tenedor (TIC) ───────────────────
  const t = await tic.descargar();
  const totalTic = t.totales['Grand Total'];
  const partesTic = t.tenedores.slice(0, TOP).map((h) => ({
    id: 'TIC_' + h.nombre.replace(/[^A-Za-z]/g, '').slice(0, 10).toUpperCase(),
    label: h.nombre,
    valor: h.valor,
    detail: `${h.nombre} mantiene ${h.valor} mil millones de dólares en valores del Tesoro de EEUU, el ${((h.valor / totalTic) * 100).toFixed(1)} % del total en manos extranjeras.`,
  }));

  bloques.push(bloqueReparto({
    id: 'deuda_eeuu', clase: 'stock', tipo: 'debt',
    titulo: 'Deuda del Tesoro de EEUU en manos extranjeras, por tenedor',
    origen: 'Deuda del Tesoro de EEUU',
    total: totalTic, partes: partesTic,
    unidad: 'B USD', periodo: t.periodo,
    fuente: FUENTES.tic.corto, url: FUENTES.tic.url,
    nota: 'Saldo a fin de mes, no un flujo. El fichero legible por máquina del Tesoro va por detrás de la nota de prensa mensual: el periodo es el del dato, no el de hoy.',
  }));
  console.log(`  TIC     ${t.periodo}: ${totalTic} B USD, ${partesTic.length} tenedores de ${t.tenedores.length}`);

  // ── Bloques del Banco Mundial ────────────────────────────────────────────
  const delBanco = [
    {
      id: 'remesas', clase: 'flujo', tipo: 'remit', codigo: 'BX.TRF.PWKR.CD.DT',
      titulo: 'Remesas recibidas', origen: 'Remesas mundiales',
      nota: 'Flujo anual: transferencias personales recibidas en un año, no un saldo acumulado.',
    },
    {
      id: 'ied', clase: 'flujo', tipo: 'fdi', codigo: 'BX.KLT.DINV.CD.WD',
      titulo: 'Entradas de inversión extranjera directa', origen: 'IED mundial',
      nota: 'Flujo anual neto de entrada. Puede ser negativo en un país concreto; los negativos no se reparten en el diagrama y entran en el resto.',
    },
    {
      id: 'exportaciones', clase: 'flujo', tipo: 'trade', codigo: 'NE.EXP.GNFS.CD',
      titulo: 'Exportaciones de bienes y servicios', origen: 'Exportaciones mundiales',
      nota: 'Flujo anual. Al sumar países se cuenta el comercio intermedio más de una vez, así que el total es mayor que el comercio mundial neto.',
    },
    {
      id: 'reservas_pais', clase: 'stock', tipo: 'reserves', codigo: 'FI.RES.TOTL.CD',
      titulo: 'Reservas totales, por país', origen: 'Reservas mundiales',
      nota: 'Saldo, oro incluido. No es lo mismo que COFER: aquí se reparte por país tenedor y allí por moneda.',
    },
  ];

  for (const b of delBanco) {
    const r = await ultimoValor(b.codigo, iso3, 'wb');
    const positivos = [...r.valores].filter(([, v]) => v.valor > 0);
    const total = positivos.reduce((a, [, v]) => a + v.valor, 0) / B;
    const partes = positivos
      .sort((a, b2) => b2[1].valor - a[1].valor)
      .slice(0, TOP)
      .map(([iso, v]) => ({
        id: b.id.toUpperCase().slice(0, 4) + '_' + iso,
        label: nombre.get(iso) || iso,
        region: corta(iso),
        valor: v.valor / B,
        anio: v.anio,
        detail: `${nombre.get(iso) || iso}: ${miles(v.valor / B)} B USD en ${v.anio}. ${r.nombre}.`,
      }));

    // El periodo del bloque es el año más frecuente entre sus datos: con
    // `mrnev` cada país puede venir de un año distinto.
    const anios = positivos.map(([, v]) => v.anio);
    const cuenta = new Map();
    for (const a of anios) cuenta.set(a, (cuenta.get(a) || 0) + 1);
    const periodo = String([...cuenta.entries()].sort((x, y) => y[1] - x[1])[0][0]);

    bloques.push(bloqueReparto({
      id: b.id, clase: b.clase, tipo: b.tipo, titulo: b.titulo, origen: b.origen,
      total, partes, unidad: 'B USD', periodo,
      fuente: FUENTES.wb.corto,
      url: 'https://data.worldbank.org/indicator/' + b.codigo,
      nota: `${b.nota} Suma de ${positivos.length} países con dato; el año puede variar de uno a otro y va en cada enlace.`,
    }));
    console.log(`  ${b.id.padEnd(14)} ${periodo}: ${miles(total)} B USD, ${positivos.length} países`);
  }

  // ── Conservación ─────────────────────────────────────────────────────────
  const conservacion = bloques.map((b) => {
    const entradas = b.enlaces.filter((l) => l.s === 'TOTAL_' + b.id).reduce((a, l) => a + l.v, 0);
    const residuo = Math.abs(entradas - b.total);
    return {
      bloque: b.id,
      total: b.total,
      suma_enlaces: miles(entradas),
      residuo: Math.round(residuo * 100) / 100,
      // El redondeo a un decimal de cada enlace puede dejar unas décimas.
      tolerancia: Math.max(0.5, b.enlaces.length * 0.05),
      ok: residuo <= Math.max(0.5, b.enlaces.length * 0.05),
    };
  });

  const malos = conservacion.filter((c2) => !c2.ok);
  console.log('\nconservación:');
  for (const c2 of conservacion) {
    console.log(`  ${c2.ok ? 'OK  ' : 'MAL '} ${c2.bloque.padEnd(16)} total ${c2.total} · enlaces ${c2.suma_enlaces} · residuo ${c2.residuo}`);
  }
  if (malos.length) {
    console.error(`\nABORTA: ${malos.length} bloque(s) no conservan.`);
    process.exit(1);
  }

  const salida = {
    esquema: 1,
    generado: ahora,
    // Lo que se muestra cuando no se filtra: solo los flujos, nunca mezclados
    // con los stocks. Mezclarlos es el error que este fichero viene a corregir.
    porDefecto: bloques.filter((b) => b.clase === 'flujo').map((b) => b.id),
    bloques,
    conservacion,
  };

  if (enSeco) { console.log('\n--dry: no se escribe nada.'); return; }
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify(salida, null, 1));
  console.log(`\nescrito data/vector.json (${Math.round(JSON.stringify(salida).length / 1024)} KB, ${bloques.length} bloques)`);
}

main().catch((err) => {
  console.error('los datos de Vector han fallado:', err && err.stack ? err.stack : err);
  process.exit(1);
});
