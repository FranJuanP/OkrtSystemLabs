/**
 * Los países del globo salen del fichero de datos (T23).
 *
 * El globo llevaba su propia tabla `COUNTRIES` de 176 entradas escritas a
 * mano, con cuatro campos inventados cada una:
 *
 *   { name:"Alemania", lat:51.16, lng:10.45, risk:"MEDIUM",
 *     cat:"ENERGÍA INDUSTRIAL",
 *     signal:"Reconfiguración de dependencia energética impactando cadena
 *             de suministro industrial. Recesión técnica activa." }
 *
 * Nada de eso tenía fuente. Y, lo que es peor, el panel y el globo se
 * contradecían: el mismo país podía salir MEDIUM en un sitio y HIGH en el
 * otro, porque eran dos tablas distintas mantenidas por separado.
 *
 * Ahora las dos páginas leen `data/latest.json` y calculan con
 * `src/core/scoring.js`, de modo que no pueden discrepar: el nivel de riesgo
 * de un país es el mismo número en los dos sitios por construcción, y
 * `tests/paridad.mjs` lo comprueba país a país.
 *
 * Qué sustituye a cada campo:
 *   name    el nombre que publica el Banco Mundial en español
 *   lat/lng las coordenadas de la capital, que publica el Banco Mundial
 *   risk    el nivel que sale de la puntuación compuesta
 *   cat     la categoría de mayor riesgo del país
 *   signal  un resumen generado con sus datos, con cifra, fuente y año
 *
 * El `signal` escrito a mano desaparece. Era texto de opinión sin autoría ni
 * fecha («Ciclos de activación social predecibles», «Instituciones débiles»),
 * del mismo tipo que el que la Fase 1 quitó de Signal.
 */

import { formatearValor } from '../core/datos.js';

/**
 * Nombres con los que TENSION_ARCS nombra a los países, y su ISO3.
 *
 * Los arcos de tensión son una capa editorial aparte: describen relaciones
 * entre países y no se calculan de ningún dato. Se quedan, pero antes
 * emparejaban por nombre con la tabla COUNTRIES, y los nombres del Banco
 * Mundial no son los mismos («Federación de Rusia» frente a «Rusia»). Esta
 * tabla traduce los 58 extremos que usan los 92 arcos.
 */
export const ISO_DE_ARCO = {
  'Afganistán': 'AFG', 'Alemania': 'DEU', 'Arabia Saudí': 'SAU', 'Argelia': 'DZA',
  'Armenia': 'ARM', 'Australia': 'AUS', 'Azerbaiyán': 'AZE', 'Bielorrusia': 'BLR',
  'Burkina Faso': 'BFA', 'China': 'CHN', 'Colombia': 'COL', 'Corea del Norte': 'PRK',
  'Corea del Sur': 'KOR', 'Cuba': 'CUB', 'EE.UU.': 'USA', 'Emiratos Árabes': 'ARE',
  'Eritrea': 'ERI', 'Estonia': 'EST', 'Etiopía': 'ETH', 'Filipinas': 'PHL',
  'Finlandia': 'FIN', 'Francia': 'FRA', 'Grecia': 'GRC', 'Hungría': 'HUN',
  'India': 'IND', 'Iraq': 'IRQ', 'Irán': 'IRN', 'Israel': 'ISR',
  'Italia': 'ITA', 'Japón': 'JPN', 'Kazajistán': 'KAZ', 'Kosovo': 'XKX',
  'Libia': 'LBY', 'Líbano': 'LBN', 'Mali': 'MLI', 'Marruecos': 'MAR',
  'Myanmar': 'MMR', 'Noruega': 'NOR', 'Níger': 'NER', 'Pakistán': 'PAK',
  'Palestina': 'PSE', 'Polonia': 'POL', 'Qatar': 'QAT', 'RDC': 'COD',
  'Reino Unido': 'GBR', 'República Centroafricana': 'CAF', 'Ruanda': 'RWA',
  'Rusia': 'RUS', 'Serbia': 'SRB', 'Siria': 'SYR', 'Somalia': 'SOM',
  'Sudán': 'SDN', 'Sudán del Sur': 'SSD', 'Taiwán': 'TWN', 'Turquía': 'TUR',
  'Ucrania': 'UKR', 'Venezuela': 'VEN', 'Yemen': 'YEM',
};

/** Nombre corto para la etiqueta del globo, donde no cabe el nombre largo. */
const NOMBRE_CORTO = {
  USA: 'EE.UU.', RUS: 'Rusia', PRK: 'Corea del Norte', KOR: 'Corea del Sur',
  COD: 'RDC', CAF: 'Rep. Centroafricana', ARE: 'Emiratos Árabes',
  VEN: 'Venezuela', IRN: 'Irán', EGY: 'Egipto', SYR: 'Siria',
  LAO: 'Laos', VNM: 'Vietnam', BRN: 'Brunéi', MKD: 'Macedonia del Norte',
  CIV: 'Costa de Marfil', SVK: 'Eslovaquia', CZE: 'Chequia',
  TZA: 'Tanzania', FSM: 'Micronesia', BHS: 'Bahamas', GMB: 'Gambia',
  KGZ: 'Kirguistán', MDA: 'Moldavia', PSE: 'Palestina', HKG: 'Hong Kong',
  YEM: 'Yemen', SOM: 'Somalia', LBY: 'Libia', SDN: 'Sudán',
  GBR: 'Reino Unido', IRQ: 'Iraq', LBN: 'Líbano', BOL: 'Bolivia',
};

/**
 * Convierte la salida de `calcular()` en la lista que el globo dibuja.
 *
 * @param {object} datos    contenido de data/latest.json
 * @param {object} calculo  salida de calcular()
 * @returns {Array<object>} un elemento por país con coordenadas y puntuación
 */
export function construirPaisesGlobo(datos, calculo) {
  const etiquetas = new Map((datos.categorias || []).map((c) => [c.key, c.etiqueta]));
  const nombresCat = new Map((datos.categorias || []).map((c) => [c.key, c.nombre]));
  const fuera = [];
  const lista = [];

  for (const [iso, p] of Object.entries(calculo.paises)) {
    // Sin coordenadas no se puede colocar el marcador, y sin puntuación no
    // hay nada que colocar. Se cuentan los descartes para poder decirlo.
    if (p.lat == null || p.lng == null) { fuera.push(`${iso} (sin coordenadas)`); continue; }
    if (p.score == null || !p.nivel) { fuera.push(`${iso} (sin puntuación)`); continue; }

    const peor = p.peorCategoria;
    const cat = peor
      ? (etiquetas.get(peor.cat) || peor.cat).toUpperCase()
      : 'SIN CATEGORÍA DESTACADA';

    lista.push({
      iso,
      name: NOMBRE_CORTO[iso] || p.nombre,
      nombreCompleto: p.nombre,
      lat: p.lat,
      lng: p.lng,
      risk: p.nivel.clave,
      score: p.score,
      puesto: p.puesto,
      deTotal: p.deTotal,
      confianza: p.confianza,
      cat,
      signal: resumen(p, peor, nombresCat),
    });
  }

  lista.sort((a, b) => b.score - a.score);
  return { lista, fuera };
}

/**
 * El texto del panel, construido con los datos del país.
 *
 * Sustituye a la prosa escrita a mano. Dice tres cosas comprobables: dónde
 * está el país en el conjunto, qué dominio tiene peor y con qué dato
 * concreto, y qué confianza tiene esa lectura.
 */
function resumen(p, peor, nombresCat) {
  const partes = [];
  partes.push(`Riesgo compuesto ${p.score} sobre 100, puesto ${p.puesto} de ${p.deTotal} países.`);

  if (peor) {
    const cat = p.categorias[peor.cat];
    const nombre = (nombresCat.get(peor.cat) || peor.cat).toLowerCase();
    partes.push(`Su dominio de mayor riesgo es ${nombre} (${peor.score}).`);
    // El indicador que más empuja esa categoría, con su cifra y su fuente.
    const peorInd = (cat.indicadores || [])
      .filter((i) => i.puntua && typeof i.riesgo === 'number')
      .sort((a, b) => b.riesgo - a.riesgo)[0];
    if (peorInd) {
      const cifra = formatearValor(peorInd.value, peorInd.decimales != null ? peorInd.decimales : 1);
      partes.push(`${peorInd.etiqueta}: ${cifra} ${peorInd.unit} (${peorInd.source}, ${peorInd.year}).`);
    }
  }

  if (p.confianza && p.confianza.nivel !== 'alta') {
    partes.push(`Confianza ${p.confianza.nivel}: ${p.confianza.motivo}.`);
  }
  return partes.join(' ');
}
