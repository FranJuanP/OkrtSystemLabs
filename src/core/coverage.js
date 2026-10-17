/**
 * AETHER · cobertura declarada (T9, recalculada en T23)
 *
 * Un único sitio para la cifra de países, que antes aparecía con cuatro
 * valores distintos según la pantalla: 202 en el README, la portada y el
 * pie; 195 en el panel de chat y en la cabecera del globo; y 173 calculado
 * en tiempo de ejecución por el propio globo a partir de su tabla.
 *
 * T9 lo unificó en 201, que era el recuento de la tabla DATA escrita a mano
 * (204 entradas menos WLD, EUU y el duplicado MKD2). Esa tabla ya no existe:
 * T23 la sustituyó por `data/latest.json`, así que la cifra **se cuenta del
 * fichero de datos** en lugar de estar escrita en ningún sitio. Si el
 * pipeline añade o pierde países, el número cambia solo.
 *
 * Qué significa cada campo, que no es lo mismo:
 *   countries     países con al menos un indicador y puntuación calculada
 *   withData      países presentes en el fichero, tengan puntuación o no
 *   onGlobe       países que el globo puede dibujar: los que además tienen
 *                 coordenadas de su capital en la fuente
 *   dataYear      año más frecuente entre todos los datos
 *
 * tests/coverage.mjs comprueba que las cifras que aparecen en el HTML y en
 * el README coinciden con lo que el fichero de datos sostiene.
 */
import { cargarDatos } from './datos.js';

let countries = 0;
let withData = 0;
let onGlobe = 0;
let dataYear = null;
let generated = null;
let indicators = 0;
let sources = 0;

try {
  const { datos, calculo } = await cargarDatos();
  withData = Object.keys(datos.paises).length;
  countries = Object.values(calculo.paises).filter((p) => p.score != null).length;
  onGlobe = Object.values(calculo.paises)
    .filter((p) => p.score != null && p.lat != null && p.lng != null).length;
  dataYear = calculo.anioDatos;
  generated = datos.generado;
  indicators = Object.keys(datos.indicadores).length;
  sources = Object.keys(datos.fuentes).length;
} catch (err) {
  // Sin datos no se declara ninguna cobertura: las páginas muestran «—» en
  // vez de una cifra heredada que ya no respalda nada.
  console.warn('AETHER: no se ha podido contar la cobertura:', err && err.message);
}

export const AETHER_COVERAGE = {
  countries,
  withData,
  onGlobe,
  categories: 16,
  indicators,
  sources,
  dataYear,
  generated,
};
