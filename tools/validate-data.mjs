/**
 * Valida un fichero de datos contra data/schema/aether-datos.schema.json (T21).
 *
 * El esquema atrapa lo que un pipeline que descarga de cinco servidores
 * ajenos hace mal tarde o temprano: un indicador sin año, un enlace que no
 * es https, un porcentaje de 10.000 por un cambio de escala en el origen, un
 * `direccion` inventado.
 *
 * Además del esquema hay comprobaciones que un JSON Schema no sabe expresar:
 * que todo dato apunte a un indicador declarado, que todo indicador apunte a
 * una categoría y una fuente que existan, y que la cobertura del fichero
 * cuadre con los datos que lleva dentro.
 *
 * Uso:
 *   node tools/validate-data.mjs                  valida data/latest.json
 *   node tools/validate-data.mjs data/otro.json   valida el que se le diga
 *
 * Sale con 1 si algo falla, para que el workflow no confirme un fichero roto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// El esquema es draft 2020-12; el export por defecto de ajv es draft-07.
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESQUEMA = path.join(ROOT, 'data', 'schema', 'aether-datos.schema.json');

const objetivo = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'data', 'latest.json');

if (!fs.existsSync(objetivo)) {
  console.error(`no existe: ${objetivo}`);
  process.exit(1);
}

const esquema = JSON.parse(fs.readFileSync(ESQUEMA, 'utf8'));
const datos = JSON.parse(fs.readFileSync(objetivo, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const valida = ajv.compile(esquema);

const fallos = [];
if (!valida(datos)) {
  for (const e of valida.errors.slice(0, 40)) {
    fallos.push(`${e.instancePath || '/'} ${e.message}`);
  }
  if (valida.errors.length > 40) fallos.push(`… y ${valida.errors.length - 40} más`);
}

// ── Coherencia interna, que el esquema no puede comprobar ────────────────────
const idsIndicadores = new Set(Object.keys(datos.indicadores || {}));
const claves = new Set((datos.categorias || []).map((c) => c.key));
const fuentes = new Set(Object.keys(datos.fuentes || {}));

for (const [id, ind] of Object.entries(datos.indicadores || {})) {
  if (!claves.has(ind.categoria)) fallos.push(`indicador ${id}: categoría «${ind.categoria}» no declarada`);
  if (!fuentes.has(ind.fuente)) fallos.push(`indicador ${id}: fuente «${ind.fuente}» no declarada`);
}

const recuento = {};
let celdas = 0;
for (const [iso, pais] of Object.entries(datos.paises || {})) {
  for (const [id, dato] of Object.entries(pais.indicadores || {})) {
    if (!idsIndicadores.has(id)) {
      fallos.push(`${iso}: el dato «${id}» no corresponde a ningún indicador declarado`);
      continue;
    }
    // La unidad del dato tiene que ser la del indicador: si cambia en el
    // registro y no en los datos, las comparaciones dejan de significar nada.
    const esperada = datos.indicadores[id].unidad;
    if (dato.unit !== esperada) {
      fallos.push(`${iso}/${id}: unidad «${dato.unit}» frente a «${esperada}» del registro`);
    }
    recuento[id] = (recuento[id] || 0) + 1;
    celdas++;
  }
}

for (const [id, n] of Object.entries(datos.cobertura || {})) {
  if ((recuento[id] || 0) !== n) {
    fallos.push(`cobertura de ${id}: dice ${n} y hay ${recuento[id] || 0}`);
  }
}

// Una categoría sin ningún indicador que puntúe no se puede calcular: eso
// dejaría una puntuación inventada, que es lo que la Fase 3 viene a quitar.
for (const key of claves) {
  const puntuables = Object.values(datos.indicadores || {}).filter(
    (i) => i.categoria === key && i.direccion !== 'ambiguo',
  );
  if (!puntuables.length) fallos.push(`la categoría «${key}» no tiene ningún indicador que puntúe`);
}

const nombre = path.relative(ROOT, objetivo).replace(/\\/g, '/');
if (fallos.length) {
  console.error(`${nombre}: ${fallos.length} problema(s)\n  ` + fallos.join('\n  '));
  process.exit(1);
}

const paises = Object.keys(datos.paises || {}).length;
console.log(
  `${nombre}: válido · ${paises} países · ${idsIndicadores.size} indicadores · ` +
  `${celdas} datos · generado ${String(datos.generado).slice(0, 10)}`,
);
if ((datos.avisos || []).length) {
  console.log(`avisos de la descarga: ${datos.avisos.length}\n  ` + datos.avisos.join('\n  '));
}
