/**
 * AETHER · tipografías autoalojadas (T16)
 *
 * Venían de `fonts.googleapis.com`, que además de ser una dependencia de
 * terceros en el camino crítico del render obligaba a abrir `style-src` y
 * `font-src` a dos dominios externos, y filtra a Google la IP de cada
 * visitante.
 *
 * Ahora se empaquetan con el build. Solo se importan los pesos que el CSS
 * usa de verdad, no la familia entera:
 *
 *   Share Tech Mono  400          (la más usada: 115 apariciones)
 *   Rajdhani         400 600 700
 *   Bebas Neue       400
 *   Inter            300 400 500
 *   Space Mono       400 700
 *   Exo 2            300 400 600 700
 *   Orbitron         400 600 700 900
 *
 * Cada fichero declara su propio `@font-face` con `font-display: swap`, así
 * que el texto se ve desde el primer momento con la tipografía de respaldo
 * y se sustituye cuando llega la real.
 */
import '@fontsource/share-tech-mono/400.css';

import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';

import '@fontsource/bebas-neue/400.css';

import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';

import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';

import '@fontsource/exo-2/300.css';
import '@fontsource/exo-2/400.css';
import '@fontsource/exo-2/600.css';
import '@fontsource/exo-2/700.css';

import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/600.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
