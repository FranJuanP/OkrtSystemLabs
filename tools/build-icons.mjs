/**
 * Genera los iconos de la PWA a partir del logo (T19).
 *
 * El icono que el manifest declaraba como `purpose: "maskable"` era byte a
 * byte idéntico al normal y su dibujo ocupaba el 100 % del lienzo. Un icono
 * maskable tiene que dejar margen: Android recorta con una máscara (círculo,
 * squircle, gota…) y solo garantiza que se vea la **zona segura**, el
 * círculo central de diámetro 80 %. Con el dibujo a sangre, ese icono pierde
 * las esquinas en cualquier lanzador.
 *
 * Aquí se generan dos familias distintas de verdad:
 *
 *   any       el logo ocupando el lienzo, para contextos que no recortan.
 *   maskable  el logo al 60 % sobre el fondo de marca, de modo que todo el
 *             dibujo cae dentro de la zona segura y la máscara solo come
 *             fondo.
 *
 * Uso: node tools/build-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'icons');

/** Fondo de marca, el mismo que `theme_color` y `background_color`. */
const BRAND_BG = '#050A10';

/**
 * Proporción del lienzo que ocupa el logo en el icono maskable.
 *
 * La zona segura es el círculo central de diámetro 80 % del lienzo, es
 * decir radio 0,40·W desde el centro. Un cuadrado centrado de lado r·W
 * tiene las esquinas a (r/2)·√2·W del centro, así que para que quepa
 * entero hace falta r ≤ 0,8/√2 ≈ 0,5657. Se usa 0,55 para dejar holgura.
 *
 * La comprobación del final del script mide la caja real del dibujo en vez
 * de fiarse de esta cuenta.
 */
const MASKABLE_RATIO = 0.55;

/**
 * Logo de origen. El repositorio guarda la versión de 192 px, que es la que
 * usa la web; para un icono de 512 hace falta el original de 2000 px, que
 * estaba incrustado en base64 en index.html antes de T15. Se recupera del
 * historial de git.
 */
function sourceLogo() {
  const local = path.join(ROOT, 'assets', 'img', 'okrt-logo-2000.png');
  if (fs.existsSync(local)) return fs.readFileSync(local);

  console.log('Recuperando el logo original (2000x2000) del historial de git ...');
  const sha = execFileSync('git', ['log', '--format=%H', '-1', '--', 'index.html'], { cwd: ROOT })
    .toString().trim();
  // Cualquier commit anterior a T15 sirve; se busca el que aún tenía base64.
  const commits = execFileSync('git', ['log', '--format=%H', '--', 'index.html'], { cwd: ROOT })
    .toString().trim().split('\n');
  for (const c of commits) {
    let html;
    try {
      html = execFileSync('git', ['show', `${c}:index.html`], { cwd: ROOT, maxBuffer: 1 << 30 }).toString();
    } catch { continue; }
    const m = html.match(/data:image\/png;base64,([A-Za-z0-9+/=]{100000,})/);
    if (!m) continue;
    for (const candidate of html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)) {
      const buf = Buffer.from(candidate[1], 'base64');
      // El logo es cuadrado de 2000x2000; el hero es 1536x1024.
      if (buf.length > 80000 && buf.length < 200000) {
        fs.writeFileSync(local, buf);
        console.log(`  encontrado en ${c.slice(0, 8)} (${(buf.length / 1024).toFixed(0)} kB)`);
        return buf;
      }
    }
  }
  throw new Error('no se encontró el logo original en el historial');
}

const logo = sourceLogo();
const meta = await sharp(logo).metadata();
if (meta.width !== meta.height) {
  console.warn(`aviso: el logo no es cuadrado (${meta.width}x${meta.height})`);
}
fs.mkdirSync(OUT, { recursive: true });

/** Icono "any": el logo escalado al tamaño pedido. */
async function buildAny(size, file) {
  await sharp(logo)
    .resize(size, size, { fit: 'contain', background: BRAND_BG })
    .flatten({ background: BRAND_BG })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

/** Icono "maskable": el logo al 60 % centrado sobre el fondo de marca. */
async function buildMaskable(size, file) {
  const inner = Math.round(size * MASKABLE_RATIO);
  const logoResized = await sharp(logo)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: logoResized, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

await buildAny(192, 'icon-okrt-192-v2.png');
await buildAny(512, 'icon-okrt-512-v2.png');
await buildMaskable(192, 'icon-okrt-192-maskable-v2.png');
await buildMaskable(512, 'icon-okrt-512-maskable-v2.png');
await buildAny(180, 'apple-touch-icon-okrt-v2.png');
// Apple no aplica máscara, pero sí esquinas redondeadas: sin transparencia.
fs.copyFileSync(path.join(OUT, 'apple-touch-icon-okrt-v2.png'),
  path.join(ROOT, 'public', 'apple-touch-icon-okrt-v2.png'));
fs.copyFileSync(path.join(OUT, 'apple-touch-icon-okrt-v2.png'),
  path.join(ROOT, 'public', 'apple-touch-icon.png'));
fs.copyFileSync(path.join(OUT, 'apple-touch-icon-okrt-v2.png'),
  path.join(ROOT, 'public', 'apple-touch-icon-precomposed.png'));

/**
 * Mide la caja del dibujo (lo que no es fondo de marca) y comprueba, para
 * los maskable, que las cuatro esquinas de esa caja caen dentro del círculo
 * de zona segura. Es la verificación que faltaba: el icono anterior se
 * declaraba maskable sin serlo.
 */
async function inspect(file) {
  const { data, info } = await sharp(path.join(OUT, file)).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (Math.abs(data[i] - 5) > 14 || Math.abs(data[i + 1] - 10) > 14 || Math.abs(data[i + 2] - 16) > 14) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const cx = W / 2, cy = H / 2, rSafe = W * 0.4;
  const safe = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]
    .every(([px, py]) => Math.hypot(px - cx, py - cy) <= rSafe);
  return { W, H, pct: Math.round((Math.max(w, h) / W) * 100), safe };
}

console.log('\nIconos generados:');
let problemas = 0;
for (const f of fs.readdirSync(OUT).sort()) {
  const r = await inspect(f);
  let nota = `dibujo ${r.pct}% del lienzo`;
  if (f.includes('maskable')) {
    nota += r.safe ? '  · dentro de la zona segura' : '  · SE SALE DE LA ZONA SEGURA';
    if (!r.safe) problemas++;
  }
  console.log(`  ${f.padEnd(36)} ${r.W}x${r.H}  ${nota}`);
}
if (problemas) {
  console.error(`\n${problemas} icono(s) maskable con el dibujo fuera de la zona segura.`);
  process.exit(1);
}
