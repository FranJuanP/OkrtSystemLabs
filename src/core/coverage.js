/**
 * AETHER · cobertura declarada (T9)
 *
 * Un único sitio para la cifra de países, que antes aparecía con cuatro
 * valores distintos según la pantalla: 202 en el README, la portada y el
 * pie; 195 en el panel de chat y en la cabecera del globo; y 173 calculado
 * en tiempo de ejecución por el propio globo a partir de su tabla.
 *
 * El número correcto es el recuento de entradas reales de `DATA` en el
 * motor, excluyendo las tres que no son países:
 *
 *   204 entradas
 *   −  WLD   (agregado mundial)
 *   −  EUU   (agregado de la Unión Europea)
 *   −  MKD2  (duplicado de MKD, Macedonia del Norte)
 *   = 201 países
 *
 * tests/coverage.mjs comprueba contra el motor que esta constante sigue
 * coincidiendo con el recuento real, para que no se vuelvan a separar.
 *
 * La Fase 3 lo calcula desde data/latest.json y esta constante desaparece.
 */
export const AETHER_COVERAGE = {
  /** Países con puntuación en DATA (sin WLD, EUU ni el duplicado MKD2). */
  countries: 201,
  /** Entradas totales de DATA, agregados incluidos. */
  dataEntries: 204,
  /** Claves de DATA que no son países. */
  nonCountryKeys: ['WLD', 'EUU', 'MKD2'],
  /** Categorías de riesgo. */
  categories: 16,
  /** Año aproximado de los datos base. Pendiente de verificar; ver T22. */
  dataYear: 2023,
};
