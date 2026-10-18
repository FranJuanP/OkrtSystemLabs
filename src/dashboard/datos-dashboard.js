/**
 * Puente entre el fichero de datos y la tabla DATA del motor del panel (T23).
 *
 * El motor espera una estructura muy concreta, la que tenía escrita a mano:
 *
 *   DATA[ISO3] = {
 *     name: 'España',
 *     eco:  { score: 51, inds: [ { n: 'Inflación', v: '2,4 % anual', risk: 38 }, … ] },
 *     geo:  { … }, …
 *   }
 *
 * Esa forma se mantiene: cambiar las 30 lecturas de `DATA[...]` repartidas por
 * un motor de 4.478 líneas habría sido mucho más arriesgado que rellenar la
 * misma estructura con datos de verdad. Lo que cambia es de dónde salen los
 * números: antes eran 3.264 puntuaciones y 1.600 indicadores elegidos a mano;
 * ahora salen de `data/latest.json` y del cálculo de `src/core/scoring.js`.
 *
 * Tres decisiones que afectan a lo que se ve:
 *
 *  - Una categoría sin ningún indicador con dato NO se incluye. El motor ya
 *    sabe saltarse las categorías que faltan (`if(!cat) return;`), así que una
 *    tarjeta vacía es mejor que una tarjeta con un número inventado.
 *
 *  - Los indicadores que no puntúan (fecundidad, saldo migratorio…) sí se
 *    muestran, pero con `risk: null`, para que no reciban un color de riesgo
 *    que no se puede justificar.
 *
 *  - Un país sin NINGÚN dato (Taiwán es el único del selector) se marca con
 *    `sinDatos` y su motivo. Antes el selector lo ofrecía con cifras escritas
 *    a mano; ahora dice que no hay fuente oficial, que es lo que ocurre.
 */
import { formatearValor } from '../core/datos.js';

/** Nombre legible de un territorio sin datos, si lo conocemos por otra vía. */
export const NOMBRES_SIN_FUENTE = {
  TWN: 'Taiwán',
  ESH: 'Sáhara Occidental',
  GUF: 'Guayana Francesa',
};

/** Texto que se muestra en la ficha de cada indicador. */
function valorLegible(ind) {
  const n = formatearValor(ind.value, ind.decimales != null ? ind.decimales : 1);
  if (!ind.unit) return n;
  // Los porcentajes y las unidades cortas se pegan al número; el resto va
  // separado, como estaba antes («2,4 % anual», «83,2 años»).
  return `${n} ${ind.unit}`;
}

/**
 * @param {object} datos    contenido de data/latest.json
 * @param {object} calculo  salida de calcular()
 * @returns {Record<string, object>} la tabla DATA que consume el motor
 */
export function construirDATA(datos, calculo) {
  const DATA = {};
  const claves = (datos.categorias || []).map((c) => c.key);

  const montar = (iso, p) => {
    const entrada = {
      name: p.nombre,
      score: p.score,
      nivel: p.nivel ? p.nivel.clave : null,
      puesto: p.puesto || null,
      deTotal: p.deTotal || null,
      confianza: p.confianza,
      peorCategoria: p.peorCategoria || null,
      // Si el nivel lo impone el umbral de conflicto del UCDP, la ficha
      // tiene que decirlo: el numero del indice no lo explica por si solo.
      elevadoPorConflicto: p.elevadoPorConflicto || null,
      conflicto: p.conflicto || null,
      lat: p.lat,
      lng: p.lng,
    };

    let conDato = 0;
    for (const cat of claves) {
      const r = p.categorias[cat];
      if (!r || r.score === null) continue;
      conDato++;
      entrada[cat] = {
        score: r.score,
        confianza: r.confianza,
        inds: r.indicadores.map((i) => ({
          n: i.etiqueta,
          v: valorLegible(i),
          risk: i.riesgo,
          year: i.year,
          source: i.source,
          url: i.url,
          nota: i.nota || null,
          puntua: i.puntua,
        })),
      };
    }

    if (!conDato) {
      entrada.sinDatos = true;
      entrada.motivo = (datos.sin_fuente && datos.sin_fuente[iso])
        || 'No hay serie oficial comparable en ninguna de las fuentes.';
    }
    return entrada;
  };

  for (const [iso, p] of Object.entries(calculo.paises)) DATA[iso] = montar(iso, p);
  for (const [iso, p] of Object.entries(calculo.agregados || {})) DATA[iso] = montar(iso, p);

  // Los territorios que el panel ofrece y para los que no hay ninguna fuente
  // entran igualmente, marcados: el selector los sigue listando y la ficha
  // explica por qué está vacía, en vez de caer en las cifras de «Global».
  for (const [iso, motivo] of Object.entries(datos.sin_fuente || {})) {
    if (DATA[iso]) continue;
    DATA[iso] = {
      name: NOMBRES_SIN_FUENTE[iso] || iso,
      score: null,
      nivel: null,
      confianza: { nivel: 'ninguna', motivo: 'sin ningún dato' },
      sinDatos: true,
      motivo,
      lat: null,
      lng: null,
    };
  }

  return DATA;
}

