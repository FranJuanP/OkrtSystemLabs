import { defineConfig } from 'vitest/config';

/**
 * T29 · Pruebas unitarias.
 *
 * Cubren lo que las pruebas de navegador no pueden: que el calculo hace lo que
 * dice METHODOLOGY.md, que las matrices son validas, que el generador con
 * semilla es determinista y que las conversiones de las fuentes de Signal
 * producen lo que la interfaz espera.
 *
 * Solo ficheros puros, sin DOM: son rapidas (menos de un segundo) y se pueden
 * correr en cada commit sin esperar a que arranque un navegador.
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.mjs'],
    environment: 'node',
    reporters: ['default'],
  },
});
