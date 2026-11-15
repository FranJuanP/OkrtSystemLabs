/**
 * A qué país pertenece cada evento de Signal (fase eventos por país).
 *
 * El globo y el panel necesitan saber qué eventos tocan a un país para
 * ponerlos junto a su puntuación. Las fuentes no lo dicen de una forma común:
 *
 *   USGS    `place` en inglés: «95 km SSE of Hachijo-jima, Japan»
 *   EONET   el título: «Wildfire in Hinds County, Mississippi»
 *   OMS     el título: «Avian Influenza A(H5N1) - Cambodia»
 *   GDACS   una lista de países separada por comas
 *   GDELT   `sourcecountry`, que es el país del MEDIO que publica la noticia,
 *           no el del suceso. Un diario británico que cuenta algo de Sudán
 *           tiene sourcecountry «United Kingdom». Asignarlo a Reino Unido
 *           sería falso, así que GDELT no se asigna a ningún país.
 *
 * Se busca el nombre del país como palabra completa en el texto de cada
 * fuente, empezando por los nombres más largos y tachando lo que ya ha
 * casado: así «Papua New Guinea» no se cuenta además como «Guinea», ni
 * «South Sudan» como «Sudan». Un evento sin país reconocible (una dorsal
 * oceánica, un iceberg) se queda sin país: mejor eso que inventarle uno.
 *
 * Es un módulo puro, sin DOM, porque lo usa el trabajo que escribe
 * `data/events.json` (tools/fetch-events.mjs) y lo prueban las unitarias.
 */

/**
 * Nombres en inglés que no coinciden con los de Intl.DisplayNames, o que las
 * fuentes escriben de otra manera. La clave va ya normalizada.
 */
const ALIAS = {
  'usa': 'USA', 'u s a': 'USA', 'united states of america': 'USA',
  'uk': 'GBR', 'great britain': 'GBR', 'england': 'GBR', 'scotland': 'GBR',
  'wales': 'GBR', 'northern ireland': 'GBR',
  'russian federation': 'RUS',
  'iran islamic republic of': 'IRN', 'islamic republic of iran': 'IRN',
  'turkey': 'TUR', 'turkiye': 'TUR',
  'republic of korea': 'KOR', 'korea republic of': 'KOR',
  'democratic people s republic of korea': 'PRK', 'dprk': 'PRK',
  'viet nam': 'VNM',
  'syrian arab republic': 'SYR',
  'lao pdr': 'LAO', 'lao people s democratic republic': 'LAO',
  'democratic republic of the congo': 'COD', 'democratic republic of congo': 'COD',
  'dr congo': 'COD', 'drc': 'COD', 'congo kinshasa': 'COD',
  'republic of the congo': 'COG', 'republic of congo': 'COG', 'congo': 'COG',
  'congo brazzaville': 'COG',
  'ivory coast': 'CIV', 'cote d ivoire': 'CIV',
  'czech republic': 'CZE',
  'myanmar': 'MMR', 'burma': 'MMR',
  'cabo verde': 'CPV', 'cape verde': 'CPV',
  'east timor': 'TLS', 'timor leste': 'TLS',
  'swaziland': 'SWZ', 'eswatini': 'SWZ',
  'macedonia': 'MKD',
  'palestine': 'PSE', 'occupied palestinian territory': 'PSE', 'gaza': 'PSE',
  'gaza strip': 'PSE', 'west bank': 'PSE',
  'hong kong': 'HKG', 'macau': 'MAC', 'macao': 'MAC',
  'taiwan': 'TWN',
  'kosovo': 'XKX',
  'micronesia': 'FSM', 'federated states of micronesia': 'FSM',
  'the bahamas': 'BHS', 'bahamas': 'BHS', 'the gambia': 'GMB', 'gambia': 'GMB',
  'brunei': 'BRN', 'bolivia': 'BOL', 'venezuela': 'VEN', 'tanzania': 'TZA',
  'moldova': 'MDA', 'kyrgyzstan': 'KGZ', 'slovakia': 'SVK',
  'fiji islands': 'FJI', 'solomon islands': 'SLB',
};

/**
 * Estados de EEUU y territorios con nombre propio en USGS y EONET. USGS
 * escribe «..., Alaska» o «..., CA» sin decir «United States».
 */
const ESTADOS_EEUU = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'hawaii', 'idaho', 'illinois',
  'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri',
  'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
  'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
  'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
  'washington', 'west virginia', 'wisconsin', 'wyoming',
];
/** Las abreviaturas que USGS usa al final de `place` («..., CA»). */
const ABREV_EEUU = new Set([
  'ak', 'al', 'ar', 'az', 'ca', 'co', 'ct', 'de', 'fl', 'hi', 'id', 'il',
  'in', 'ks', 'ky', 'la', 'ma', 'md', 'me', 'mi', 'mn', 'mo', 'ms', 'mt',
  'nc', 'nd', 'ne', 'nh', 'nj', 'nm', 'nv', 'ny', 'oh', 'ok', 'or', 'pa',
  'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'va', 'vt', 'wa', 'wi', 'wv', 'wy',
]);

/** Minúsculas, sin tildes, «&» como «and» y todo lo demás como espacio. */
export function normalizarNombre(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Construye el diccionario nombre → ISO3 a partir de `latest.json`.
 *
 * Los nombres del fichero están en español (los publica así el Banco
 * Mundial) y las fuentes de eventos escriben en inglés, así que se usa el
 * nombre inglés que da Intl.DisplayNames para el ISO2 de cada país, más la
 * tabla de alias de arriba.
 *
 * @param {Record<string, {iso2?: string}>} paises  `latest.json`.paises
 * @returns {Map<string, string>}
 */
export function crearDiccionario(paises) {
  const dic = new Map();
  const poner = (nombre, iso3) => {
    const k = normalizarNombre(nombre);
    if (k && !dic.has(k)) dic.set(k, iso3);
  };

  for (const [k, iso3] of Object.entries(ALIAS)) dic.set(k, iso3);

  let en = null;
  try { en = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (_e) { en = null; }

  for (const [iso3, p] of Object.entries(paises || {})) {
    if (!p || !p.iso2 || !en) continue;
    let nombre = '';
    try { nombre = en.of(String(p.iso2).toUpperCase()) || ''; } catch (_e) { nombre = ''; }
    // Intl devuelve el propio código cuando no conoce la región.
    if (!nombre || nombre.toUpperCase() === String(p.iso2).toUpperCase()) continue;
    poner(nombre, iso3);
    // «St. Lucia» y «Saint Lucia» conviven en las fuentes.
    if (/\bst\b/.test(normalizarNombre(nombre))) {
      poner(normalizarNombre(nombre).replace(/\bst\b/g, 'saint'), iso3);
    }
    // «Myanmar (Burma)», «Congo - Kinshasa»: también la parte antes del
    // paréntesis o del guion, si no es ambigua.
    const corto = nombre.split(/\s[(-]/)[0];
    if (corto !== nombre && corto.length > 3 && normalizarNombre(corto) !== 'congo') poner(corto, iso3);
  }

  for (const e of ESTADOS_EEUU) if (!dic.has(e)) dic.set(e, 'USA');
  return dic;
}

/** Claves del diccionario de la más larga a la más corta, memorizadas. */
const ordenadas = new WeakMap();
function clavesPorLongitud(dic) {
  let k = ordenadas.get(dic);
  if (!k) {
    k = Array.from(dic.keys()).sort((a, b) => b.length - a.length);
    ordenadas.set(dic, k);
  }
  return k;
}

/**
 * Todos los países que se nombran en `texto`, en orden de aparición.
 *
 * @param {string} texto
 * @param {Map<string, string>} dic  de `crearDiccionario`
 * @returns {string[]} ISO3 sin repetir
 */
export function paisesEnTexto(texto, dic) {
  let t = ' ' + normalizarNombre(texto) + ' ';
  if (t.trim() === '') return [];
  const hallados = [];

  // «..., CA» al final: abreviatura de estado de EEUU.
  const ultimo = t.trim().split(' ').pop();
  const crudo = String(texto || '').trim();
  if (ABREV_EEUU.has(ultimo) && /,\s*[A-Z]{2}$/.test(crudo)) {
    hallados.push({ pos: t.length, iso: 'USA' });
    t = t.slice(0, t.length - ultimo.length - 1) + ' '.repeat(ultimo.length + 1);
  }

  /* Georgia es un país y un estado de EEUU. En EONET los incendios de EEUU
     llevan «County»; si lo hay, es el estado. */
  const esEEUU = /\bcounty\b|\bunited states\b|\busa\b/.test(t);

  for (const clave of clavesPorLongitud(dic)) {
    const aguja = ' ' + clave + ' ';
    let i = t.indexOf(aguja);
    while (i !== -1) {
      let iso = dic.get(clave);
      if (clave === 'georgia' && esEEUU) iso = 'USA';
      hallados.push({ pos: i, iso });
      // Se tacha para que una clave más corta no vuelva a casar dentro.
      t = t.slice(0, i + 1) + ' '.repeat(clave.length) + t.slice(i + 1 + clave.length);
      i = t.indexOf(aguja);
    }
  }

  hallados.sort((a, b) => a.pos - b.pos);
  return Array.from(new Set(hallados.map((h) => h.iso)));
}

/**
 * Los países de un evento ya normalizado, según su fuente.
 *
 * @param {{fuente?: string, source?: string, title?: string, location?: string}} ev
 * @param {Map<string, string>} dic
 * @returns {string[]} ISO3
 */
export function paisesDeEvento(ev, dic) {
  if (!ev) return [];
  const fuente = String(ev.fuente || ev.source || '').toLowerCase();
  // Ver la cabecera: el país de GDELT es el del medio, no el del suceso.
  if (fuente.startsWith('gdelt')) return [];
  if (fuente === 'usgs' || fuente === 'gdacs' || fuente === 'relief') {
    return paisesEnTexto(ev.location, dic);
  }
  if (fuente === 'who' || fuente.startsWith('oms')) {
    const p = paisesEnTexto(ev.location, dic);
    return p.length ? p : paisesEnTexto(ev.title, dic);
  }
  // EONET y cualquier fuente nueva: el título es lo que nombra el lugar.
  return paisesEnTexto(ev.title, dic);
}
