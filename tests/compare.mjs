/**
 * Compara dos ejecuciones de la prueba de humo: diagnosticos y capturas.
 *
 *   node tests/compare.mjs antes despues
 *
 * Las capturas se comparan pixel a pixel. Como el reloj del navegador esta
 * congelado y las fuentes salen de fixtures, cualquier diferencia que quede
 * es responsabilidad del cambio de codigo, salvo animaciones CSS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatchNs from 'pixelmatch';
import { TESTS_DIR } from './lib/harness.mjs';

const pixelmatch = pixelmatchNs.default || pixelmatchNs;
const [aLabel, bLabel] = process.argv.slice(2);
if (!aLabel || !bLabel) {
  console.error('uso: node tests/compare.mjs <antes> <despues>');
  process.exit(1);
}

const dirA = path.join(TESTS_DIR, 'shots', aLabel);
const dirB = path.join(TESTS_DIR, 'shots', bLabel);
const diffDir = path.join(TESTS_DIR, 'shots', `diff-${aLabel}-${bLabel}`);
fs.mkdirSync(diffDir, { recursive: true });

const readReport = (d) => JSON.parse(fs.readFileSync(path.join(d, 'report.json'), 'utf8'));
const A = readReport(dirA);
const B = readReport(dirB);

console.log(`\n===== DIAGNOSTICOS: ${aLabel} -> ${bLabel} =====`);
const keys = [...new Set([...Object.keys(A.cases), ...Object.keys(B.cases)])];
let regressions = 0;

for (const key of keys) {
  const a = A.cases[key], b = B.cases[key];
  if (!a || !b) { console.log(`\n## ${key}\n   caso solo en ${a ? aLabel : bLabel}`); continue; }

  const lines = [];
  const newErrors = b.consoleErrors.filter((e) => !a.consoleErrors.includes(e));
  const goneErrors = a.consoleErrors.filter((e) => !b.consoleErrors.includes(e));
  const newPageErrors = b.pageErrors.filter((e) => !a.pageErrors.includes(e));
  const newCsp = b.cspViolations.filter((e) => !a.cspViolations.includes(e));
  const newReqFail = b.requestFailures.filter((e) => !a.requestFailures.includes(e));

  for (const e of newErrors) { lines.push('   + ERROR NUEVO   ' + e.slice(0, 180)); regressions++; }
  for (const e of newPageErrors) { lines.push('   + PAGEERR NUEVO ' + e.slice(0, 180)); regressions++; }
  for (const e of newCsp) { lines.push('   + CSP NUEVO     ' + e.slice(0, 180)); regressions++; }
  for (const e of newReqFail) { lines.push('   + REQFAIL NUEVO ' + e.slice(0, 180)); regressions++; }
  for (const e of goneErrors) lines.push('   - resuelto       ' + e.slice(0, 180));

  if (a.navigation !== b.navigation) { lines.push(`   ! navegacion ${a.navigation} -> ${b.navigation}`); regressions++; }

  for (const field of ['dataKeys', 'signalCards', 'nodes', 'svgPaths', 'hasRobustezBadge', 'hasLiveBadge']) {
    const va = a.probe?.[field], vb = b.probe?.[field];
    if (JSON.stringify(va) !== JSON.stringify(vb)) lines.push(`   ~ ${field}: ${JSON.stringify(va)} -> ${JSON.stringify(vb)}`);
  }

  if (lines.length) { console.log(`\n## ${key}`); lines.forEach((l) => console.log(l)); }
}

console.log(`\n===== CAPTURAS =====`);
const shots = fs.readdirSync(dirA).filter((f) => f.endsWith('.png'));
for (const f of shots) {
  const pb = path.join(dirB, f);
  if (!fs.existsSync(pb)) { console.log(`${f.padEnd(46)} FALTA en ${bLabel}`); continue; }
  const a = PNG.sync.read(fs.readFileSync(path.join(dirA, f)));
  const b = PNG.sync.read(fs.readFileSync(pb));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`${f.padEnd(46)} DIMENSIONES ${a.width}x${a.height} -> ${b.width}x${b.height}`);
    continue;
  }
  const out = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 });
  const total = a.width * a.height;
  if (n > 0) fs.writeFileSync(path.join(diffDir, f), PNG.sync.write(out));
  const pct = ((100 * n) / total).toFixed(2);
  console.log(`${f.padEnd(46)} ${String(n).padStart(8)} px  (${pct}%)`);
}

console.log(`\nRegresiones detectadas: ${regressions}`);
console.log(`Diferencias de imagen en: ${path.relative(process.cwd(), diffDir)}`);
process.exitCode = 0;
