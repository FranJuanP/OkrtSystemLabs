/**
 * Normalización de los eventos de las cuatro fuentes de Signal (T24).
 *
 * Estas funciones estaban dentro de los `fetch` del motor, mezcladas con el
 * estado de los puntos de fuente y el DOM. Se sacan por un motivo concreto:
 * desde T24 los mismos eventos los descarga también un trabajo automático
 * cada media hora (`tools/fetch-events.mjs`), para que la página tenga una
 * lectura reciente aunque una fuente esté caída o bloquee la petición desde
 * el navegador.
 *
 * Si la conversión viviera en dos sitios, los dos divergirían: un cambio en
 * el formato de GDELT se arreglaría en el navegador y no en el trabajo, o al
 * revés, y Signal mostraría una cosa en vivo y otra de la copia. Así que la
 * conversión es una sola, pura, sin red ni DOM, y la usan los dos.
 *
 * `ahora` se pasa como parámetro en vez de leer el reloj: el trabajo calcula
 * «hace cuánto» en el momento de la descarga, y la página lo recalcula al
 * mostrarlo. Además hace que las pruebas sean deterministas.
 */

/** Terremotos de USGS (GeoJSON del resumen semanal de magnitud ≥ 4,5). */
export function normalizarUSGS(d, ahora = Date.now()) {
  return (d.features || []).slice(0, 30).map((f) => {
    const p = f.properties || {};
    const mag = p.mag || 0;
    const sev = mag >= 7 ? 'CRITICAL' : mag >= 6 ? 'HIGH' : mag >= 5 ? 'MEDIUM' : 'LOW';
    const prof = (f.geometry && f.geometry.coordinates && f.geometry.coordinates[2]) || 0;
    return {
      id: 'usgs_' + f.id,
      source: 'USGS',
      cat: 'seismic',
      title: `M${mag.toFixed(1)} — ${p.place || 'Desconocido'}`,
      location: p.place || '—',
      time: new Date(p.time),
      severity: sev,
      url: p.url,
      detail: `Terremoto de magnitud ${mag.toFixed(1)} registrado en ${p.place}. Profundidad: ${prof.toFixed(1)} km. Estado USGS: ${p.status || 'revisado'}.`,
      impacts: {
        'MAGNITUD': mag.toFixed(1),
        'PROFUNDIDAD': prof.toFixed(0) + 'km',
        'ALERTA': p.alert || 'verde',
        'TSUNAMI': p.tsunami ? 'SÍ' : 'NO',
      },
      isNew: (ahora - new Date(p.time).getTime()) < 3600000,
    };
  });
}

const CAT_EONET = {
  Wildfires: 'climate', Volcanoes: 'seismic', 'Severe Storms': 'climate',
  Floods: 'climate', Drought: 'climate', 'Sea and Lake Ice': 'climate',
  Earthquakes: 'seismic', 'Dust and Haze': 'climate',
};

/** Eventos naturales abiertos de NASA EONET. */
export function normalizarEONET(d, ahora = Date.now()) {
  return (d.events || []).map((ev) => {
    const titulo = ev.categories && ev.categories[0] && ev.categories[0].title;
    const cat = CAT_EONET[titulo] || 'climate';
    const geo = ev.geometry && ev.geometry[0];
    const days = geo ? Math.round((ahora - new Date(geo.date).getTime()) / 86400000) : 0;
    return {
      id: 'nasa_' + ev.id,
      source: 'NASA EONET',
      cat,
      title: ev.title,
      location: titulo || 'Evento natural',
      time: geo ? new Date(geo.date) : new Date(ahora),
      severity: days < 2 ? 'HIGH' : 'MEDIUM',
      url: (ev.sources && ev.sources[0] && ev.sources[0].url) || '',
      detail: `Evento natural clasificado como "${titulo}" activo. ${ev.description || 'Monitoreo continuo activo por NASA Earth Observatory.'} Duración estimada: ${days} días en seguimiento.`,
      impacts: { 'DURACIÓN': days + 'd', 'ESTADO': 'ACTIVO', 'FUENTE': 'NASA', 'TIPO': titulo || '—' },
      isNew: days < 1,
    };
  });
}

const CAT_RELIEF = {
  'Conflict': 'conflict', 'Epidemic': 'health', 'Drought': 'climate',
  'Flood': 'climate', 'Earthquake': 'seismic',
  'Cyclone / Typhoon / Hurricane': 'climate', 'Famine': 'humanitarian',
};

/* Informes humanitarios de ReliefWeb (OCHA).

   Hoy no la llama nadie: ver FUENTES_PENDIENTES. Se conserva, y con su
   prueba, porque es exactamente lo que habra que volver a enchufar en cuanto
   haya un appname aprobado; borrarla obligaria a reescribirla de memoria. */
export function normalizarReliefWeb(d, ahora = Date.now()) {
  return (d.data || []).map((item, i) => {
    const f = item.fields || {};
    const dtype = (f.disaster_type && f.disaster_type[0] && f.disaster_type[0].name) || '';
    const cat = CAT_RELIEF[dtype] || 'humanitarian';
    const country = (f.country && f.country[0] && f.country[0].name) || 'Global';
    const creado = (f.date && f.date.created) || null;
    return {
      id: 'relief_' + item.id,
      source: 'ReliefWeb OCHA',
      cat,
      title: f.title || 'Alerta humanitaria',
      location: country,
      time: new Date(creado || ahora),
      severity: i < 3 ? 'HIGH' : 'MEDIUM',
      url: f.url_alias ? 'https://reliefweb.int' + f.url_alias : 'https://reliefweb.int',
      detail: `Informe humanitario publicado por OCHA ReliefWeb. País afectado: ${country}. Tipo de emergencia: ${dtype || 'humanitaria'}. Acceder al informe completo para datos operacionales.`,
      impacts: {
        'PAÍS': country.slice(0, 12),
        'TIPO': (dtype || 'HUMANIT.').slice(0, 10),
        'ESTADO': 'ACTIVO',
        'FUENTE': 'OCHA',
      },
      isNew: (ahora - new Date(creado || 0).getTime()) < 86400000,
    };
  });
}

/** Las tres consultas que se le hacen a GDELT, con su categoría y gravedad. */
export const CONSULTAS_GDELT = [
  { q: 'conflict+war+military', cat: 'conflict', sev: 'HIGH' },
  { q: 'sanctions+geopolitical+crisis', cat: 'geo', sev: 'MEDIUM' },
  { q: 'economic+recession+market+crash', cat: 'eco', sev: 'MEDIUM' },
];

export const urlGDELT = (q) =>
  `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=8&format=json&timespan=1d`;

/** Artículos de una consulta de GDELT. */
export function normalizarGDELT(d, indiceConsulta, ahora = Date.now()) {
  const { cat, sev } = CONSULTAS_GDELT[indiceConsulta];
  return (d.articles || []).map((art, i) => ({
    id: 'gdelt_' + indiceConsulta + '_' + i,
    source: 'GDELT',
    cat,
    title: art.title || 'Evento geopolítico detectado',
    location: art.sourcecountry || art.domain || 'Global',
    time: art.seendate
      ? new Date(art.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'))
      : new Date(ahora),
    severity: i === 0 ? sev : 'MEDIUM',
    url: art.url || '',
    detail: `Evento detectado por sistema GDELT en tiempo real. Fuente: ${art.domain || 'múltiples medios'}. Tono analítico: ${art.tone ? parseFloat(art.tone).toFixed(2) : '—'}. Cobertura: ${art.sourcecountry || 'global'}.`,
    impacts: {
      'TONO': art.tone ? parseFloat(art.tone).toFixed(1) : '—',
      'FUENTE': (art.domain || '—').slice(0, 12),
      'PAÍS': (art.sourcecountry || 'GLOBAL').slice(0, 10),
      'GDELT': 'ACTIVO',
    },
    isNew: true,
  }));
}

/**
 * Brotes de la OMS (Disease Outbreak News).
 *
 * La categoría SALUD se quedó sin fuente cuando T1 borró los tres items de
 * la OMS escritos a mano -tenían marcas de tiempo sintéticas y pintaban su
 * punto en verde sin que hubiera ninguna petición detrás- y cuando ReliefWeb
 * cerró su API, que era la que alimentaba «Epidemic».
 *
 * Esta sí es la OMS de verdad: el mismo OData que usa su propia web, con el
 * título, la fecha de publicación real y el enlace al informe. Y responde
 * con `Access-Control-Allow-Origin: *`, así que la página puede consultarla
 * directamente; no hace falta pasar por el trabajo automático.
 */
export function normalizarWHO(d, ahora = Date.now()) {
  return (d.value || []).map((ev, i) => {
    const fecha = new Date(ev.PublicationDateAndTime || ev.PublicationDate || ahora);
    const dias = Math.max(0, Math.round((ahora - fecha.getTime()) / 86400000));
    // El resumen viene con HTML y con espacios finos; se limpia para la ficha.
    const resumen = String(ev.Summary || ev.Overview || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\u00a0\u202f\u2009]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      id: 'who_' + (ev.Id || ev.UrlName || i),
      source: 'OMS · Disease Outbreak News',
      cat: 'health',
      title: ev.Title || 'Brote notificado por la OMS',
      location: String(ev.Title || '').split(' - ').slice(1).join(' - ') || 'Global',
      time: fecha,
      // Un brote notificado esta semana pesa más que uno de hace dos meses.
      severity: dias <= 7 ? 'HIGH' : dias <= 30 ? 'MEDIUM' : 'LOW',
      url: ev.UrlName
        ? 'https://www.who.int/emergencies/disease-outbreak-news/item/' + ev.UrlName
        : 'https://www.who.int/emergencies/disease-outbreak-news',
      detail: resumen || 'Informe de brote publicado por la OMS en Disease Outbreak News.',
      impacts: {
        'PUBLICADO': fecha.toISOString().slice(0, 10),
        'ANTIGÜEDAD': dias + 'd',
        'FUENTE': 'OMS',
        'TIPO': 'BROTE',
      },
      isNew: dias <= 2,
    };
  });
}

/** URLs de las fuentes, en un solo sitio para que el trabajo y la página coincidan. */
export const URLS = {
  usgs: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
  eonet: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25&days=14',
  /* OData de la propia web de la OMS. Se piden los campos que se usan y los
     20 más recientes; sin `$select` la respuesta pasa de 270 KB. */
  who: 'https://www.who.int/api/news/diseaseoutbreaknews'
     + '?%24orderby=PublicationDateAndTime%20desc&%24top=20'
     + '&%24select=Id,Title,PublicationDateAndTime,UrlName,Summary&%24format=json',
  /* ReliefWeb no tiene URL aqui a proposito.

     La v1 devuelve 410 Gone y la v2 responde 403 a cualquier appname que
     ReliefWeb no haya aprobado. Mientras no haya uno aprobado no se le llama
     ni desde la pagina ni desde el trabajo automatico, y no tenerla escrita
     es la forma mas simple de que no se cuele otra vez. Cuando se consiga el
     appname, se añade aqui y se vuelve a enchufar en las dos partes. */
};

/**
 * Las señales guardadas en data/events.json vuelven con `time` como texto.
 * Esto las devuelve a la forma que espera la interfaz, marcadas como lectura
 * del servidor para que la página pueda decir de cuándo son.
 */
export function rehidratar(evento, momento) {
  return Object.assign({}, evento, {
    time: new Date(evento.time),
    isNew: false,
    stale: true,
    fetchedAt: momento ? new Date(momento) : null,
  });
}

/**
 * Fuentes que no están caídas, sino cerradas a la espera de un permiso.
 *
 * La diferencia importa para lo que se le dice al visitante: «sin conexión»
 * invita a volver a intentarlo, y aquí no hay nada que intentar hasta que
 * alguien pida el permiso.
 *
 * ReliefWeb apareció al montar el trabajo automático: su API v1, que es la
 * que esta página consultaba, devuelve 410 Gone con el mensaje «The API
 * version 'v1' has been decommissioned», y la v2 contesta 403 a cualquier
 * `appname` que no haya aprobado ReliefWeb previamente.
 *
 * No se le llama desde ningún sitio. Esta tabla existe para que la interfaz
 * pueda decir por qué, y para que el trabajo automático la salte sin tener
 * que repetir el motivo.
 */
export const FUENTES_PENDIENTES = {
  relief: {
    motivo: 'ReliefWeb retiró la API v1 (410 Gone) y la v2 exige un «appname» aprobado por ellos.',
    comoArreglarlo: 'Solicitar un appname en https://apidoc.reliefweb.int/, añadir URLS.reliefweb y volver a enchufarla en el motor y en tools/fetch-events.mjs.',
  },
};
