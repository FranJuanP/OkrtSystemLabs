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
 * Medidas por país:
 *
 *   muertos12m    en su TERRITORIO, últimos doce meses, contados hacia atrás
 *                 desde la última fecha que trae Candidate
 *   porTipo12m    ese mismo total, desglosado por los tres tipos de violencia
 *                 que distingue el UCDP
 *   media3anios   la media de los tres últimos años completos de GED
 *   parte12m      muertos en conflictos ESTATALES en los que el gobierno de
 *                 ese país es una de las partes, ocurran donde ocurran
 *
 * Las dos últimas son cosas distintas y por eso se guardan por separado.
 * «En el territorio» responde a qué está pasando dentro de un país; «como
 * parte» responde a en qué guerras está metido su gobierno. Rusia tiene 266
 * muertos en su territorio y 48.086 como parte; Israel, 4 y 2.522. Dar solo
 * la primera cifra describe mal a los dos.
 *
 * La condición de parte sale de los campos de actores del propio UCDP, sin
 * reatribuir nada: en los eventos de violencia estatal, `side_a` y `side_b`
 * llevan el actor y `gwnoa`/`gwnob` su código de gobierno cuando lo son.
 * Todos los actores con código se llaman «Government of X», así que el país
 * se resuelve con el mismo emparejamiento de nombres que el resto.
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
import { StringDecoder } from 'node:string_decoder';
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

/**
 * Los tres tipos de violencia organizada del UCDP.
 *
 * Importan porque mil muertos no significan lo mismo según de qué sean: una
 * guerra entre un Estado y un grupo armado, enfrentamientos entre bandas sin
 * Estado de por medio, o una campaña contra población civil. El nivel mínimo
 * que impone cada uno es distinto, y está en src/core/scoring.js.
 */
export const TIPOS_VIOLENCIA = {
  1: 'estatal',
  2: 'noEstatal',
  3: 'civiles',
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

  /* Todas las entregas del año en curso, no solo la última.

     Cada versión mensual de Candidate es un LOTE, no un acumulado: la 26.0.1
     trae del 29-12-2025 al 05-02-2026 y la 26.0.8 del 01-01 al 10-09-2026,
     pero entre las dos faltan las seis de en medio. Con una sola, la ventana
     de doce meses se quedaba en cinco.

     La página enlaza únicamente las dos últimas, así que el resto se deducen
     del patrón de nombre y se piden; las que no existan darán 404 y se
     descartan. Se empieza por la más nueva porque es la que manda al quitar
     duplicados. */
  const [mayor, menor] = cands[0].partes;
  const ultima = cands[0].partes[2];
  const serie = [];
  for (let k = ultima; k >= 1; k--) {
    const ya = cands.find((c) => c.partes[0] === mayor && c.partes[1] === menor && c.partes[2] === k);
    serie.push(ya || {
      url: new URL(`candidateged/GEDEvent_v${mayor}_${menor}_${k}.csv`, PAGINA).href,
      version: `${mayor}.${menor}.${k}`,
      partes: [mayor, menor, k],
    });
  }

  return {
    ged: { url: geds[0].url, version: geds[0].version },
    candidate: { url: cands[0].url, version: cands[0].version },
    serieCandidate: serie,
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
  /* Dentro de un campo entrecomillado, un salto de línea NO termina el
     registro. `source_article` lleva el texto de la noticia y trae saltos a
     menudo: partir por '\n' a secas rompía esos registros en trozos, y como
     `country`, `best` y las fechas van DESPUÉS de ese campo, el trozo de
     delante se quedaba sin ellos y no sumaba. Se perdía el 6,9 % de los
     muertos de Candidate, y no de forma uniforme: Colombia perdía el 61 % y
     Nigeria el 23 %. */
  let dentroDeComillas = false;
  // Un trozo del flujo puede cortar un carácter UTF-8 por la mitad.
  const decodificador = new StringDecoder('utf8');

  const procesa = (registro) => {
    if (!registro.trim()) return;
    if (!cabecera) { cabecera = partirCSV(registro); return; }
    alLeer(partirCSV(registro), cabecera);
  };

  for await (const trozo of stream) {
    const texto = decodificador.write(Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo));
    let inicio = 0;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      // Toggle simple: con «""» (comilla escapada) entra y sale, que es lo
      // correcto, porque sigue estando dentro del campo.
      if (c === '"') { dentroDeComillas = !dentroDeComillas; continue; }
      if (c === '\n' && !dentroDeComillas) {
        procesa(resto + texto.slice(inicio, i));
        resto = '';
        inicio = i + 1;
      }
    }
    resto += texto.slice(inicio);
  }
  resto += decodificador.end();
  procesa(resto);
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
    // Un salto dentro de un campo entrecomillado se guarda como espacio: el
    // valor sigue siendo el mismo dato y así no arrastra saltos a la ficha.
    if (c === '\n') { actual += ' '; continue; }
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

  /* Un bloque de recuento: lo mismo se mide sobre la ventana movil y sobre
     cada año natural, y se elige despues cual se publica. */
  const bloque = () => ({
    muertos: 0,
    eventos: 0,
    porTipo: { estatal: 0, noEstatal: 0, civiles: 0 },
    parte: 0,
    parteEventos: 0,
    parteConflictos: new Set(),
  });

  const acumulado = new Map();
  const toca = (iso) => {
    if (!acumulado.has(iso)) {
      acumulado.set(iso, { ventana: bloque(), porAnio: new Map() });
    }
    return acumulado.get(iso);
  };
  /** El bloque del año natural `anio` de un país, creándolo si hace falta. */
  const tocaAnio = (iso, anio) => {
    const a = toca(iso);
    if (!a.porAnio.has(anio)) a.porAnio.set(anio, bloque());
    return a.porAnio.get(anio);
  };

  /**
   * Suma el evento al territorio donde ocurre, en los bloques que toquen.
   *
   * @param {string} iso      país del evento
   * @param {object} destinos {ventana:boolean, anio:number|null}
   */
  const anotaTerritorio = (iso, tipoBruto, best, destinos) => {
    const tipo = TIPOS_VIOLENCIA[tipoBruto];
    const aplica = [];
    if (destinos.ventana) aplica.push(toca(iso).ventana);
    if (destinos.anio != null) aplica.push(tocaAnio(iso, destinos.anio));
    for (const b of aplica) {
      b.muertos += best;
      b.eventos += 1;
      if (tipo) b.porTipo[tipo] += best;
    }
  };

  /**
   * Los países cuyo gobierno figura en un lado de un evento.
   *
   * Casi siempre es uno solo —«Government of Ukraine»—, pero el UCDP escribe
   * las coaliciones en el mismo campo separadas por comas: la invasión de
   * Irak sale como «Government of Australia, Government of United Kingdom,
   * Government of United States of America». Sin partirlas, esa cadena entera
   * no empareja con ningún país y la coalición se pierde entera.
   *
   * @returns {string[]} ISO3 sin repetir
   */
  const gobiernosDe = (lado) => {
    const fuera = new Set();
    for (const trozo of String(lado || '').split(',')) {
      const m = /^\s*Government of (.+?)\s*$/.exec(trozo);
      if (!m) continue;
      const iso = isoDe(m[1], nombresIngles, null);
      if (iso) fuera.add(iso);
    }
    return [...fuera];
  };

  /**
   * Suma el evento a los gobiernos que son parte, si es violencia estatal.
   *
   * Un evento de la guerra de Ucrania suma a Rusia y a Ucrania: los dos son
   * parte. No se reparte entre ellos ni se divide; la cifra responde a «en
   * cuánta violencia está metido este gobierno», no a quién la causó.
   */
  const anotaPartes = (fila, destinos) => {
    if (String(fila.type_of_violence) !== '1') return;
    const best = Number(fila.best) || 0;
    /* Candidate trae conflictos recien codificados sin nombre todavia,
       identificados con un codigo interno del tipo «XXX475». Esa cadena en
       la ficha parece un error; las muertes si cuentan. */
    const nombre = String(fila.conflict_name || '');
    const etiqueta = !nombre ? null
      : (/^XXX\d*$/i.test(nombre) ? 'conflicto aun sin nombre en UCDP' : nombre);

    /* No se mira `gwnoa`/`gwnob`: en las COALICIONES vienen VACÍOS aunque el
       lado nombre a dos gobiernos. Exigirlos descartaba la guerra entera de
       Irán contra Israel y Estados Unidos. El filtro de verdad es el nombre:
       `gobiernosDe()` solo acepta «Government of X» que resuelva a un país, y
       se comprobó que los únicos actores con ese patrón y sin número desde
       2020 son las cuatro coaliciones que existen. */
    for (const ladoNombre of ['side_a', 'side_b']) {
      for (const iso of gobiernosDe(fila[ladoNombre])) {
        const aplica = [];
        if (destinos.ventana) aplica.push(toca(iso).ventana);
        if (destinos.anio != null) aplica.push(tocaAnio(iso, destinos.anio));
        for (const b of aplica) {
          b.parte += best;
          b.parteEventos += 1;
          if (etiqueta) b.parteConflictos.add(etiqueta);
        }
      }
    }
  };

  // ── 1. Candidate: el año en curso, entrega a entrega ─────────────────────
  /* Se recorren de la más nueva a la más vieja y se queda el PRIMER id que
     aparece: cuando un evento sale en dos entregas, la reciente es la que
     lleva la corrección. Hoy se solapan 65 de 11.825 filas. */
  const vistosCand = new Set();
  const filasCand = [];
  const entregas = [];
  for (const v of (version.serieCandidate || [version.candidate])) {
    let csv;
    try {
      csv = await pedir(v.url, { como: 'text', timeoutMs: 180000 });
    } catch (err) {
      // Una entrega que no está no es un error: el patrón de nombre se deduce.
      avisos.push(`UCDP: Candidate ${v.version} no disponible (${String(err.message).slice(0, 60)})`);
      continue;
    }
    let nuevas = 0;
    let repetidas = 0;
    await porCadaFila((async function* () { yield Buffer.from(csv, 'utf8'); })(), (campos, cab) => {
      const fila = {};
      for (let i = 0; i < cab.length; i++) fila[cab[i]] = campos[i];
      if (!fila.id) return;
      if (vistosCand.has(fila.id)) { repetidas++; return; }
      vistosCand.add(fila.id);
      filasCand.push(fila);
      nuevas++;
    });
    entregas.push({ version: v.version, nuevas, repetidas });
  }
  if (!filasCand.length) throw new Error('UCDP: ninguna entrega de Candidate ha podido leerse');

  let ultimaFecha = null;
  let primeraCand = null;
  for (const fila of filasCand) {
    const fin = new Date(fila.date_end || fila.date_start);
    if (!isNaN(fin) && (!ultimaFecha || fin > ultimaFecha)) ultimaFecha = fin;
    const ini = new Date(fila.date_start || fila.date_end);
    if (!isNaN(ini) && (!primeraCand || ini < primeraCand)) primeraCand = ini;
  }
  if (!ultimaFecha) throw new Error('UCDP: Candidate no trae fechas utilizables');
  if (!primeraCand) primeraCand = ultimaFecha;

  // Los últimos doce meses se cuentan hacia atrás desde la última fecha del
  // Candidate, no desde hoy: si el fichero va con un mes de retraso, «hoy»
  // metería un mes vacío y bajaría artificialmente el recuento.
  const desde = new Date(ultimaFecha.getTime() - 365 * 86400000);

  for (const fila of filasCand) {
    const d = new Date(fila.date_end || fila.date_start);
    if (isNaN(d) || d < desde) continue;
    const best = Number(fila.best) || 0;

    /* Candidate cubre el año en curso, que por definición no está completo:
       sus eventos entran en la ventana y en ningún bloque anual. */
    const iso = isoDe(fila.country, nombresIngles, fila.adm_1);
    if (iso) anotaTerritorio(iso, fila.type_of_violence, best, { ventana: true, anio: null });
    anotaPartes(fila, { ventana: true, anio: null });
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
  // Hasta dónde llega GED, para poder decir cuánto de la ventana está cubierto.
  let ultimaGed = null;
  await porCadaFila(stream, (campos, cab) => {
    const idx = {};
    for (let i = 0; i < cab.length; i++) idx[cab[i]] = i;
    const anio = Number(campos[idx.year]);
    if (!Number.isFinite(anio)) return;
    // Solo interesan los cuatro últimos años; lo anterior son 400.000 filas
    // que no se usan.
    if (anio < 2000) return;
    aniosVistos.add(anio);
    const best = Number(campos[idx.best]) || 0;
    const d = new Date(campos[idx.date_end] || campos[idx.date_start]);
    /* El tramo de la ventana que Candidate no cubre. La cota superior evita
       contar dos veces si una futura versión de GED llegase a solaparse con
       Candidate: hoy GED acaba donde Candidate aún no ha empezado. */
    if (!isNaN(d) && (!ultimaGed || d > ultimaGed)) ultimaGed = d;
    const enVentana = !isNaN(d) && d >= desde && d <= ultimaFecha && d < primeraCand;

    const destinos = { ventana: enVentana, anio };
    const iso = isoDe(campos[idx.country], nombresIngles, campos[idx.adm_1]);
    if (iso) anotaTerritorio(iso, campos[idx.type_of_violence], best, destinos);

    anotaPartes({
      type_of_violence: campos[idx.type_of_violence],
      best: campos[idx.best],
      side_a: campos[idx.side_a],
      side_b: campos[idx.side_b],
      gwnoa: campos[idx.gwnoa],
      gwnob: campos[idx.gwnob],
      conflict_name: campos[idx.conflict_name],
    }, destinos);
  });

  const ultimoCompleto = Math.max(...aniosVistos);

  /* Cuántos meses de la ventana están realmente cubiertos.

     GED cubre hasta su última fecha y Candidate desde la suya; si entre las
     dos queda un hueco, la «ventana de doce meses» no son doce meses y hay
     que decirlo. Se unen los dos tramos recortados a la ventana y se mide. */
  const tramos = [];
  if (ultimaGed && ultimaGed > desde) {
    tramos.push([desde.getTime(), Math.min(ultimaGed.getTime(), ultimaFecha.getTime())]);
  }
  tramos.push([Math.max(primeraCand.getTime(), desde.getTime()), ultimaFecha.getTime()]);
  tramos.sort((a, b) => a[0] - b[0]);
  const unidos = [];
  for (const t of tramos) {
    if (t[1] <= t[0]) continue;
    const ult = unidos[unidos.length - 1];
    if (ult && t[0] <= ult[1]) ult[1] = Math.max(ult[1], t[1]);
    else unidos.push([...t]);
  }
  const diasCubiertos = unidos.reduce((n, t) => n + (t[1] - t[0]) / 86400000, 0);
  const coberturaMeses = Math.round((diasCubiertos / 365) * 12 * 10) / 10;
  const tresAnios = [ultimoCompleto - 2, ultimoCompleto - 1, ultimoCompleto];

  /* Dos semanas de margen: una ventana a la que le falten más de catorce
     días deja de poder llamarse «doce meses». */
  const ventanaIncompleta = diasCubiertos < 351;

  const porPais = new Map();
  for (const [iso, a] of acumulado) {
    const vacio = bloque();
    const ventana = a.ventana;
    const anual = a.porAnio.get(ultimoCompleto) || vacio;
    const suma = tresAnios.reduce((t, y) => t + ((a.porAnio.get(y) || vacio).muertos), 0);

    /* Cuál de los dos se publica.

       El año natural cerrado es un RESPALDO, no una alternativa: solo entra
       cuando la ventana está incompleta. Mientras las entregas de Candidate
       cubran el año en curso, la ventana de doce meses es doce meses de
       verdad y es la que describe el presente; coger entonces el año anterior
       solo porque fue peor mezclaría dos periodos y sesgaría al alza.

       Cuando sí está incompleta —si el UCDP se salta una entrega, o si
       cambia el formato— gana el de más muertos, y se publica ENTERO: el
       desglose por tipo y la cifra de parte vienen del mismo tramo que el
       total, porque mezclarlos daría un desglose que no suma. */
    const usaAnual = ventanaIncompleta && anual.muertos > ventana.muertos;
    const elegido = usaAnual ? anual : ventana;

    porPais.set(iso, {
      muertos: elegido.muertos,
      eventos: elegido.eventos,
      porTipo: elegido.porTipo,
      parte: elegido.parte,
      parteEventos: elegido.parteEventos,
      // Los nombres de los conflictos, para poder decir en cuáles está metido
      // y no solo cuántos muertos suman.
      parteConflictos: [...elegido.parteConflictos].sort(),
      base: usaAnual ? 'anio_completo' : 'ventana_12m',
      anioBase: usaAnual ? ultimoCompleto : null,
      // Las dos cifras crudas, para poder enseñar por qué se eligió una.
      muertosVentana: ventana.muertos,
      muertosAnual: anual.muertos,
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
      candidateDesde: primeraCand.toISOString().slice(0, 10),
      gedHasta: ultimaGed ? ultimaGed.toISOString().slice(0, 10) : null,
      ultimoAnioCompleto: ultimoCompleto,
      coberturaMeses,
      ventanaIncompleta,
      entregasCandidate: entregas,
      /* «26.0.1-26.0.8», porque se leen todas y decir solo la última daría a
         entender que de ahí sale todo el año. */
      candidateRango: entregas.length > 1
        ? `${entregas[entregas.length - 1].version}-${entregas[0].version}`
        : (entregas[0] ? entregas[0].version : version.candidate.version),
      aniosCompletos: tresAnios,
      licencia: LICENCIA_UCDP,
      cita: CITA_UCDP,
    },
    porPais,
    avisos,
  };
}

export { dias };
