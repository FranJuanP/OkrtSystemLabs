import { defineConfig } from 'vite';
import { resolve } from 'node:path';

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

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // Solo minificar, con el minificador por defecto de Vite. Sin ofuscación
    // y sin mangling agresivo de nombres: el objetivo es peso, no esconder el
    // código. La fuente que se versiona sigue siendo legible.
    minify: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        globe: resolve(import.meta.dirname, 'aether-globe-v3.html'),
        signal: resolve(import.meta.dirname, 'aether-signal.html'),
        vector: resolve(import.meta.dirname, 'aether-vector.html'),
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
