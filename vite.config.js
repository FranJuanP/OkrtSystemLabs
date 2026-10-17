import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * T21 · El fichero de datos entra en el build.
 *
 * `data/latest.json` lo escribe el trabajo semanal en la raíz del
 * repositorio, no en `public/`, porque ahí viven también las instantáneas con
 * fecha y esas NO deben publicarse: son varios megas cada una y solo sirven
 * para comparar. Este plugin copia únicamente `latest.json`.
 *
 * No se precachea: son 2,9 MB, y sumarlos a los 4 MB que ya instala el
 * service worker haría una instalación de siete megas. El worker lo sirve con
 * NetworkFirst y guarda su copia, así que a partir de la primera visita
 * funciona sin red.
 */
function datosEnElBuild() {
  return {
    name: 'aether-datos',
    generateBundle() {
      try {
        this.emitFile({
          type: 'asset',
          fileName: 'data/latest.json',
          source: readFileSync(resolve(import.meta.dirname, 'data/latest.json'), 'utf8'),
        });
      } catch (err) {
        // Sin datos el sitio sigue construyéndose; las páginas lo dicen en
        // lugar de quedarse en blanco. Mejor avisar que romper el build.
        this.warn('no se encontró data/latest.json; ejecuta `npm run datos`');
      }
    },
  };
}

/**
 * AETHER · configuración de Vite (T12)
 *
 * Multipágina con las cuatro entradas. `base` apunta al subdirectorio de
 * GitHub Pages, que es donde se publica el sitio.
 *
 * El build solo minifica: la fuente que se versiona es legible, y el motor
 * ya no se ofusca (eso era lo que obligaba a trabajar a ciegas).
 */
export default defineConfig({
  base: '/OkrtSystemLabs/',
  appType: 'mpa',

  plugins: [
    datosEnElBuild(),

    /**
     * T18 · Workbox con injectManifest.
     *
     * El service worker se escribe a mano en src/sw.js y Vite le inyecta
     * la lista de todo lo que produce el build, cada entrada con su
     * revision. Antes la lista se generaba a mano con tools/build-sw.mjs
     * y apuntaba a rutas de src/, que en el build no existen.
     */
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',          // nada de skipWaiting automatico
      injectRegister: false,           // lo registra src/core/pwa-register.js
      manifest: false,                 // el manifest se mantiene a mano
      injectManifest: {
        globPatterns: ['**/*.{html,js,css,webp,avif,png,jpg,svg,ico,woff2}'],
        // El globo y su textura son grandes; sin esto quedarian fuera.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        /**
         * Solo se consideran "ya versionados" los ficheros que llevan un
         * hash de Vite en el nombre. Por defecto se asume que todo lo que
         * cuelga de assets/ lo lleva, y no es cierto: lo que viene de
         * public/ (las 250 banderas, los iconos) se copia tal cual. Sin
         * esto Workbox les pone revision null y no detectaria un cambio.
         */
        dontCacheBustURLsMatching: /-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/,
      },
      devOptions: { enabled: false },
    }),
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // T23: es2022 por el top-level await con el que el motor espera a
    // data/latest.json. Con es2020 el build falla al transformarlo.
    target: 'es2022',
    // Solo minificar, con el minificador por defecto de Vite. Sin ofuscación
    // y sin mangling agresivo de nombres: el objetivo es peso, no esconder el
    // código. La fuente que se versiona sigue siendo legible.
    minify: true,
    // Sin sourcemaps en el publicado: son 5 MB y la fuente ya es legible
    // y esta en el repositorio. Para depurar: npm run build -- --sourcemap
    sourcemap: false,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        globe: resolve(import.meta.dirname, 'aether-globe-v3.html'),
        signal: resolve(import.meta.dirname, 'aether-signal.html'),
        vector: resolve(import.meta.dirname, 'aether-vector.html'),
        metodologia: resolve(import.meta.dirname, 'metodologia.html'),
      },
    },
    // El motor es grande; avisar a partir de 700 kB en vez de 500.
    chunkSizeWarningLimit: 700,
  },

  server: {
    port: 8080,
    strictPort: false,
  },
  preview: {
    port: 8080,
    strictPort: false,
  },
});
