/**
 * Muertos por violencia organizada, del UCDP (B-c).
 *
 * Era el hueco más visible del conjunto: la categoría GEO se apoyaba en la
 * estabilidad política de los WGI y en las dimensiones de INFORM, que son
 * índices compuestos y anuales. Sin un recuento de muertes por conflicto, una
 * guerra solo entraba de forma indirecta, y el resultado se notaba: Israel
 * salía en el puesto 194 de 217 y Ucrania en el 57.
 *
 * **No se usa la API**, que exige un token que hay que pedir por correo. Se
 * usan las descargas directas de <https://ucdp.uu.se/downloads/>, que son
 * CC BY 4.0 y no piden registro:
 *
 *   GED Global        años completos, 1989 hasta el último cerrado
 *   Candidate Events  el año en curso, actualizado cada mes
 *
 * Las versiones **no van fijas en el código**: se leen de la propia página de
 * descargas. UCDP publica una versión nueva de GED al año y una de Candidate
 * al mes, y dejar `ged261` escrito aquí sería garantizar que esto se queda
 * desfasado sin que nadie se entere.
 *
 * Dos medidas por país:
 *
 *   muertos12m    los últimos doce meses, contados hacia atrás desde la
 *                 última fecha que trae Candidate
 *   media3anios   la media de los tres últimos años completos de GED
 *
 * La primera dice qué está pasando ahora; la segunda, si es algo reciente o
 * sostenido. Las dos suman los tres tipos de violencia que distingue el UCDP
 * (estatal, no estatal y unilateral contra civiles), que es lo que significa
 * «violencia organizada».
 *
 * Cita obligada por la licencia, y está también en la página de metodología:
 *
 *   Davies, Shawn, Garoun Engström, Therese Pettersson & Magnus Öberg (2024).
 *   Organized violence 1989-2023, and the prevalence of organized crime
 *   groups. Journal of Peace Research 61(4).
 *   Sundberg, Ralph & Erik Melander (2013). Introducing the UCDP Georeferenced
 *   Event Dataset. Journal of Peace Research 50(4).
 */
import { createInflateRaw } from 'node:zlib';
import { pedir } from './http.mjs';

const PAGINA = 'https://ucdp.uu.se/downloads/';

export const CITA_UCDP =
  'Davies, Engström, Pettersson y Öberg (2024), «Organized violence 1989-2023, and the prevalence '
  + 'of organized crime groups», Journal of Peace Research 61(4); Sundberg y Melander (2013), '
  + '«Introducing the UCDP Georeferenced Event Dataset», Journal of Peace Research 50(4).';

export const LICENCIA_UCDP = 'CC BY 4.0';

/**
 * Nombres del UCDP que no coinciden con los del Banco Mundial.
 *
 * El emparejamiento normal es por nombre exacto, quitando el paréntesis que
 * el UCDP añade con el nombre histórico («DR Congo (Zaire)»). Solo hacen
 * falta ocho excepciones, y se escriben una a una **a propósito**: probé a
 * emparejar por coincidencia parcial y «Somalia» casaba con Malí. Un país mal
 * emparejado aquí es atribuirle a alguien las muertes de otro.
 */
const ALIAS = {
  'bosnia-herzegovina': 'BIH',
  'dr congo': 'COD',
  'congo': 'COG',
  'ivory coast': 'CIV',
  'kyrgyzstan': 'KGZ',
  'laos': 'LAO',
  'turkey': 'TUR',
  'somalia': 'SOM',
  'myanmar': 'MMR',
  'yemen': 'YEM',
  'russia': 'RUS',
  'iran': 'IRN',
  'syria': 'SYR',
  'egypt': 'EGY',
  'venezuela': 'VEN',
  'bolivia': 'BOL',
  'tanzania': 'TZA',
  'vietnam': 'VNM',
  'north korea': 'PRK',
  'south korea': 'KOR',
  'cambodia (kampuchea)': 'KHM',
  'cambodia': 'KHM',
  'madagascar (malagasy)': 'MDG',
  'zimbabwe (rhodesia)': 'ZWE',
  'moldova': 'MDA',
  'macedonia, fyr': 'MKD',
  'north macedonia': 'MKD',
  'serbia (yugoslavia)': 'SRB',
  'slovakia': 'SVK',
  'czech republic': 'CZE',
  'gambia': 'GMB',
  'bahamas': 'BHS',
  'brunei': 'BRN',
  'cape verde': 'CPV',
  'east timor': 'TLS',
  'swaziland': 'SWZ',
  'palestine': 'PSE',
  'israel': 'ISR',
  'kosovo': 'XKX',
  'turkmenistan': 'TKM',
  'saint lucia': 'LCA',
  'saint kitts and nevis': 'KNA',
  'saint vincent and the grenadines': 'VCT',
  'united states of america': 'USA',
  'kingdom of eswatini': 'SWZ',
  'eswatini': 'SWZ',
};

/**
 * El UCDP no tiene «Palestina» como país.
 *
 * Codifica los eventos por el territorio donde ocurren, y los de Gaza y
 * Cisjordania salen bajo `country = "Israel"`. Sin tocarlo, la tabla diría
 * que Israel tuvo 27.535 muertos por violencia organizada en 2023 sin
 * aclarar que la inmensa mayoría son palestinos muertos en Gaza, y que
 * Palestina tuvo cero. Las dos cosas serían engañosas.
 *
 * No hace falta inventar nada para separarlos: **el propio UCDP etiqueta la
 * provincia** en `adm_1`, y dice «Gaza Strip» y «West Bank». Así que se
 * reasignan a PSE los eventos que el UCDP sitúa ahí, que además es justo lo
 * que el Banco Mundial llama PSE: «Ribera Occidental y Gaza».
 *
 * De los 36.185 muertos que el UCDP sitúa en Israel en 2024-2025, 36.068
 * están etiquetados como Gaza o Cisjordania.
 *
 * Esta reasignación usa la geografía del propio dato y no un criterio mío.
 * Es la única que hay, y está documentada en METHODOLOGY.md.
 */
const POR_PROVINCIA = {
  Israel: { 'gaza strip': 'PSE', 'west bank': 'PSE' },
};

/** Quita el paréntesis histórico y normaliza para comparar. */
function normaliza(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La versión vigente de cada conjunto, leída de la página de descargas.
 *
 * @returns {Promise<{ged:{url:string,version:string}, candidate:{url:string,version:string}}>}
 */
export async function versionesVigentes() {
  const html = await pedir(PAGINA, { como: 'texto', timeoutMs: 60000 })
    .catch(() => pedir(PAGINA, { como: 'text', timeoutMs: 60000 }));

  // ged261-csv.zip -> 26.1
  const geds = [...String(html).matchAll(/href="([^"]*\/ged\/ged(\d{2})(\d+)-csv\.zip)"/gi)]
    .map((m) => ({
      url: new URL(m[1], PAGINA).href,
      mayor: Number(m[2]),
      menor: Number(m[3]),
      version: `${m[2]}.${m[3]}`,
    }))
    .sort((a, b) => (b.mayor - a.mayor) || (b.menor - a.menor));

  // GEDEvent_v26_0_8.csv -> 26.0.8
  const cands = [...String(html).matchAll(/href="([^"]*\/candidateged\/GEDEvent_v(\d+)_(\d+)_(\d+)\.csv)"/gi)]
    .map((m) => ({
      url: new URL(m[1], PAGINA).href,
      partes: [Number(m[2]), Number(m[3]), Number(m[4])],
      version: `${m[2]}.${m[3]}.${m[4]}`,
    }))
    .sort((a, b) => {
      for (let i = 0; i < 3; i++) if (b.partes[i] !== a.partes[i]) return b.partes[i] - a.partes[i];
      return 0;
    });

  if (!geds.length) throw new Error('UCDP: no se encuentra el GED global en la página de descargas');
  if (!cands.length) throw new Error('UCDP: no se encuentra Candidate Events en la página de descargas');

  return {
    ged: { url: geds[0].url, version: geds[0].version },
    candidate: { url: cands[0].url, version: cands[0].version },
  };
}

/**
 * Recorre un CSV línea a línea sin cargarlo entero en memoria.
 *
 * El GED descomprimido son 274 MB y 418.000 filas; leerlo de golpe para
 * quedarse con los últimos cuatro años sería gastar medio giga por nada.
 */
async function porCadaFila(stream, alLeer) {
  let resto = '';
  let cabecera = null;
  for await (const trozo of stream) {
    const texto = resto + trozo.toString('utf8');
    const lineas = texto.split('\n');
    resto = lineas.pop();
    for (const linea of lineas) {
      if (!linea.trim()) continue;
      if (!cabecera) { cabecera = partirCSV(linea); continue; }
      alLeer(partirCSV(linea), cabecera);
    }
  }
  if (resto.trim() && cabecera) alLeer(partirCSV(resto), cabecera);
}

/** Divide una línea de CSV respetando comillas y comillas dobladas. */
function partirCSV(linea) {
  const out = [];
  let actual = '';
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (dentro && linea[i + 1] === '"') { actual += '"'; i++; }
      else dentro = !dentro;
      continue;
    }
    if (c === ',' && !dentro) { out.push(actual); actual = ''; continue; }
    if (c === '\r') continue;
    actual += c;
  }
  out.push(actual);
  return out;
}

/** Los datos del zip de GED, como flujo descomprimido. */
function flujoDelZip(buf) {
  // Directorio central: la entrada local no trae los tamaños en estos zips.
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x01 && buf[i + 3] === 0x02) {
      const metodo = buf.readUInt16LE(i + 10);
      const tamComp = buf.readUInt32LE(i + 20);
      const nLocal = buf.readUInt16LE(i + 28);
      const eCentral = buf.readUInt16LE(i + 30);
      const despl = buf.readUInt32LE(i + 42);
      const nombre = buf.toString('utf8', i + 46, i + 46 + nLocal);
      if (!/\.csv$/i.test(nombre)) continue;
      const nn = buf.readUInt16LE(despl + 26);
      const ee = buf.readUInt16LE(despl + 28);
      const inicio = despl + 30 + nn + ee;
      const datos = buf.subarray(inicio, inicio + tamComp);
      void eCentral;
      if (metodo === 0) {
        return { nombre, stream: (async function* () { yield datos; })() };
      }
      const inflate = createInflateRaw();
      inflate.end(datos);
      return { nombre, stream: inflate };
    }
  }
  throw new Error('UCDP: el zip de GED no trae ningún CSV');
}

const dias = (a, b) => (b - a) / 86400000;

/**
 * @returns {Promise<{version:object, porPais: Map<string,object>, avisos:string[]}>}
 */
export async function descargar(iso3Validos) {
  const validos = new Set(iso3Validos || []);
  const version = await versionesVigentes();
  const avisos = [];

  // Nombre de UCDP -> ISO3, con el alias cuando hace falta.
  const sinEmparejar = new Set();
  const porNombre = new Map();
  for (const iso of validos) porNombre.set(iso, iso);

  /**
   * Resuelve el ISO3 de un evento; null si no se puede.
   * @param {string} nombre  el `country` del UCDP
   * @param {string} provincia  su `adm_1`, que a veces decide el país
   */
  const isoDe = (nombre, nombresIngles, provincia) => {
    const porProv = POR_PROVINCIA[nombre];
    if (porProv) {
      const destino = porProv[String(provincia || '').toLowerCase().trim()];
      if (destino && validos.has(destino)) return destino;
    }
    const n = normaliza(nombre);
    if (ALIAS[n] && validos.has(ALIAS[n])) return ALIAS[n];
    const porIngles = nombresIngles.get(n);
    if (porIngles) return porIngles;
    if (n) sinEmparejar.add(nombre);
    return null;
  };

  // Los nombres en inglés del Banco Mundial, que son con los que se compara.
  const j = await pedir('https://api.worldbank.org/v2/country?format=json&per_page=400', { timeoutMs: 45000 });
  const nombresIngles = new Map();
  for (const c of (j[1] || [])) {
    if (!c.region || c.region.id === 'NA') continue;
    nombresIngles.set(normaliza(c.name), c.id);
  }

  const acumulado = new Map();
  const toca = (iso) => {
    if (!acumulado.has(iso)) {
      acumulado.set(iso, { muertos12m: 0, eventos12m: 0, porAnio: new Map() });
    }
    return acumulado.get(iso);
  };

  // ── 1. Candidate: el año en curso ────────────────────────────────────────
  const csvCand = await pedir(version.candidate.url, { como: 'text', timeoutMs: 180000 });
  let ultimaFecha = null;
  const filasCand = [];
  await porCadaFila((async function* () { yield Buffer.from(csvCand, 'utf8'); })(), (campos, cab) => {
    const fila = {};
    for (let i = 0; i < cab.length; i++) fila[cab[i]] = campos[i];
    filasCand.push(fila);
    const d = new Date(fila.date_end || fila.date_start);
    if (!isNaN(d) && (!ultimaFecha || d > ultimaFecha)) ultimaFecha = d;
  });
  if (!ultimaFecha) throw new Error('UCDP: Candidate no trae fechas utilizables');

  // Los últimos doce meses se cuentan hacia atrás desde la última fecha del
  // Candidate, no desde hoy: si el fichero va con un mes de retraso, «hoy»
  // metería un mes vacío y bajaría artificialmente el recuento.
  const desde = new Date(ultimaFecha.getTime() - 365 * 86400000);

  for (const fila of filasCand) {
    const iso = isoDe(fila.country, nombresIngles, fila.adm_1);
    if (!iso) continue;
    const d = new Date(fila.date_end || fila.date_start);
    if (isNaN(d) || d < desde) continue;
    const best = Number(fila.best) || 0;
    const a = toca(iso);
    a.muertos12m += best;
    a.eventos12m += 1;
  }

  // ── 2. GED: los años completos y el tramo que le falta a Candidate ───────
  const zip = await pedir(version.ged.url, { como: 'buffer', timeoutMs: 300000 });
  const { stream } = flujoDelZip(zip);

  const anioUltimo = (() => {
    // El último año completo de GED; se deduce al leerlo.
    return null;
  })();
  void anioUltimo;

  const aniosVistos = new Set();
  await porCadaFila(stream, (campos, cab) => {
    const idx = {};
    for (let i = 0; i < cab.length; i++) idx[cab[i]] = i;
    const anio = Number(campos[idx.year]);
    if (!Number.isFinite(anio)) return;
    // Solo interesan los cuatro últimos años; lo anterior son 400.000 filas
    // que no se usan.
    if (anio < 2000) return;
    aniosVistos.add(anio);
    const iso = isoDe(campos[idx.country], nombresIngles, campos[idx.adm_1]);
    if (!iso) return;
    const best = Number(campos[idx.best]) || 0;
    const a = toca(iso);
    a.porAnio.set(anio, (a.porAnio.get(anio) || 0) + best);

    // Y el tramo de los doce meses que Candidate no cubre.
    const d = new Date(campos[idx.date_end] || campos[idx.date_start]);
    if (!isNaN(d) && d >= desde && d <= ultimaFecha) {
      a.muertos12m += best;
      a.eventos12m += 1;
    }
  });

  const ultimoCompleto = Math.max(...aniosVistos);
  const tresAnios = [ultimoCompleto - 2, ultimoCompleto - 1, ultimoCompleto];

  const porPais = new Map();
  for (const [iso, a] of acumulado) {
    const suma = tresAnios.reduce((t, y) => t + (a.porAnio.get(y) || 0), 0);
    porPais.set(iso, {
      muertos12m: a.muertos12m,
      eventos12m: a.eventos12m,
      media3anios: Math.round((suma / tresAnios.length) * 10) / 10,
      anios3: tresAnios,
    });
  }

  if (sinEmparejar.size) {
    avisos.push(`UCDP: ${sinEmparejar.size} países sin emparejar (${[...sinEmparejar].slice(0, 8).join(', ')})`);
  }

  return {
    version: {
      ged: version.ged.version,
      candidate: version.candidate.version,
      urlGed: version.ged.url,
      urlCandidate: version.candidate.url,
      desde: desde.toISOString().slice(0, 10),
      hasta: ultimaFecha.toISOString().slice(0, 10),
      aniosCompletos: tresAnios,
      licencia: LICENCIA_UCDP,
      cita: CITA_UCDP,
    },
    porPais,
    avisos,
  };
}

export { dias };
