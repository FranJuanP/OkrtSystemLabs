/**
 * Cálculo de las puntuaciones de riesgo de AETHER (T22).
 *
 * Hasta ahora las 3.264 puntuaciones del panel (204 países × 16 categorías)
 * estaban escritas a mano, y las 176 etiquetas del globo
 * (LOW/MEDIUM/HIGH/CRITICAL) también. No había forma de saber por qué España
 * tenía 42 en ECO y Portugal 47, porque no había ningún «por qué»: eran
 * números elegidos.
 *
 * Esto las calcula a partir de `data/latest.json`, que trae los datos con su
 * fuente, y de un método que se puede leer, discutir y rehacer. Está escrito
 * largo en METHODOLOGY.md; el resumen es:
 *
 *  1. Cada indicador se convierte en un PERCENTIL DE RIESGO de 0 a 100
 *     comparando cada país con todos los que tienen dato en ese indicador.
 *     Si el indicador declara que un valor alto es más riesgo, el percentil
 *     va en el mismo sentido; si declara lo contrario, se invierte.
 *
 *  2. La puntuación de una categoría es la media de los percentiles de sus
 *     indicadores disponibles, con los pesos de PESOS_INDICADOR.
 *
 *  3. La puntuación de un país es la media de sus categorías, con los pesos
 *     de PESOS_CATEGORIA.
 *
 *  4. Cada puntuación lleva una CONFIANZA (alta, media, baja) que depende de
 *     cuántos indicadores tenía de verdad y de lo viejos que son.
 *
 * Por qué percentiles y no normalizar al rango:
 *   Los indicadores no son comparables entre sí ni están en la misma escala.
 *   Las patentes de residentes van de 1 a 1.500.000; una normalización
 *   lineal pondría a China en 100 y a todos los demás por debajo de 2, con lo
 *   que el indicador dejaría de distinguir entre 190 países. El percentil es
 *   inmune a eso.
 *
 *   Consecuencia que conviene tener presente: el percentil solo mira el
 *   ORDEN. Si todos los países empeoran a la vez, los percentiles no se
 *   mueven. Es una medida de posición relativa, no absoluta, y eso está
 *   dicho en la propia página de metodología.
 *
 *   Y por eso el campo `escala: 'log'` del registro NO interviene aquí: el
 *   orden no cambia al tomar logaritmos. Solo sirve para presentar el número.
 */

/**
 * Peso de cada categoría en la puntuación de un país.
 *
 * Están todos a 1, y es una decisión, no un descuido: para poner la economía
 * por encima de los océanos hace falta una fuente que justifique cuánto por
 * encima, y no la hay. Antes que inventar una jerarquía con aire técnico, se
 * deja explícito que pesan igual y se publica esta tabla para que cambiarla
 * sea un cambio visible en un sitio.
 */
export const PESOS_CATEGORIA = {
  eco: 1, geo: 1, health: 1, climate: 1,
  social: 1, tech: 1, food: 1, mental: 1,
  energy: 1, demo: 1, urban: 1, science: 1,
  justice: 1, finance: 1, ocean: 1, bio: 1,
};

/**
 * Peso de indicadores concretos dentro de su categoría. Lo que no aparece
 * pesa 1.
 *
 * Las dos excepciones son índices compuestos que ya resumen varios
 * indicadores: el riesgo INFORM agrega amenaza, vulnerabilidad y capacidad
 * de respuesta, y la vulnerabilidad de ND-GAIN agrega 36 indicadores. Darles
 * el mismo peso que a un dato suelto los diluiría; dárselo doble refleja que
 * resumen más información que los demás.
 */
export const PESOS_INDICADOR = {
  inform_riesgo: 2,
  vulnerabilidad_clima: 2,
};

/** Umbrales de la etiqueta de riesgo. Son los del globo, que ya existían. */
export const NIVELES = [
  { max: 35, clave: 'LOW', etiqueta: 'BAJO' },
  { max: 55, clave: 'MEDIUM', etiqueta: 'MEDIO' },
  { max: 75, clave: 'HIGH', etiqueta: 'ALTO' },
  { max: Infinity, clave: 'CRITICAL', etiqueta: 'CRÍTICO' },
];

/** La etiqueta que corresponde a una puntuación de 0 a 100. */
export function nivelDe(score) {
  for (const n of NIVELES) if (score <= n.max) return n;
  return NIVELES[NIVELES.length - 1];
}

/**
 * Percentil de riesgo de cada país en un indicador.
 *
 * Se usa la función de distribución empírica con media de empates: un país
 * que empata con otros tres queda en el centro del tramo que ocupan los
 * cuatro, no al principio ni al final. Con `n` países el resultado está en
 * (0, 100), nunca exactamente en 0 ni en 100, porque nadie está por debajo
 * de sí mismo.
 *
 * @param {Array<{iso:string, valor:number}>} observaciones
 * @param {'mas_riesgo'|'menos_riesgo'} direccion
 * @returns {Map<string, number>} iso3 -> percentil de riesgo (0-100)
 */
export function percentiles(observaciones, direccion) {
  const n = observaciones.length;
  const salida = new Map();
  if (!n) return salida;

  // El riesgo crece con el valor, o al contrario; se normaliza el signo aquí
  // para no repetir la condición en todo el cálculo.
  const signo = direccion === 'menos_riesgo' ? -1 : 1;
  const orden = observaciones
    .map((o) => ({ iso: o.iso, r: signo * o.valor }))
    .sort((a, b) => a.r - b.r);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && orden[j + 1].r === orden[i].r) j++;
    // Rango medio del grupo de empates, en el centro de su tramo.
    const p = ((i + j) / 2 + 0.5) / n * 100;
    for (let k = i; k <= j; k++) salida.set(orden[k].iso, p);
    i = j + 1;
  }
  return salida;
}

/**
 * Confianza de una puntuación.
 *
 * Dos cosas la bajan: que falten indicadores y que los que hay sean viejos.
 * Se devuelven las dos razones, no solo la etiqueta, para poder decir en la
 * interfaz POR QUÉ la confianza es baja en vez de limitarse a avisar.
 *
 * @param {number} presentes   indicadores con dato
 * @param {number} posibles    indicadores que podría haber tenido
 * @param {number[]} anios     año de cada dato presente
 * @param {number} anioActual
 */
export function confianzaDe(presentes, posibles, anios, anioActual) {
  if (!presentes) {
    return { nivel: 'ninguna', cobertura: 0, antiguedad: null, motivo: 'sin ningún dato' };
  }
  const cobertura = presentes / posibles;
  const ordenados = [...anios].sort((a, b) => a - b);
  const mediana = ordenados[Math.floor(ordenados.length / 2)];
  const antiguedad = anioActual - mediana;

  const motivos = [];
  if (cobertura < 0.8) motivos.push(`${presentes} de ${posibles} indicadores`);
  if (antiguedad > 4) motivos.push(`datos de ${mediana}`);

  let nivel = 'alta';
  if (cobertura < 0.5 || antiguedad > 8) nivel = 'baja';
  else if (cobertura < 0.8 || antiguedad > 4) nivel = 'media';

  return {
    nivel,
    cobertura: Math.round(cobertura * 100) / 100,
    antiguedad,
    anioMediano: mediana,
    motivo: motivos.join(' · ') || 'completo y reciente',
  };
}

/**
 * Calcula todo a partir del fichero de datos.
 *
 * @param {object} datos  el contenido de data/latest.json
 * @returns {{
 *   generado: string, anioDatos: number,
 *   indicadores: Record<string, {percentiles: Map<string,number>, observaciones: number}>,
 *   paises: Record<string, {
 *     nombre: string, score: number, nivel: object, confianza: object,
 *     categorias: Record<string, {score: number, confianza: object, indicadores: Array}>
 *   }>
 * }}
 */
export function calcular(datos) {
  if (!datos || !datos.indicadores || !datos.paises) {
    throw new Error('scoring: el fichero de datos no tiene la forma esperada');
  }

  const anioActual = new Date(datos.generado || Date.now()).getUTCFullYear();
  const categorias = (datos.categorias || []).map((c) => c.key);

  // ── 1. Percentiles por indicador ─────────────────────────────────────────
  const porIndicador = {};
  for (const [id, meta] of Object.entries(datos.indicadores)) {
    const obs = [];
    for (const [iso, pais] of Object.entries(datos.paises)) {
      const d = pais.indicadores && pais.indicadores[id];
      if (d && Number.isFinite(d.value)) obs.push({ iso, valor: d.value });
    }
    porIndicador[id] = {
      // Los ambiguos se muestran pero no puntúan, así que no hace falta
      // ordenarlos: no tienen un sentido de riesgo que ordenar.
      percentiles: meta.direccion === 'ambiguo' ? new Map() : percentiles(obs, meta.direccion),
      observaciones: obs.length,
    };
  }

  // ── 2 y 3. Categorías y países ───────────────────────────────────────────
  /**
   * Percentil de un valor que NO está en la muestra, interpolando en la
   * distribución de los países. Lo necesitan los agregados (el mundo, la
   * Unión Europea): tienen que poder situarse frente a los países sin
   * contarse entre ellos, porque el mundo es la media de todos y meterlo en
   * la muestra desplazaría el centro de todas las comparaciones.
   */
  function percentilExterno(id, valor) {
    const meta = datos.indicadores[id];
    if (!meta || meta.direccion === 'ambiguo' || !Number.isFinite(valor)) return null;
    const signo = meta.direccion === 'menos_riesgo' ? -1 : 1;
    const muestra = [];
    for (const pais of Object.values(datos.paises)) {
      const d = pais.indicadores && pais.indicadores[id];
      if (d && Number.isFinite(d.value)) muestra.push(signo * d.value);
    }
    if (!muestra.length) return null;
    const r = signo * valor;
    let menores = 0;
    let iguales = 0;
    for (const v of muestra) {
      if (v < r) menores++;
      else if (v === r) iguales++;
    }
    return ((menores + iguales / 2) / muestra.length) * 100;
  }

  /** Calcula las 16 categorías y la puntuación de una entrada cualquiera. */
  function puntuar(iso, entrada, externo) {
    const resultadoCats = {};

    for (const cat of categorias) {
      const delCat = Object.entries(datos.indicadores).filter(([, m]) => m.categoria === cat);
      const puntuables = delCat.filter(([, m]) => m.direccion !== 'ambiguo');

      let suma = 0;
      let pesos = 0;
      const anios = [];
      const detalle = [];

      for (const [id, meta] of delCat) {
        const d = entrada.indicadores && entrada.indicadores[id];
        if (!d) continue;
        const p = externo
          ? percentilExterno(id, d.value)
          : porIndicador[id].percentiles.get(iso);
        const peso = PESOS_INDICADOR[id] || 1;
        if (meta.direccion !== 'ambiguo' && Number.isFinite(p)) {
          suma += p * peso;
          pesos += peso;
          anios.push(d.year);
        }
        detalle.push({
          id,
          etiqueta: meta.etiqueta,
          value: d.value,
          unit: d.unit,
          year: d.year,
          source: d.source,
          url: d.url,
          nota: meta.nota || null,
          decimales: meta.decimales,
          riesgo: meta.direccion === 'ambiguo' ? null : (Number.isFinite(p) ? Math.round(p) : null),
          puntua: meta.direccion !== 'ambiguo',
        });
      }

      const score = pesos ? suma / pesos : null;
      resultadoCats[cat] = {
        score: score === null ? null : Math.round(score),
        confianza: confianzaDe(anios.length, puntuables.length, anios, anioActual),
        indicadores: detalle,
      };
    }

    let suma = 0;
    let pesos = 0;
    const aniosPais = [];
    let catsConDato = 0;
    for (const cat of categorias) {
      const r = resultadoCats[cat];
      if (r.score === null) continue;
      const peso = PESOS_CATEGORIA[cat] != null ? PESOS_CATEGORIA[cat] : 1;
      suma += r.score * peso;
      pesos += peso;
      catsConDato++;
      if (r.confianza.anioMediano) aniosPais.push(r.confianza.anioMediano);
    }
    const score = pesos ? Math.round(suma / pesos) : null;

    return {
      nombre: entrada.nombre,
      iso2: entrada.iso2,
      region: entrada.region,
      lat: entrada.lat != null ? entrada.lat : null,
      lng: entrada.lng != null ? entrada.lng : null,
      capital: entrada.capital || null,
      score,
      nivel: score === null ? null : nivelDe(score),
      confianza: confianzaDe(catsConDato, categorias.length, aniosPais, anioActual),
      categorias: resultadoCats,
    };
  }

  const paises = {};
  for (const [iso, pais] of Object.entries(datos.paises)) {
    paises[iso] = puntuar(iso, pais, false);
  }

  const agregados = {};
  for (const [iso, entrada] of Object.entries(datos.agregados || {})) {
    agregados[iso] = puntuar(iso, entrada, true);
  }

  // ── 4. Posición de cada país en el conjunto ──────────────────────────────
  // La puntuación compuesta es una media de percentiles, y eso la comprime
  // hacia el centro: con 16 categorías el rango real va de 27 a 74, no de 0 a
  // 100. Decir «74» sin más invita a leerlo como «74 de 100 de riesgo
  // posible», que no es lo que mide. Se añade el puesto del país entre los
  // que tienen puntuación, que sí es interpretable.
  const conScore = Object.entries(paises).filter(([, p]) => p.score !== null);
  const ordenados = conScore.slice().sort((a, b) => b[1].score - a[1].score);
  ordenados.forEach(([iso], i) => {
    paises[iso].puesto = i + 1;
    paises[iso].deTotal = ordenados.length;
  });

  // La categoría con más riesgo de cada país, que es lo que de verdad
  // distingue a Ucrania de Bélgica: la media de 16 categorías las acerca, el
  // máximo las separa.
  //
  // Con una condición que hubo que añadir al ver el resultado: para titular,
  // la categoría necesita AL MENOS DOS indicadores con dato. Sin esa regla,
  // la categoría destacada de Ucrania salía «salud mental», porque esa
  // categoría tiene un solo indicador (la tasa de suicidio, de 2021) y un
  // percentil suelto es mucho más extremo que una media de cuatro. Con la
  // regla sale «geopolítica», que es lo que miden sus datos: amenaza humana
  // 10 sobre 10 y población desarraigada 10 sobre 10.
  //
  // La categoría de un indicador sigue puntuando y mostrándose; lo que no
  // hace es encabezar la ficha de un país apoyada en un dato único.
  for (const [, p] of conScore) {
    let peor = null;
    for (const [cat, r] of Object.entries(p.categorias)) {
      if (r.score === null) continue;
      const conDato = r.indicadores.filter((i) => i.puntua && i.riesgo !== null).length;
      if (conDato < 2) continue;
      if (!peor || r.score > peor.score) peor = { cat, score: r.score, indicadores: conDato };
    }
    // Si ninguna categoría llega a dos indicadores, mejor no destacar nada
    // que destacar lo que se apoye en uno.
    p.peorCategoria = peor;
  }

  // El año que se muestra como «datos de»: el más común entre los datos, que
  // describe el conjunto mejor que el máximo (siempre habría alguno de este
  // año) o que el mínimo (siempre habría alguno de los noventa).
  const cuenta = new Map();
  for (const pais of Object.values(datos.paises)) {
    for (const d of Object.values(pais.indicadores || {})) {
      cuenta.set(d.year, (cuenta.get(d.year) || 0) + 1);
    }
  }
  const anioDatos = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    generado: datos.generado,
    anioDatos: anioDatos ? anioDatos[0] : anioActual,
    indicadores: porIndicador,
    paises,
    agregados,
  };
}
