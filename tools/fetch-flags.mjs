/**
 * Descarga las banderas de país y las deja en el repositorio (T17).
 *
 * El selector de región pedía 108 imágenes a `flagcdn.com` cada vez que se
 * abría. Era el último tercero que quedaba después de T16, y por el mismo
 * motivo que las tipografías: obliga a abrir `img-src` a un dominio externo
 * y le entrega a ese dominio la IP de cada visitante, además de poner una
 * dependencia de terceros en el camino de una interacción normal.
 *
 * Se descargan a `public/assets/flags/` en WebP, en los dos tamaños que el
 * selector usa (w20 y w40 para pantallas 2x).
 *
 * Uso: node tools/fetch-flags.mjs
 *
 * Solo hay que volver a ejecutarlo si se añaden países a `DATA`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'flags');
const FLAGS_SRC = path.join(ROOT, 'src', 'dashboard', 'okrt-flags-data.js');

/**
 * Códigos ISO-2 que necesita el selector. Salen de OKRT_ALL_REGIONS, que es
 * la tabla que el propio selector recorre, más los de FLAG_OVERRIDES y el
 * mapa de respaldo de `flagRef()`. Así la lista no puede quedarse corta
 * respecto de lo que la página llega a pedir.
 */
function neededCodes() {
  const src = fs.readFileSync(FLAGS_SRC, 'utf8');
  const codes = new Set();
  const regions = src.match(/const OKRT_ALL_REGIONS = (\[.*?\]);/s);
  if (regions) {
    for (const entry of JSON.parse(regions[1])) {
      if (entry && typeof entry.a2 === 'string' && /^[a-z]{2}$/.test(entry.a2)) codes.add(entry.a2);
    }
  }
  // Mapa de respaldo y overrides, por si alguno no está en la tabla.
  for (const m of src.matchAll(/:\s*'([a-z]{2})'/g)) codes.add(m[1]);
  if (!codes.size) throw new Error('no se pudo derivar ningún código de bandera');
  return [...codes].sort();
}

const codes = neededCodes();
console.log(`${codes.length} banderas que descargar`);
fs.mkdirSync(OUT, { recursive: true });

let ok = 0; const failed = [];
for (const code of codes) {
  const targets = [
    { w: 20, file: path.join(OUT, `${code}.webp`) },
    { w: 40, file: path.join(OUT, `${code}@2x.webp`) },
  ];
  if (targets.every((t) => fs.existsSync(t.file))) { ok++; continue; }
  try {
    for (const t of targets) {
      const res = await fetch(`https://flagcdn.com/w${t.w}/${code}.png`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).webp({ quality: 90, effort: 6 }).toFile(t.file);
    }
    ok++;
  } catch (err) {
    failed.push(`${code}: ${err.message}`);
  }
}

const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`descargadas ${ok}/${codes.length}  ·  ${fs.readdirSync(OUT).length} ficheros  ·  ${(bytes / 1024).toFixed(0)} kB en total`);
if (failed.length) {
  console.warn('sin descargar:');
  failed.forEach((f) => console.warn('  ' + f));
}
