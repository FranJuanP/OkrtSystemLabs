/**
 * Descarga de indicadores del Banco Mundial (T21).
 *
 * Cubre tres catálogos distintos que viven en la misma API con números de
 * fuente diferentes:
 *   WDI (source 2)   los indicadores de desarrollo, el grueso
 *   WGI (source 3)   gobernanza; los códigos cambiaron y ahora son
 *                    GOV_WGI_PV.EST y compañía. Los antiguos (PV.EST) dan
 *                    «The indicator was not found. It may have been deleted
 *                    or archived», que es justo lo que le pasaría a este
 *                    pipeline en silencio si no lo comprobara.
 *   UHC (source 58)  cobertura sanitaria universal
 *
 * Detalle que obliga a pedir los países uno a uno (bueno, en tandas): con
 * `country/all` y una fuente que no sea la 2, la API devuelve el campo
 * `countryiso3code` VACÍO, solo el nombre del país. Emparejar por nombre es
 * pedir que algún día «Turkiye» o «Congo, Dem. Rep.» metan un dato en el país
 * equivocado, así que se piden los códigos explícitos en tandas de 55 y la
 * respuesta trae el ISO3 de vuelta.
 *
 * Se piden los últimos valores de cada país, no solo el más reciente: hacen
 * falta DOS para saber hacia dónde se mueve un indicador, que es de donde
 * sale la velocidad de cada categoría (antes era una tabla escrita a mano
 * con diez países). El más reciente de cada país puede ser de un año distinto
 * al de su vecino; el año se guarda dato a dato precisamente por eso, y
 * METHODOLOGY.md explica qué implica comparar años distintos.
 */
import { pedir, trozos } from './http.mjs';

const BASE = 'https://api.worldbank.org/v2';

/**
 * La API está traducida: `/v2/es/...` devuelve los nombres de país y de
 * región en español («España», «Mundo», «Países Bajos»). Se usa para la lista
 * de países, porque esos nombres son los que se muestran en la interfaz; los
 * valores numéricos son los mismos en cualquier idioma.
 */
const BASE_ES = 'https://api.worldbank.org/v2/es';

/** Número de fuente de la API para cada catálogo del registro. */
const SOURCE = { wb: 2, wgi: 3, uhc: 58 };

/** Tandas de 55: la API acepta listas largas, pero no ilimitadas. */
const TANDA = 55;

/**
 * Lista de países del Banco Mundial. Los agregados (mundo, UE, «ingreso
 * alto»...) se distinguen porque su región es 'NA'; se devuelven aparte
 * porque el panel sí usa algunos como referencia.
 */
export async function listaPaises() {
  const j = await pedir(`${BASE_ES}/country?format=json&per_page=400`);
  const filas = j[1] || [];
  const paises = [];
  const agregados = [];
  for (const c of filas) {
    const fila = {
      iso3: c.id,
      iso2: c.iso2Code,
      nombre: c.name,
      region: c.region && c.region.value,
      ingreso: c.incomeLevel && c.incomeLevel.value,
      // Coordenadas de la capital, que publica el propio Banco Mundial. Son
      // las que usa el globo para colocar cada marcador (T23); antes el globo
      // llevaba su propia tabla de 176 pares lat/lng escritos a mano.
      capital: c.capitalCity || null,
      lat: c.latitude === '' || c.latitude == null ? null : Number(c.latitude),
      lng: c.longitude === '' || c.longitude == null ? null : Number(c.longitude),
    };
    (c.region && c.region.id === 'NA' ? agregados : paises).push(fila);
  }
  return { paises, agregados };
}

/**
 * Cuántos años recientes se piden por país.
 *
 * Cuidado con este número: `MRV` cuenta AÑOS DE CALENDARIO, no valores con
 * dato. Con 8 se perdían indicadores dispersos —la deuda pública central
 * cayó del 50 % de cobertura al 28 %, porque en muchos países su último dato
 * es de hace más de ocho años—. Con 40 se recupera lo que daba `mrnev`, que
 * buscaba el último valor no vacío sin límite de antigüedad.
 */
const VALORES_RECIENTES = 40;

/**
 * Los dos valores no vacíos más recientes de un indicador, por país.
 *
 * Devuelve el último y, si existe, el anterior con su año. Con esos dos se
 * calcula la velocidad de la categoría; sin el anterior, ese indicador
 * simplemente no aporta tendencia.
 *
 * @param {string} codigo  código del indicador
 * @param {string[]} iso3  países a pedir
 * @param {'wb'|'wgi'|'uhc'} catalogo
 * @returns {Promise<{valores: Map<string,{valor:number,anio:number,previo:?{valor:number,anio:number}}>, nombre:string, actualizado:string}>}
 */
export async function ultimoValor(codigo, iso3, catalogo = 'wb') {
  const source = SOURCE[catalogo];
  const porPais = new Map();
  let nombre = '';
  let actualizado = '';

  for (const tanda of trozos(iso3, TANDA)) {
    const url =
      `${BASE_ES}/country/${tanda.join(';')}/indicator/${encodeURIComponent(codigo)}` +
      `?format=json&per_page=${TANDA * VALORES_RECIENTES * 2}&MRV=${VALORES_RECIENTES}&source=${source}`;
    const j = await pedir(url, { timeoutMs: 60000 });

    // La API contesta 200 con un mensaje de error dentro del cuerpo cuando el
    // indicador no existe. Hay que mirarlo o el indicador se queda vacío sin
    // que nadie se entere.
    if (Array.isArray(j) && j[0] && j[0].message) {
      const m = j[0].message[0] || {};
      throw new Error(`${codigo}: ${m.key || ''} ${m.value || ''}`.trim());
    }
    if (j[0] && j[0].lastupdated) actualizado = j[0].lastupdated;

    for (const fila of j[1] || []) {
      if (fila.value == null) continue;
      const iso = fila.countryiso3code;
      if (!iso) continue;
      const anio = Number(fila.date);
      if (!Number.isFinite(anio)) continue;
      if (!porPais.has(iso)) porPais.set(iso, []);
      porPais.get(iso).push({ valor: Number(fila.value), anio });
      if (!nombre && fila.indicator) nombre = fila.indicator.value;
    }
  }

  // De cada país, el más reciente y el anterior a ese.
  const valores = new Map();
  for (const [iso, lista] of porPais) {
    lista.sort((a, b) => b.anio - a.anio);
    const ultimo = lista[0];
    const previo = lista.find((x) => x.anio < ultimo.anio) || null;
    valores.set(iso, { valor: ultimo.valor, anio: ultimo.anio, previo });
  }

  return { valores, nombre, actualizado };
}
