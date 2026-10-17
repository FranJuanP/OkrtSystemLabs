/**
 * AETHER · Global Intelligence Globe
 *
 * T4 lo sacó de aether-globe-v3.html, donde iba inline (596 kB), para poder
 * quitar 'unsafe-inline' de script-src.
 *
 * T12: módulo ES. Lo que antes compartía por variables globales con
 * touch.js, functional-boost.js y module-hardening.js ahora se exporta.
 * Las lecturas funcionan con los bindings vivos de ESM; para las escrituras
 * desde fuera se expone `pointer`, una API explícita con el estado de
 * arrastre y zoom, en vez de dejar que un parche reasigne variables ajenas.
 *
 * La tabla COUNTRIES que define aquí es la que T23 sustituye por la lectura
 * de data/latest.json, para que el globo y el dashboard dejen de tener dos
 * verdades distintas.
 */
import { AETHER_COVERAGE } from '../core/coverage.js';
import { AETHER_STORAGE } from '../core/storage.js';
import { onVisibilityChange } from '../core/visibility.js';

/* T18: las texturas se importan en vez de referenciarse por cadena. Con la
   cadena, Vite no sabia que existian: no las copiaba al build, la peticion
   daba 404 y el globo se dibujaba sin ellas, porque el catch de loadTex se
   tragaba el fallo en silencio. Importadas, Vite las emite con hash y el
   precache de Workbox las recoge. */
import earthDayUrl from '../../assets/img/earth-day.webp?url';
import earthNightUrl from '../../assets/img/earth-night.webp?url';
import earthCloudsUrl from '../../assets/img/earth-clouds.webp?url';
import * as THREE from 'three';
import { cargarDatos } from '../core/datos.js';
import { construirPaisesGlobo, ISO_DE_ARCO } from './datos-globo.js';

/* ── T16 · three.js r128 -> r186 ──────────────────────────────────────────
   Se sube a la version actual y se empaqueta en el repositorio, en vez de
   descargarla del CDN. Dos notas sobre el salto:

   - El globo NO usa luces, asi que no le afecta el cambio al modelo de
     iluminacion fisica de r155, que es el cambio de ruptura mas grande del
     periodo. Tampoco usaba outputEncoding ni useLegacyLights.
   - Desde r152 la gestion de color esta activada por defecto: los colores
     en hexadecimal se interpretan como sRGB y se convierten a lineal, lo
     que desplaza TODOS los tonos del globo. Como la regla de trabajo es no
     cambiar la estetica, se desactiva para reproducir exactamente el
     comportamiento de r128. Pasar a color gestionado es una decision
     visible, y por tanto de John, no mia. */
THREE.ColorManagement.enabled = false;

/* T23 · Los paises salen de data/latest.json.

   Aqui habia una tabla de 176 entradas escritas a mano con cuatro campos
   inventados cada una: el nivel de riesgo (LOW/MEDIUM/HIGH/CRITICAL), la
   categoria destacada, un texto de analisis y las coordenadas.

   Lo peor no era que no tuvieran fuente, sino que el panel tenia SU PROPIA
   tabla con sus propios numeros: el mismo pais podia salir MEDIUM en el
   globo y ALTO en el panel, porque eran dos tablas distintas mantenidas por
   separado. Ahora las dos leen el mismo fichero y calculan con el mismo
   modulo, y tests/paridad.mjs lo comprueba pais a pais.

   Igual que en el panel, el await es deliberado: el globo no empieza a
   construir marcadores hasta que los datos estan. */
const { lista: COUNTRIES, fuera: PAISES_FUERA } = await (async () => {
  try {
    const { datos, calculo } = await cargarDatos();
    return construirPaisesGlobo(datos, calculo);
  } catch (err) {
    console.error('AETHER Globe: no se han podido cargar los datos:', err);
    return { lista: [], fuera: [] };
  }
})();

// ── Deduplicar por nombre
const seen = new Set();
/* T23: se deduplica por ISO3, no por nombre. Antes hacia falta porque la
   tabla escrita a mano tenia paises repetidos (Macedonia y Mexico aparecian
   dos veces); el fichero de datos no puede repetirlos, porque esta indexado
   por ISO3, asi que esto es ya solo una red de seguridad. */
const COUNTRIES_DEDUP = COUNTRIES.filter(c => {
  if(seen.has(c.iso)) return false;
  seen.add(c.iso); return true;
});

// ── TENSION ARCS
const TENSION_ARCS = [

  // ══════════════════════════════════════════
  // CONFLICTOS ARMADOS ACTIVOS — CRÍTICO
  // ══════════════════════════════════════════
  { a:"Rusia",          b:"Ucrania",          type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"CONFLICTO ARMADO ACTIVO",      signal:"Línea de contacto activa >1.000 km. Flujos de armamento OTAN continuos. Amenaza nuclear táctica como disuasión." },
  { a:"Israel",         b:"Palestina",        type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"CONFLICTO ACTIVO GAZA",         signal:"Operación militar activa. Colapso humanitario Gaza documentado. West Bank con violencia creciente." },
  { a:"Irán",           b:"Israel",           type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"CONFRONTACIÓN DIRECTA",        signal:"Ataques directos cruzando umbral histórico. Proxies en Yemen, Líbano, Iraq. Escalada simétrica: abierta." },
  { a:"Corea del Norte",b:"Corea del Sur",    type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"ARMISTICIO SIN PAZ",           signal:"DPRK destruyó carreteras intercoreanas. Declaró a Corea del Sur 'estado enemigo'. Sin comunicación oficial activa." },
  { a:"Corea del Norte",b:"Japón",            type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"AMENAZA BALÍSTICA",            signal:"Misiles sobre espacio aéreo japonés en frecuencia histórica. Coordinación trilateral EE.UU.–Japón–Corea Sur." },
  { a:"Sudán",          b:"Sudán del Sur",    type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"CONFLICTO CIVIL ACTIVO",       signal:"Guerra SAF vs RSF desde abril 2023. +8M desplazados. Crisis humanitaria masiva sin solución diplomática." },
  { a:"RDC",            b:"Ruanda",           type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"CONFLICTO PROXY ESTE-DRC",     signal:"Ruanda acusada de apoyar M23. 6M desplazados en este de RDC. Recursos mineros financian violencia." },
  { a:"Israel",         b:"Líbano",           type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"OPERACIONES ACTIVAS HEZBOLLAH",signal:"Intercambio de fuego con Hezbollah. Operaciones israelíes en sur del Líbano. Riesgo de escalada total." },
  { a:"Serbia",         b:"Kosovo",           type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"DISPUTA SOBERANÍA IRRESUELTA", signal:"Serbia no reconoce independencia de Kosovo. Incidentes armados norte Kosovo recurrentes. KFOR en alerta." },
  { a:"Myanmar",        b:"China",            type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"GUERRA CIVIL / INFLUENCIA",    signal:"Junta militar enfrenta resistencia armada masiva. China mantiene relaciones con Tatmadaw y EAO. Control territorial fragmentado." },

  // ══════════════════════════════════════════
  // TENSIONES ELEVADAS — HIGH
  // ══════════════════════════════════════════
  { a:"China",          b:"EE.UU.",           type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"RIVALIDAD ESTRATÉGICA",        signal:"Competencia tecnológica, naval y de influencia. Taiwán como detonador latente. Desacoplamiento económico parcial." },
  { a:"China",          b:"Taiwán",           type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"TENSIÓN DE REUNIFICACIÓN",      signal:"Incursiones ADIZ diarias. Ejercicios de bloqueo simulados. EEUU mantiene ambigüedad estratégica." },
  { a:"China",          b:"Japón",            type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"DISPUTAS MARÍTIMAS",            signal:"Senkaku / Diaoyu como epicentro. Incursiones navales recurrentes. Riesgo de incidente no intencional." },
  { a:"China",          b:"Filipinas",        type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"MAR DEL SUR — SOBERANÍA",       signal:"China bloquea misiones de reabastecimiento en Second Thomas Shoal. Cañones de agua y láseres contra guardacostas filipinos." },
  { a:"India",          b:"China",            type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"TENSIÓN FRONTERIZA HIMALAYA",   signal:"LAC como línea de fricción. Incidentes Galwan tipo sin resolución. Desacoplamiento económico iniciado." },
  { a:"Pakistán",       b:"India",            type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"DISPUTA TERRITORIAL NUCLEAR",   signal:"Kashmir como fractura permanente. Incidentes en LoC mensuales. Sin mecanismo de desescalada activo." },
  { a:"Irán",           b:"Arabia Saudí",     type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"RIVALIDAD REGIONAL",            signal:"Acercamiento frágil. Proxies en Yemen activos. Competencia Iraq y Líbano sostenida." },
  { a:"Turquía",        b:"Siria",            type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"TENSIÓN FRONTERIZA",            signal:"Turquía mantiene zonas de control en norte sirio. Operaciones contra posiciones kurdas. Conflicto congelado." },
  { a:"Turquía",        b:"Grecia",           type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"DISPUTAS EGEO / SOBERANÍA",     signal:"Disputa espacio aéreo 10nm vs 6nm. Vuelos militares en zonas grises. Incidentes navales en plataforma continental." },
  { a:"Turquía",        b:"Iraq",             type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"OPERACIONES ANTIKURDAS",        signal:"Turquía realiza operaciones militares en norte de Iraq contra PKK. Bases turcas en territorio iraquí sin autorización formal." },
  { a:"Rusia",          b:"Alemania",         type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"RUPTURA ENERGÉTICA",            signal:"Desconexión gas ruso. Sabotaje Nord Stream. Industria pesada alemana reseteando. Relación bilateral en mínimo histórico." },
  { a:"Rusia",          b:"Polonia",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"FLANCO ESTE OTAN",              signal:"Polonia despliega mayor presupuesto defensa OTAN. Tropas OTAN en suelo polaco. Corredor Suwalki como zona crítica." },
  { a:"Rusia",          b:"Estonia",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"FLANCO BÁLTICO — OTAN",         signal:"Estonia lidera gasto defensa per cápita OTAN. Ciberataques rusos documentados. Frontera con Rusia en vigilancia permanente." },
  { a:"Rusia",          b:"Finlandia",        type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"NUEVA FRONTERA OTAN",           signal:"Finlandia ingresó OTAN 2023: 1.340 km de nueva frontera directa Rusia-OTAN. Rusia amenaza con respuesta asimétrica." },
  { a:"Rusia",          b:"Reino Unido",      type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"GUERRA DE INTELIGENCIA",        signal:"Envenenamientos Salisbury. Ciberataques rusos en infraestructura UK. Reino Unido lidera sanciones y apoyo a Ucrania." },
  { a:"Bielorrusia",    b:"Polonia",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"WEAPONIZACIÓN MIGRACIÓN",       signal:"Lukashenko usa migrantes como arma híbrida. Miles de intentos de cruce forzado. Valla fronteriza y estado de emergencia." },
  { a:"Bielorrusia",    b:"Ucrania",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"BASE OPERACIONES RUSAS",        signal:"Bielorrusia sirvió de territorio de lanzamiento invasión 2022. Tropas rusas estacionadas. Lukashenko bajo presión de Moscú." },
  { a:"EE.UU.",         b:"Venezuela",        type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"PRESIÓN GEOPOLÍTICA",           signal:"Ciclos de sanción sin cambio de régimen. Migración como instrumento. Petróleo como variable encubierta." },
  { a:"EE.UU.",         b:"Corea del Norte",  type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"AMENAZA NUCLEAR / ICBM",        signal:"DPRK prueba ICBMs con alcance CONUS. Sin diálogo diplomático activo. Cooperación militar DPRK-Rusia en armamento." },
  { a:"Colombia",       b:"Venezuela",        type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"TENSIÓN FRONTERIZA",            signal:"Guerrillas colombianas operan en Venezuela. Migración masiva venezolana desestabilizadora. Relaciones complejas." },
  { a:"Marruecos",      b:"Argelia",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"RIVALIDAD REGIONAL",            signal:"Frontera cerrada desde 1994. Sahara Occidental como núcleo del conflicto. Competencia por influencia en Sahel." },
  { a:"Azerbaiyán",     b:"Armenia",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"POST-KARABAJ INESTABLE",        signal:"Karabaj tomado por fuerza 2023. 120.000 armenios expulsados. Frontera sin demarcación. Tensión residual." },
  { a:"Etiopía",        b:"Somalia",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"TENSIÓN REGIONAL CUERNO",       signal:"Acuerdo Somalilandia-Etiopía desestabiliza relaciones. Al-Shabaab como actor compartido de amenaza." },
  { a:"Etiopía",        b:"Eritrea",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"TENSIÓN POST-TIGRAY",           signal:"Eritrea participó en guerra Tigray. Fronteras sin demarcación. Alianza táctica frágil con Addis Abeba." },
  { a:"Afganistán",     b:"Pakistán",         type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"FRONTERA DURAND — TALIBAN",     signal:"Taliban no reconoce línea Durand. Ataques TTP desde Afganistán. Pakistán cierra pasos fronterizos periódicamente." },
  { a:"Sudán",          b:"Etiopía",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"DISPUTA FRONTERIZA AL-FASHAGA", signal:"Fuerzas etíopes y sudanesas enfrentadas en zona agrícola fértil. Sin resolución desde 2020. Desplazamientos continuos." },
  { a:"Myanmar",        b:"India",            type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"REFUGIADOS / FRONTERA POROSA",  signal:"500.000+ refugiados Myanmar en Manipur. India construye valla fronteriza. Grupos armados operan a ambos lados." },
  { a:"Siria",          b:"Israel",           type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"ATAQUES AÉREOS ISRAELÍES",      signal:"Israel realiza ataques regulares contra posiciones iraníes en Siria. Más de 600 ataques documentados desde 2017." },
  { a:"Iraq",           b:"Irán",             type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"INFLUENCIA PROXY IRANÍ",        signal:"Milicias pro-iraníes controlan zonas de Iraq. Ataques contra bases EEUU. Gobierno iraquí entre dos presiones." },
  { a:"Yemen",          b:"Arabia Saudí",     type:"CRITICAL",  col:0xFF4060, cssType:"t-c", label:"GUERRA CIVIL / INTERVENCIÓN",   signal:"Houthis respaldados por Irán vs. coalición saudí. +150.000 muertos. Crisis humanitaria. Armisticio frágil." },
  { a:"Yemen",          b:"EE.UU.",           type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"OPERACIONES ANTIHOUTHI",        signal:"EE.UU. y UK atacan posiciones Houthi por bloqueo Mar Rojo. Houthis atacan buques comerciales y militares." },
  { a:"Hungría",        b:"Ucrania",          type:"HIGH",      col:0xFF8030, cssType:"t-h", label:"BLOQUEO POLÍTICO OTAN/UE",      signal:"Hungría bloquea ayuda UE a Ucrania. Orbán mantiene relaciones con Moscú. Tensión con aliados OTAN persistente." },

  // ══════════════════════════════════════════
  // SANCIONES ECONÓMICAS — SANCTION
  // ══════════════════════════════════════════
  { a:"EE.UU.",         b:"Rusia",            type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"SANCIONES MÁXIMAS",            signal:"+14.000 sanciones desde feb. 2022. Exclusión parcial SWIFT. Confiscación reservas. Aislamiento financiero parcial." },
  { a:"EE.UU.",         b:"Irán",             type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"MÁXIMA PRESIÓN NUCLEAR",        signal:"Sanciones petróleo, banca y tecnología. Sin JCPOA vigente. Irán enriquece uranio al 60%+. Economía bajo presión severa." },
  { a:"EE.UU.",         b:"Corea del Norte",  type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"EMBARGO TOTAL",                 signal:"Régimen de sanciones más comprehensivo del mundo. DPRK evade por canal China y criptomonedas. Sin efecto en política nuclear." },
  { a:"EE.UU.",         b:"Cuba",             type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"EMBARGO 60 AÑOS",               signal:"Embargo más largo de la historia moderna. Crisis económica aguda. Apagones masivos. Migración histórica récord 2022-23." },
  { a:"EE.UU.",         b:"Venezuela",        type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"SANCIONES PETRÓLEO",            signal:"Sanciones PDVSA limitan exportaciones. Excepciones temporales negociadas. Maduro mantiene poder a pesar del impacto." },
  { a:"EE.UU.",         b:"Myanmar",          type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"SANCIONES JUNTA MILITAR",       signal:"Sanciones tras golpe 2021 contra generales y empresas militares. Limitado impacto en junta por apoyo chino y ruso." },
  { a:"EE.UU.",         b:"China",            type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"GUERRA TECNOLÓGICA / CHIPS",    signal:"Restricciones exportación semiconductores avanzados. Lista negra Huawei. China invierte masivamente en semiconductores propios." },
  { a:"Reino Unido",    b:"Rusia",            type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"SANCIONES POST-SALISBURY",      signal:"Sanciones oligarcas y empresas rusas. Congelación activos. Coordinación con UE y EE.UU. en régimen de sanciones." },
  { a:"China",          b:"Australia",        type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"GUERRA COMERCIAL",              signal:"China impuso aranceles vino, cebada, carbón australiano tras llamada australiana a investigar COVID-19. Levantados parcialmente 2023." },
  { a:"Rusia",          b:"Alemania",         type:"SANCTION",  col:0x4499FF, cssType:"t-s", label:"CONTRA-SANCIONES ENERGÉTICAS",  signal:"Rusia cortó gas Nord Stream como respuesta a sanciones occidentales. Alemania pagó precio económico severo en industria." },

  // ══════════════════════════════════════════
  // DEPENDENCIAS ENERGÉTICAS — ENERGY
  // ══════════════════════════════════════════
  { a:"Rusia",          b:"Turquía",          type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"TURKSTREAM — GAS NATURAL",      signal:"Turquía importa ~45% de su gas natural de Rusia. TurkStream como hub estratégico. Ankara mantiene relación ambigua con Moscú." },
  { a:"Rusia",          b:"China",            type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"POWER OF SIBERIA — GAS",        signal:"Gasoducto Power of Siberia operativo. Rusia pivota exportaciones energéticas hacia China tras sanciones occidentales." },
  { a:"Arabia Saudí",   b:"China",            type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"PETRÓLEO — DEPENDENCIA CLAVE",  signal:"China importa ~17% de su petróleo de Arabia Saudí. Conversaciones sobre facturar en yuanes. Desafío al petrodólar." },
  { a:"Arabia Saudí",   b:"India",            type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"PETRÓLEO — 2º PROVEEDOR",       signal:"Arabia Saudí es segundo proveedor de petróleo de India. India compra también petróleo ruso con descuento. Diversificación activa." },
  { a:"Qatar",          b:"Alemania",         type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"GNL — ACUERDO EMERGENCIA",      signal:"Acuerdo GNL 2022 para compensar gas ruso. Alemania construye terminales regasificación flotantes de emergencia." },
  { a:"Noruega",        b:"Alemania",         type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"GAS — SUSTITUCIÓN RUSIA",       signal:"Noruega se convirtió en principal proveedor gas a Europa post-Rusia. Ingresos récord fondo soberano noruego." },
  { a:"EE.UU.",         b:"Alemania",         type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"GNL AMERICANO — POST-NORDSTREAM",signal:"EE.UU. mayor proveedor GNL a Europa. Interés estratégico y económico en desplazar gas ruso del mercado europeo." },
  { a:"Kazajistán",     b:"China",            type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"RUTA PETRÓLEO CENTRAL ASIA",    signal:"Kazajistán diversifica rutas exportación petróleo. China como destino creciente. Presión rusa sobre oleoducto CPC." },
  { a:"Azerbaiyán",     b:"Italia",           type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"CORREDOR GAS SUR — TAP/TANAP",  signal:"Gasoducto Trans-Adriático lleva gas azerbaiyano a Italia. Alternativa estratégica al gas ruso para Europa del sur." },
  { a:"Irán",           b:"China",            type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"PETRÓLEO BAJO SANCIONES",       signal:"China importa petróleo iraní bajo sanciones con descuento masivo. 90%+ exportaciones iraníes van a China. Dependencia mutua." },
  { a:"Emiratos Árabes",b:"India",            type:"ENERGY",    col:0xFF9A3C, cssType:"t-e", label:"ENERGÍA / INVERSIÓN BILATERAL", signal:"Emiratos mayor inversor árabe en India. Acuerdo comercial integral 2022. Cooperación energías renovables y petróleo." },

  // ══════════════════════════════════════════
  // ALIANZAS MILITARES — ALLIANCE
  // ══════════════════════════════════════════
  { a:"EE.UU.",         b:"Israel",           type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"ALIANZA MILITAR INCONDICIONAL", signal:"EE.UU. garantiza seguridad israelí. +3.800M$ anuales en ayuda militar. Veto en Consejo de Seguridad ONU." },
  { a:"EE.UU.",         b:"Japón",            type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"TRATADO SEGURIDAD MUTUA",       signal:"Tratado 1960. 54.000 tropas EEUU en Japón. Japón amplía capacidades ofensivas históricamente. Respuesta a DPRK y China." },
  { a:"EE.UU.",         b:"Corea del Sur",    type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"ALIANZA DEFENSA MUTUA",         signal:"28.500 tropas EEUU en Corea del Sur. Ejercicios conjuntos reanudados. Escudo antimisiles THAAD operativo." },
  { a:"EE.UU.",         b:"Australia",        type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"AUKUS — SUBMARINOS NUCLEARES",   signal:"AUKUS: EE.UU. transfiere tecnología submarino nuclear a Australia. Australia primera nación no-OTAN con esa capacidad." },
  { a:"EE.UU.",         b:"Polonia",          type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"FLANCO ESTE — PRESENCIA OTAN",   signal:"EE.UU. establece cuartel permanente en Polonia. Primera vez desde WWII. Mayor despliegue OTAN en flanco este." },
  { a:"EE.UU.",         b:"Reino Unido",      type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"RELACIÓN ESPECIAL — 5 EYES",    signal:"Alianza inteligencia Five Eyes. Cooperación nuclear y misiles. Coordinación Ucrania, Indo-Pacífico y tecnología." },
  { a:"Rusia",          b:"China",            type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"ASOCIACIÓN ESTRATÉGICA SIN LÍMITES",signal:"Declaración sin límites feb. 2022. Coordinación ONU. Sin alianza formal pero alineamiento geopolítico profundo anti-occidental." },
  { a:"Rusia",          b:"Bielorrusia",      type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"ESTADO DE LA UNIÓN",            signal:"Unión política y militar. Armas nucleares rusas en Bielorrusia. Lukashenko completamente dependiente de Moscú." },
  { a:"Rusia",          b:"Irán",             type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"COOPERACIÓN MILITAR PROFUNDA",   signal:"Irán suministra drones Shahed a Rusia. Rusia transfiere tecnología militar. Coordinación Siria. Eje anti-occidental." },
  { a:"China",          b:"Pakistán",         type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"CPEC — CORREDOR ECONÓMICO",      signal:"Corredor Económico China-Pakistán 62.000M$. Gwadar como puerto estratégico. Cooperación nuclear y militar profunda." },
  { a:"China",          b:"Irán",             type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"ACUERDO 25 AÑOS",               signal:"Acuerdo cooperación 2021: 400.000M$ inversión china en Irán a cambio de petróleo. Eje anti-sanciones." },
  { a:"Turquía",        b:"Azerbaiyán",       type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"UNA NACIÓN DOS ESTADOS",        signal:"Alianza militar, cultural y energética. Drones Bayraktar clave en victoria de Karabaj 2020. Gasoducto BTC compartido." },
  { a:"India",          b:"Rusia",            type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"DEFENSA HISTÓRICA",             signal:"70% arsenal militar indio de origen ruso. India compra petróleo ruso con descuento. No condenó invasión Ucrania en ONU." },
  { a:"Francia",        b:"Alemania",         type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"EJE FRANCO-ALEMÁN UE",          signal:"Motor de la integración europea. Coordinación defensa, energía y política exterior. Tensiones sobre estrategia Ucrania." },
  { a:"Australia",      b:"Reino Unido",      type:"ALLIANCE",  col:0x00CC66, cssType:"t-a", label:"AUKUS — PILAR INDO-PACÍFICO",    signal:"Reino Unido transfiere tecnología propulsión nuclear a Australia en AUKUS. Presencia naval en Indo-Pacífico reforzada." },

  // ══════════════════════════════════════════
  // CONFLICTOS PROXY / INFLUENCIA — PROXY
  // ══════════════════════════════════════════
  { a:"Irán",           b:"Yemen",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"APOYO HOUTHI",                  signal:"Irán suministra misiles antibuque, drones y tecnología a Houthis. Canal de suministro a través de Omán e Iraq." },
  { a:"Irán",           b:"Líbano",           type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"HEZBOLLAH — BRAZO ARMADO",      signal:"Irán financia y arma a Hezbollah con >700M$/año. Hezbollah como herramienta de disuasión regional contra Israel." },
  { a:"Irán",           b:"Siria",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"PRESENCIA IRGC EN SIRIA",       signal:"IRGC y milicias iraníes en Siria desde 2013. Israel ataca regularmente. Corredor terrestre Irán-Líbano en construcción." },
  { a:"Rusia",          b:"Siria",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"INTERVENCIÓN MILITAR DIRECTA",  signal:"Rusia intervino militarmente 2015. Bases Tartus y Hmeimim. Negociando permanencia con nueva administración post-Assad." },
  { a:"Rusia",          b:"Mali",             type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"WAGNER / AFRICA CORPS",        signal:"Wagner/Africa Corps desplazado tras expulsión Francia. Junta maliense depende de mercenarios rusos. Recursos minerales." },
  { a:"Rusia",          b:"Burkina Faso",     type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"WAGNER SAHEL",                  signal:"Junta Burkina expulsó fuerzas francesas. Contrató Wagner. Ataques yihadistas continúan. Control territorial reducido." },
  { a:"Rusia",          b:"Níger",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"GOLPE / PIVOTE RUSIA",          signal:"Golpe jul. 2023 expulsó Francia. Junta giró a Rusia y Wagner. EE.UU. perdió base drones clave en Agadez." },
  { a:"Rusia",          b:"República Centroafricana",type:"PROXY",col:0xCC44FF,cssType:"t-p",label:"WAGNER — CONTROL TOTAL",       signal:"Wagner controla seguridad del estado desde 2018. Extracción diamantes y oro. Propaganda antifrancesa masiva." },
  { a:"Francia",        b:"Mali",             type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"EXPULSIÓN POST-SAHEL",          signal:"Francia expulsada 2022 tras golpe. Retirada Barkhane. Pérdida de influencia en Sahel frente a avance ruso-Wagner." },
  { a:"Francia",        b:"Níger",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"EXPULSIÓN DIPLOMÁTICA",         signal:"Niger expulsó embajador francés, retiró acuerdos militares. Francia pierde último bastión Sahel. Giro geopolítico." },
  { a:"EE.UU.",         b:"Ucrania",          type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"APOYO MILITAR MASIVO",          signal:"+100.000M$ ayuda militar EEUU. Sistemas ATACMS, Abrams, Patriots. Debate continuo sobre misiles largo alcance en Rusia." },
  { a:"Turquía",        b:"Libia",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"INTERVENCIÓN TRIPOLITANIA",     signal:"Turquía desplegó tropas y drones en apoyo GNA Trípoli. Memorándum mar permite presencia naval en Mediterráneo." },
  { a:"Emiratos Árabes",b:"Libia",            type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"APOYO A HAFTAR / LNA",          signal:"Emiratos financia y equipa LNA de Haftar. Drones chinos Wing Loong. Contrapeso al eje Turquía-Trípoli." },
  { a:"China",          b:"RDC",              type:"PROXY",     col:0xCC44FF, cssType:"t-p", label:"INTERESES MINEROS",             signal:"China controla ~50% minería cobalto RDC. Interés en estabilidad sin intervención directa. Influencia económica como proxy." },

];


const RISK_HEX = { CRITICAL:'#FF4060', HIGH:'#FF8030', MEDIUM:'#FFB020', LOW:'#00FFC8' };
const RISK_INT = { CRITICAL:0xFF4060, HIGH:0xFF8030, MEDIUM:0xFFB020, LOW:0x00FFC8 };
const BADGE_CLS= { CRITICAL:'bc', HIGH:'bh', MEDIUM:'bm', LOW:'bl2' };

// ── PROGRESS ──
function prog(p, m) {
  document.getElementById('ldFill').style.width = p + '%';
  document.getElementById('ldMsg').textContent  = m;
}

// ── UPDATE STATS ──
function updateStats() {
  const cnt = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 };
  COUNTRIES_DEDUP.forEach(c => cnt[c.risk]++);
  document.getElementById('sc').textContent = cnt.CRITICAL;
  document.getElementById('sh').textContent = cnt.HIGH;
  document.getElementById('sm').textContent = cnt.MEDIUM;
  document.getElementById('sl2').textContent = cnt.LOW;
  document.getElementById('countLabel').textContent =
    // T9: la cifra de referencia es la cobertura real del motor (201). El
    // globo dibuja hoy menos marcadores, asi que se dicen las dos: lo que
    // pinta y sobre cuantos. T23 unifica las dos tablas y esto se simplifica.
    `SEÑAL ACTIVA — ${COUNTRIES_DEDUP.length} DE ${AETHER_COVERAGE.countries} PAÍSES · ${AETHER_COVERAGE.categories} CATEGORÍAS`;
}

// ── RENDERER ──
const glCanvas  = document.getElementById('gl-canvas');
const lblCanvas = document.getElementById('lbl-canvas');
const W = innerWidth, H = innerHeight;
const renderer  = new THREE.WebGLRenderer({ canvas:glCanvas, antialias:true });
renderer.setSize(W, H);
/* T30 · Tope de 1,75 en vez de 2,5.
   Con 2,5 un movil de densidad 3 renderiza 6,25 veces los pixeles logicos; a
   partir de 1,75 la diferencia en un globo con brillos y lineas finas es
   practicamente invisible y el coste de relleno crece con el cuadrado. */
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x000508, 1);
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 200);
camera.position.set(0, 0, 2.9);
const lctx   = lblCanvas.getContext('2d');
lblCanvas.width = W; lblCanvas.height = H;

const globeGroup = new THREE.Group();
scene.add(globeGroup);

// ── SHADERS ──
const VERT = `
  varying vec2 vUv; varying vec3 vNormal,vWorldPos,vViewDir;
  void main(){
    vUv=uv; vec4 wp=modelMatrix*vec4(position,1.);
    vWorldPos=wp.xyz; vNormal=normalize(normalMatrix*normal);
    vViewDir=normalize(cameraPosition-wp.xyz);
    gl_Position=projectionMatrix*viewMatrix*wp;
  }`;

const FRAG = `
  uniform sampler2D uTex;
  uniform sampler2D uTexNight;
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec2 vUv; varying vec3 vNormal,vWorldPos,vViewDir;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    // ── Day / Night textures ──
    vec3 dayCol   = texture2D(uTex,      vUv).rgb;
    vec3 nightCol = texture2D(uTexNight, vUv).rgb;

    // Sun illumination: dot product of surface normal and sun direction
    float sunDot = dot(vNormal, normalize(uSunDir));

    // Soft terminator transition (-0.18 to +0.22)
    float dayMix = smoothstep(-0.18, 0.22, sunDot);

    // Boost night lights in dark side
    vec3 nightBoosted = nightCol * 2.8;

    // Base earth color blend
    vec3 col = mix(nightBoosted, dayCol, dayMix);

    // ── Specular highlight (ocean glint on day side) ──
    float spec = pow(max(dot(reflect(-normalize(uSunDir), vNormal), vViewDir), 0.), 48.) * 0.35 * dayMix;
    col += vec3(1.0, 0.97, 0.9) * spec;

    // ── Atmospheric rim glow ──
    float fr = pow(1. - clamp(dot(vNormal, vViewDir), 0., 1.), 3.5);
    // Day side: warm white rim. Night side: faint cyan
    vec3 rimDay   = vec3(0.7, 0.85, 1.0) * 0.55;
    vec3 rimNight = vec3(0.0, 1.0, 0.78) * 0.35;
    col += mix(rimNight, rimDay, dayMix) * fr;

    // ── Subtle AETHER holographic overlays (kept thin over real earth) ──
    vec3 cyan = vec3(0., 1., .78);

    // Fine lat/lon grid — very subtle
    float gf = max(step(.97, fract(vUv.y*72.)), step(.97, fract(vUv.x*144.))) * 0.06;
    float gc = max(step(.93, fract(vUv.y*12.)), step(.93, fract(vUv.x*24.)))  * 0.09;
    col += cyan * (gf + gc) * (0.4 + 0.6 * (1. - dayMix));  // more visible on night side

    // Scan sweep line
    float sw = fract(uTime * 0.05);
    float scan = (1. - smoothstep(0., .004, abs(vUv.y - sw))) * 0.25;
    col += cyan * scan;

    // Polar aurora shimmer
    float lat = abs((vUv.y - .5) * 2.);
    float aurora = smoothstep(.75, 1., lat) * (sin(uTime*.8 + vUv.x*14.) * .5 + .5) * .18;
    col += vec3(0.2, 0.8, 1.0) * aurora * (1. - dayMix + 0.3);

    // Terminator glow line (thin band at day/night boundary)
    float termLine = (1. - smoothstep(0., 0.06, abs(sunDot))) * 0.18;
    col += vec3(1.0, 0.6, 0.3) * termLine;

    gl_FragColor = vec4(col, 1.0);
  }`;

const ATMOS_V = `varying vec3 vNormal,vWorldPos;
  void main(){vNormal=normalize(normalMatrix*normal);vWorldPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const ATMOS_F = `uniform vec3 uColor;uniform float uPow,uOpacity,uTime;
  varying vec3 vNormal,vWorldPos;
  void main(){vec3 vd=normalize(cameraPosition-vWorldPos);float fr=pow(1.-clamp(dot(vNormal,vd),0.,1.),uPow);
  float f=1.+sin(uTime*3.1+vWorldPos.y*8.)*.04;gl_FragColor=vec4(uColor,fr*uOpacity*f);}`;

function makeAtmos(r, pw, op, col) {
  const m = new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(col)},uPow:{value:pw},uOpacity:{value:op},uTime:{value:0}},
    vertexShader:ATMOS_V, fragmentShader:ATMOS_F,
    transparent:true, side:THREE.BackSide, blending:THREE.AdditiveBlending, depthWrite:false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(r,64,64), m);
}

/* buildTex() borrada: no se llamaba desde ningun sitio.

   Generaba la textura del mundo dibujando los paises de un topojson sobre
   un canvas de 4096x2048 con d3-geo, y devolvia una CanvasTexture. Nadie la
   invocaba: el globo usa las tres texturas WebP (dia, noche y nubes) desde
   T18. Se quedo ahi al externalizar el motor y arrastraba topojson-client al
   bundle para nada; d3 ni siquiera estaba importado en este modulo, asi que
   si alguien la hubiera llamado habria lanzado un ReferenceError.

   Esta en el historial si alguna vez hace falta: git log -- src/globe/engine.js */

// ── STARS ──
function buildStars() {
  const N=5000; const pos=new Float32Array(N*3),col=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const r=70+Math.random()*50,t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
    const w=Math.random();
    col[i*3]=w>.85?1.:(w>.6?.85:.7); col[i*3+1]=w>.85?.9:(w>.6?.9:.8); col[i*3+2]=w>.85?.7:1.;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  scene.add(new THREE.Points(geo,new THREE.PointsMaterial({vertexColors:true,size:.09,transparent:true,opacity:.65,sizeAttenuation:true,blending:THREE.AdditiveBlending,depthWrite:false})));
}

// ── GEO UTIL ──
function ll2v(lat,lng,r=1.0){
  const phi=(90-lat)*Math.PI/180, theta=(lng+180)*Math.PI/180;
  return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));
}

// ── STATE ──
let selectedCountry = null, activeArcIndex = -1;
/* T30: dotMeshes y pulseMeshes se quedan vacios. Eran los 211+633 objetos
   que ahora son mallas instanciadas; los arrays se conservan porque el
   export y el asa de depuracion los nombran, y vaciarlos deja constancia de
   que ya no hay mallas sueltas que recorrer. */
const dotMeshes=[], markerData=[], pulseMeshes=[], arcObjects=[];

// ── RETICLE STATE ──
const reticle = {
  active:false, x:0, y:0, alpha:0,
  r1:0, r2:0, r3:0,   // three ring radii animate inward
  scanT:0,             // coord scan 0..1
  lat:0, lng:0, color:'#00FFC8', phase:0
};


/* T30 · Los marcadores pasan a mallas instanciadas.

   Medido antes: 1.724 llamadas de dibujado, 433.656 triangulos, 1.728 hijos
   en la escena, 9 fps. Ocultando solo los marcadores el globo subia a 24 fps
   y las llamadas bajaban a 183, asi que el problema no estaba en las
   etiquetas ni en los arcos: estaba en crear SEIS MALLAS SUELTAS POR PAIS.
   Con 211 paises eso son mas de mil objetos, cada uno con su propia llamada
   de dibujado y su propia geometria.

   Ahora cada tipo de marcador es una sola InstancedMesh con 211 instancias:
   una geometria, un material, una llamada. El color por instancia va con
   setColorAt, que MeshBasicMaterial sabe usar.

   Los anillos que laten son el caso delicado: cada pais late en su propia
   fase y con su propia opacidad, y la opacidad de un material es una sola
   para todas las instancias. En vez de renunciar al efecto, la fase va como
   atributo de instancia y el latido se calcula EN EL VERTEX SHADER, que es
   donde sale gratis. Se ve igual que antes y cuesta una llamada por anillo.

   Las espigas de los paises criticos siguen siendo mallas sueltas: son pocas
   (las que esten en CRITICAL, ahora mismo ninguna) y no merece la pena. */

/** Matriz de un marcador: posicion sobre la esfera y orientacion al exterior. */
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _ARRIBA = new THREE.Vector3(0, 1, 0);
const _escala = new THREE.Vector3(1, 1, 1);

function matrizDeMarcador(pos, up, escala) {
  _q.setFromUnitVectors(_ARRIBA, up);
  _escala.set(escala, escala, escala);
  return _m4.compose(pos, _q, _escala);
}

/**
 * Anillos que laten, con la fase por instancia.
 *
 * El vertex shader escala el anillo y el fragment lo atenua, igual que hacia
 * el bucle de animacion mesh a mesh. uTime es lo unico que se actualiza por
 * fotograma: una asignacion, en vez de 633 escalas y 633 opacidades.
 */
const PULSO_VERT = `
  attribute float fase;
  attribute vec3 instanceColorA;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    float s = 1.0 + 0.65 * (sin(uTime * 1.75 + fase) * 0.5 + 0.5);
    vColor = instanceColorA;
    vAlpha = 1.0 - (s - 1.0) / 0.65;
    vec3 p = position * s;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }`;

const PULSO_FRAG = `
  uniform float uOpacidad;
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    gl_FragColor = vec4(vColor, uOpacidad * vAlpha);
  }`;

/** Los materiales de pulso, para poder actualizar uTime en el bucle. */
const materialesPulso = [];

function buildMarkers(){
  const n = COUNTRIES_DEDUP.length;
  if (!n) return;

  const pos = [];
  const ups = [];
  const colores = [];
  COUNTRIES_DEDUP.forEach((c) => {
    const v = ll2v(c.lat, c.lng, 1.018);
    pos.push(v);
    ups.push(v.clone().normalize());
    colores.push(new THREE.Color(RISK_INT[c.risk]));
    markerData.push(c);
  });

  /** Crea una InstancedMesh colocada en los 211 puntos. */
  const instanciar = (geo, mat, escala) => {
    const im = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) {
      im.setMatrixAt(i, matrizDeMarcador(pos[i], ups[i], escala));
      im.setColorAt(i, colores[i]);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    // Los marcadores no se mueven respecto del globo: no hace falta
    // recalcular su matriz en cada fotograma.
    im.matrixAutoUpdate = false;
    globeGroup.add(im);
    return im;
  };

  // El punto. Es lo que se puede pulsar, asi que se guarda para el raycast.
  // 10x10 segmentos por esfera eran 160 triangulos; 8x6 bastan a este tamano.
  dotInstances = instanciar(
    new THREE.SphereGeometry(0.011, 8, 6),
    new THREE.MeshBasicMaterial({}),
    1,
  );

  // Halos. Mismo centro, radios mayores, aditivos.
  [{ r: 0.018, op: 0.16 }, { r: 0.028, op: 0.06 }].forEach(({ r, op }) => {
    instanciar(
      new THREE.SphereGeometry(r, 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }),
      1,
    );
  });

  // Anillo de base. El toro pasa de 8x36 a 6x24 segmentos: a 20 pixeles de
  // diametro en pantalla la diferencia no se ve y son 576 triangulos menos
  // por pais.
  instanciar(
    new THREE.TorusGeometry(0.02, 0.002, 6, 24),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }),
    1,
  );

  // Anillos que laten, uno por nivel. Cada nivel incluye a los paises cuyo
  // riesgo le da derecho a ese anillo; los demas se colocan con escala 0,
  // que es la forma de "no dibujar" una instancia sin romper el indice.
  const tamanos = [0.022, 0.034, 0.05];
  const opacidades = [0.48, 0.26, 0.13];
  for (let ri = 0; ri < 3; ri++) {
    const geo = new THREE.TorusGeometry(tamanos[ri], 0.0014, 6, 24);
    const fases = new Float32Array(n);
    const colorA = new Float32Array(n * 3);
    let cuantos = 0;
    const im = new THREE.InstancedMesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacidad: { value: opacidades[ri] } },
        vertexShader: PULSO_VERT,
        fragmentShader: PULSO_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      n,
    );
    COUNTRIES_DEDUP.forEach((c, i) => {
      const maximo = c.risk === 'CRITICAL' ? 3 : c.risk === 'HIGH' ? 2 : 1;
      const visible = ri < maximo;
      if (visible) cuantos++;
      im.setMatrixAt(i, matrizDeMarcador(pos[i], ups[i], visible ? 1 : 0));
      fases[i] = (i / n) * Math.PI * 2 + ri * 1.2;
      colorA[i * 3] = colores[i].r;
      colorA[i * 3 + 1] = colores[i].g;
      colorA[i * 3 + 2] = colores[i].b;
    });
    geo.setAttribute('fase', new THREE.InstancedBufferAttribute(fases, 1));
    geo.setAttribute('instanceColorA', new THREE.InstancedBufferAttribute(colorA, 3));
    im.instanceMatrix.needsUpdate = true;
    im.matrixAutoUpdate = false;
    globeGroup.add(im);
    materialesPulso.push(im.material);
    if (!cuantos) im.visible = false;
  }

  // Espigas de los paises criticos: pocas, siguen sueltas.
  COUNTRIES_DEDUP.forEach((c, i) => {
    if (c.risk !== 'CRITICAL') return;
    const spike = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0004, 0.0025, 0.09, 6),
      new THREE.MeshBasicMaterial({ color: RISK_INT[c.risk], transparent: true, opacity: 0.45 }),
    );
    spike.position.copy(pos[i]).addScaledVector(ups[i], 0.045);
    spike.quaternion.setFromUnitVectors(_ARRIBA, ups[i]);
    globeGroup.add(spike);
  });
}

// ── BUILD ARCS ──
// ── PARÁMETROS VISUALES POR TIPO ──
const ARC_CFG = {
  // type       : { convoy, speedBase, speedJitter, particleSize, lineOpacity, glowOpacity, trailLen, height }
  'CRITICAL'    : { convoy:7,  speedBase:0.52, speedJitter:0.18, pSize:0.0065, lineOp:0.82, glowOp:0.28, trail:14, h:1.62 },
  'HIGH'        : { convoy:5,  speedBase:0.36, speedJitter:0.14, pSize:0.0055, lineOp:0.65, glowOp:0.20, trail:11, h:1.55 },
  'SANCTION'    : { convoy:3,  speedBase:0.18, speedJitter:0.08, pSize:0.0045, lineOp:0.50, glowOp:0.14, trail:8,  h:1.48 },
  'ENERGY'      : { convoy:4,  speedBase:0.22, speedJitter:0.10, pSize:0.0050, lineOp:0.55, glowOp:0.16, trail:10, h:1.50 },
  'ALLIANCE'    : { convoy:4,  speedBase:0.20, speedJitter:0.09, pSize:0.0048, lineOp:0.52, glowOp:0.15, trail:9,  h:1.50 },
  'PROXY'       : { convoy:5,  speedBase:0.30, speedJitter:0.12, pSize:0.0052, lineOp:0.58, glowOp:0.18, trail:12, h:1.52 },
};
const ARC_CFG_DEFAULT = { convoy:3, speedBase:0.22, speedJitter:0.10, pSize:0.0045, lineOp:0.45, glowOp:0.12, trail:8, h:1.48 };

function buildArcs(){
  TENSION_ARCS.forEach((arc,idx)=>{
    const from = COUNTRIES_DEDUP.find(c=>c.iso===isoDeExtremo(arc.a));
    const to   = COUNTRIES_DEDUP.find(c=>c.iso===isoDeExtremo(arc.b));
    if(!from||!to) return;

    const cfg = ARC_CFG[arc.type] || ARC_CFG_DEFAULT;

    const v1  = ll2v(from.lat,from.lng,1.02);
    const v2  = ll2v(to.lat,  to.lng,  1.02);
    const mid = v1.clone().add(v2).normalize().multiplyScalar(cfg.h + 0.02*((idx%4)*.25));
    const curve = new THREE.QuadraticBezierCurve3(v1,mid,v2);
    const pts   = curve.getPoints(140);

    const makeLine = (opacity) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts.flatMap(p=>[p.x,p.y,p.z])),3));
      geo.setDrawRange(0,0);
      const mat = new THREE.LineBasicMaterial({color:arc.col,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});
      const line = new THREE.Line(geo,mat); line.visible=false; globeGroup.add(line); return line;
    };
    const line = makeLine(0);
    const glow = makeLine(0);

    // ── CONVOY PARTICLES — tamaño y cantidad según tipo ──
    const convoy = [];
    for(let i=0;i<cfg.convoy;i++){
      const pSize = cfg.pSize + Math.random()*0.002;
      const pGeo  = new THREE.SphereGeometry(pSize, 6, 6);
      const pMat  = new THREE.MeshBasicMaterial({color:arc.col,transparent:true,opacity:0,blending:THREE.AdditiveBlending});
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.visible = false;
      globeGroup.add(pMesh);
      convoy.push({
        mesh:  pMesh,
        t:     i / cfg.convoy,
        speed: cfg.speedBase + Math.random() * cfg.speedJitter,
        trail: [],
        trailLen: cfg.trail + Math.floor(Math.random()*4),
        // ARCOS BIDIRECCIONALES: CRITICAL y PROXY van en ambas direcciones
        dir:   (arc.type==='CRITICAL'||arc.type==='PROXY') && i%2===1 ? -1 : 1
      });
    }

    arcObjects.push({ line, glow, convoy, curve, pts, data:arc, cfg, progress:0, targetProgress:0, animating:false });
  });
}


let activationTimers = [];
function clearTimers(){ activationTimers.forEach(clearTimeout); activationTimers=[]; }

function deactivateAllArcs(){
  clearTimers();
  arcObjects.forEach(ao=>{
    ao.targetProgress=0;
    ao.line.material.opacity=0; ao.glow.material.opacity=0;
    ao.convoy.forEach(p=>{ p.mesh.material.opacity=0; p.mesh.visible=false; });
  });
}

/* T23 · Los arcos siguen nombrando a los paises como lo hacian ("Rusia",
   "EE.UU."), porque es texto editorial y es lo que se muestra. Lo que ya no
   se puede hacer es emparejarlos por ese nombre con la lista de paises: los
   nombres vienen ahora del Banco Mundial y no coinciden ("Federacion de
   Rusia"). El emparejamiento pasa por el ISO3. */
function isoDeExtremo(nombre){ return ISO_DE_ARCO[nombre] || null; }
function arcoToca(arc, iso){ return isoDeExtremo(arc.a)===iso || isoDeExtremo(arc.b)===iso; }

function activateArcsForCountry(iso){
  deactivateAllArcs();
  arcObjects.filter(ao=>arcoToca(ao.data, iso)).forEach((ao,i)=>{
    const t=setTimeout(()=>{
      ao.line.visible=true; ao.glow.visible=true;
      ao.animating=true; ao.progress=0;
      ao.line.geometry.setDrawRange(0,0); ao.glow.geometry.setDrawRange(0,0);
      ao.targetProgress=1;
      ao.convoy.forEach(p=>{ p.mesh.visible=true; p.trail=[]; });
    }, i*160);
    activationTimers.push(t);
  });
}

/* T12/T13: aqui habia una primera definicion de updateArcs(dt).
   Mas abajo se declaraba otra con el mismo nombre, que por hoisting es la
   que gana en tiempo de ejecucion, asi que esta nunca llegaba a usarse.
   En un modulo ES dos declaraciones con el mismo nombre son un error de
   sintaxis, de modo que la migracion la ha destapado. Se conserva la que
   gana hoy, que es la que aplica la intensidad del dashboard. */


// ── SCREEN PROJECTION ──
function w2s(localPos){
  const wPos=localPos.clone().applyMatrix4(globeGroup.matrixWorld);
  const gC=new THREE.Vector3().applyMatrix4(globeGroup.matrixWorld);
  const n=wPos.clone().sub(gC).normalize();
  const tc2=camera.position.clone().sub(gC).normalize();
  const f=n.dot(tc2); if(f<.1) return null;
  const p=wPos.clone().project(camera);
  return{x:(p.x*.5+.5)*lblCanvas.width,y:(-p.y*.5+.5)*lblCanvas.height,f};
}

// ── DRAW RETICLE ──
function drawReticle(dt){
  if(!reticle.active) return;
  // find screen pos of selected country
  const c = COUNTRIES_DEDUP.find(x=>x.iso===selectedCountry);
  if(!c) return;
  const sc = w2s(ll2v(c.lat,c.lng,1.025));
  if(!sc){ reticle.alpha=Math.max(0,reticle.alpha-dt*3); }
  else {
    reticle.x = sc.x; reticle.y = sc.y;
    reticle.alpha = Math.min(1, reticle.alpha + dt*4);
  }
  reticle.phase += dt;
  reticle.scanT = Math.min(1, reticle.scanT + dt*1.2);

  const x=reticle.x, y=reticle.y, a=reticle.alpha, col=reticle.color;

  // animate rings inward from 60→28, 42→18, 26→10
  const R1 = 28 + (1-reticle.scanT)*32;
  const R2 = 18 + (1-reticle.scanT)*24;
  const R3 = 10 + (1-reticle.scanT)*16;

  lctx.save();

  // outer ring
  lctx.beginPath(); lctx.arc(x,y,R1,0,Math.PI*2);
  lctx.strokeStyle=col; lctx.lineWidth=0.8; lctx.globalAlpha=a*0.5; lctx.stroke();

  // rotating dashes on outer ring
  lctx.save();
  lctx.translate(x,y); lctx.rotate(reticle.phase*0.8);
  for(let i=0;i<8;i++){
    const ang=i*Math.PI/4;
    lctx.beginPath();
    lctx.arc(0,0,R1, ang, ang+0.25);
    lctx.strokeStyle=col; lctx.lineWidth=2; lctx.globalAlpha=a*0.9; lctx.stroke();
  }
  lctx.restore();

  // mid ring
  lctx.beginPath(); lctx.arc(x,y,R2,0,Math.PI*2);
  lctx.strokeStyle=col; lctx.lineWidth=0.6; lctx.globalAlpha=a*0.35; lctx.stroke();

  // inner ring
  lctx.beginPath(); lctx.arc(x,y,R3,0,Math.PI*2);
  lctx.strokeStyle=col; lctx.lineWidth=1.2; lctx.globalAlpha=a*0.7; lctx.stroke();

  // crosshair lines
  const CH=R1+10;
  [[1,0],[- 1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
    lctx.beginPath();
    lctx.moveTo(x+dx*(R3+3), y+dy*(R3+3));
    lctx.lineTo(x+dx*CH, y+dy*CH);
    lctx.strokeStyle=col; lctx.lineWidth=0.8; lctx.globalAlpha=a*0.55; lctx.stroke();
  });

  // corner brackets at outer ring
  const BS=10, BR=R1;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{
    const bx=x+sx*BR*0.707, by=y+sy*BR*0.707;
    lctx.beginPath(); lctx.moveTo(bx, by+sy*BS); lctx.lineTo(bx,by); lctx.lineTo(bx+sx*BS,by);
    lctx.strokeStyle=col; lctx.lineWidth=1.5; lctx.globalAlpha=a*0.9; lctx.stroke();
  });

  // center dot
  lctx.beginPath(); lctx.arc(x,y,2,0,Math.PI*2);
  lctx.fillStyle=col; lctx.globalAlpha=a; lctx.fill();

  // scanning coords text
  if(reticle.scanT>0.3){
    const progress = (reticle.scanT-0.3)/0.7;
    const latStr  = c.lat>0?c.lat.toFixed(2)+'°N':Math.abs(c.lat).toFixed(2)+'°S';
    const lngStr  = c.lng>0?c.lng.toFixed(2)+'°E':Math.abs(c.lng).toFixed(2)+'°W';
    const fullStr = latStr+'  '+lngStr;
    const shown   = fullStr.slice(0, Math.floor(progress*fullStr.length));
    lctx.font='8px "Space Mono",monospace';
    lctx.fillStyle=col; lctx.globalAlpha=a*0.8;
    lctx.fillText(shown, x+R1+8, y+4);
    // risk level tag
    if(progress>0.6){
      lctx.fillText(c.risk, x+R1+8, y+16);
    }
  }

  lctx.restore();
}

// ── DRAW ARC TRAILS ──
function drawArcTrails(){
  arcObjects.forEach(ao=>{
    if(ao.progress<.08) return;
    ao.convoy.forEach(p=>{
      if(p.trail.length<2) return;
      for(let i=1;i<p.trail.length;i++){
        const pa=p.trail[i-1], pb=p.trail[i];
        const pa2d=w2s(pa), pb2d=w2s(pb);
        if(!pa2d||!pb2d) continue;
        const t=i/p.trail.length;
        const hexCol='#'+ao.data.col.toString(16).padStart(6,'0');
        lctx.beginPath();
        lctx.moveTo(pa2d.x,pa2d.y); lctx.lineTo(pb2d.x,pb2d.y);
        lctx.strokeStyle=hexCol;
        lctx.lineWidth=1.5*t;
        lctx.globalAlpha=t*ao.progress*0.6*Math.min(pa2d.f,pb2d.f);
        lctx.stroke();
      }
      lctx.globalAlpha=1;
    });
  });
}

function drawLabels(){
  lctx.clearRect(0,0,lblCanvas.width,lblCanvas.height);

  // draw arc trails first (behind labels)
  drawArcTrails();

  COUNTRIES_DEDUP.forEach(c=>{
    const pos=ll2v(c.lat,c.lng,1.025);
    const sc=w2s(pos); if(!sc) return;
    const a=Math.min(1,(sc.f-.1)/.35);
    const col=RISK_HEX[c.risk];
    const isSel=c.iso===selectedCountry;
    if(isSel){
      lctx.beginPath(); lctx.arc(sc.x,sc.y,9,0,Math.PI*2);
      lctx.strokeStyle=col; lctx.lineWidth=1; lctx.globalAlpha=a*.35; lctx.stroke();
    }
    lctx.beginPath(); lctx.arc(sc.x,sc.y,2.2,0,Math.PI*2);
    lctx.fillStyle=col; lctx.globalAlpha=a*.9; lctx.fill();
    lctx.beginPath(); lctx.moveTo(sc.x,sc.y); lctx.lineTo(sc.x+10,sc.y-8);
    lctx.strokeStyle=col; lctx.lineWidth=.6; lctx.globalAlpha=a*.32; lctx.stroke();
    lctx.font=isSel?'bold 8.5px "Space Mono",monospace':'8px "Space Mono",monospace';
    lctx.fillStyle=col; lctx.globalAlpha=isSel?a:a*.68;
    lctx.fillText(c.name.toUpperCase(),sc.x+13,sc.y-9);
    lctx.globalAlpha=1;
  });
}

// ── PANEL ──
function showPanel(c){
  showPanelBase(c);
  for (const hook of afterShowPanelHooks) {
    try { hook(c); } catch (err) { console.warn('AETHER Globe: hook de panel fallido:', err); }
  }
}

function showPanelBase(c){
  selectedCountry=c.iso;
  // activate reticle
  reticle.active=true; reticle.scanT=0; reticle.alpha=0;
  reticle.lat=c.lat; reticle.lng=c.lng;
  reticle.color=RISK_HEX[c.risk];
  document.getElementById('pName').textContent=c.name;
  document.getElementById('pBadge').textContent=c.risk;
  document.getElementById('pBadge').className='pb '+BADGE_CLS[c.risk];
  document.getElementById('pCat').textContent='// '+c.cat;
  document.getElementById('pSig').textContent=c.signal;
  const lat=c.lat>0?c.lat.toFixed(2)+'°N':Math.abs(c.lat).toFixed(2)+'°S';
  const lng=c.lng>0?c.lng.toFixed(2)+'°E':Math.abs(c.lng).toFixed(2)+'°W';
  document.getElementById('pCoords').textContent=lat+'   '+lng;
  const related=TENSION_ARCS.filter(a=>arcoToca(a, c.iso));
  const sec=document.getElementById('arcSection'), lst=document.getElementById('arcList');
  lst.replaceChildren(); activeArcIndex=-1;
  if(related.length>0){
    sec.hidden=false;
    related.forEach((arc,i)=>{
      const other=isoDeExtremo(arc.a)===c.iso?arc.b:arc.a;
      const row=document.createElement('div'); row.className='arc-row';

      const head=document.createElement('div');
      head.className='arc-head';

      const name=document.createElement('span');
      name.className='arc-name';
      name.textContent=`↔ ${other.toUpperCase()}`;

      const type=document.createElement('span');
      type.className=`arc-type ${arc.cssType}`;
      type.textContent=arc.type;

      const label=document.createElement('div');
      label.className='arc-label';
      label.textContent=arc.label;

      const sig=document.createElement('div');
      sig.className='arc-sig';
      sig.textContent=arc.signal;

      head.appendChild(name);
      head.appendChild(type);
      row.appendChild(head);
      row.appendChild(label);
      row.appendChild(sig);

      row.addEventListener('click',()=>{
        document.querySelectorAll('.arc-row').forEach(r=>r.classList.remove('active'));
        if(activeArcIndex===i) activeArcIndex=-1;
        else { row.classList.add('active'); activeArcIndex=i; }
      });
      lst.appendChild(row);
    });
  } else { sec.hidden=true; }
  document.getElementById('panel').classList.add('open');
  // Desactivar modo global cuando se selecciona un país
  globalArcMode = false;
  document.querySelector('.arc-fbtn[data-type="GLOBAL"]')?.classList.remove('active');
  activateArcsForCountry(c.iso);
}

function closePanel(){
  document.getElementById('panel').classList.remove('open');
  deactivateAllArcs(); selectedCountry=null;
  reticle.active=false; reticle.alpha=0;
  // Restaurar modo global
  globalArcMode = true;
  document.querySelector('.arc-fbtn[data-type="GLOBAL"]')?.classList.add('active');
  setTimeout(showGlobalArcs, 200);
}
document.getElementById('pClose').addEventListener('click', closePanel);
window.addEventListener('keydown', e=>{ if(e.key==='Escape') closePanel(); });

// ── CLOCK ──
setInterval(()=>{
  const n=new Date();
  document.getElementById('clock').textContent=
    [n.getUTCHours(),n.getUTCMinutes(),n.getUTCSeconds()].map(v=>String(v).padStart(2,'0')).join(':')+' UTC';
},1000);

// ── INTERACTION ──
const mouse=new THREE.Vector2(-9,-9);
/* T30 · La malla instanciada de los puntos, que es lo que se puede pulsar.
   Antes dotMeshes era un array de 211 mallas y el raycast las recorria una a
   una; ahora es un solo objeto y el raycast devuelve el instanceId. */
let dotInstances = null;

const raycaster=new THREE.Raycaster();
let isDrag=false, autoRot=true, prevX=0, prevY=0;
let rotY=0.4, rotX=0.15, tRotY=0.4, tRotX=0.15;
let resumeTimer=null, didDrag=false;

window.addEventListener('mousemove',e=>{
  mouse.x=(e.clientX/innerWidth)*2-1;
  mouse.y=-(e.clientY/innerHeight)*2+1;
  if(isDrag){
    const dx=e.clientX-prevX, dy=e.clientY-prevY;
    if(Math.abs(dx)+Math.abs(dy)>2) didDrag=true;
    tRotY+=dx*.005; tRotX+=dy*.005;
    tRotX=Math.max(-1.35,Math.min(1.35,tRotX));
    prevX=e.clientX; prevY=e.clientY;
    if(arcTooltip){ arcTooltip.classList.remove('show'); tooltipActive=false; }
  } else {
    /* T30 · El raycast ya no se hace aqui.
       mousemove se dispara hasta cientos de veces por segundo, y cada
       disparo lanzaba un raycast contra las 211 mallas de los puntos. Ahora
       solo se apunta que hay que comprobarlo, y el bucle de animacion lo
       hace UNA VEZ por fotograma, que es tantas veces como se puede llegar a
       ver el resultado. */
    hayQueRaycast = true;
    if(typeof updateArcTooltip==='function') updateArcTooltip(e);
  }
});
window.addEventListener('mousedown',e=>{ isDrag=true; didDrag=false; autoRot=false; prevX=e.clientX; prevY=e.clientY; clearTimeout(resumeTimer); });
window.addEventListener('mouseup',()=>{ isDrag=false; resumeTimer=setTimeout(()=>{ autoRot=true; },2800); });
window.addEventListener('wheel',e=>{ camera.position.z=Math.max(1.55,Math.min(6.0,camera.position.z+e.deltaY*.003)); },{passive:true});
window.addEventListener('click',e=>{
  if(didDrag) return;
  raycaster.setFromCamera(mouse,camera);
  const idx = paisBajoElPuntero();
  if(idx >= 0) showPanel(markerData[idx]);
});

/* T30 · El pais que esta bajo el puntero, o -1.
   Con InstancedMesh el raycast devuelve instanceId, que es directamente el
   indice del pais en COUNTRIES_DEDUP y en markerData. */
function paisBajoElPuntero(){
  if(!dotInstances) return -1;
  const hits = raycaster.intersectObject(dotInstances);
  if(!hits.length) return -1;
  const id = hits[0].instanceId;
  return (typeof id === 'number') ? id : -1;
}

let hayQueRaycast = false;

// ── ANIMATE ──
let globeMat;
const clock3=new THREE.Clock();
// Sun direction rotates slowly (full orbit ~120s)
const sunDir = new THREE.Vector3(1, 0.3, 0).normalize();


/**
 * Un fotograma del globo.
 *
 * T14: antes se reencolaba con requestAnimationFrame(animate) desde dentro,
 * asi que el bucle no se podia parar: solo se podia dejar que el navegador
 * dejara de llamarlo. Ahora lo gobierna renderer.setAnimationLoop(), que
 * admite setAnimationLoop(null) para soltarlo de verdad cuando la pestana
 * deja de verse.
 */
function animate(){
  for (const hook of beforeFrameHooks) {
    try { hook(); } catch (err) { /* un hook no debe tumbar el bucle */ }
  }
  const dt=clock3.getDelta(), t=clock3.elapsedTime;
  if(globeMat) {
    globeMat.uniforms.uTime.value=t;
    // Rotate sun slowly — full orbit every 120s
    const sa = t * (Math.PI * 2 / 120);
    sunDir.set(Math.cos(sa), 0.28, Math.sin(sa)).normalize();
    globeMat.uniforms.uSunDir.value.copy(sunDir);
  }
  globeGroup.children.forEach(c=>{ if(c.userData.isCloud) c.rotation.y = t*0.00018; });
  if(autoRot) tRotY+=.00065;
  rotY+=(tRotY-rotY)*.055; rotX+=(tRotX-rotX)*.055;
  globeGroup.rotation.y=rotY; globeGroup.rotation.x=rotX;
  /* T30 · El latido de los anillos lo calcula el shader con la fase de cada
     instancia. Aqui solo se mueve el reloj: tres asignaciones por fotograma
     en vez de 633 escalas y 633 opacidades. */
  for(const mat of materialesPulso) mat.uniforms.uTime.value = t;

  /* T30 · Un raycast por fotograma como maximo, y solo si el puntero se ha
     movido desde el ultimo. */
  if(hayQueRaycast){
    hayQueRaycast = false;
    raycaster.setFromCamera(mouse,camera);
    document.body.style.cursor = paisBajoElPuntero() >= 0 ? 'pointer' : 'crosshair';
  }
  updateArcs(dt);
  drawLabels();
  drawReticle(dt);
  renderer.render(scene,camera);
}

// ── INIT ──
async function init(){
  prog(5,'Inicializando motor 3D...');
  updateStats();
  buildStars();
  prog(18,'Cargando texturas NASA Blue Marble...');

  // Load NASA Day + Night textures via Three.js TextureLoader
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  const loadTex = (url) => new Promise((res, rej) => {
    loader.load(url, t => {
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      res(t);
    }, undefined, rej);
  });

  // T16: texturas autoalojadas. Venian de unpkg.com, que ademas de ser una
  // dependencia de terceros en el camino critico del render obligaba a abrir
  // img-src a ese dominio. WebP: dia 1.428 -> 584 KB, noche 698 -> 264 KB.
  const DAY_URL   = earthDayUrl;
  const NIGHT_URL = earthNightUrl;
  // T15: la textura de nubes iba aqui en base64, 479 kB de texto dentro del
  // JavaScript, duplicando byte a byte assets/img/earth-clouds.png, que ya
  // estaba en el repositorio y en el precache. Ahora se carga del fichero.
  const CLOUDS_URL = earthCloudsUrl;

  let texDay, texNight, texClouds;
  try {
    prog(30, 'Descargando textura diurna NASA...');
    texDay = await loadTex(DAY_URL);
    prog(50, 'Descargando textura nocturna NASA...');
    texNight = await loadTex(NIGHT_URL);
    prog(62, 'Descargando capa de nubes...');
    try { texClouds = await loadTex(CLOUDS_URL); }
    catch(e){ texClouds = null; console.warn('AETHER Globe: no se pudo cargar la textura de nubes', e); }
  } catch(e){
    // Fallback: procedural canvas texture
    prog(45, 'Fallback: textura procedural...');
    const fc=document.createElement('canvas'); fc.width=2048; fc.height=1024;
    const fx=fc.getContext('2d'); fx.fillStyle='#001418'; fx.fillRect(0,0,2048,1024);
    texDay   = new THREE.CanvasTexture(fc);
    texNight = texDay;
    texClouds = null;
  }
  prog(65,'Compilando shaders Day/Night...');
  globeMat=new THREE.ShaderMaterial({
    uniforms:{
      uTex:     { value: texDay },
      uTexNight:{ value: texNight },
      uSunDir:  { value: sunDir.clone() },
      uTime:    { value: 0 }
    },
    vertexShader:VERT, fragmentShader:FRAG, transparent:false
  });
  const globe=new THREE.Mesh(new THREE.SphereGeometry(1.,128,128),globeMat);
  globeGroup.add(globe);

  // Cloud layer (semi-transparent sphere slightly larger)
  if(texClouds){
    const cloudMat = new THREE.MeshPhongMaterial({
      map: texClouds,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.008, 64, 64), cloudMat);
    globeGroup.add(cloudMesh);
    // animate clouds slightly slower than globe
    cloudMesh.userData.isCloud = true;
  }

  prog(88,'Posicionando marcadores de riesgo...');
  buildMarkers();
  prog(93,'Construyendo red de tensiones...');
  buildArcs();
  prog(100,'Sistema AETHER en línea.');
  setTimeout(()=>{
    document.getElementById('loading').classList.add('fade');
    setTimeout(()=>{ document.getElementById('loading').style.display='none'; },900);
    startRenderLoop();
  },600);
}

window.addEventListener('resize',()=>{
  const w=innerWidth,h=innerHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  lblCanvas.width=w; lblCanvas.height=h;
});

// ══════════════════════════════════════════════════
//  NIVEL 3 — INTERACTIVIDAD AVANZADA
// ══════════════════════════════════════════════════

// ── Estado global modo arcos ──
let globalArcMode   = true;    // GLOBAL activo por defecto
let currentArcFilter = null;   // null = todos los tipos
const TYPE_COLORS = {
  CRITICAL:'#FF4060', HIGH:'#FF8030', SANCTION:'#4499FF',
  ENERGY:'#FF9A3C', ALLIANCE:'#00CC66', PROXY:'#CC44FF'
};

// ── Filtro por tipo ──
function setArcFilter(type){
  currentArcFilter = (type === 'ALL') ? null : type;
  // Reactivar globalArcMode: filtrar siempre implica mostrar arcos globalmente
  globalArcMode = true;
  document.querySelectorAll('.arc-fbtn[data-type]').forEach(b=>{
    b.classList.remove('active');
    b.style.fontWeight = '';
  });
  // GLOBAL se mantiene activo (es el modo, no el filtro)
  document.querySelector('.arc-fbtn[data-type="GLOBAL"]')?.classList.add('active');
  const target = type === 'ALL'
    ? document.querySelector('.arc-fbtn[data-type="ALL"]')
    : document.querySelector(`.arc-fbtn[data-type="${type}"]`);
  if(target) target.classList.add('active');
  showGlobalArcs();
}

// ── Modo global: todos los arcos visibles ──
function toggleGlobalMode(){
  globalArcMode = !globalArcMode;
  const btn = document.querySelector('.arc-fbtn[data-type="GLOBAL"]');
  if(btn) btn.classList.toggle('active', globalArcMode);
  if(globalArcMode){
    // Cerrar panel si estaba abierto en modo país
    if(document.getElementById('panel').classList.contains('open')){
      document.getElementById('panel').classList.remove('open');
      selectedCountry = null; reticle.active = false; reticle.alpha = 0;
    }
    showGlobalArcs();
  } else {
    deactivateAllArcs();
  }
}

function showGlobalArcs(){
  if (globalArcsStrategy) { globalArcsStrategy(); return; }
  deactivateAllArcs();
  const filtered = arcObjects.filter(ao =>
    !currentArcFilter || ao.data.type === currentArcFilter
  );
  filtered.forEach((ao, i) => {
    const t = setTimeout(() => {
      ao.line.visible = true; ao.glow.visible = true;
      ao.animating = true; ao.progress = 0;
      ao.line.geometry.setDrawRange(0,0); ao.glow.geometry.setDrawRange(0,0);
      ao.targetProgress = 1;
      ao.convoy.forEach(p => { p.mesh.visible = true; p.trail = []; });
    }, i * 28); // delay escalonado corto para no saturar
    activationTimers.push(t);
  });
}

// ── Intensidad dinámica desde localStorage (bridge con dashboard) ──
function applyDashboardIntensity(){
  try {
    // T7: a traves del contrato, que valida el esquema antes de devolverlo.
    // AETHER_STORAGE.get devuelve el valor ya parseado y validado.
    const data = AETHER_STORAGE.get('aether_globe_scores', null);
    if(!data || !data.scores || Date.now() - data.ts > 30*60*1000) return;
    const scores = data.scores; // { geo: 72, eco: 55, ... }
    // Mapeo: score alto = mayor opacidad y velocidad para arcos relacionados
    // Usamos geo como señal principal de intensidad geopolítica
    const geoScore = scores.geo || 50;
    const intensity = Math.max(0.5, Math.min(1.8, geoScore / 50)); // 0.5–1.8x
    arcObjects.forEach(ao => {
      const cfg = ao.cfg || ARC_CFG_DEFAULT;
      ao._intensityMult = intensity;
    });
  } catch(e){}
}

// Aplica la intensidad que publica el dashboard en el bucle de animacion.
// (Antes habia aqui un `const _origUpdateArcs = updateArcs;` que, por
//  hoisting, apuntaba a esta misma funcion y no se usaba en ninguna parte.)
function updateArcs(dt){
  arcObjects.forEach(ao=>{
    if(!ao.animating && ao.progress===0) return;
    if(ao.progress < ao.targetProgress) ao.progress=Math.min(ao.targetProgress,ao.progress+dt*1.8);
    else if(ao.progress > ao.targetProgress){
      ao.progress=Math.max(ao.targetProgress,ao.progress-dt*2.5);
      if(ao.progress===0){
        ao.line.visible=false; ao.glow.visible=false;
        ao.convoy.forEach(p=>{ p.mesh.visible=false; }); ao.animating=false; return;
      }
    }
    const count=Math.floor(ao.progress*ao.pts.length);
    ao.line.geometry.setDrawRange(0,count); ao.glow.geometry.setDrawRange(0,count);
    const cfg = ao.cfg || ARC_CFG_DEFAULT;
    const mult = ao._intensityMult || 1.0;
    ao.line.material.opacity = Math.min(0.95, ao.progress * cfg.lineOp * mult);
    ao.glow.material.opacity = Math.min(0.45, ao.progress * cfg.glowOp * mult);
    if(ao.progress>.08){
      ao.convoy.forEach(p=>{
        p.t = p.dir===1
          ? (p.t + dt * p.speed * mult) % 1.0
          : ((p.t - dt * p.speed * mult) + 1.0) % 1.0;
        const tCapped = p.dir===1
          ? Math.min(p.t, ao.progress)
          : Math.max(p.t, 1.0 - ao.progress);
        const pos = ao.curve.getPoint(tCapped);
        p.trail.push(pos.clone());
        if(p.trail.length>p.trailLen) p.trail.shift();
        p.mesh.position.copy(pos);
        p.mesh.material.opacity = Math.sin(tCapped*Math.PI)*ao.progress*.9;
      });
    }
  });
}

// ── Tooltip en hover sobre arcos ──
const arcTooltip    = document.getElementById('arc-tooltip');
const ttType        = document.getElementById('tt-type');
const ttCountries   = document.getElementById('tt-countries');
const ttLabel       = document.getElementById('tt-label');
const ttSignal      = document.getElementById('tt-signal');
let   tooltipActive = false;

function updateArcTooltip(e){
  // Project all arc curves to screen and find closest to mouse
  if(!arcObjects.length) return;
  const mx = e.clientX, my = e.clientY;
  let best = null, bestDist = 28; // px threshold

  arcObjects.forEach(ao => {
    if(!ao.line.visible || ao.progress < 0.1) return;
    // Sample N points along the curve
    const steps = 18;
    for(let s=0; s<=steps; s++){
      const tp = (s/steps) * ao.progress;
      const p3 = ao.curve.getPoint(tp);
      // Project to screen
      const wPos = p3.clone().applyMatrix4(globeGroup.matrixWorld);
      const proj = wPos.clone().project(camera);
      const sx = (proj.x * 0.5 + 0.5) * innerWidth;
      const sy = (-proj.y * 0.5 + 0.5) * innerHeight;
      // Skip if behind globe
      const gC = new THREE.Vector3().applyMatrix4(globeGroup.matrixWorld);
      const n = wPos.clone().sub(gC).normalize();
      const tc2 = camera.position.clone().sub(gC).normalize();
      if(n.dot(tc2) < 0.05) continue;
      const d = Math.hypot(mx - sx, my - sy);
      if(d < bestDist){ bestDist = d; best = ao; }
    }
  });

  if(best){
    const col = TYPE_COLORS[best.data.type] || '#00FFC8';
    arcTooltip.style.setProperty('--tt-col', col);
    ttType.textContent      = best.data.type;
    ttCountries.textContent = `${best.data.a.toUpperCase()}  ↔  ${best.data.b.toUpperCase()}`;
    ttLabel.textContent     = best.data.label;
    ttSignal.textContent    = best.data.signal;
    arcTooltip.style.left   = (mx + 16) + 'px';
    arcTooltip.style.top    = (my - 10) + 'px';
    // Ajuste borde pantalla
    if(mx + 280 > innerWidth)  arcTooltip.style.left = (mx - 274) + 'px';
    if(my + 160 > innerHeight) arcTooltip.style.top  = (my - 140) + 'px';
    arcTooltip.classList.add('show');
    tooltipActive = true;
    document.body.style.cursor = 'crosshair';
  } else if(tooltipActive){
    arcTooltip.classList.remove('show');
    tooltipActive = false;
  }
}



// ══════════════════════════════════════════════════
//  NIVEL 4 — DATOS DINÁMICOS
// ══════════════════════════════════════════════════

// ── Bridge con SIGNAL: leer alertas desde localStorage ──
// El módulo SIGNAL guarda en 'aether_signal_events' un array de eventos
// con { country, type, severity, label, signal, ts }
// Aquí los leemos y creamos arcos temporales adicionales
let dynamicArcObjects = [];

function syncSignalEvents(){
  try {
    const events = AETHER_STORAGE.get('aether_signal_events', null);
    if(!Array.isArray(events) || !events.length) return;
    const now = Date.now();
    // Filtrar eventos recientes (<24h) y con país conocido
    const fresh = events.filter(ev =>
      ev && ev.country && ev.ts && (now - ev.ts) < 24*60*60*1000
    );
    // Marcar arcos existentes como "hot" si su país tiene alerta activa
    const alertCountries = new Set(fresh.map(ev => ev.country));
    arcObjects.forEach(ao => {
      const isHot = alertCountries.has(ao.data.a) || alertCountries.has(ao.data.b);
      ao._signalHot = isHot;
      if(isHot) ao._intensityMult = Math.min(1.8, (ao._intensityMult||1.0) * 1.35);
    });
  } catch(e){}
}

// ── Timeline: activar/desactivar arcos según horizonte del dashboard ──
// Lee 'aether_horizon' de localStorage (valor: '1m','3m','6m','12m','24m')
// Arcos más "históricos" o futuros se atenúan
function applyTimelineHorizon(){
  try {
    const horizon = AETHER_STORAGE.get('aether_horizon', '12m');
    const months = parseInt(horizon) || 12;
    // Arcos ALLIANCE y ENERGY son más "estructurales" → siempre visibles
    // Arcos CRITICAL/PROXY son más inmediatos → visibles en horizontes cortos
    // Arcos SANCTION son intermedios
    const HORIZON_WEIGHTS = {
      CRITICAL:  months <= 6  ? 1.0 : months <= 12 ? 0.85 : 0.65,
      PROXY:     months <= 6  ? 1.0 : months <= 12 ? 0.80 : 0.60,
      HIGH:      months <= 6  ? 0.9 : months <= 12 ? 0.85 : 0.75,
      SANCTION:  months <= 12 ? 1.0 : 0.85,
      ENERGY:    1.0,   // siempre estructural
      ALLIANCE:  1.0,   // siempre estructural
    };
    arcObjects.forEach(ao => {
      const w = HORIZON_WEIGHTS[ao.data.type] || 0.8;
      ao._horizonMult = w;
    });
  } catch(e){}
}

// ── Polling periódico (cada 30s) ──
function startDynamicSync(){
  try{ applyDashboardIntensity(); }catch(e){}
  try{ syncSignalEvents(); }catch(e){}
  try{ applyTimelineHorizon(); }catch(e){}
  setInterval(()=>{
    try{ applyDashboardIntensity(); }catch(e){}
    try{ syncSignalEvents(); }catch(e){}
    try{ applyTimelineHorizon(); }catch(e){}
  }, 30000);
}

// ── Inicializar modo global al arrancar ──
function initArcControls(){
  startDynamicSync();
  // Esperar a que arcObjects esté poblado antes de activar arcos globales
  let _arcWait = 0;
  const _arcPoll = setInterval(()=>{
    if(typeof arcObjects !== 'undefined' && arcObjects.length > 0){
      clearInterval(_arcPoll);
      showGlobalArcs();
    } else if(++_arcWait > 60){ // máx ~6s de espera
      clearInterval(_arcPoll);
    }
  }, 100);
}


function renderDesktopHotspots(){
  const list = document.getElementById('desktopHotspotsList');
  if(!list || !Array.isArray(COUNTRIES)) return;

  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const labelMap = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };
  /* T23: los cinco destacados se eligen por ISO3; antes era por nombre, y
     el nombre lo pone ahora el Banco Mundial. */
  const preferidos = ['RUS', 'CHN', 'USA', 'IRN', 'ISR'];

  const porIso = new Map(COUNTRIES.map(c => [c.iso, c]));
  let selected = preferidos.map(i => porIso.get(i)).filter(Boolean);

  if(selected.length < 5){
    const extras = COUNTRIES
      .filter(c => !selected.some(s => s.iso === c.iso))
      .sort((a,b) => {
        const ra = priorityOrder[a.risk] ?? 99;
        const rb = priorityOrder[b.risk] ?? 99;
        if(ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name, 'es');
      })
      .slice(0, 5 - selected.length);
    selected = selected.concat(extras);
  }

  list.innerHTML = selected.slice(0,5).map((c, idx) => `
    <button class="dh-item" type="button" data-country="${c.iso}" aria-label="Abrir detalle de ${c.name}">
      <div class="dh-rank">${String(idx + 1).padStart(2,'0')}</div>
      <div class="dh-name">${c.name}</div>
      <div class="dh-risk">${labelMap[c.risk] || c.risk}</div>
    </button>
  `).join('');

  list.querySelectorAll('.dh-item[data-country]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const iso = btn.getAttribute('data-country');
      const country = COUNTRIES_DEDUP.find(c => c.iso === iso);
      if(country) showPanel(country);
    });
  });
}

function bindArcControlButtons(){
  document.querySelectorAll('.arc-fbtn[data-type]').forEach(btn => {
    if(btn.dataset.boundArcClick === '1') return;
    btn.dataset.boundArcClick = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      if(type === 'GLOBAL') toggleGlobalMode();
      else setArcFilter(type);
    });
  });
}

renderDesktopHotspots();
bindArcControlButtons();
init();
initArcControls();


/* ── T12 · Puntos de extension ────────────────────────────────────────────
   functional-boost.js sustituia showGlobalArcs y envolvia showPanel y
   animate reasignando las variables del motor. En un modulo ES eso no es
   posible, y ademas era fragil: dependia del orden de carga y de marcas
   como __gfPatched. Ahora el motor ofrece estos tres puntos. */

/** Estrategia alternativa para desplegar los arcos globales. */
let globalArcsStrategy = null;
/** Sustituye por completo el despliegue de arcos globales. */
export function setGlobalArcsStrategy(fn){ globalArcsStrategy = typeof fn === 'function' ? fn : null; }

/** Hooks que corren despues de pintar el panel de un pais. */
const afterShowPanelHooks = [];
export function registerAfterShowPanel(fn){ if (typeof fn === 'function') afterShowPanelHooks.push(fn); }

/** Hooks que corren al principio de cada fotograma. */
const beforeFrameHooks = [];
export function registerBeforeFrame(fn){ if (typeof fn === 'function') beforeFrameHooks.push(fn); }

/* ── T12 · API de puntero ──────────────────────────────────────────────────
   touch.js necesitaba escribir el estado de arrastre del motor. Antes lo
   hacia reasignando variables globales ajenas (autoRot, isDrag, prevX...).
   Ahora pasa por aqui, que es la unica puerta de escritura. */
export const pointer = {
  stopAutoRotate(){ autoRot = false; },
  startAutoRotate(){ autoRot = true; },
  setDragging(v){ isDrag = !!v; },
  isDragging(){ return isDrag; },
  setLast(x, y){ prevX = x; prevY = y; },
  lastX(){ return prevX; },
  lastY(){ return prevY; },
  rotateBy(dx, dy){
    tRotY += dx;
    tRotX = Math.max(-1.35, Math.min(1.35, tRotX + dy));
  },
  setDidDrag(v){ didDrag = !!v; },
  hideTooltip(){
    if (arcTooltip) arcTooltip.classList.remove('show');
    tooltipActive = false;
  },
  zoomBy(delta){
    if (camera && camera.position) {
      camera.position.z = Math.max(1.55, Math.min(6.0, camera.position.z + delta));
    }
  },
  pointAt(clientX, clientY){
    if (!mouse) return;
    mouse.x =  (clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  },
};

export {
  COUNTRIES, COUNTRIES_DEDUP, TENSION_ARCS,
  arcObjects, pulseMeshes, markerData, activationTimers,
  animate, showPanel, showGlobalArcs, deactivateAllArcs,
  setArcFilter, toggleGlobalMode,
  currentArcFilter,
};


/* ── T14 · El bucle se suelta cuando la pestana no se ve ──────────────────
   El globo es lo mas caro de la aplicacion. Con la pestana oculta no hay
   nada que mirar, asi que se suelta el bucle en vez de seguir rindiendo
   fotogramas que nadie ve. clock3 se reinicia al volver para que el delta
   del primer fotograma no sea el tiempo que la pestana estuvo oculta. */
export function startRenderLoop(){ renderer.setAnimationLoop(animate); }
export function stopRenderLoop(){ renderer.setAnimationLoop(null); }

onVisibilityChange((hidden) => {
  if (hidden) { stopRenderLoop(); return; }
  clock3.getDelta();
  startRenderLoop();
});

/* T23 · Asa de depuracion, igual que la del panel.

   El globo ya no tiene tabla propia: sus paises salen de data/latest.json.
   Las pruebas necesitan poder comprobar que son los mismos que los del panel
   (tests/paridad.mjs), asi que se expone una referencia congelada y marcada
   como tal. Ningun modulo la usa. */
window.__AETHER_GLOBE_DIAG__ = { renderer, scene, globeGroup, dotMeshes, pulseMeshes, lblCanvas,
  get dotInstances(){ return dotInstances; },
  get info(){ return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                       geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
                       hijos: globeGroup.children.length }; } };

window.__AETHER_GLOBE__ = Object.freeze({
  COUNTRIES: COUNTRIES_DEDUP,
  PAISES_FUERA,
  TENSION_ARCS,
  ISO_DE_ARCO,
});
