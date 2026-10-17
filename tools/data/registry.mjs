/**
 * Registro de indicadores de AETHER (T21).
 *
 * Esta tabla es el documento central de la Fase 3. Hasta ahora el motor
 * llevaba 1.600 indicadores escritos a mano (857 nombres distintos) sin
 * ninguna fuente detrás: «Karoshi», «Bunkers/hab.», «Nobeles/cápita alto».
 * Nada de eso se podía comprobar y nada de eso se actualizaba.
 *
 * Lo que queda es más corto y mucho menos vistoso, pero cada número tiene un
 * origen con nombre, año y enlace, y se vuelve a descargar cada semana.
 *
 * Campos de cada indicador:
 *   id         clave estable; no se renombra nunca (los datos viejos la usan)
 *   cat        una de las 16 categorías de CAT_KEYS
 *   etiqueta   texto que ve el usuario
 *   unidad     unidad del valor, tal cual se muestra
 *   fuente     'wb' | 'wgi' | 'uhc' | 'inform' | 'ndgain'
 *   codigo     identificador del indicador en esa fuente
 *   dir        dirección de riesgo, y esto es lo que más importa:
 *                'mas_riesgo'   valor alto = más riesgo
 *                'menos_riesgo' valor alto = menos riesgo
 *                'ambiguo'      no es monótono; SE MUESTRA PERO NO PUNTÚA
 *   decimales  redondeo al mostrar
 *   escala     'lineal' (por defecto) o 'log' para magnitudes con colas largas
 *   nota       límite de comparabilidad del indicador, cuando lo tiene. Se
 *              muestra junto al dato y se recoge en METHODOLOGY.md. No es
 *              decoración: «reservas en meses de importaciones» no significa
 *              lo mismo para España que para Chile, y callarlo sería dar por
 *              comparable algo que no lo es.
 *
 * Sobre 'ambiguo': la tasa de fecundidad, el saldo migratorio o el porcentaje
 * de población urbana no tienen una dirección de riesgo única. 1,1 hijos por
 * mujer es un problema demográfico y 6,8 también, por motivos opuestos.
 * Inventar una dirección para que puntúe habría sido exactamente el vicio que
 * esta fase viene a corregir, así que esos indicadores se muestran con su
 * valor y su fuente y se quedan fuera del cálculo. Está explicado en
 * METHODOLOGY.md.
 */

/** Las 16 categorías del motor, en su orden. */
export const CATEGORIAS = [
  { key: 'eco', etiqueta: 'ECO', nombre: 'Economía' },
  { key: 'geo', etiqueta: 'GEO', nombre: 'Geopolítica' },
  { key: 'health', etiqueta: 'SALUD', nombre: 'Salud' },
  { key: 'climate', etiqueta: 'CLIMA', nombre: 'Clima' },
  { key: 'social', etiqueta: 'SOCIAL', nombre: 'Social' },
  { key: 'tech', etiqueta: 'TECH', nombre: 'Tecnología' },
  { key: 'food', etiqueta: 'ALIM', nombre: 'Alimentación' },
  { key: 'mental', etiqueta: 'MENTAL', nombre: 'Salud mental' },
  { key: 'energy', etiqueta: 'ENERGÍA', nombre: 'Energía' },
  { key: 'demo', etiqueta: 'DEMO', nombre: 'Demografía' },
  { key: 'urban', etiqueta: 'URBANO', nombre: 'Urbano' },
  { key: 'science', etiqueta: 'CIENCIA', nombre: 'Ciencia' },
  { key: 'justice', etiqueta: 'JUSTICIA', nombre: 'Justicia' },
  { key: 'finance', etiqueta: 'FINANZAS', nombre: 'Finanzas' },
  { key: 'ocean', etiqueta: 'OCÉANOS', nombre: 'Océanos' },
  { key: 'bio', etiqueta: 'BIOSEG', nombre: 'Bioseguridad' },
];

/** Metadatos de cada fuente: nombre visible, licencia y enlace. */
export const FUENTES = {
  wb: {
    nombre: 'Banco Mundial · World Development Indicators',
    corto: 'Banco Mundial · WDI',
    url: 'https://databank.worldbank.org/source/world-development-indicators',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://datacatalog.worldbank.org/public-licenses#cc-by',
  },
  wgi: {
    nombre: 'Banco Mundial · Worldwide Governance Indicators',
    corto: 'Banco Mundial · WGI',
    url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://datacatalog.worldbank.org/public-licenses#cc-by',
  },
  uhc: {
    nombre: 'Banco Mundial / OMS · Universal Health Coverage',
    corto: 'OMS · UHC',
    url: 'https://databank.worldbank.org/source/universal-health-coverage',
    licencia: 'CC BY 4.0',
    licenciaUrl: 'https://datacatalog.worldbank.org/public-licenses#cc-by',
  },
  inform: {
    nombre: 'Comisión Europea · JRC · INFORM Risk Index',
    corto: 'JRC · INFORM Risk',
    url: 'https://drmkc.jrc.ec.europa.eu/inform-index',
    licencia: 'Reutilización permitida con atribución (Decisión 2011/833/UE)',
    licenciaUrl: 'https://ec.europa.eu/info/legal-notice_en',
  },
  ndgain: {
    nombre: 'University of Notre Dame · ND-GAIN Country Index',
    corto: 'ND-GAIN',
    url: 'https://gain.nd.edu/our-work/country-index/',
    licencia: 'CC BY-NC-SA 4.0 (uso no comercial)',
    licenciaUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
  cofer: {
    nombre: 'Fondo Monetario Internacional · COFER',
    corto: 'FMI · COFER',
    url: 'https://data.imf.org/en/datasets/IMF.STA:COFER',
    licencia: 'Reutilización con atribución',
    licenciaUrl: 'https://www.imf.org/external/terms.htm',
  },
  tic: {
    nombre: 'US Treasury · Treasury International Capital',
    corto: 'Tesoro de EEUU · TIC',
    url: 'https://home.treasury.gov/data/treasury-international-capital-tic-system',
    licencia: 'Dominio público (obra del gobierno de EEUU)',
    licenciaUrl: 'https://home.treasury.gov/footer/privacy-act',
  },
};

/** Enlace a la ficha del indicador, para citarlo dato a dato. */
export function urlIndicador(ind) {
  if (ind.fuente === 'wb' || ind.fuente === 'uhc') {
    return 'https://data.worldbank.org/indicator/' + ind.codigo;
  }
  if (ind.fuente === 'wgi') return FUENTES.wgi.url;
  if (ind.fuente === 'inform') {
    return 'https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data';
  }
  if (ind.fuente === 'ndgain') return 'https://gain.nd.edu/our-work/country-index/rankings/';
  return FUENTES[ind.fuente] ? FUENTES[ind.fuente].url : '';
}

export const INDICADORES = [
  // ── ECO ──────────────────────────────────────────────────────────────────
  { id: 'pib_crecimiento',   cat: 'eco', etiqueta: 'Crecimiento del PIB',    unidad: '% anual',      fuente: 'wb',  codigo: 'NY.GDP.MKTP.KD.ZG', dir: 'menos_riesgo', decimales: 1 },
  { id: 'inflacion',         cat: 'eco', etiqueta: 'Inflación',              unidad: '% anual',      fuente: 'wb',  codigo: 'FP.CPI.TOTL.ZG',    dir: 'mas_riesgo',   decimales: 1 },
  { id: 'desempleo',         cat: 'eco', etiqueta: 'Desempleo',              unidad: '% pobl. activa', fuente: 'wb', codigo: 'SL.UEM.TOTL.ZS',   dir: 'mas_riesgo',   decimales: 1 },
  { id: 'pib_pc_ppa',        cat: 'eco', etiqueta: 'PIB por habitante (PPA)', unidad: '$ int.',      fuente: 'wb',  codigo: 'NY.GDP.PCAP.PP.CD', dir: 'menos_riesgo', decimales: 0, escala: 'log' },

  // ── GEO ──────────────────────────────────────────────────────────────────
  { id: 'estabilidad_politica', cat: 'geo', etiqueta: 'Estabilidad política', unidad: '−2,5 a +2,5', fuente: 'wgi', codigo: 'GOV_WGI_PV.EST',    dir: 'menos_riesgo', decimales: 2 },
  { id: 'inform_riesgo',     cat: 'geo', etiqueta: 'Riesgo INFORM',          unidad: '0–10',         fuente: 'inform', codigo: 'INFORM',         dir: 'mas_riesgo',   decimales: 1 },
  { id: 'inform_conflicto',  cat: 'geo', etiqueta: 'Amenaza humana',         unidad: '0–10',         fuente: 'inform', codigo: 'HA.HUM',         dir: 'mas_riesgo',   decimales: 1 },
  { id: 'desplazados',       cat: 'geo', etiqueta: 'Población desarraigada', unidad: '0–10',         fuente: 'inform', codigo: 'VU.VGR.UP',      dir: 'mas_riesgo',   decimales: 1 },

  // ── SALUD ────────────────────────────────────────────────────────────────
  { id: 'esperanza_vida',    cat: 'health', etiqueta: 'Esperanza de vida',   unidad: 'años',         fuente: 'wb',  codigo: 'SP.DYN.LE00.IN',    dir: 'menos_riesgo', decimales: 1 },
  { id: 'mortalidad_menores5', cat: 'health', etiqueta: 'Mortalidad < 5 años', unidad: 'por 1.000',  fuente: 'wb',  codigo: 'SH.DYN.MORT',       dir: 'mas_riesgo',   decimales: 1 },
  { id: 'cobertura_sanitaria', cat: 'health', etiqueta: 'Cobertura sanitaria universal', unidad: 'índice 0–100', fuente: 'uhc', codigo: 'SH.UHC.SRVS.CV.XD', dir: 'menos_riesgo', decimales: 0 },
  { id: 'gasto_sanitario',   cat: 'health', etiqueta: 'Gasto sanitario',     unidad: '% del PIB',    fuente: 'wb',  codigo: 'SH.XPD.CHEX.GD.ZS', dir: 'menos_riesgo', decimales: 1 },
  { id: 'medicos',           cat: 'health', etiqueta: 'Médicos',             unidad: 'por 1.000 hab.', fuente: 'wb', codigo: 'SH.MED.PHYS.ZS',   dir: 'menos_riesgo', decimales: 2 },

  // ── CLIMA ────────────────────────────────────────────────────────────────
  { id: 'co2_pc',            cat: 'climate', etiqueta: 'Emisiones de CO₂',   unidad: 't/hab.',       fuente: 'wb',  codigo: 'EN.GHG.CO2.PC.CE.AR5', dir: 'mas_riesgo', decimales: 2,
    nota: 'Excluye el uso de la tierra y la silvicultura (LULUCF), que en los países con mucha deforestación es una parte grande de sus emisiones.' },
  { id: 'vulnerabilidad_clima', cat: 'climate', etiqueta: 'Vulnerabilidad climática', unidad: '0–1',  fuente: 'ndgain', codigo: 'vulnerability', dir: 'mas_riesgo',   decimales: 3 },
  { id: 'preparacion_clima', cat: 'climate', etiqueta: 'Preparación climática', unidad: '0–1',        fuente: 'ndgain', codigo: 'readiness',     dir: 'menos_riesgo', decimales: 3 },
  { id: 'estres_hidrico',    cat: 'climate', etiqueta: 'Estrés hídrico',      unidad: '% extracción', fuente: 'wb',  codigo: 'ER.H2O.FWST.ZS',    dir: 'mas_riesgo',   decimales: 1, escala: 'log' },

  // ── SOCIAL ───────────────────────────────────────────────────────────────
  { id: 'gini',              cat: 'social', etiqueta: 'Desigualdad (Gini)',  unidad: 'índice',       fuente: 'wb',  codigo: 'SI.POV.GINI',       dir: 'mas_riesgo',   decimales: 1,
    nota: 'El año del dato varía mucho de un país a otro, de 1992 a 2025. Comparar países con encuestas de años distintos tiene un margen que no se puede cuantificar aquí.' },
  { id: 'pobreza',           cat: 'social', etiqueta: 'Pobreza (3 $/día PPA 2021)', unidad: '% pobl.', fuente: 'wb', codigo: 'SI.POV.DDAY',      dir: 'mas_riesgo',   decimales: 1,
    nota: 'Mismo problema de años dispares que el Gini: sale de encuestas de hogares que no se hacen al mismo tiempo en todas partes.' },
  { id: 'voz_rendicion',     cat: 'social', etiqueta: 'Voz y rendición de cuentas', unidad: '−2,5 a +2,5', fuente: 'wgi', codigo: 'GOV_WGI_VA.EST', dir: 'menos_riesgo', decimales: 2 },
  { id: 'desigualdad_genero', cat: 'social', etiqueta: 'Desigualdad de género (GII)', unidad: '0–1',  fuente: 'inform', codigo: 'VU.SEV.INQ.GII', dir: 'mas_riesgo',   decimales: 3 },

  // ── TECH ─────────────────────────────────────────────────────────────────
  { id: 'internet',          cat: 'tech', etiqueta: 'Uso de internet',       unidad: '% pobl.',      fuente: 'wb',  codigo: 'IT.NET.USER.ZS',    dir: 'menos_riesgo', decimales: 1 },
  { id: 'moviles',           cat: 'tech', etiqueta: 'Líneas móviles',        unidad: 'por 100 hab.', fuente: 'wb',  codigo: 'IT.CEL.SETS.P2',    dir: 'menos_riesgo', decimales: 1 },
  { id: 'infraestr_comunic', cat: 'tech', etiqueta: 'Carencia de comunicaciones', unidad: '0–10',    fuente: 'inform', codigo: 'CC.INF.COM',     dir: 'mas_riesgo',   decimales: 1 },

  // ── ALIM ─────────────────────────────────────────────────────────────────
  { id: 'subnutricion',      cat: 'food', etiqueta: 'Subnutrición',          unidad: '% pobl.',      fuente: 'wb',  codigo: 'SN.ITK.DEFC.ZS',    dir: 'mas_riesgo',   decimales: 1 },
  { id: 'retraso_crecimiento', cat: 'food', etiqueta: 'Retraso del crecimiento infantil', unidad: '% < 5 años', fuente: 'wb', codigo: 'SH.STA.STNT.ZS', dir: 'mas_riesgo', decimales: 1 },
  { id: 'seguridad_alimentaria', cat: 'food', etiqueta: 'Inseguridad alimentaria', unidad: '0–10',    fuente: 'inform', codigo: 'VU.VGR.OG.FS',   dir: 'mas_riesgo',   decimales: 1 },
  { id: 'produccion_alimentos', cat: 'food', etiqueta: 'Producción de alimentos', unidad: 'índice 2014-16=100', fuente: 'wb', codigo: 'AG.PRD.FOOD.XD', dir: 'menos_riesgo', decimales: 1 },

  // ── MENTAL ───────────────────────────────────────────────────────────────
  // Solo hay un indicador comparable entre países con fuente oficial. La
  // categoría se queda con confianza baja a propósito: es lo que hay.
  { id: 'suicidio',          cat: 'mental', etiqueta: 'Mortalidad por suicidio', unidad: 'por 100.000', fuente: 'wb', codigo: 'SH.STA.SUIC.P5', dir: 'mas_riesgo',   decimales: 1,
    nota: 'Última estimación comparable de la OMS, de 2021. Depende de la calidad del registro de causas de muerte, que varía mucho entre países.' },

  // ── ENERGÍA ──────────────────────────────────────────────────────────────
  { id: 'acceso_electricidad', cat: 'energy', etiqueta: 'Acceso a electricidad', unidad: '% pobl.',  fuente: 'wb',  codigo: 'EG.ELC.ACCS.ZS',    dir: 'menos_riesgo', decimales: 1 },
  { id: 'renovables',        cat: 'energy', etiqueta: 'Energía renovable',     unidad: '% consumo',   fuente: 'wb',  codigo: 'EG.FEC.RNEW.ZS',    dir: 'menos_riesgo', decimales: 1 },
  { id: 'importacion_energia', cat: 'energy', etiqueta: 'Importación neta de energía', unidad: '% uso', fuente: 'wb', codigo: 'EG.IMP.CONS.ZS',  dir: 'mas_riesgo',   decimales: 1,
    nota: 'Negativo en los exportadores netos. El percentil los sitúa correctamente, pero el número suelto se lee mal sin esta aclaración.' },

  // ── DEMO ─────────────────────────────────────────────────────────────────
  { id: 'mayores_65',        cat: 'demo', etiqueta: 'Población de 65 años o más', unidad: '% pobl.',  fuente: 'wb',  codigo: 'SP.POP.65UP.TO.ZS', dir: 'mas_riesgo',   decimales: 1,
    nota: 'Único indicador que puntúa en su categoría: la puntuación de DEMO es, en la práctica, el percentil de este dato.' },
  { id: 'crecimiento_poblacion', cat: 'demo', etiqueta: 'Crecimiento de la población', unidad: '% anual', fuente: 'wb', codigo: 'SP.POP.GROW',  dir: 'ambiguo',      decimales: 2 },
  { id: 'fecundidad',        cat: 'demo', etiqueta: 'Tasa de fecundidad',     unidad: 'hijos/mujer',  fuente: 'wb',  codigo: 'SP.DYN.TFRT.IN',    dir: 'ambiguo',      decimales: 2 },
  { id: 'saldo_migratorio',  cat: 'demo', etiqueta: 'Saldo migratorio',       unidad: 'personas',     fuente: 'wb',  codigo: 'SM.POP.NETM',       dir: 'ambiguo',      decimales: 0 },

  // ── URBANO ───────────────────────────────────────────────────────────────
  { id: 'pm25',              cat: 'urban', etiqueta: 'Contaminación del aire (PM2,5)', unidad: 'µg/m³', fuente: 'wb', codigo: 'EN.ATM.PM25.MC.M3', dir: 'mas_riesgo',   decimales: 1 },
  { id: 'crecimiento_urbano', cat: 'urban', etiqueta: 'Crecimiento urbano',   unidad: '% anual',      fuente: 'wb',  codigo: 'SP.URB.GROW',       dir: 'mas_riesgo',   decimales: 2 },
  { id: 'chabolismo',        cat: 'urban', etiqueta: 'Población en chabolas urbanas', unidad: '% urb.', fuente: 'inform', codigo: 'HA.FWB.POP.SLUM', dir: 'mas_riesgo', decimales: 1 },
  { id: 'poblacion_urbana',  cat: 'urban', etiqueta: 'Población urbana',      unidad: '% pobl.',      fuente: 'wb',  codigo: 'SP.URB.TOTL.IN.ZS', dir: 'ambiguo',      decimales: 1 },
  { id: 'infraestr_fisica',  cat: 'urban', etiqueta: 'Carencia de infraestructura física', unidad: '0–10', fuente: 'inform', codigo: 'CC.INF.PHY', dir: 'mas_riesgo',   decimales: 1 },

  // ── CIENCIA ──────────────────────────────────────────────────────────────
  { id: 'gasto_id',          cat: 'science', etiqueta: 'Inversión en I+D',    unidad: '% del PIB',    fuente: 'wb',  codigo: 'GB.XPD.RSDV.GD.ZS', dir: 'menos_riesgo', decimales: 2 },
  { id: 'patentes',          cat: 'science', etiqueta: 'Patentes de residentes', unidad: 'solicitudes', fuente: 'wb', codigo: 'IP.PAT.RESD',      dir: 'menos_riesgo', decimales: 0, escala: 'log' },
  { id: 'matricula_superior', cat: 'science', etiqueta: 'Matrícula universitaria', unidad: '% bruto',  fuente: 'wb',  codigo: 'SE.TER.ENRR',       dir: 'menos_riesgo', decimales: 1 },

  // ── JUSTICIA ─────────────────────────────────────────────────────────────
  { id: 'estado_derecho',    cat: 'justice', etiqueta: 'Estado de derecho',   unidad: '−2,5 a +2,5',  fuente: 'wgi', codigo: 'GOV_WGI_RL.EST',    dir: 'menos_riesgo', decimales: 2 },
  { id: 'control_corrupcion', cat: 'justice', etiqueta: 'Control de la corrupción', unidad: '−2,5 a +2,5', fuente: 'wgi', codigo: 'GOV_WGI_CC.EST', dir: 'menos_riesgo', decimales: 2 },
  { id: 'eficacia_gobierno', cat: 'justice', etiqueta: 'Eficacia del gobierno', unidad: '−2,5 a +2,5', fuente: 'wgi', codigo: 'GOV_WGI_GE.EST',   dir: 'menos_riesgo', decimales: 2 },
  { id: 'homicidios',        cat: 'justice', etiqueta: 'Homicidios intencionales', unidad: 'por 100.000', fuente: 'wb', codigo: 'VC.IHR.PSRC.P5', dir: 'mas_riesgo',   decimales: 1, escala: 'log' },

  // ── FINANZAS ─────────────────────────────────────────────────────────────
  { id: 'reservas_meses',    cat: 'finance', etiqueta: 'Reservas',            unidad: 'meses de importaciones', fuente: 'wb', codigo: 'FI.RES.TOTL.MO', dir: 'menos_riesgo', decimales: 1,
    nota: 'No es comparable para los miembros de una unión monetaria, cuyas reservas guarda el banco central común, ni para los emisores de moneda de reserva, que no necesitan acumularlas.' },
  { id: 'deuda_externa_pnb', cat: 'finance', etiqueta: 'Deuda externa',       unidad: '% del PNB',    fuente: 'wb',  codigo: 'DT.DOD.DECT.GN.ZS', dir: 'mas_riesgo',   decimales: 1,
    nota: 'El Banco Mundial solo lo publica para los países de renta baja y media; falta para los de renta alta, no porque no tengan deuda externa.' },
  { id: 'deuda_publica',     cat: 'finance', etiqueta: 'Deuda pública central', unidad: '% del PIB',  fuente: 'wb',  codigo: 'GC.DOD.TOTL.GD.ZS', dir: 'mas_riesgo',   decimales: 1,
    nota: 'Es deuda del gobierno CENTRAL, no del conjunto de las administraciones. En los países con mucho gasto descentralizado queda por debajo de la deuda pública total.' },
  { id: 'remesas_pib',       cat: 'finance', etiqueta: 'Remesas recibidas',   unidad: '% del PIB',    fuente: 'wb',  codigo: 'BX.TRF.PWKR.DT.GD.ZS', dir: 'ambiguo',    decimales: 2 },

  // ── OCÉANOS ──────────────────────────────────────────────────────────────
  { id: 'areas_marinas_protegidas', cat: 'ocean', etiqueta: 'Áreas marinas protegidas', unidad: '% aguas terr.', fuente: 'wb', codigo: 'ER.MRN.PTMR.ZS', dir: 'menos_riesgo', decimales: 1 },
  { id: 'peces_amenazados',  cat: 'ocean', etiqueta: 'Especies de peces amenazadas', unidad: 'especies', fuente: 'wb', codigo: 'EN.FSH.THRD.NO',  dir: 'mas_riesgo',   decimales: 0, escala: 'log' },
  { id: 'produccion_pesquera', cat: 'ocean', etiqueta: 'Producción pesquera', unidad: 't',            fuente: 'wb',  codigo: 'ER.FSH.PROD.MT',    dir: 'ambiguo',      decimales: 0, escala: 'log',
    nota: 'Volumen absoluto: depende del tamaño del país y de su litoral, no solo de la presión sobre el recurso. Por eso no puntúa.' },

  // ── BIOSEG ───────────────────────────────────────────────────────────────
  { id: 'superficie_forestal', cat: 'bio', etiqueta: 'Superficie forestal',   unidad: '% del suelo',  fuente: 'wb',  codigo: 'AG.LND.FRST.ZS',    dir: 'menos_riesgo', decimales: 1 },
  { id: 'areas_protegidas',  cat: 'bio', etiqueta: 'Áreas terrestres protegidas', unidad: '% del suelo', fuente: 'wb', codigo: 'ER.LND.PTLD.ZS', dir: 'menos_riesgo', decimales: 1 },
  { id: 'mamiferos_amenazados', cat: 'bio', etiqueta: 'Especies de mamíferos amenazadas', unidad: 'especies', fuente: 'wb', codigo: 'EN.MAM.THRD.NO', dir: 'mas_riesgo', decimales: 0, escala: 'log' },
  { id: 'amenaza_vectorial', cat: 'bio', etiqueta: 'Amenaza por vectores',    unidad: '0–10',         fuente: 'inform', codigo: 'HA.VECT',        dir: 'mas_riesgo',   decimales: 1 },
  { id: 'amenaza_epidemica', cat: 'bio', etiqueta: 'Amenaza epidémica',       unidad: '0–10',         fuente: 'inform', codigo: 'HA.NAT.EPI',     dir: 'mas_riesgo',   decimales: 1 },
];

/** Indicadores agrupados por categoría, en el orden del registro. */
export function porCategoria() {
  const m = new Map(CATEGORIAS.map((c) => [c.key, []]));
  for (const ind of INDICADORES) {
    if (!m.has(ind.cat)) throw new Error('categoría desconocida en el registro: ' + ind.cat);
    m.get(ind.cat).push(ind);
  }
  return m;
}

/** Comprobaciones de coherencia del propio registro. */
export function comprobarRegistro() {
  const problemas = [];
  const ids = new Set();
  for (const ind of INDICADORES) {
    if (ids.has(ind.id)) problemas.push('id repetido: ' + ind.id);
    ids.add(ind.id);
    if (!FUENTES[ind.fuente]) problemas.push(ind.id + ': fuente desconocida ' + ind.fuente);
    if (!['mas_riesgo', 'menos_riesgo', 'ambiguo'].includes(ind.dir)) {
      problemas.push(ind.id + ': dir inválida ' + ind.dir);
    }
  }
  for (const [cat, lista] of porCategoria()) {
    if (lista.filter((i) => i.dir !== 'ambiguo').length === 0) {
      problemas.push('categoría ' + cat + ' sin ningún indicador que puntúe');
    }
  }
  return problemas;
}
