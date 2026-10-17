/**
 * Saca las imágenes base64 incrustadas en los HTML a ficheros (T15).
 *
 * index.html llevaba 805 kB de base64, el 89 % del fichero, y de ellos el
 * logo ocupaba 95 kB repetido TRES veces (navegación, pie y cabecera del
 * dashboard). aether-globe-v3.html llevaba 936 kB, el 96 %, en una sola
 * imagen de carga de 686 kB.
 *
 * Base64 pesa un tercio más que el binario, no se cachea por separado, no
 * se puede servir en otro formato según el navegador y obliga a descargar
 * la imagen antes de poder pintar nada de la página.
 *
 * Este script las extrae, las deduplica por hash, las convierte a WebP y
 * AVIF y deja el PNG como respaldo. Reescribe los HTML con <picture>.
 *
 * Uso: node tools/extract-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'img');

/**
 * Nombre y tamaño máximo por hash de contenido. El ancho máximo se elige
 * por el uso real que tiene cada imagen en la página.
 */
const KNOWN = {
  '25a3e790ad49': { name: 'okrt-logo', maxWidth: 192, note: 'logo, se repetía 3 veces' },
  '24e4a7c3fa4b': { name: 'aether-hero', maxWidth: 1600, note: 'captura de la portada' },
  'ea2f60f58722': { name: 'globe-loader', maxWidth: 400, note: 'imagen de carga del globo' },
};

const DATA_URI = /data:image\/([a-z+]+);base64,([A-Za-z0-9+/=]+)/g;

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = [];

for (const page of ['index.html', 'aether-globe-v3.html']) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  const before = Buffer.byteLength(html);

  const matches = [...html.matchAll(DATA_URI)];
  // De atrás hacia delante, para que los índices no se muevan al sustituir.
  for (const m of matches.reverse()) {
    const buf = Buffer.from(m[2], 'base64');
    const sha = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
    const meta = KNOWN[sha];
    if (!meta) {
      console.warn(`  imagen desconocida (sha ${sha}, ${(buf.length / 1024).toFixed(0)} kB) en ${page}: se deja como está`);
      continue;
    }

    const base = path.join(OUT_DIR, meta.name);
    if (!fs.existsSync(`${base}.webp`)) {
      const img = sharp(buf);
      const { width, height } = await img.metadata();
      const resize = width > meta.maxWidth
        ? { width: meta.maxWidth, withoutEnlargement: true }
        : null;

      const pipeline = () => (resize ? sharp(buf).resize(resize) : sharp(buf));
      await pipeline().webp({ quality: 82, effort: 6 }).toFile(`${base}.webp`);
      await pipeline().avif({ quality: 60, effort: 6 }).toFile(`${base}.avif`);
      await pipeline().png({ compressionLevel: 9, palette: true }).toFile(`${base}.png`);

      const sizes = ['avif', 'webp', 'png'].map((ext) => ({
        ext, bytes: fs.statSync(`${base}.${ext}`).size,
      }));
      report.push({
        page, name: meta.name, note: meta.note,
        original: buf.length,
        from: `${width}x${height}`,
        to: resize ? `${meta.maxWidth}px de ancho` : 'sin redimensionar',
        sizes,
      });
    }

    html = html.slice(0, m.index) + `assets/img/${meta.name}.png` + html.slice(m.index + m[0].length);
  }

  fs.writeFileSync(file, html);
  const after = Buffer.byteLength(html);
  console.log(`${page}: ${(before / 1024).toFixed(0)} kB -> ${(after / 1024).toFixed(0)} kB`);
}

console.log('\nImágenes extraídas:');
for (const r of report) {
  console.log(`  ${r.name}  (${r.note})`);
  console.log(`    original PNG en base64: ${(r.original / 1024).toFixed(0)} kB · ${r.from} · ${r.to}`);
  for (const s of r.sizes) {
    console.log(`    ${s.ext.padEnd(5)} ${(s.bytes / 1024).toFixed(1).padStart(7)} kB   (${((1 - s.bytes / r.original) * 100).toFixed(0)}% menos)`);
  }
}
