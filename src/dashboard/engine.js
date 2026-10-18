/**
 * AETHER · motor analítico del dashboard
 *
 * Fuente legible recuperada en la Fase 0 del monolito del 26/03/2026 y
 * verificada por AST contra el assets/js/app-core.js publicado: 61
 * funciones, 40 constantes y los datos idénticos valor a valor.
 *
 * Módulo ES (T12): exporta lo que el resto del dashboard necesita, en vez
 * de dejar 59 funciones y 40 constantes sueltas en el ámbito global.
 */
import { esc, safeHref, safeUrl, formatBold } from '../core/escape.js';
import { AETHER_COVERAGE } from '../core/coverage.js';

/* d3 modular: solo lo que usa el grafo de fuerzas.

   Antes entraban ademas d3-geo, d3-zoom, d3-ease, d3-array y
   topojson-client, para el mapa coropletico. Ese mapa se ha sustituido por
   la tarjeta de acceso al globo, asi que las cuatro primeras se van enteras
   del proyecto; d3-array se queda porque Vector usa su `range`. */
import { select } from 'd3-selection';
import { drag } from 'd3-drag';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
} from 'd3-force';
import { cargarDatos, fechaDatos } from '../core/datos.js';
import { construirDATA } from './datos-dashboard.js';
import { ETIQUETA_RELATIVA } from '../core/scoring.js';
import { semilla, fijarSemilla, generadorDeSimulacion, gaussianaCon } from './rng.js';
import { proyectarAPSD, normalizarPesos, comprobarCorrelacion } from './matrices.js';
import { proyectar, enMemoria, estadisticas as statsSim } from './sim-cliente.js';
import { simularCascada, monteCarlo as monteCarloLocal } from './sim-core.js';

const d3 = {
  select, drag,
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
};

// ──────────────────────────────────────────
// MATRIX RAIN
// ──────────────────────────────────────────
(function(){
  const c=document.getElementById('matrix'),x=c.getContext('2d');
  function rs(){c.width=innerWidth;c.height=innerHeight}rs();
  addEventListener('resize',rs);
  const CH='01アイAETHERRISK∆Σ∞◈';
  let dr=[];
  function init(){dr=Array(Math.floor(c.width/16)).fill(1)}
  init();addEventListener('resize',init);
  setInterval(()=>{
    x.fillStyle='rgba(5,10,16,0.06)';x.fillRect(0,0,c.width,c.height);
    dr.forEach((y,i)=>{
      x.fillStyle=Math.random()>.97?'#00FFC8':'#00FF8818';
      x.font='13px Share Tech Mono';
      x.fillText(CH[Math.floor(Math.random()*CH.length)],i*16,y*16);
      if(y*16>c.height&&Math.random()>.975)dr[i]=0;
      dr[i]++;
    });
  },55);
})();

// ──────────────────────────────────────────
// CLOCK
// ──────────────────────────────────────────
setInterval(()=>{
  document.getElementById('clock').textContent=new Date().toISOString().slice(0,19)+' UTC';
},1000);
document.getElementById('clock').textContent=new Date().toISOString().slice(0,19)+' UTC';

// ──────────────────────────────────────────
// LOADER
// ──────────────────────────────────────────
const STEPS=[[15,'CARGANDO MÓDULOS DE RIESGO...'],[35,'INICIALIZANDO BASE DE DATOS...'],[60,'CALIBRANDO INDICADORES...'],[80,'GENERANDO SEÑALES DE ALERTA...'],[100,'SISTEMA OPERATIVO']];
let li=0;
function nextStep(){
  if(li>=STEPS.length){setTimeout(()=>document.getElementById('loader').classList.add('out'),700);return;}
  const[p,m]=STEPS[li++];
  document.getElementById('lf').style.width=p+'%';
  document.getElementById('lm').textContent=m;
  setTimeout(nextStep,li===STEPS.length?900:500);
}
setTimeout(nextStep,300);

// ──────────────────────────────────────────
// OLLAMA CHECK
// ──────────────────────────────────────────
function getOllamaURL(){
  const raw=(document.getElementById('ollama-url')?.value||'').trim().replace(/\/+$/,'');
  if(!raw) return 'http://localhost:11434';
  try{
    const u=new URL(raw), h=u.hostname;
    const ok=h==='localhost'||h==='127.0.0.1'||h==='::1'
      ||/^192\.168\./.test(h)||/^10\./.test(h)
      ||/^172\.(1[6-9]|2\d|3[01])\./.test(h);
    return ok?raw:'http://localhost:11434';
  }catch(e){return 'http://localhost:11434';}
}
function getModel(){return document.getElementById('model-sel').value;}
/**
 * T5 - Comprueba si hay una Ollama local escuchando.
 *
 * Se ejecuta sola al cargar la pagina (ver abajo) y tambien al pulsar
 * VERIFICAR. Si no responde, en vez de soltar un error de CORS ilegible
 * ("Failed to fetch", "NetworkError") se dice lo que de verdad pasa: no se
 * ha detectado una IA local, con enlace a las instrucciones de arranque.
 *
 * @param {boolean} [silent]  true en la comprobacion automatica de carga:
 *                            no marca "VERIFICANDO" ni toca el panel si ya
 *                            hay contenido.
 * @returns {Promise<boolean>} si hay IA local disponible
 */
async function checkOllama(silent){
  const st=document.getElementById('api-status');
  if(!silent && st){ st.textContent='● VERIFICANDO...'; st.style.color='var(--yellow)'; }
  try{
    const url=getOllamaURL();
    const r=await fetch(url+'/api/tags',{signal:AbortSignal.timeout(4000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    const models=d.models?.map(m=>m.name)||[];
    const sel=document.getElementById('model-sel');
    if(models.length && sel){
      sel.innerHTML='';
      models.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o);});
    }
    if(st){ st.textContent='● OLLAMA ACTIVO — '+models.length+' modelos'; st.style.color='var(--green)'; }
    setAiAvailability(true);
    return true;
  }catch(e){
    if(st){ st.textContent='● IA local no detectada'; st.style.color='var(--dim)'; }
    setAiAvailability(false, silent);
    return false;
  }
}

/**
 * T5 - Refleja en el panel de IA si hay o no motor local.
 * Sin IA, el panel explica que falta y como arrancarla, en vez de esperar a
 * que el usuario pulse un boton y reciba un error de CORS.
 */
function setAiAvailability(available, silent){
  const btn=document.getElementById('analyze-btn');
  const out=document.getElementById('ai-out');
  document.body.classList.toggle('ai-offline', !available);
  if(available){
    if(btn) btn.disabled=false;
    return;
  }
  if(btn) btn.disabled=true;
  if(!out) return;
  // En la comprobacion automatica no se pisa un analisis que ya este en pantalla.
  if(silent && out.dataset.aiRendered==='1') return;
  out.innerHTML=
    '<div class="ai-block"><div class="ai-tag" style="color:var(--dim)">IA LOCAL ///</div>'+
    '<div><strong style="color:var(--bright)">IA local no detectada</strong><br/><br/>'+
    '<span style="color:var(--text)">AETHER funciona sin IA: el motor analitico, el termometro, '+
    'el ranking y la cascada no la necesitan. El panel de prediccion y el chat si.</span><br/><br/>'+
    '<a href="#install" class="ai-help-link" style="color:var(--cyan);text-decoration:none;'+
    'border-bottom:1px solid rgba(0,255,200,.3)">Ver como arrancar Ollama en local &darr;</a>'+
    '&nbsp;&nbsp;<a href="https://github.com/FranJuanP/OkrtSystemLabs#uso-local-con-ia--ollamamistral" '+
    'target="_blank" rel="noopener noreferrer" style="color:var(--cyan);text-decoration:none;'+
    'border-bottom:1px solid rgba(0,255,200,.3)">Instrucciones completas &nearr;</a>'+
    '</div></div>';
}

// ──────────────────────────────────────────
// HORIZON
// ──────────────────────────────────────────
let horizon=6;
function setHorizon(el,v){
  horizon=v;
  document.querySelectorAll('.hbtn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
}

// ──────────────────────────────────────────
// BASELINE DATA (World Bank ~2023, normalized to risk 0-100)
// Higher score = higher RISK
// ──────────────────────────────────────────
/* T23 · DATA se rellena desde data/latest.json.

   Aqui habia 162.000 caracteres de tabla escrita a mano: 204 paises por 16
   categorias, 3.264 puntuaciones y 1.600 indicadores sin ninguna fuente
   detras. La estructura es la misma (DATA[ISO3][categoria].score y .inds),
   porque cambiarla habria obligado a tocar las 30 lecturas de DATA
   repartidas por este motor; lo que cambia es de donde salen los numeros.

   El await de aqui es deliberado: con top-level await, todo lo que importe
   este modulo espera a que los datos esten, asi que ninguna funcion de
   pintado puede ejecutarse con DATA a medias. Si la descarga falla, DATA se
   queda vacio y DATOS_ESTADO lo dice, y el panel lo muestra en vez de pintar
   ceros. */
const DATA = {};
let DATOS_ESTADO = { ok: false, error: null, generado: null, calculo: null, datos: null };

try {
  const { datos, calculo, deCache, guardadoEn } = await cargarDatos();
  Object.assign(DATA, construirDATA(datos, calculo));
  DATOS_ESTADO = {
    ok: true, error: null,
    generado: datos.generado, calculo, datos, deCache, guardadoEn,
  };
} catch (err) {
  DATOS_ESTADO = {
    ok: false,
    error: (err && err.message) ? err.message : String(err),
    generado: null, calculo: null, datos: null,
  };
}

// ──────────────────────────────────────────
// GAUGE DRAW  (semicírculo SUPERIOR — SVG Y invertido)
// Ángulos: 180° = izquierda, 270° = arriba (ya que sin(270°)=-1 → y sube)
//          360°/0° = derecha
// Fill: de 180° hasta 180°+(score/100)*180°, sweep=1 (horario en pantalla)
// ──────────────────────────────────────────
function drawGauge(svgId, score, color){
  const svg=document.getElementById(svgId);
  const cx=75, cy=72, r=56;

  function pt(deg, rr){
    rr=rr||r;
    const a=deg*Math.PI/180;
    return{x:cx+rr*Math.cos(a), y:cy+rr*Math.sin(a)};
  }

  const start=pt(180);         // punto izquierdo
  const end=pt(360);           // punto derecho  (=0°)
  const fillEndDeg=180+(score/100)*180;
  const fe=pt(fillEndDeg);
  // Track completo: de izquierda a derecha por arriba (large=1, sweep=1)
  const trackD=`M ${f(start.x)} ${f(start.y)} A ${r} ${r} 0 1 1 ${f(end.x)} ${f(end.y)}`;
  // Fill: large=0 SIEMPRE — el arco parcial nunca supera 180°, sweep=1 (horario)
  const fillD=score<1?null:
    `M ${f(start.x)} ${f(start.y)} A ${r} ${r} 0 0 1 ${f(fe.x)} ${f(fe.y)}`;

  // Marcas de graduación cada 18° (10 segmentos)
  let ticks='';
  for(let i=0;i<=10;i++){
    const deg=180+i*18;
    const p1=pt(deg, r-6), p2=pt(deg, r+3);
    ticks+=`<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}"
      stroke="#1E2E48" stroke-width="${i%5===0?1.5:.8}"/>`;
  }

  function f(n){return n.toFixed(2);}

  svg.innerHTML=`
    <defs>
      <filter id="gl_${svgId}" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    ${ticks}
    <path d="${trackD}" stroke="#172238" stroke-width="9" fill="none" stroke-linecap="round"/>
    ${fillD?`<path d="${fillD}" stroke="${color}" stroke-width="9" fill="none"
      stroke-linecap="round" filter="url(#gl_${svgId})"/>`:''}
    ${fillD?`<circle cx="${f(fe.x)}" cy="${f(fe.y)}" r="5" fill="${color}"
      filter="url(#gl_${svgId})"/>`:''}
    <line x1="${cx}" y1="${cy}" x2="${f(fe.x)}" y2="${f(fe.y)}"
      stroke="${color}" stroke-width="1.5" opacity=".45"/>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="${color}" opacity=".7"/>
  `;
}

// ──────────────────────────────────────────
// RISK LABEL
// ──────────────────────────────────────────
/* Color y texto de cada nivel. Las claves son las de src/core/scoring.js.
   Los colores son los que ya usaba la aplicacion; lo que cambia es que
   ahora los asigna el tramo de la distribucion y no un umbral fijo. */
/**
 * De qué periodo son las cifras de conflicto de un país.
 *
 * No siempre son doce meses. Candidate, el fichero del año en curso, no es
 * acumulativo: la version vigente trae seis semanas. Cuando el ultimo año
 * natural cerrado de GED da mas muertos que esa ventana coja, se publica el
 * año entero, y entonces la ficha tiene que decir «año 2025» y no «12 meses».
 */
function etiquetaPeriodo(c){
  if(!c) return '12 meses';
  if(c.base === 'anio_completo' && c.anioBase) return 'año ' + c.anioBase;
  /* La cobertura va a la vista y no solo al tooltip: «12 meses» con cinco
     meses de datos detrás es la clase de medio dato que hay que mirar dos
     veces, y nadie abre un tooltip que no sabe que tiene que abrir. */
  if(c.coberturaMeses == null) return '12 meses';
  return '12 meses, cobertura ' + c.coberturaMeses.toLocaleString('es-ES', { maximumFractionDigits: 1 }) + '/12';
}

/**
 * Qué cifra del UCDP es la que se enseña.
 *
 * Publica tres por evento —`low`, `best` y `high`— y aquí se suma siempre la
 * central. Sin decirlo, el número se lee como un recuento cerrado cuando es
 * una estimación con una horquilla que a veces es de seis veces.
 */
const ESTIMACION_UCDP = 'Cifras: estimación central de UCDP (columna «best»), nunca la mínima ni la máxima. ';

/** La explicacion de por que se ha usado ese periodo, para el tooltip. */
function porQueEstePeriodo(c){
  if(!c) return '';
  if(c.base !== 'anio_completo'){
    return 'Ventana de 12 meses con '
      + (c.coberturaMeses == null ? '?' : c.coberturaMeses.toLocaleString('es-ES', { maximumFractionDigits: 1 }))
      + ' meses cubiertos por los ficheros del UCDP: ';
  }
  return 'Se usa el año ' + c.anioBase + ' completo (' + Number(c.ultimoAnioCompleto || 0).toLocaleString('es-ES')
    + ' muertos) y no la ventana de 12 meses (' + Number(c.ventana12m || 0).toLocaleString('es-ES')
    + '), porque el fichero del año en curso del UCDP no es acumulativo y deja la ventana incompleta. Periodo publicado: ';
}

/** Severidad de cada nivel, para ordenar el ranking por etiqueta. */
const ORDEN_NIVEL_RANKING = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const NIVEL_INFO = {
  CRITICAL: { etiqueta: 'CRÍTICO', color: 'var(--red)',    descripcion: 'El 5 % de países con más riesgo medido' },
  HIGH:     { etiqueta: 'ALTO',    color: 'var(--orange)', descripcion: 'Entre el 5 % y el 20 % con más riesgo' },
  MEDIUM:   { etiqueta: 'MEDIO',   color: 'var(--yellow)', descripcion: 'Entre el 20 % y el 50 % con más riesgo' },
  LOW:      { etiqueta: 'BAJO',    color: 'var(--green)',  descripcion: 'La mitad de países con menos riesgo' },
};

/** La linea que recuerda que la clasificacion es relativa. */
function actualizarPieDeNivel(d){
  const el = document.getElementById('nivel-relativo');
  const elConf = document.getElementById('nivel-conflicto');
  if(elConf) elConf.textContent = '';
  if(!el) return;
  if(!d || !d.nivel){ el.textContent = ''; return; }
  /* Si el nivel viene del umbral de conflicto, la descripcion del tramo NO
     corresponde: decir "el 5 % con mas riesgo - puesto 53 de 217" seria
     contradecirse en la misma linea. En ese caso se ensena donde cae por
     percentil, y la linea de abajo explica por que esta mas arriba. */
  const info = NIVEL_INFO[d.nivel];
  const puesto = d.puesto ? ' · puesto ' + d.puesto + ' de ' + d.deTotal : '';
  el.textContent = d.elevadoPorConflicto
    ? 'Por percentil: ' + d.elevadoPorConflicto.desde + puesto
    : (info ? info.descripcion : '') + puesto;
  el.title = ETIQUETA_RELATIVA;

  /* Cuando el nivel no sale del percentil sino del umbral de conflicto del
     UCDP, hay que decirlo con la cifra: si no, el usuario ve CRITICO junto a
     un indice de 70 y no hay forma de entender de donde sale. */
  if(elConf && d.elevadoPorConflicto){
    const e = d.elevadoPorConflicto;
    elConf.textContent = '⚠ ' + e.motivo;
    elConf.title = 'Umbral del UCDP: ' + e.umbral.toLocaleString('es-ES')
      + ' muertos en 12 meses · ' + e.detalle
      + '. Por percentil le correspondería ' + e.desde + '.';
  }

  /* Las dos cifras de muertos, siempre que haya alguna.

     Son cosas distintas y se ensenan con su etiqueta: «en el territorio»
     responde a que pasa dentro del pais, «como parte» a en que guerras esta
     metido su gobierno. Rusia tiene 266 y 47.931; darle solo la primera lo
     describiria mal. */
  const elCifras = document.getElementById('conflicto-cifras');
  if(elCifras){
    const c = d.conflicto;
    if(!c){
      elCifras.textContent = '';
      elCifras.title = '';
    } else if(!c.territorio && !c.parte){
      /* Un cero es un cero y no una laguna: decirlo evita que la ausencia de
         la linea se lea como «no hay dato». */
      elCifras.textContent = '☗ UCDP · Sin muertos por violencia organizada (' + etiquetaPeriodo(c) + ')';
      elCifras.title = 'El UCDP no registra eventos de violencia organizada en este país en '
        + (c.desde || '') + ' a ' + (c.hasta || '') + ' · ' + (c.version || '');
    } else {
      const n = (v) => Number(v || 0).toLocaleString('es-ES');
      // Las dos van siempre que haya alguna: un «como parte: 0» junto a 7.843
      // en el territorio es justo lo que distingue a México de Rusia.
      elCifras.textContent = '☗ UCDP · En el territorio: ' + n(c.territorio)
        + '  ·  Como parte: ' + n(c.parte) + ' muertos (' + etiquetaPeriodo(c) + ')';
      const tipos = [];
      if(c.estatal) tipos.push('estatal ' + n(c.estatal));
      if(c.noEstatal) tipos.push('no estatal ' + n(c.noEstatal));
      if(c.civiles) tipos.push('contra civiles ' + n(c.civiles));
      elCifras.title = (tipos.length ? 'En el territorio, por tipo: ' + tipos.join(', ') + '. ' : '')
        + (c.conflictos && c.conflictos.length
          ? 'Parte en: ' + c.conflictos.slice(0, 6).join('; ') + '. ' : '')
        /* El UCDP da tres cifras por evento (low, best, high) y la horquilla
           puede ser enorme: Sudán va de 13.044 a 82.181. Decir cuál se usa
           evita que la cifra se lea como un recuento cerrado. */
        + ESTIMACION_UCDP
        + porQueEstePeriodo(c)
        + (c.desde || '') + ' a ' + (c.hasta || '') + ' · ' + (c.version || '');
    }
  }
}

/* riskLabel se queda para las CATEGORIAS, que si se leen contra una escala
   de 0 a 100: el percentil de una categoria es directamente su posicion
   entre los 217 paises en ese dominio. Lo que no puede es etiquetar el
   indice compuesto, que esta comprimido hacia el centro. */
function riskLabel(s){
  if(s<30)return['BAJO','var(--green)'];
  if(s<50)return['MODERADO','var(--yellow)'];
  if(s<70)return['ELEVADO','var(--orange)'];
  return['CRÍTICO','var(--red)'];
}

// ──────────────────────────────────────────
// INDICATORS RENDER
// ──────────────────────────────────────────
function renderInds(id,inds,color){
  const el=document.getElementById(id);
  if(!el) return;
  el.innerHTML=(inds||[]).map(d=>{
    /* T23: `risk` es null en los indicadores que no puntuan (fecundidad,
       saldo migratorio...). Se muestran con la barra vacia y en el color de
       la categoria, sin color de riesgo: ponerles uno seria afirmar una
       direccion que la propia fuente no sostiene. */
    const tiene=typeof d.risk==='number';
    const bc=!tiene?'var(--dim)':d.risk>66?'var(--red)':d.risk>40?'var(--yellow)':color;
    /* T23: la procedencia va en el title. Cada dato lleva su anio y su
       fuente, y los que tienen limite de comparabilidad lo dicen. */
    const partes=[];
    if(d.year) partes.push('Dato de '+d.year);
    if(d.source) partes.push(d.source);
    if(!tiene) partes.push('No puntúa: no tiene una dirección de riesgo única');
    if(d.nota) partes.push(d.nota);
    const titulo=partes.join(' · ');
    return`<div class="ind-row" title="${esc(titulo)}">
      <span class="ind-name">${esc(d.n)}</span>
      <div class="ind-track"><div class="ind-fill" style="width:${tiene?d.risk:0}%;background:${bc}"></div></div>
      <span class="ind-val" style="color:${bc}">${esc(d.v)}</span>
    </div>`;
  }).join('');
}

// ──────────────────────────────────────────
// UPDATE BANNER
// ──────────────────────────────────────────

// ═══════════════════════════════════════════════════════
//  DATOS DE INTELIGENCIA DE CONFLICTOS
// ═══════════════════════════════════════════════════════
const CONFLICT_INFO = {
  'RUS-UKR': { title:'Invasión rusa de Ucrania', desc:'Conflicto armado total desde feb. 2022. Línea de frente estabilizada. Uso de misiles balísticos y drones. OTAN apoya a Ucrania.', risk:'CRÍTICO', trend:'→ ESTANCADO' },
  'ISR-PSE': { title:'Guerra en Gaza', desc:'Ofensiva terrestre israelí tras ataques de Hamas el 7-oct-2023. +40.000 víctimas civiles. Crisis humanitaria severa.', risk:'CRÍTICO', trend:'↑ ESCALANDO' },
  'ISR-LBN': { title:'Conflicto Israel-Líbano', desc:'Operaciones israelíes contra Hezbolá en sur de Líbano. Intercambio de misiles. Riesgo de escalada regional.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'IRN-ISR': { title:'Guerra en las sombras', desc:'Ataques proxy mutuos. Irán lanzó >300 drones/misiles en abril 2024. Israel respondió. Hezbolá, Hamas y Houthi como brazos iraníes.', risk:'CRÍTICO', trend:'↑ ESCALANDO' },
  'PRK-USA': { title:'Amenaza balística DPRK', desc:'Corea del Norte prueba ICBM con capacidad de alcanzar EEUU. Cooperación militar con Rusia. Sin diálogo diplomático activo.', risk:'CRÍTICO', trend:'↑ ESCALANDO' },
  'PRK-KOR': { title:'Tensión Peninsula Coreana', desc:'DPRK declaró a Corea del Sur "estado enemigo". Destrucción de carreteras intercoreanas. Ejercicios militares conjuntos RoK-EEUU.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'CHN-TWN': { title:'Estrecho de Taiwán', desc:'China intensifica ejercicios militares alrededor de Taiwán. Violaciones frecuentes del espacio aéreo. EEUU vende armamento a Taiwán.', risk:'CRÍTICO', trend:'↑ ESCALANDO' },
  'CHN-USA': { title:'Rivalidad sistémica EEUU-China', desc:'Guerra comercial, restricciones tecnológicas (chips). Tensión por Taiwán, Mar del Sur, TikTok. Competencia militar global.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'IRN-USA': { title:'Crisis nuclear iraní', desc:'Irán enriquece uranio al 60%+, cerca del grado armamentístico. EEUU mantiene sanciones máximas. Sin acuerdo JCPOA viable.', risk:'CRÍTICO', trend:'↑ ESCALANDO' },
  'IND-PAK': { title:'Cachemira — tensión nuclear', desc:'Conflicto territorial con armamento nuclear en ambos bandos. Intercambios de fuego en línea de control. Incidentes aéreos.', risk:'ELEVADO', trend:'→ CRÓNICO' },
  'SDN-SSD': { title:'Guerra civil Sudán', desc:'Conflicto entre FFAA y paramilitares RSF desde abr. 2023. >8M desplazados. Crisis humanitaria. Sin solución diplomática.', risk:'CRÍTICO', trend:'↑ ESCALANDO' },
  'YEM-SAU': { title:'Guerra Yemen / Houthi', desc:'Houthis atacan barcos en Mar Rojo afectando comercio global. EEUU y UK bombardean posiciones. Irán financia y arma a los Houthi.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'IRN-YEM': { title:'Apoyo iraní a Houthis', desc:'Irán suministra misiles antibuque, drones y tecnología a los Houthi. Desvío de rutas comerciales globales. +60% del comercio mundial afectado.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'USA-UKR': { title:'Apoyo OTAN a Ucrania', desc:'+150.000M$ en ayuda militar desde 2022. Discusión sobre uso de misiles de largo alcance contra Rusia. Línea roja nuclear rusa.', risk:'ELEVADO', trend:'→ SOSTENIDO' },
  'RUS-IRN': { title:'Alianza ruso-iraní', desc:'Irán suministra drones Shahed a Rusia. Rusia transfiere tecnología militar. Coordinación en Siria. Alianza anti-occidental creciente.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'CHN-PHL': { title:'Mar del Sur de China', desc:'China obstruye misiones de suministro filipinas. Incidentes con lanchas de agua. Tratado de defensa EEUU-Filipinas activado.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'COD-RWA': { title:'M23 / Conflicto Congo', desc:'Grupo M23 apoyado por Ruanda controla Goma. +6M desplazados. Implicación de Wagner (ahora Afrika Corps). Oro y minerales en juego.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'USA-RUS': { title:'Sanciones máximas sobre Rusia', desc:'+14.000 sanciones desde feb. 2022. Exclusión de SWIFT. Confiscación de reservas rusas. Rusia redirige economía hacia China y Asia.', risk:'ELEVADO', trend:'→ SOSTENIDO' },
  'CHN-IND': { title:'Frontera del Himalaya', desc:'Patrullas enfrentadas en LAC (Línea de Control Real). Acuerdo de desenganche 2024. Desconfianza estructural. Rivalidad regional.', risk:'MODERADO', trend:'↓ REDUCIENDO' },
  'AZE-ARM': { title:'Nagorno-Karabaj', desc:'Azerbaiyán completó toma de control en sep. 2023. +100.000 armenios étnicos expulsados. Armenia busca distanciarse de Rusia.', risk:'MODERADO', trend:'↓ REDUCIÉNDOSE' },
  'TUR-SYR': { title:'Operaciones turcas en Siria', desc:'Turquía mantiene zonas de control en norte sirio. Ataques contra kurdos del YPG/SDF. Tensión con EEUU por bases compartidas.', risk:'MODERADO', trend:'→ CRÓNICO' },
  'RUS-SYR': { title:'Presencia militar rusa en Siria', desc:'Bases de Hmeimim y Tartus cuestionadas tras caída de Assad. Rusia negocia mantenimiento de bases con nueva administración siria.', risk:'MODERADO', trend:'↓ DEBILITÁNDOSE' },
  'MLI-BFA': { title:'Sahel — Yihadismo', desc:'Al-Qaeda y Estado Islámico controlan vastas zonas. Wagner/Afrika Corps reemplaza a Francia. Golpes militares en Mali, Burkina, Níger.', risk:'ELEVADO', trend:'↑ ESCALANDO' },
  'CHN-AFR': { title:'Influencia china en África', desc:'Deuda-trampa: +150.000M$ en préstamos. Puertos estratégicos en Djibouti, Tanzania. Extracción de minerales críticos para tecnología.', risk:'MODERADO', trend:'→ SOSTENIDO' },
  'RUS-AFR': { title:'Wagner/Afrika Corps en África', desc:'Presencia en Mali, CAR, Libia, Sudan. Explotación de recursos naturales. Desplazamiento de influencia occidental. Mercenarios por concesiones mineras.', risk:'MODERADO', trend:'↑ ESCALANDO' },
};

// Herramienta activa para filtro de tipo
window.arcTypeFilter = null;







// ──────────────────────────────────────────
// LOAD REGION
// ──────────────────────────────────────────
// loadRegion v1 — replaced by unified v6

// ──────────────────────────────────────────
// EVENTS
// ──────────────────────────────────────────
const EVENT_POOL={
  eco:[
    {t:'ECO',b:'beco',tx:'Presión inflacionaria persistente en economías desarrolladas',src:'FMI',url:'https://www.imf.org/en/Publications/WEO'},
    {t:'ECO',b:'beco',tx:'Mercados de bonos registran alta volatilidad',src:'Reuters',url:'https://www.reuters.com/markets/'},
    {t:'ECO',b:'beco',tx:'Ralentización del comercio internacional',src:'OMC',url:'https://www.wto.org/english/news_e/news_e.htm'},
    {t:'ECO',b:'beco',tx:'Deuda corporativa en niveles históricamente elevados',src:'BIS',url:'https://www.bis.org/statistics/totcredit.htm'},
  ],
  geo:[
    {t:'GEO',b:'bgeo',tx:'Escalada de tensiones en múltiples frentes geopolíticos',src:'ACLED',url:'https://acleddata.com/dashboard/'},
    {t:'GEO',b:'bgeo',tx:'Fragmentación del orden multilateral en curso',src:'SIPRI',url:'https://www.sipri.org/research/peace-and-development/global-order'},
    {t:'GEO',b:'bgeo',tx:'Ciberataques a infraestructura crítica de estados',src:'CISA',url:'https://www.cisa.gov/news-events/alerts'},
    {t:'GEO',b:'bgeo',tx:'Elecciones clave con alto potencial de inestabilidad',src:'GDELT',url:'https://www.gdeltproject.org/'},
  ],
  health:[
    {t:'SALUD',b:'bhealth',tx:'OMS monitorea brotes respiratorios con potencial pandémico',src:'OMS',url:'https://www.who.int/emergencies/disease-outbreak-news'},
    {t:'SALUD',b:'bhealth',tx:'Resistencia antimicrobiana supera umbrales de alerta',src:'OMS/AMR',url:'https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance'},
    {t:'SALUD',b:'bhealth',tx:'Sistemas sanitarios bajo presión por envejecimiento',src:'OMS',url:'https://www.who.int/data/gho/data/themes/topics/health-workforce'},
  ],
  climate:[
    {t:'CLIMA',b:'bclimate',tx:'Temperatura oceánica global en máximos históricos',src:'NOAA',url:'https://www.ncei.noaa.gov/access/monitoring/monthly-report/'},
    {t:'CLIMA',b:'bclimate',tx:'Frecuencia de eventos climáticos extremos +34%',src:'EM-DAT',url:'https://www.emdat.be/'},
    {t:'CLIMA',b:'bclimate',tx:'Estrés hídrico crítico en cuencas fluviales clave',src:'WRI Aqueduct',url:'https://www.wri.org/aqueduct'},
    {t:'CLIMA',b:'bclimate',tx:'Desplazamiento climático: 1.2B personas para 2050',src:'IDMC',url:'https://www.internal-displacement.org/global-report/grid2022/'},
  ],
  social:[
    {t:'SOCIAL',b:'bsocial',tx:'Desplazados forzados superan 117 millones de personas',src:'ACNUR',url:'https://www.unhcr.org/global-trends'},
    {t:'SOCIAL',b:'bsocial',tx:'Índices de confianza institucional en mínimos históricos',src:'Edelman',url:'https://www.edelman.com/trust/trust-barometer'},
    {t:'SOCIAL',b:'bsocial',tx:'Polarización política extrema fragmenta la cohesión social',src:'V-Dem',url:'https://v-dem.net/data_analysis/VariableGraph/'},
    {t:'SOCIAL',b:'bsocial',tx:'Populismo avanza en democracias consolidadas',src:'EIU Democracy',url:'https://www.eiu.com/n/campaigns/democracy-index-2023/'},
  ],
  tech:[
    {t:'CYBER',b:'btech',tx:'Ciberataques a infraestructura crítica crecen +38% anual',src:'IBM X-Force',url:'https://www.ibm.com/reports/threat-intelligence'},
    {t:'CYBER',b:'btech',tx:'Desinformación por IA altera procesos electorales',src:'Freedom House',url:'https://freedomhouse.org/report/freedom-on-the-net'},
    {t:'CYBER',b:'btech',tx:'Brecha digital excluye a 2.6B personas de servicios básicos',src:'ITU',url:'https://www.itu.int/en/ITU-D/Statistics/Pages/facts/default.aspx'},
    {t:'CYBER',b:'btech',tx:'Armamento autónomo con IA activo en zonas de conflicto',src:'SIPRI',url:'https://www.sipri.org/research/armament-and-disarmament/autonomous-weapon-systems'},
  ],
  food:[
    {t:'ALIM.',b:'bfood',tx:'Reservas mundiales de cereales en alerta: 72 días',src:'FAO',url:'https://www.fao.org/worldfoodsituation/csdb/en/'},
    {t:'ALIM.',b:'bfood',tx:'Precio de commodities agrícolas con volatilidad extrema',src:'FAO FPEI',url:'https://www.fao.org/worldfoodsituation/foodpricesindex/en/'},
    {t:'ALIM.',b:'bfood',tx:'845 millones en situación de inseguridad alimentaria',src:'FSIN',url:'https://www.fsinplatform.org/global-report-food-crises'},
    {t:'ALIM.',b:'bfood',tx:'Colapso polinizadores amenaza 35% de producción global',src:'IPBES',url:'https://ipbes.net/assessment-reports/pollinators'},
  ],
  mental:[
    {t:'MENTAL',b:'bmental',tx:'OMS: los trastornos mentales, principal causa de discapacidad',src:'OMS',url:'https://www.who.int/news-room/fact-sheets/detail/mental-disorders'},
    {t:'MENTAL',b:'bmental',tx:'Epidemia de soledad declarada en más de 20 países',src:'Lancet',url:'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(23)02583-7/fulltext'},
    {t:'MENTAL',b:'bmental',tx:'Burnout afecta al 44% de trabajadores en economías avanzadas',src:'Gallup',url:'https://www.gallup.com/workplace/349484/state-of-the-global-workplace.aspx'},
    {t:'MENTAL',b:'bmental',tx:'Suicidio: 2ª causa de muerte en jóvenes de 15-29 años',src:'OMS',url:'https://www.who.int/news-room/fact-sheets/detail/suicide'},
  ],
  energy:[
    {t:'ENERGÍA',b:'benergy',tx:'Volatilidad extrema en mercados de energía global',src:'AIE',url:'https://www.iea.org/reports/world-energy-outlook-2023'},
    {t:'ENERGÍA',b:'benergy',tx:'Transición energética insuficiente para objetivos climáticos',src:'IRENA',url:'https://www.irena.org/Publications/2023/Mar/World-Energy-Transitions-Outlook-2023'},
    {t:'ENERGÍA',b:'benergy',tx:'Dependencia de minerales críticos como nuevo riesgo geopolítico',src:'AIE',url:'https://www.iea.org/reports/critical-minerals-market-review-2023'},
    {t:'ENERGÍA',b:'benergy',tx:'Cortes de suministro energético en economías emergentes',src:'Banco Mundial',url:'https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS'},
  ],
  demo:[
    {t:'DEMOGR.',b:'bdemo',tx:'Colapso demográfico proyectado en 23 países para 2050',src:'ONU DESA',url:'https://population.un.org/wpp/'},
    {t:'DEMOGR.',b:'bdemo',tx:'Presión migratoria en fronteras alcanza máximos históricos',src:'OIM',url:'https://worldmigrationreport.iom.int/'},
    {t:'DEMOGR.',b:'bdemo',tx:'Brain drain vaciando economías emergentes de talento clave',src:'OCDE',url:'https://www.oecd.org/migration/mig/brain-drain.htm'},
    {t:'DEMOGR.',b:'bdemo',tx:'Envejecimiento poblacional amenaza sistemas de pensiones',src:'OIT',url:'https://www.ilo.org/global/research/global-reports/world-social-security-report/lang--en/index.htm'},
  ],
  urban:[
    {t:'URBANO',b:'burban',tx:'1000+ ciudades en riesgo severo por cambio climático',src:'C40',url:'https://www.c40.org/research/'},
    {t:'URBANO',b:'burban',tx:'Crisis global de vivienda asequible sin precedentes',src:'ONU-Habitat',url:'https://unhabitat.org/world-cities-report-2022'},
    {t:'URBANO',b:'burban',tx:'Infraestructura crítica obsoleta en economías avanzadas',src:'ASCE',url:'https://infrastructurereportcard.org/'},
    {t:'URBANO',b:'burban',tx:'Megaciudades enfrentan colapso hídrico inminente',src:'WRI',url:'https://www.wri.org/insights/17-countries-home-one-quarter-worlds-population-face-extremely-high-water-stress'},
  ],
  science:[
    {t:'CIENCIA',b:'bscience',tx:'Carrera armamentística por IA genera riesgos existenciales',src:'AI Safety',url:'https://www.safe.ai/statement-on-ai-risk'},
    {t:'CIENCIA',b:'bscience',tx:'Brecha de innovación entre países en aceleración',src:'OMPI',url:'https://www.wipo.int/global_innovation_index/en/'},
    {t:'CIENCIA',b:'bscience',tx:'Desinformación científica mina respuesta a crisis globales',src:'Nature',url:'https://www.nature.com/articles/s41562-021-01056-1'},
    {t:'CIENCIA',b:'bscience',tx:'Dependencia tecnológica crea nuevas asimetrías de poder',src:'UNCTAD',url:'https://unctad.org/publication/technology-and-innovation-report-2023'},
  ],
  justice:[
    {t:'JUSTICIA',b:'bjustice',tx:'Crímenes de guerra sin rendición de cuentas internacional',src:'CPI',url:'https://www.icc-cpi.int/situations'},
    {t:'JUSTICIA',b:'bjustice',tx:'Trabajo forzado moderno afecta a 40 millones de personas',src:'OIT',url:'https://www.ilo.org/global/topics/forced-labour/lang--en/index.htm'},
    {t:'JUSTICIA',b:'bjustice',tx:'Retroceso en derechos de género en múltiples regiones',src:'ONU Mujeres',url:'https://www.unwomen.org/en/digital-library/progress-of-the-worlds-women'},
    {t:'JUSTICIA',b:'bjustice',tx:'Sistemas judiciales capturados por el crimen organizado',src:'UNODC',url:'https://www.unodc.org/unodc/en/organized-crime/index.html'},
  ],
  finance:[
    {t:'FINANZAS',b:'bfinance',tx:'Deuda global supera 307% del PIB mundial',src:'IIF',url:'https://www.iif.com/Research/Capital-Flows-and-Debt/Global-Debt-Monitor'},
    {t:'FINANZAS',b:'bfinance',tx:'Burbujas inmobiliarias simultáneas en 15+ mercados',src:'BIS',url:'https://www.bis.org/statistics/pp_selected.htm'},
    {t:'FINANZAS',b:'bfinance',tx:'Banca en la sombra concentra riesgo sistémico oculto',src:'FSB',url:'https://www.fsb.org/work-of-the-fsb/market-and-institutional-resilience/non-bank-financial-intermediation/'},
    {t:'FINANZAS',b:'bfinance',tx:'Criptoactivos amplían volatilidad en mercados emergentes',src:'FMI',url:'https://www.imf.org/en/Publications/GFSR'},
  ],
  ocean:[
    {t:'OCÉANOS',b:'bocean',tx:'50% de arrecifes coralinos en blanqueamiento severo',src:'GCRMN',url:'https://gcrmn.net/2020-report/'},
    {t:'OCÉANOS',b:'bocean',tx:'Acidificación oceánica en ritmo sin precedentes geológicos',src:'NOAA OA',url:'https://oceanacidification.noaa.gov/'},
    {t:'OCÉANOS',b:'bocean',tx:'Sobrepesca: 34% de stocks marinos en colapso',src:'FAO',url:'https://www.fao.org/state-of-fisheries-aquaculture'},
    {t:'OCÉANOS',b:'bocean',tx:'Microplásticos detectados en cadena alimentaria humana',src:'PNUMA',url:'https://www.unep.org/resources/report/plastics-planet-valuing-plastic-action-framework'},
  ],
  bio:[
    {t:'BIOSEG.',b:'bbio',tx:'OMS: riesgo de pandemia X en próximos años es alto',src:'OMS',url:'https://www.who.int/activities/preparing-for-disease-x'},
    {t:'BIOSEG.',b:'bbio',tx:'Resistencia antibiótica: 10M muertes/año proyectadas 2050',src:'IACG ONU',url:'https://www.who.int/antimicrobial-resistance/interagency-coordination-group/final-report/en/'},
    {t:'BIOSEG.',b:'bbio',tx:'Zoonosis emergentes por deforestación y cambio climático',src:'PREDICT',url:'https://ohi.vetmed.ucdavis.edu/programs-projects/predict-project'},
    {t:'BIOSEG.',b:'bbio',tx:'Bioseguridad de laboratorios BSL-4: brechas identificadas',src:'NTI Bio',url:'https://www.nti.org/analysis/articles/2023-biolabs-security-index/'},
  ],
};

function renderEvents(d){
  const pool=[];
  ["eco","geo","health","climate","social","tech","food","mental","energy","demo","urban","science","justice","finance","ocean","bio"].forEach(k=>{
    const s=d[k]?.score||50;
    const n=s>65?3:s>40?2:1;
    for(let i=0;i<n;i++) pool.push(...EVENT_POOL[k]);
  });
  const seen=new Set(), uniq=[];
  for(const e of pool){ if(!seen.has(e.tx)){seen.add(e.tx);uniq.push(e);} }
  // T2: sin barajado aleatorio. El orden depende solo de la puntuacion de la
  // region, asi que dos cargas de la misma region muestran lo mismo.
  const picked=uniq.slice(0,12);
  const feed=document.getElementById('events-feed');
  feed.innerHTML=picked.map(e=>`
    <div class="ev" style="flex-direction:column;gap:4px;padding:8px;background:rgba(5,10,16,.4);border-radius:6px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="ev-badge ${esc(e.b)}">${esc(e.t)}</span>
        <a href="${safeHref(e.url)}" target="_blank" rel="noopener noreferrer" class="ev-src-link"
          style="margin-left:auto;font-size:9px;font-family:'Share Tech Mono',monospace;
          color:var(--cyan);background:rgba(0,255,200,.06);border:1px solid rgba(0,255,200,.2);
          padding:2px 7px;border-radius:3px;text-decoration:none;white-space:nowrap;
          transition:background .2s" rel="noopener noreferrer">
          ${esc(e.src)} ↗
        </a>
      </div>
      <div class="ev-text">${esc(e.tx)}</div>
    </div>`).join('');
  document.getElementById('ev-count').textContent=picked.length+' TEMAS';
}

function onRegionChange(){loadRegion();}

// ──────────────────────────────────────────
// AI PREDICTION
// ──────────────────────────────────────────
async function runAnalysis(){
  const btn=document.getElementById('analyze-btn');
  btn.disabled=true;
  const out=document.getElementById('ai-out');
  out.innerHTML=`<div class="thinking"><div class="dk"></div><div class="dk"></div><div class="dk"></div><span style="color:var(--cyan);font-size:12px;margin-left:4px">AETHER ANALIZANDO Y PROYECTANDO...</span></div>`;

  const code=document.getElementById('region-sel').value;
  const d=DATA[code]||DATA.WLD;
  const gScore=Math.round([d.eco.score,d.geo.score,d.health.score,d.climate.score].reduce((a,b)=>a+b,0)/4);

  const indsTxt=Object.entries(d).filter(([k])=>["eco", "geo", "health", "climate", "social", "tech", "food", "mental", "energy", "demo", "urban", "science", "justice", "finance", "ocean", "bio"].includes(k))
    .map(([k,v])=>`[${k.toUpperCase()}] Score:${v.score}/100\n`+v.inds.map(i=>`  · ${i.n}: ${i.v} (riesgo:${i.risk}%)`).join('\n')).join('\n');

  const prompt=`Eres AETHER, motor de inteligencia de riesgo global de OkrtSystem Labs. Tu misión es PREDECIR sucesos futuros — tanto amenazas como oportunidades — que afectarán al ser humano.

REGIÓN ANALIZADA: ${d.name}
ÍNDICE GLOBAL DE RIESGO: ${gScore}/100
HORIZONTE DE PREDICCIÓN: próximos ${horizon} meses

INDICADORES ACTUALES (datos base ~2023):
${indsTxt}

Genera una predicción estructurada en español con este formato EXACTO:

**DIAGNÓSTICO ACTUAL**
[Evaluación del estado actual en 2-3 frases. Sé directo y específico.]

**⚠ AMENAZAS PREDICHAS (próximos ${horizon} meses)**
1. [Amenaza específica con probabilidad estimada y mecanismo de causalidad]
2. [Segunda amenaza]  
3. [Tercera amenaza]

**✅ OPORTUNIDADES Y TENDENCIAS POSITIVAS**
1. [Oportunidad o señal positiva que puede materializarse]
2. [Segunda oportunidad]

**🎯 SEÑALES DE ALERTA TEMPRANA A VIGILAR**
- [Indicador concreto que confirmaría la amenaza si se materializa]
- [Segunda señal de alerta]
- [Tercera señal]

**📊 ESCENARIO BASE (${horizon} meses)**
[Párrafo con la predicción más probable. Incluye % de probabilidad estimada para el escenario.]

**📌 PUNTOS CRÍTICOS DE ACTUACIÓN**
- [Acción o área donde la intervención humana/política tendría mayor impacto]
- [Segunda área crítica]

Sé específico, técnico y basado en los indicadores reales. Menciona causalidades concretas entre indicadores. Máximo 400 palabras.`;

  try{
    const ollamaURL=getOllamaURL();
    const model=getModel();
    document.getElementById('model-tag').textContent=model.toUpperCase();
    const res=await fetch(ollamaURL+'/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:model,
        stream:false,
        messages:[{role:'user',content:prompt}]
      })
    });
    if(!res.ok){const e=await res.text();throw new Error('HTTP '+res.status+': '+e.slice(0,120));}
    const data=await res.json();
    if(data.error){throw new Error(data.error);}
    const txt=data.message?.content||'Sin respuesta';

    out.innerHTML='';
    const blocks=txt.split('\n\n').filter(s=>s.trim());
    blocks.forEach(b=>{
      const isWarn=b.includes('AMENAZA')||b.includes('⚠');
      const isPred=b.includes('ESCENARIO')||b.includes('📊');
      const isOpp=b.includes('OPORTUNIDAD')||b.includes('✅');
      const isInfo=b.includes('ALERTA')||b.includes('🎯')||b.includes('CRÍTICO')||b.includes('📌');
      const cls=isWarn?'warn':isPred?'pred':isOpp?'':isInfo?'info':'';
      const tagColor=isWarn?'var(--red)':isPred?'var(--purple)':isOpp?'var(--green)':'var(--cyan)';
      const tagTxt=isWarn?'AMENAZA ///':isPred?'PREDICCIÓN ///':isOpp?'OPORTUNIDAD ///':'ANÁLISIS ///';
      const div=document.createElement('div');
      div.className='ai-block '+cls;
      // T3: el texto del modelo se escapa ANTES de aplicar el formato de
      // negritas, igual que ya hacia el chat. formatBold hace las dos cosas
      // en el orden correcto, de modo que un <img onerror> del modelo llega
      // como texto y nunca como etiqueta.
      div.innerHTML=`<div class="ai-tag" style="color:${tagColor}">${tagTxt}</div><div>${formatBold(b)}</div>`;
      out.appendChild(div);
    });
  }catch(e){
    const isCors=e.message.includes('fetch')||e.message.includes('Failed')||e.message.includes('NetworkError');
    out.innerHTML=`<div class="ai-block warn"><div class="ai-tag" style="color:var(--red)">ERROR — OLLAMA ///</div>
    <div>
      <strong style="color:var(--orange)">${isCors?'IA local no detectada':'Error: '+esc(e.message)}</strong><br/><br/>
      ${isCors?`<span style="color:var(--text)">Ollama bloquea peticiones desde archivos locales.<br/>
      Debes arrancarlo con permisos de origen abierto:</span>
      <br/><br/>
      <span style="background:rgba(0,0,0,.5);padding:10px 14px;border-radius:6px;display:block;color:var(--cyan);font-size:11px;line-height:2">
        <strong style="color:var(--yellow)">Windows CMD:</strong><br/>
        set OLLAMA_ORIGINS=https://franjuanp.github.io,http://localhost:8080<br/>
        ollama serve<br/>
        <br/>
        <strong style="color:var(--yellow)">PowerShell:</strong><br/>
        $env:OLLAMA_ORIGINS="https://franjuanp.github.io,http://localhost:8080"; ollama serve<br/>
        <br/>
        <strong style="color:var(--yellow)">Linux / Mac:</strong><br/>
        OLLAMA_ORIGINS=https://franjuanp.github.io,http://localhost:8080 ollama serve
      </span>
      <br/><span style="color:var(--dim);font-size:11px">Después pulsa ⚡ VERIFICAR y vuelve a intentarlo.</span>`
      :'<span style="color:var(--dim)">'+esc(e.message)+'</span>'}
    </div></div>`;
  }
  btn.disabled=false;
}

// ──────────────────────────────────────────
// INIT v5
// ──────────────────────────────────────────
setTimeout(loadRegion,2500);
  setTimeout(initShockSimulator,3000);

// ══════════════════════════════════════════════════
//  SENTINEL v5 — ALGORITMO MULTICAPA + MAPA + CORR
// ══════════════════════════════════════════════════
const CAT_KEYS=["eco", "geo", "health", "climate", "social", "tech", "food", "mental", "energy", "demo", "urban", "science", "justice", "finance", "ocean", "bio"];
const CAT_LABELS=["ECO", "GEO", "SALUD", "CLIMA", "SOCIAL", "TECH", "ALIM", "MENTAL", "ENERG\u00cdA", "DEMO", "URBANO", "CIENCIA", "JUSTICIA", "FINANZAS", "OC\u00c9ANOS", "BIOSEG"];
const CAT_COLORS=[
  "#FFFFFF",   // eco       — blanco nuclear
  "#00FFC8",   // geo       — cian primario
  "#FFFFFF",   // salud     — blanco nuclear
  "#7DD8F0",   // clima     — cian claro
  "#B0C8E0",   // social    — gris-azul claro
  "#00FFC8",   // tech      — cian primario
  "#7DD8F0",   // aliment.  — cian claro
  "#B0C8E0",   // mental    — gris-azul claro
  "#FFFFFF",   // energía   — blanco nuclear
  "#B0C8E0",   // demo      — gris-azul claro
  "#7DD8F0",   // urbano    — cian claro
  "#00FFC8",   // ciencia   — cian primario
  "#FFFFFF",   // justicia  — blanco nuclear
  "#00FFC8",   // finanzas  — cian primario
  "#7DD8F0",   // océanos   — cian claro
  "#B0C8E0",   // bioseg    — gris-azul claro
];
/* T28/B-d · VELOCITY se calcula de los datos.

   Aqui habia una tabla escrita a mano con valores para DIEZ paises; los
   otros 207 usaban los del mundo, de modo que la "velocidad" de Nigeria era
   la misma que la de Noruega. No tenia fuente ni forma de comprobarse.

   Ahora sale de la variacion de los propios indicadores entre sus dos
   ultimos anos publicados, con el signo del riesgo y por mediana, en
   src/core/scoring.js. Cada categoria lleva ademas de cuantos indicadores
   sale esa velocidad: con cero, es un cero declarado y no una medicion de
   estabilidad. */
const VELOCITY = {};

/* Se rellena aqui y no junto a DATA: en el modulo, `const VELOCITY` esta en
   su zona muerta hasta esta linea, y asignarle antes lanzaba
   "Cannot set properties of undefined", dejaba DATOS_ESTADO en fallo y el
   panel entero decia SIN DATOS teniendo los datos cargados. */
if (DATOS_ESTADO.ok && DATOS_ESTADO.calculo) {
  for (const [iso, p] of Object.entries(DATOS_ESTADO.calculo.paises)) VELOCITY[iso] = p.velocidades;
  for (const [iso, p] of Object.entries(DATOS_ESTADO.calculo.agregados || {})) VELOCITY[iso] = p.velocidades;
}
/* T27 · CORR_MATRIX no era una matriz de correlacion.

   Es simetrica, tiene unos en la diagonal y todos sus valores estan en
   [-1, 1], asi que lo parece. Pero una matriz de correlacion tiene que ser
   ademas SEMIDEFINIDA POSITIVA: si no lo es, describe un conjunto de
   correlaciones que ningun conjunto de variables reales puede tener a la vez.

   Su espectro tiene un valor propio negativo: -0,1484. Los otros quince son
   positivos. Mientras haya uno negativo, cualquier calculo que la trate como
   una correlacion puede producir varianzas negativas.

   La tabla escrita a mano se conserva como CORR_DECLARADA, para poder ver de
   donde se parte, y CORR_MATRIX es su proyeccion valida: se recorta el valor
   propio negativo y se devuelve la diagonal a unos. El cambio maximo en un
   elemento es 0,051 y la correlacion mas alta pasa de 0,80 a 0,7879.

   INFORME_CORR lleva el detalle y window.__AETHER__ lo expone. */
const CORR_DECLARADA=[[1.0, 0.6, 0.3, 0.3, 0.7, 0.4, 0.5, 0.4, 0.6, 0.2, 0.4, 0.3, 0.4, 0.8, 0.2, 0.2], [0.6, 1.0, 0.2, 0.3, 0.6, 0.5, 0.4, 0.3, 0.5, 0.3, 0.3, 0.2, 0.8, 0.4, 0.3, 0.3], [0.3, 0.2, 1.0, 0.5, 0.3, 0.2, 0.5, 0.6, 0.2, 0.4, 0.4, 0.3, 0.2, 0.2, 0.3, 0.8], [0.3, 0.3, 0.5, 1.0, 0.4, 0.2, 0.8, 0.3, 0.5, 0.3, 0.5, 0.2, 0.2, 0.2, 0.8, 0.4], [0.7, 0.6, 0.3, 0.4, 1.0, 0.4, 0.4, 0.8, 0.3, 0.6, 0.5, 0.3, 0.7, 0.5, 0.2, 0.3], [0.4, 0.5, 0.2, 0.2, 0.4, 1.0, 0.2, 0.3, 0.4, 0.2, 0.4, 0.7, 0.3, 0.5, 0.2, 0.2], [0.5, 0.4, 0.5, 0.8, 0.4, 0.2, 1.0, 0.4, 0.4, 0.3, 0.4, 0.2, 0.3, 0.3, 0.6, 0.4], [0.4, 0.3, 0.6, 0.3, 0.8, 0.3, 0.4, 1.0, 0.2, 0.4, 0.4, 0.3, 0.4, 0.3, 0.2, 0.2], [0.6, 0.5, 0.2, 0.5, 0.3, 0.4, 0.4, 0.2, 1.0, 0.2, 0.4, 0.3, 0.2, 0.5, 0.4, 0.2], [0.2, 0.3, 0.4, 0.3, 0.6, 0.2, 0.3, 0.4, 0.2, 1.0, 0.6, 0.2, 0.3, 0.2, 0.2, 0.3], [0.4, 0.3, 0.4, 0.5, 0.5, 0.4, 0.4, 0.4, 0.4, 0.6, 1.0, 0.3, 0.3, 0.4, 0.3, 0.3], [0.3, 0.2, 0.3, 0.2, 0.3, 0.7, 0.2, 0.3, 0.3, 0.2, 0.3, 1.0, 0.2, 0.3, 0.2, 0.4], [0.4, 0.8, 0.2, 0.2, 0.7, 0.3, 0.3, 0.4, 0.2, 0.3, 0.3, 0.2, 1.0, 0.4, 0.2, 0.2], [0.8, 0.4, 0.2, 0.2, 0.5, 0.5, 0.3, 0.3, 0.5, 0.2, 0.4, 0.3, 0.4, 1.0, 0.2, 0.2], [0.2, 0.3, 0.3, 0.8, 0.2, 0.2, 0.6, 0.2, 0.4, 0.2, 0.3, 0.2, 0.2, 0.2, 1.0, 0.4], [0.2, 0.3, 0.8, 0.4, 0.3, 0.2, 0.4, 0.2, 0.2, 0.3, 0.3, 0.4, 0.2, 0.2, 0.4, 1.0]];

const INFORME_CORR = (() => {
  const antes = comprobarCorrelacion(CORR_DECLARADA);
  const r = proyectarAPSD(CORR_DECLARADA);
  return {
    antes,
    despues: comprobarCorrelacion(r.matriz),
    valoresPropios: r.valoresPropios,
    minimoOriginal: r.minimoOriginal,
    recortados: r.recortados,
    cambioMaximo: r.cambioMaximo,
    yaEraValida: r.yaEraValida,
    matriz: r.matriz,
  };
})();

const CORR_MATRIX = INFORME_CORR.matriz;
const ISO_MAP={
  '004':'AFG',
  '008':'ALB',
  '012':'DZA',
  '020':'AND',
  '024':'AGO',
  '028':'ATG',
  '031':'AZE',
  '032':'ARG',
  '036':'AUS',
  '040':'AUT',
  '044':'BHS',
  '048':'BHR',
  '050':'BGD',
  '051':'ARM',
  '052':'BRB',
  '056':'BEL',
  '064':'BTN',
  '068':'BOL',
  '070':'BIH',
  '072':'BWA',
  '076':'BRA',
  '084':'BLZ',
  '090':'SLB',
  '096':'BRN',
  '100':'BGR',
  '104':'MMR',
  '108':'BDI',
  '112':'BLR',
  '116':'KHM',
  '120':'CMR',
  '124':'CAN',
  '132':'CPV',
  '144':'LKA',
  '148':'TCD',
  '152':'CHL',
  '156':'CHN',
  '158':'TWN',
  '170':'COL',
  '174':'COM',
  '178':'COG',
  '180':'COD',
  '188':'CRI',
  '191':'HRV',
  '192':'CUB',
  '196':'CYP',
  '203':'CZE',
  '204':'BEN',
  '208':'DNK',
  '212':'DMA',
  '214':'DOM',
  '218':'ECU',
  '222':'SLV',
  '226':'GNQ',
  '231':'ETH',
  '232':'ERI',
  '233':'EST',
  '242':'FJI',
  '246':'FIN',
  '250':'FRA',
  '262':'DJI',
  '266':'GAB',
  '268':'GEO',
  '270':'GMB',
  '275':'PSE',
  '276':'DEU',
  '288':'GHA',
  '296':'KIR',
  '300':'GRC',
  '308':'GRD',
  '320':'GTM',
  '324':'GIN',
  '328':'GUY',
  '332':'HTI',
  '340':'HND',
  '344':'HKG',
  '348':'HUN',
  '352':'ISL',
  '356':'IND',
  '360':'IDN',
  '364':'IRN',
  '368':'IRQ',
  '372':'EUU',
  '376':'ISR',
  '380':'ITA',
  '383':'KOS',
  '384':'CIV',
  '388':'JAM',
  '392':'JPN',
  '398':'KAZ',
  '400':'JOR',
  '404':'KEN',
  '410':'KOR',
  '414':'KWT',
  '417':'KGZ',
  '418':'LAO',
  '422':'LBN',
  '426':'LSO',
  '428':'LVA',
  '430':'LBR',
  '434':'LBY',
  '438':'LIE',
  '440':'LTU',
  '442':'LUX',
  '450':'MDG',
  '454':'MWI',
  '458':'MYS',
  '462':'MDV',
  '466':'MLI',
  '470':'EUU',
  '478':'MRT',
  '480':'MUS',
  '484':'MEX',
  '492':'MCO',
  '496':'MNG',
  '498':'MDA',
  '499':'MNE',
  '504':'MAR',
  '508':'MOZ',
  '512':'OMN',
  '516':'NAM',
  '520':'NRU',
  '524':'NPL',
  '528':'NLD',
  '548':'VUT',
  '554':'NZL',
  '558':'NIC',
  '562':'NER',
  '566':'NGA',
  '578':'NOR',
  '583':'FSM',
  '584':'MHL',
  '585':'PLW',
  '586':'PAK',
  '591':'PAN',
  '598':'PNG',
  '600':'PRY',
  '604':'PER',
  '608':'PHL',
  '616':'POL',
  '620':'PRT',
  '624':'GNB',
  '626':'TLS',
  '630':'PRI',
  '634':'QAT',
  '642':'ROU',
  '643':'RUS',
  '646':'RWA',
  '659':'KNA',
  '662':'LCA',
  '670':'VCT',
  '674':'SMR',
  '678':'STP',
  '682':'SAU',
  '686':'SEN',
  '688':'SRB',
  '690':'SYC',
  '694':'SLE',
  '702':'SGP',
  '703':'SVK',
  '704':'VNM',
  '705':'SVN',
  '706':'SOM',
  '710':'ZAF',
  '716':'ZWE',
  '724':'ESP',
  '728':'SSD',
  '736':'SDN',
  '740':'SUR',
  '748':'SWZ',
  '752':'SWE',
  '756':'CHE',
  '760':'SYR',
  '762':'TJK',
  '764':'THA',
  '768':'TOG',
  '776':'TON',
  '780':'TTO',
  '784':'ARE',
  '788':'TUN',
  '792':'TUR',
  '795':'TKM',
  '798':'TUV',
  '800':'UGA',
  '804':'UKR',
  '807':'MKD',
  '818':'EGY',
  '826':'GBR',
  '834':'TZA',
  '840':'USA',
  '854':'BFA',
  '858':'URY',
  '860':'UZB',
  '862':'VEN',
  '882':'WSM',
  '887':'YEM',
  '894':'ZMB'
,
  

  // Rep. Centroafricana
  '140':'CAF',
  // Sáhara Occidental (puede aparecer en topojson)
  '732':'ESH',
  // Variantes de IDs que world-atlas v2 puede usar
  // Kosovo (algunos topojson usan 383 o -99)
  '383':'KOS',
  // Palestina variantes
  '275':'PSE',
  // Corea del Norte
  '408':'PRK',
  // Libia variante
  '434':'LBY',
  // Variantes sin padding para IDs < 100
  '36':'AUS','76':'BRA','124':'CAN','152':'CHL','170':'COL',
  '192':'CUB','214':'DOM','218':'ECU','320':'GTM','332':'HTI',
  '340':'HND','356':'IND','360':'IDN','376':'ISR','392':'JPN',
  '400':'JOR','410':'KOR','422':'LBN','484':'MEX','504':'MAR',
  '528':'NLD','586':'PAK','604':'PER','608':'PHL','616':'POL',
  '630':'PRI','643':'RUS','682':'SAU','710':'ZAF','724':'ESP',
  '756':'CHE','760':'SYR','764':'THA','780':'TTO','784':'ARE',
  '804':'UKR','818':'EGY','826':'GBR','840':'USA','858':'URY',
  '862':'VEN','887':'YEM'
,
  '372':'IRL','470':'MLT','408':'PRK','729':'SDN','698':'SOM'
};

// ── ENHANCED SCORE: base + velocidad + boost correlación ──
/* T27 · El desglose, que antes no se podia ver.

   La tarjeta de cada categoria mostraba un solo numero, el compuesto, con el
   desglose escondido en el atributo title. Eso mezcla en una cifra tres cosas
   de naturaleza muy distinta:

     base   el percentil que sale de los datos, con su fuente y su anio
     vel    un ajuste que depende de VELOCITY, una tabla escrita a mano
     corr   un ajuste que depende de CORR_MATRIX, otra tabla escrita a mano

   Ahora se devuelven separados y la tarjeta ensena la base como numero
   principal con el ajuste al lado, para que se vea cuanto del numero viene
   del dato y cuanto del modelo. */
function enhancedScoreDesglosado(baseScore, catKey, countryCode){
  const vi = CAT_KEYS.indexOf(catKey);
  const vel = (VELOCITY[countryCode]||VELOCITY.WLD)[catKey]||0;
  const velAdj = Math.round(baseScore * vel * 0.28);
  // correlation boost: si categorías correladas también tienen score alto
  let corrBoost = 0;
  const d = DATA[countryCode]||DATA.WLD;
  CAT_KEYS.forEach((k2,j)=>{
    if(k2===catKey) return;
    const c = CORR_MATRIX[vi][j];
    if(c < 0.5) return;
    const s2 = d[k2]?.score || 50;
    corrBoost += (c - 0.5) * (s2 - 50) * 0.06;
  });
  const total = Math.min(100, Math.max(0, Math.round(baseScore + velAdj + corrBoost)));
  return {
    base: baseScore,
    velocidad: velAdj,
    correlacion: Math.round(corrBoost * 10) / 10,
    ajuste: total - baseScore,
    total,
  };
}

function enhancedScore(baseScore, catKey, countryCode){
  return enhancedScoreDesglosado(baseScore, catKey, countryCode).total;
}

// ── VELOCIDAD LABEL ──
function velLabel(catKey, code){
  const v = (VELOCITY[code]||VELOCITY.WLD)[catKey]||0;
  if(v > 0.15) return '<span class="vel-badge vel-up">▲</span>';
  if(v < -0.15) return '<span class="vel-badge vel-dn">▼</span>';
  return '<span class="vel-badge vel-st">—</span>';
}

// ── ALGO BANNER UPDATE ──
function updateAlgoBanner(code){
  const d=DATA[code]||DATA.WLD;
  const vel=VELOCITY[code]||VELOCITY.WLD;
  const worsening=CAT_KEYS.filter(k=>vel[k]>0.15).length;
  let strongCorr=0;
  for(let i=0;i<16;i++) for(let j=i+1;j<16;j++) if(CORR_MATRIX[i][j]>0.6) strongCorr++;

  let maxScore=0, maxCat='';
  CAT_KEYS.forEach(k=>{
    const s=enhancedScore(d[k]?.score||50,k,code);
    if(s>maxScore){maxScore=s;maxCat=k;}
  });

  // Top cadena: encontrar par con mayor producto score*corr
  let bestChain='', bestVal=0;
  CAT_KEYS.forEach((k1,i)=>{
    CAT_KEYS.forEach((k2,j)=>{
      if(j<=i) return;
      const s1=d[k1]?.score||50, s2=d[k2]?.score||50;
      const c=CORR_MATRIX[i][j];
      const val=(s1+s2)/2*c;
      if(val>bestVal && s1>50 && s2>50 && c>0.5){
        bestVal=val;
        bestChain=CAT_LABELS[i]+'→'+CAT_LABELS[j];
      }
    });
  });

  document.getElementById('alg-velocity').textContent=worsening+'/16';
  document.getElementById('alg-corr').textContent=strongCorr;
  document.getElementById('alg-hotspot').textContent=maxScore;
  document.getElementById('alg-chain').textContent=bestChain||'—';
  document.getElementById('alg-chain').style.fontSize=bestChain.length>12?'11px':'22px';
}

// ── RENDER CADENAS DE RIESGO ──
function renderChains(code){
  const d=DATA[code]||DATA.WLD;
  const vel=VELOCITY[code]||VELOCITY.WLD;
  const name=(DATA[code]||DATA.WLD).name;
  document.getElementById('chains-region').textContent=name;

  // Encontrar cadenas activas: pares con alta correlación y ambos scores altos
  const chains=[];
  CAT_KEYS.forEach((k1,i)=>{
    CAT_KEYS.forEach((k2,j)=>{
      if(j<=i) return;
      const s1=enhancedScore(d[k1]?.score||50,k1,code);
      const s2=enhancedScore(d[k2]?.score||50,k2,code);
      const c=CORR_MATRIX[i][j];
      if(c>=0.6 && s1>55 && s2>55){
        chains.push({k1,k2,s1,s2,c,score:(s1+s2)/2*c});
      }
    });
  });
  chains.sort((a,b)=>b.score-a.score);

  const out=document.getElementById('chains-out');
  if(!chains.length){
    out.innerHTML='<div style="color:var(--dim);font-size:12px;font-family:Share Tech Mono,monospace;padding:20px;text-align:center">No se detectan cadenas de riesgo críticas</div>';
    return;
  }

  out.innerHTML=chains.slice(0,6).map(ch=>{
    const i1=CAT_KEYS.indexOf(ch.k1), i2=CAT_KEYS.indexOf(ch.k2);
    const c1=CAT_COLORS[i1], c2=CAT_COLORS[i2];
    const [rl1]=riskLabel(ch.s1), [rl2]=riskLabel(ch.s2);
    return `<div class="chain-item">
      <span style="color:${c1}">■ ${CAT_LABELS[i1]}</span>
      <span class="arrow"> ⟷ </span>
      <span style="color:${c2}">■ ${CAT_LABELS[i2]}</span>
      <span style="float:right;color:var(--dim)">corr:${ch.c.toFixed(2)} · ${Math.round(ch.score)}</span>
    </div>`;
  }).join('');

  // Top correlaciones numéricas
  const topCorr=[];
  CAT_KEYS.forEach((k1,i)=>{
    CAT_KEYS.forEach((k2,j)=>{
      if(j<=i) return;
      const s1=d[k1]?.score||50, s2=d[k2]?.score||50;
      if(CORR_MATRIX[i][j]>0.55 && s1>45 && s2>45)
        topCorr.push({k1,k2,c:CORR_MATRIX[i][j],i,j});
    });
  });
  topCorr.sort((a,b)=>b.c-a.c);
  document.getElementById('top-corr-list').innerHTML=topCorr.slice(0,5).map(t=>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);font-size:11px;font-family:'Share Tech Mono',monospace">
      <span style="color:${CAT_COLORS[t.i]}">${CAT_LABELS[t.i]}</span>
      <span style="color:var(--dim)">↔</span>
      <span style="color:${CAT_COLORS[t.j]}">${CAT_LABELS[t.j]}</span>
      <span style="color:${t.c>0.7?'var(--red)':'var(--yellow)'}">${t.c.toFixed(2)}</span>
    </div>`
  ).join('');
}

// ── CORRELATION MATRIX CANVAS ──
let netSim=null;
function initNetworkGraph(){
  const wrap=document.getElementById('net-wrap');
  if(!wrap||typeof d3==='undefined') return;
  const W=wrap.clientWidth||600, H=wrap.clientHeight||420;
  const code=document.getElementById('region-sel').value;
  const d=DATA[code]||DATA.WLD;

  // Limpiar svg previo
  d3.select('#net-wrap svg').remove();

  const svg=d3.select('#net-wrap').append('svg')
    .attr('viewBox',`0 0 ${W} ${H}`)
    .attr('preserveAspectRatio','xMidYMid meet');

  // Construir nodos y enlaces
  const nodes=CAT_KEYS.map((k,i)=>({
    id:k, label:CAT_LABELS[i], color:CAT_COLORS[i],
    score:enhancedScore(d[k]?.score||50,k,code),
    index:i
  }));

  const links=[];
  for(let i=0;i<16;i++){
    for(let j=i+1;j<16;j++){
      const c=CORR_MATRIX[i][j];
      if(c>=0.45) links.push({source:i,target:j,value:c});
    }
  }

  // Líneas de enlace
  const linkSel=svg.append('g').selectAll('line').data(links).enter().append('line')
    .attr('stroke',d=>d.value>=0.7?'#FF3355':d.value>=0.5?'#FF8C00':'#2E4060')
    .attr('stroke-width',d=>d.value>=0.7?2.5:d.value>=0.5?1.5:0.7)
    .attr('stroke-opacity',d=>d.value>=0.7?0.9:d.value>=0.5?0.6:0.3);

  // Nodos
  const nodeG=svg.append('g').selectAll('g').data(nodes).enter().append('g')
    .attr('cursor','pointer')
    .call(d3.drag()
      .on('start',(e,d)=>{if(!e.active)netSim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;})
      .on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y;})
      .on('end',(e,d)=>{if(!e.active)netSim.alphaTarget(0);d.fx=null;d.fy=null;}));

  // Círculo de fondo (tamaño = score de riesgo)
  nodeG.append('circle')
    .attr('r',d=>10+d.score/12)
    .attr('fill',d=>d.color+'18')
    .attr('stroke',d=>d.color)
    .attr('stroke-width',d=>d.score>65?2:1.2);

  // Anillo exterior para scores críticos
  nodeG.filter(d=>d.score>65).append('circle')
    .attr('r',d=>14+d.score/12)
    .attr('fill','none')
    .attr('stroke',d=>d.color)
    .attr('stroke-width',0.5)
    .attr('stroke-dasharray','3,3')
    .attr('opacity',0.4);

  // Texto etiqueta
  nodeG.append('text')
    .text(d=>d.label.length>7?d.label.substring(0,6)+'…':d.label)
    .attr('text-anchor','middle')
    .attr('dy','0.35em')
    .attr('font-family','Share Tech Mono,monospace')
    .attr('font-size',d=>d.score>65?9:8)
    .attr('font-weight',d=>d.score>65?'bold':'normal')
    .attr('fill',d=>d.color)
    .attr('pointer-events','none');

  // Score pequeño debajo
  nodeG.append('text')
    .text(d=>d.score)
    .attr('text-anchor','middle')
    .attr('dy',d=>18+d.score/12)
    .attr('font-family','Share Tech Mono,monospace')
    .attr('font-size',8)
    .attr('fill',d=>d.score>65?'#FF3355':d.score>45?'#FFFFFF':'#00FF88')
    .attr('pointer-events','none');

  // Hover
  const tip=document.getElementById('net-tooltip');
  const detail=document.getElementById('net-detail');
  nodeG.on('mouseover',(event,d)=>{
    // Tooltip
    const rect=wrap.getBoundingClientRect();
    tip.style.display='block';
    tip.style.left=(event.clientX-rect.left+14)+'px';
    tip.style.top=(event.clientY-rect.top-10)+'px';
    tip.innerHTML=`<span style="color:${d.color};font-weight:bold">${d.label}</span>
      <br>Score: <strong style="color:${d.score>65?'#FF3355':d.score>45?'#FFFFFF':'#00FF88'}">${d.score}/100</strong>`;

    // Panel lateral
    const connected=links
      .filter(l=>(typeof l.source==='object'?l.source.id:CAT_KEYS[l.source])===d.id||
                  (typeof l.target==='object'?l.target.id:CAT_KEYS[l.target])===d.id)
      .sort((a,b)=>b.value-a.value)
      .slice(0,5);
    detail.innerHTML=`
      <div style="color:${d.color};font-size:12px;font-weight:bold;margin-bottom:8px">${d.label}</div>
      <div style="color:var(--dim);font-size:10px;margin-bottom:6px">Score compuesto: <span style="color:${d.score>65?'var(--red)':d.score>45?'var(--yellow)':'var(--green)'}">${d.score}/100</span></div>
      <div style="font-size:10px;color:var(--dim);margin-bottom:6px">TOP CONEXIONES:</div>
      ${connected.map(l=>{
        const otherId=typeof l.source==='object'
          ?(l.source.id===d.id?l.target.id:l.source.id)
          :(CAT_KEYS[l.source]===d.id?CAT_KEYS[l.target]:CAT_KEYS[l.source]);
        const oi=CAT_KEYS.indexOf(otherId);
        const lc=l.value>=0.7?'#FF3355':l.value>=0.5?'#FF8C00':'#FFFFFF';
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
          <span style="color:${CAT_COLORS[oi]}">${CAT_LABELS[oi]}</span>
          <span style="color:${lc}">${l.value.toFixed(2)}</span>
        </div>`;
      }).join('')}`;

    // Resaltar conexiones
    linkSel.attr('stroke-opacity',l=>{
      const sid=typeof l.source==='object'?l.source.id:CAT_KEYS[l.source];
      const tid=typeof l.target==='object'?l.target.id:CAT_KEYS[l.target];
      return (sid===d.id||tid===d.id)?1:0.05;
    }).attr('stroke-width',l=>{
      const sid=typeof l.source==='object'?l.source.id:CAT_KEYS[l.source];
      const tid=typeof l.target==='object'?l.target.id:CAT_KEYS[l.target];
      if(sid===d.id||tid===d.id) return l.value>=0.7?3.5:l.value>=0.5?2.5:1.5;
      return l.value>=0.7?2.5:l.value>=0.5?1.5:0.7;
    });
    nodeG.attr('opacity',n=>{
      const connected2=new Set([d.id]);
      links.forEach(l=>{
        const sid=typeof l.source==='object'?l.source.id:CAT_KEYS[l.source];
        const tid=typeof l.target==='object'?l.target.id:CAT_KEYS[l.target];
        if(sid===d.id)connected2.add(tid);
        if(tid===d.id)connected2.add(sid);
      });
      return connected2.has(n.id)?1:0.2;
    });
  })
  .on('mouseleave',()=>{
    tip.style.display='none';
    linkSel
      .attr('stroke-opacity',l=>l.value>=0.7?0.9:l.value>=0.5?0.6:0.3)
      .attr('stroke-width',l=>l.value>=0.7?2.5:l.value>=0.5?1.5:0.7);
    nodeG.attr('opacity',1);
  });

  // Simulación de fuerzas
  netSim=d3.forceSimulation(nodes)
    .force('link',d3.forceLink(links).id(d=>d.index).distance(d=>120-d.value*60).strength(d=>d.value*0.6))
    .force('charge',d3.forceManyBody().strength(-180))
    .force('center',d3.forceCenter(W/2,H/2))
    .force('collision',d3.forceCollide().radius(d=>20+d.score/12))
    .on('tick',()=>{
      linkSel
        .attr('x1',d=>d.source.x).attr('y1',d=>d.source.y)
        .attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
      nodeG.attr('transform',d=>`translate(${Math.max(20,Math.min(W-20,d.x))},${Math.max(20,Math.min(H-20,d.y))})`);
    });
}

// ── WORLD MAP CON D3 ──
let mapCatMode='global';



function scoreToColor(score){
  if(score===null||score===undefined||isNaN(score)) return '#0D1B2E';
  if(score<25) return '#00CC66';
  if(score<40) return '#44DD88';
  if(score<55) return '#FFD700';
  if(score<70) return '#FF8C00';
  if(score<82) return '#FF4422';
  return '#FF0033';
}


// ══════════════════════════════════════════════════════
//  GLOBE ARCS — Conexiones geopolíticas y de riesgo
// ══════════════════════════════════════════════════════

// Centroides aproximados [lng, lat] de países clave
const COUNTRY_CENTROIDS = {
  USA: [-95, 38],  CHN: [104, 35],  RUS: [90, 60],
  IND: [78, 22],   BRA: [-52, -10], EUU: [10, 51],
  ESP: [-3, 40],   JPN: [138, 36],  AUS: [134, -25],
  ZAF: [25, -29],  NGA: [8, 10],    EGY: [30, 26],
  SAU: [45, 24],   IRN: [53, 32],   IRQ: [44, 33],
  MEX: [-102, 24], ARG: [-64, -34], CAN: [-96, 56],
  KOR: [128, 36],  TUR: [35, 39],   UKR: [31, 49],
  GBR: [-2, 54],   POL: [20, 52],   ISR: [35, 31],
  SYR: [38, 35],   YEM: [48, 15],   SDN: [30, 15],
  SOM: [46, 6],    COD: [24, -2],   ETH: [40, 8],
  PAK: [70, 30],   AFG: [67, 33],   MMR: [96, 17],
  THA: [101, 15],  VNM: [108, 16],  IDN: [118, -2],
  NOR: [10, 62],   SWE: [15, 62],   DEU: [10, 51],
  FRA: [2, 46],    ITA: [12, 43],   UZB: [63, 41],
  KAZ: [68, 48],   AZE: [47, 40],   LBN: [35.5, 33.9],
};

// ── Tipos de conexión — por SEVERIDAD, no por categoría ──
const ARC_TYPES = {
  WAR:      { color:'#FF1A1A', label:'CONFLICTO ARMADO', width:2.2, pulse:true  },
  CRISIS:   { color:'#FF6600', label:'CRISIS ACTIVA',    width:1.8, pulse:true  },
  TENSION:  { color:'#FFB300', label:'TENSIÓN GRAVE',    width:1.3, pulse:false },
  SANCTION: { color:'#9B59B6', label:'PRESIÓN/SANCIONES',width:1.1, pulse:false },
  PROXY:    { color:'#E74C3C', label:'CONFLICTO PROXY',  width:1.5, pulse:true  },
  NUKE:     { color:'#00FFFF', label:'AMENAZA NUCLEAR',  width:1.4, pulse:true  },
  INFLUENCE:{ color:'#3498DB', label:'INFLUENCIA CRÍTICA',width:1.0,pulse:false },
};

// ── CONFLICTOS Y TENSIONES ACTIVAS 2025 ──
// [origen, destino, tipo, intensidad 0-1, etiqueta corta]
const GLOBE_CONNECTIONS = [

  // ═══ GUERRA ACTIVA ═══
  ['RUS','UKR','WAR',  1.0, 'INVASIÓN'],
  ['ISR','PSE','WAR',  1.0, 'GUERRA GAZA'],
  ['ISR','LBN','WAR',  0.9, 'LÍBANO'],
  ['ETH','SOM','WAR',  0.75,'SAHEL'],
  ['SDN','SSD','WAR',  0.8, 'GUERRA CIVIL'],
  ['MMR','THA','WAR',  0.7, 'GUERRA CIVIL'],
  ['YEM','SAU','WAR',  0.8, 'HOUTHI'],

  // ═══ CONFLICTO PROXY ═══
  ['IRN','ISR','PROXY', 0.95,'ATAQUES PROXY'],
  ['IRN','YEM','PROXY', 0.85,'APOYO HOUTHI'],
  ['RUS','SYR','PROXY', 0.8, 'BASE MILITAR'],
  ['CHN','MMR','PROXY', 0.6, 'INFLUENCIA'],
  ['USA','UKR','PROXY', 0.9, 'ARMAMENTO'],

  // ═══ CRISIS ACTIVA ═══
  ['CHN','TWN','CRISIS', 0.95,'ESTRECHO'],
  ['IND','PAK','CRISIS', 0.85,'CACHEMIRA'],
  ['PRK','KOR','CRISIS', 0.9, 'MISILES'],
  ['IRN','USA','CRISIS', 0.9, 'NUCLEAR'],
  ['COD','RWA','CRISIS', 0.8, 'M23'],
  ['MLI','BFA','CRISIS', 0.75,'YIHADISMO'],
  ['SDN','EGY','CRISIS', 0.7, 'NILO/FRONTERA'],

  // ═══ AMENAZA NUCLEAR ═══
  ['PRK','USA','NUKE',  0.9, 'ICBM'],
  ['PRK','JPN','NUKE',  0.85,'SOBREVUELOS'],
  ['IRN','ISR','NUKE',  0.85,'ENRIQUECIMIENTO'],
  ['RUS','USA','NUKE',  0.8, 'DOCTRINA'],

  // ═══ TENSIÓN GRAVE ═══
  ['CHN','USA','TENSION', 0.9, 'COMERCIO/TECH'],
  ['CHN','JPN','TENSION', 0.75,'SENKAKU'],
  ['CHN','PHL','TENSION', 0.8, 'MAR CHINA'],
  ['TUR','GRC','TENSION', 0.7, 'EGEO'],
  ['AZE','ARM','TENSION', 0.75,'NAGORNO'],
  ['SRB','XKX','TENSION', 0.7, 'KOSOVO'],
  ['VEN','COL','TENSION', 0.65,'FRONTERA'],
  ['TUR','SYR','TENSION', 0.7, 'KURDOS'],
  ['IND','CHN','TENSION', 0.8, 'HIMALAYA'],

  // ═══ SANCIONES/PRESIÓN ═══
  ['USA','RUS','SANCTION', 0.95,'SANCIONES'],
  ['EUU','RUS','SANCTION', 0.9, 'SANCIONES'],
  ['USA','CHN','SANCTION', 0.8, 'CHIPS/ARANCELES'],
  ['USA','IRN','SANCTION', 0.9, 'EMBARGO'],
  ['USA','PRK','SANCTION', 0.85,'EMBARGO'],
  ['USA','VEN','SANCTION', 0.7, 'SANCIONES'],
  ['CHN','AUS','SANCTION', 0.65,'ARANCELES'],

  // ═══ INFLUENCIA CRÍTICA ═══
  ['CHN','AFR','INFLUENCE', 0.8,'DEUDA TRAMPA'],
  ['RUS','AFR','INFLUENCE', 0.75,'WAGNER/SAHEL'],
  ['CHN','PAK','INFLUENCE', 0.85,'CPEC'],
  ['USA','ISR','INFLUENCE', 0.9, 'ALIANZA'],
  ['RUS','IRN','INFLUENCE', 0.85,'DRONES/ARMAS'],
  ['CHN','RUS','INFLUENCE', 0.8, 'ALIANZA ESTRATÉGICA'],
];

// Centroides adicionales para conexiones y fallback quirúrgico
Object.assign(COUNTRY_CENTROIDS, {
  AFR: [20, 3],     TWN: [120.9, 23.5], PSE: [34.5, 31.4], XKX: [20.9, 42.7],
  PRK: [127.5, 40.3], PHL: [122, 12.8], ARM: [45, 40.1],  SRB: [21, 44],
  COL: [-74, 4.5],  VEN: [-66, 8],      MLI: [-2, 17],    BFA: [-1.5, 12.5],
  RWA: [29.9, -1.9], GRC: [22, 39],     SSD: [31.3, 7],   DEU: [10, 51],
  FRA: [2, 46],     GBR: [-2, 54],      ITA: [12.5, 42.8], KOR: [127.8, 36.3],
  AUS: [134, -25],  ARG: [-64, -34],    NZL: [172, -41],  PRT: [-8, 39.5],
  NLD: [5.3, 52.1], BEL: [4.5, 50.8],   CHE: [8.2, 46.8], AUT: [14.2, 47.6],
  CZE: [15.3, 49.8], ROU: [24.9, 45.8], DZA: [2.6, 28.1], MAR: [-6.0, 31.8],
  TUN: [9.6, 34.1], KEN: [37.9, 0.4],   ARE: [54.3, 24.3]
});

// Alias regionales: al seleccionar un país, hereda también la capa regional.
const COUNTRY_ALIAS = Object.freeze({
  ESP:['EUU'], PRT:['EUU'], FRA:['EUU'], DEU:['EUU'], ITA:['EUU'], GBR:['EUU'],
  IRL:['EUU'], NLD:['EUU'], BEL:['EUU'], LUX:['EUU'], CHE:['EUU'], AUT:['EUU'],
  POL:['EUU'], CZE:['EUU'], SVK:['EUU'], HUN:['EUU'], ROU:['EUU'], BGR:['EUU'],
  HRV:['EUU'], SVN:['EUU'], GRC:['EUU'], CYP:['EUU'], MLT:['EUU'], DNK:['EUU'],
  SWE:['EUU'], NOR:['EUU'], FIN:['EUU'], EST:['EUU'], LVA:['EUU'], LTU:['EUU'],
  ZAF:['AFR'], NGA:['AFR'], EGY:['AFR'], SDN:['AFR'], SSD:['AFR'], SOM:['AFR'],
  COD:['AFR'], ETH:['AFR'], RWA:['AFR'], MLI:['AFR'], BFA:['AFR'], DZA:['AFR'],
  MAR:['AFR'], TUN:['AFR'], KEN:['AFR']
});

const REGIONAL_MEMBERS = Object.freeze(Object.keys(COUNTRY_ALIAS).reduce((acc, code) => {
  (COUNTRY_ALIAS[code] || []).forEach(alias => {
    (acc[alias] ||= []).push(code);
  });
  return acc;
}, {}));

function getRelatedArcCodes(code){
  const out = new Set();
  if(!code || code==='WLD') return out;
  out.add(code);
  (COUNTRY_ALIAS[code] || []).forEach(alias => out.add(alias));
  (REGIONAL_MEMBERS[code] || []).forEach(member => out.add(member));
  return out;
}
function arcTouchesSelection(fromCode, toCode, activeCodes){
  return activeCodes.has(fromCode) || activeCodes.has(toCode);
}
function normalizeArcKey([fromCode, toCode, type, intensity, label]){
  const ends = [fromCode, toCode].sort().join('~');
  return `${type}|${ends}|${label || ''}`;
}

// Conexiones directas añadidas para que países clave no queden “mudos”
GLOBE_CONNECTIONS.push(
  ['ESP','RUS','SANCTION',0.66,'POSTURA UE'],
  ['ESP','MAR','TENSION',0.50,'FLANCO SUR'],
  ['ESP','DZA','ENERGY' in ARC_TYPES ? 'ENERGY' : 'INFLUENCE',0.58,'GAS/ENERGÍA'],
  ['FRA','RUS','SANCTION',0.72,'POSTURA UE'],
  ['FRA','MLI','CRISIS',0.62,'SAHEL'],
  ['FRA','NGA','INFLUENCE',0.48,'ÁFRICA OCC.'],
  ['GBR','RUS','SANCTION',0.74,'POSTURA UK'],
  ['GBR','IRN','SANCTION',0.60,'PRESIÓN'],
  ['GBR','UKR','PROXY',0.68,'APOYO'],
  ['DEU','RUS','SANCTION',0.78,'ENERGÍA/UE'],
  ['DEU','UKR','PROXY',0.64,'APOYO'],
  ['DEU','CHN','TENSION',0.56,'INDUSTRIA/TECH'],
  ['ITA','LBN','CRISIS',0.48,'MEDITERRÁNEO'],
  ['ITA','DZA','INFLUENCE',0.58,'ENERGÍA'],
  ['ITA','RUS','SANCTION',0.61,'POSTURA UE'],
  ['KOR','JPN','TENSION',0.52,'DISPUTA HIST.'],
  ['KOR','USA','INFLUENCE',0.82,'ALIANZA'],
  ['KOR','CHN','TENSION',0.56,'CADENAS TECH'],
  ['AUS','CHN','TENSION',0.68,'INDO-PACÍFICO'],
  ['AUS','USA','INFLUENCE',0.80,'AUKUS'],
  ['AUS','IDN','INFLUENCE',0.46,'VECINDAD'],
  ['ARG','BRA','INFLUENCE',0.44,'MERCOSUR'],
  ['ARG','USA','TENSION',0.36,'FINANZAS'],
  ['ARG','CHN','INFLUENCE',0.54,'SWAP/INFRA'],
  ['ZAF','RUS','INFLUENCE',0.46,'BRICS'],
  ['NGA','RUS','INFLUENCE',0.42,'SEGURIDAD'],
  ['EGY','ISR','CRISIS',0.55,'GAZA/RAFAH'],
  ['EGY','ETH','CRISIS',0.66,'NILO'],
  ['MAR','DZA','TENSION',0.64,'MAGREB'],
  ['KEN','SOM','CRISIS',0.58,'AL-SHABAAB']
);





// ── LIVE DATA — World Bank API ──


// ── PDF EXPORT ──
function exportPDF(){
  const code=document.getElementById('region-sel').value;
  const name=(DATA[code]||DATA.WLD).name;
  const orig=document.title;
  document.title=`SENTINEL v5 — Informe de Riesgo — ${name} — ${new Date().toISOString().slice(0,10)}`;
  window.print();
  document.title=orig;
}

/* T2 - fetchLiveData eliminada, junto con las dos tablas que solo usaba ella
   (WB_LIVE_INDS y WB_COUNTRY_MAP). Descargaba nueve indicadores del Banco
   Mundial y no hacia nada con los valores: solo contaba updated++ y anadia
   una insignia "LIVE" junto al selector de region. Ademas era codigo muerto:
   el boton #live-btn del que dependia no existe en ninguna pagina y nadie
   llamaba a la funcion, asi que de haberse ejecutado habria lanzado excepcion
   en su primera linea. La Fase 3 trae datos con procedencia de verdad
   (data/latest.json). */

// ── PATCH loadRegion para usar enhanced scores y actualizar mapa/cadenas ──
// loadRegion v5 — replaced by unified v6

// ── PATCH updateBanner para enhanced scores ──

// ── INIT v5 — convertido a función para llamada desde el router ──
function initAetherApp(){
  // T16: antes se inyectaban aqui dos <script> al CDN para cargar d3 y
  // topojson, con el mapa y el grafo esperando a sus onload. Ahora las dos
  // van empaquetadas, asi que solo hay que dar tiempo a que el DOM del
  // dashboard este montado.
  // El mapa coroplético se fue con la tarjeta del globo; queda el grafo.
  setTimeout(()=>{ initNetworkGraph(); }, 3200);
}


// ══════════════════════════════════════════════════════
//  SENTINEL v6 — TERMÓMETRO + RANKING + ESCENARIOS + CHAT
// ══════════════════════════════════════════════════════

// ── DATOS DE FLAGS Y NOMBRES ──
const COUNTRY_FLAGS={WLD:'🌍',USA:'🇺🇸',CHN:'🇨🇳',ESP:'🇪🇸',RUS:'🇷🇺',IND:'🇮🇳',EUU:'🇪🇺',BRA:'🇧🇷',MEX:'🇲🇽',JPN:'🇯🇵',
  SAU:'🇸🇦',IRN:'🇮🇷',ISR:'🇮🇱',TUR:'🇹🇷',GBR:'🇬🇧',UKR:'🇺🇦',POL:'🇵🇱',ARG:'🇦🇷',KOR:'🇰🇷',NGA:'🇳🇬',AUS:'🇦🇺',CAN:'🇨🇦',ZAF:'🇿🇦',PAK:'🇵🇰',EGY:'🇪🇬',
  NOR:'🇳🇴',SWE:'🇸🇪',DEU:'🇩🇪',FRA:'🇫🇷',ITA:'🇮🇹',NLD:'🇳🇱',BEL:'🇧🇪',CHE:'🇨🇭',AUT:'🇦🇹',DNK:'🇩🇰',FIN:'🇫🇮',PRT:'🇵🇹',GRC:'🇬🇷',
  YEM:'🇾🇪',SYR:'🇸🇾',IRQ:'🇮🇶',JOR:'🇯🇴',LBN:'🇱🇧',ARE:'🇦🇪',QAT:'🇶🇦',KWT:'🇰🇼',OMN:'🇴🇲',
  ETH:'🇪🇹',KEN:'🇰🇪',DZA:'🇩🇿',MAR:'🇲🇦',SDN:'🇸🇩',SSD:'🇸🇸',COD:'🇨🇩',SOM:'🇸🇴',TZA:'🇹🇿',UGA:'🇺🇬',GHA:'🇬🇭',SEN:'🇸🇳',
  COL:'🇨🇴',VEN:'🇻🇪',CHL:'🇨🇱',PER:'🇵🇪',HTI:'🇭🇹',CUB:'🇨🇺',DOM:'🇩🇴',
  IDN:'🇮🇩',THA:'🇹🇭',VNM:'🇻🇳',BGD:'🇧🇩',TWN:'🇹🇼',SGP:'🇸🇬',MYS:'🇲🇾',PHL:'🇵🇭',AFG:'🇦🇫',KAZ:'🇰🇿',NZL:'🇳🇿',
  BLR:'🇧🇾',SRB:'🇷🇸',HUN:'🇭🇺',ROU:'🇷🇴',GEO:'🇬🇪',AZE:'🇦🇿',ARM:'🇦🇲'};

// ── TERMÓMETRO EN TIEMPO REAL ──
let thermoData={};
let thermoCountdown=30;
let thermoTimer=null;

function initThermo(code){
  const d=DATA[code]||DATA.WLD;
  thermoData={};
  CAT_KEYS.forEach(k=>{
    thermoData[k]={current:enhancedScore(d[k]?.score||50,k,code),base:enhancedScore(d[k]?.score||50,k,code)};
  });
  renderThermo(code);
  document.getElementById('thermo-region').textContent=(DATA[code]||DATA.WLD).name;
  // T2: ya no hay temporizador de "fluctuacion". El termometro muestra la
  // estimacion de los datos base y no se mueve mientras no haya dato nuevo.
  if(thermoTimer){ clearInterval(thermoTimer); thermoTimer=null; }
}

/**
 * T2 - Actualiza el termometro con datos nuevos.
 *
 * Antes sumaba ruido aleatorio cada 30 segundos
 * ((Math.random()-0.5)*4 mas un sesgo por VELOCITY) y repintaba, de modo
 * que la pantalla parecia recibir lecturas en vivo cuando en realidad
 * estaba inventando el movimiento. Ahora, si no hay dato nuevo, el valor
 * no cambia: el parametro `updates` solo trae valores medidos.
 *
 * @param {string} code  codigo ISO3 de la region
 * @param {Object<string,number>} [updates]  valor nuevo por categoria
 */
function updateThermo(code, updates){
  if(!updates || !thermoData) return;
  let changed=false;
  CAT_KEYS.forEach(k=>{
    const v=updates[k];
    if(typeof v!=='number' || !isFinite(v) || !thermoData[k]) return;
    const next=Math.min(100,Math.max(0,Math.round(v)));
    if(next!==thermoData[k].current){ thermoData[k].current=next; changed=true; }
  });
  if(changed) renderThermo(code);
}

function renderThermo(code){
  const wrap=document.getElementById('thermo-wrap');
  if(!wrap) return;
  // Mostrar las 8 categorías con mayor score
  const sorted=[...CAT_KEYS].sort((a,b)=>(thermoData[b]?.current||0)-(thermoData[a]?.current||0)).slice(0,8);
  wrap.innerHTML='<div class="thermo-wrap" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between">' +
    sorted.map(k=>{
      const i=CAT_KEYS.indexOf(k);
      const cur=thermoData[k]?.current||0;
      const base=thermoData[k]?.base||0;
      const diff=cur-base;
      const col=cur>65?'var(--red)':cur>45?'var(--orange)':'var(--green)';
      const diffStr=diff>0?`<span class="thermo-delta" style="color:var(--red)">▲${diff}</span>`:
                    diff<0?`<span class="thermo-delta" style="color:var(--green)">▼${Math.abs(diff)}</span>`:
                    `<span class="thermo-delta" style="color:var(--dim)">—</span>`;
      return `<div class="thermo-item">
        <div class="thermo-tube">
          <div class="thermo-fill" style="height:${cur}%;background:${col};box-shadow:0 0 6px ${col}44"></div>
        </div>
        <div class="thermo-val" style="color:${col}">${cur}</div>
        ${diffStr}
        <div class="thermo-lbl">${CAT_LABELS[i].substring(0,5)}</div>
      </div>`;
    }).join('') + '</div>';
}

// ── RANKING MUNDIAL ──
// Grupos regionales para ranking
const REGION_GROUPS={
  europe:['ESP','GBR','POL','UKR','TUR','DEU','FRA','ITA','NOR','SWE','CHE','NLD','BEL','AUT','DNK','FIN','PRT','GRC',
          'CZE','SVK','HUN','ROU','BGR','HRV','SRB','BIH','MKD','ALB','MNE','SVN','LTU','LVA','EST','BLR','MDA',
          'GEO','ARM','AZE','LIE','LUX','MCO','AND','SMR','KOS','ISL'],
  mideast:['SAU','IRN','ISR','EGY','YEM','SYR','IRQ','JOR','LBN','PSE','KWT','BHR','QAT','ARE','OMN','DZA','TUN','LBY','MAR'],
  americas:['USA','BRA','MEX','ARG','CAN','COL','VEN','PER','BOL','PRY','URY','ECU','CHL','GUY','SUR',
            'GTM','BLZ','HND','SLV','NIC','CRI','PAN','CUB','JAM','HTI','DOM','TTO','BRB'],
  asia:['CHN','JPN','IND','KOR','AUS','PAK','IDN','THA','VNM','MYS','SGP','PHL','BGD','TWN','BRN',
        'NPL','BTN','LKA','MDV','KHM','LAO','TLS','HKG','MMR','MNG','AFG','KAZ','UZB','TKM','KGZ','TJK','NZL',
        'FJI','PNG','SLB','VUT','WSM','TON'],
  africa:['NGA','ZAF','ETH','KEN','EGY','DZA','MAR','SDN','SSD','COD','SOM','TZA','UGA','RWA','BDI',
          'MOZ','ZMB','ZWE','MWI','NAM','BWA','LSO','SWZ','SEN','GHA','CIV','MLI','BFA','NER','TCD',
          'CMR','GNB','GMB','LBR','SLE','GIN','AGO','COG','GAB','GNQ','STP','CPV','TOG','BEN','MRT',
          'ERI','DJI','COM','SYC','MUS','MDG'],
};

function renderRanking(){
  const regionSel=document.getElementById('ranking-region')?.value||'all';
  const catSel=document.getElementById('ranking-cat')?.value||'global';
  const topN=parseInt(document.getElementById('ranking-top')?.value||'10');
  const order=document.getElementById('ranking-order')?.value||'desc';

  /* T23: los agregados (mundo, Union Europea) no compiten en el ranking, y
     los territorios sin ninguna fuente oficial tampoco aparecen: antes
     entraban con un 50 de relleno y se colocaban en mitad de la tabla como
     si fuera una medicion. */
  let codes=Object.keys(DATA).filter(k=>k!=='WLD'&&k!=='EUU'&&!DATA[k].sinDatos);
  if(regionSel!=='all') codes=codes.filter(k=>REGION_GROUPS[regionSel]?.includes(k));

  const ranked=codes.map(code=>{
    const d=DATA[code];
    if(!d) return null;
    /* La puntuacion global es la que calcula src/core/scoring.js, la misma
       que muestran el banner y el globo. Antes se recalculaba aqui con una
       media que rellenaba con 50 las categorias sin dato. */
    const score=catSel==='global'
      ? d.score
      : (d[catSel] && typeof d[catSel].score==='number' ? d[catSel].score : null);
    if(typeof score!=='number') return null;
    return{
      code, name:d.name||code, score, flag:COUNTRY_FLAGS[code]||'🌐',
      nivel: catSel==='global' ? d.nivel : null,
      elevado: catSel==='global' ? d.elevadoPorConflicto : null,
    };
  }).filter(Boolean).sort((a,b)=>{
    /* Ordena por NIVEL y, dentro de cada nivel, por indice.

       Antes ordenaba solo por indice, y desde que el conflicto impone un
       suelo eso producia una lista incoherente consigo misma: Ucrania, con
       etiqueta CRITICO, aparecia por debajo de paises etiquetados ALTO
       porque su indice es menor. La etiqueta es lo que el usuario lee. */
    if(catSel==='global' && a.nivel && b.nivel){
      const da = ORDEN_NIVEL_RANKING[a.nivel] ?? 9;
      const db = ORDEN_NIVEL_RANKING[b.nivel] ?? 9;
      if(da !== db) return order==='desc' ? da - db : db - da;
    }
    return order==='desc' ? b.score-a.score : a.score-b.score;
  }).slice(0,topN);

  const el=document.getElementById('ranking-list');
  const countEl=document.getElementById('ranking-count');
  if(!el) return;
  if(countEl) countEl.textContent=ranked.length+' PAÍSES · '+catSel.toUpperCase();

  el.innerHTML=ranked.map((r,i)=>{
    const col=r.score>65?'var(--red)':r.score>45?'var(--orange)':r.score>30?'var(--yellow)':'var(--green)';
    const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    const hasDetail=DATA[r.code]?.eco?.inds?.length>0;
    return `<div class="rank-row" style="cursor:${hasDetail?'pointer':'default'}" 
      ${hasDetail?`data-rank-code="${esc(r.code)}"`:''}
      title="${hasDetail?'Click para cargar región':''}">
      <div class="rank-pos" style="color:${col};font-size:${medal?'14px':'12px'}">${medal||'#'+(i+1)}</div>
      <div class="rank-flag">${esc(r.flag)}</div>
      <div class="rank-name" style="font-size:${r.name.length>14?'10px':'12px'}">${esc(r.name)}${r.elevado ? `<span class="rank-flecha" title="${esc(r.elevado.motivo)}">↑</span>` : ''}</div>
      <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${r.score}%;background:${col}"></div></div>
      <div class="rank-score" style="color:${col}">${r.score}</div>
    </div>`;
  }).join('');
}

// ── ESCENARIOS PREDICTIVOS ──
let scenarioData={opt:null,base:null,pes:null};
let activeScenario='base';

async function runScenarios(){
  const btn=document.getElementById('scenario-btn');
  btn.disabled=true; btn.textContent='🔮 GENERANDO...';
  const out=document.getElementById('ai-out');
  const tabs=document.getElementById('scenario-tabs');
  const probEl=document.getElementById('scenario-prob');
  out.innerHTML=`<div class="thinking"><div class="dk"></div><div class="dk"></div><div class="dk"></div><span style="color:var(--purple);font-size:12px;margin-left:4px">AETHER GENERANDO 3 ESCENARIOS...</span></div>`;
  tabs.style.display='none';

  const code=document.getElementById('region-sel').value;
  const d=DATA[code]||DATA.WLD;
  const gScore=Math.round(CAT_KEYS.map(k=>enhancedScore(d[k]?.score||50,k,code)).reduce((a,b)=>a+b,0)/CAT_KEYS.length);
  const topRisks=CAT_KEYS.map((k,i)=>({k,s:enhancedScore(d[k]?.score||50,k,code),l:CAT_LABELS[i]}))
    .sort((a,b)=>b.s-a.s).slice(0,5).map(x=>`${x.l}:${x.s}`).join(', ');

  const prompt=`Eres AETHER, sistema de inteligencia de riesgo global. Genera TRES escenarios predictivos para ${d.name} en los próximos ${horizon} meses.

Score global actual: ${gScore}/100
Categorías más críticas: ${topRisks}

Responde EXACTAMENTE en este formato JSON (solo JSON, sin texto extra, sin markdown):
{"optimista":{"prob":XX,"titulo":"...","resumen":"2-3 frases concretas del escenario optimista","factores":["factor1","factor2","factor3"]},"base":{"prob":XX,"titulo":"...","resumen":"2-3 frases del escenario más probable","factores":["factor1","factor2","factor3"]},"pesimista":{"prob":XX,"titulo":"...","resumen":"2-3 frases del escenario pesimista","factores":["factor1","factor2","factor3"]}}

Las probabilidades deben sumar 100. Sé específico y usa los datos reales.`;

  try{
    const res=await fetch(getOllamaURL()+'/api/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:getModel(),stream:false,messages:[{role:'user',content:prompt}]})
    });
    const data=await res.json();
    let txt=data.message?.content||'{}';
    // Limpiar posible markdown del modelo
    txt=txt.replace(/```json|```/g,'').trim();
    const idx=txt.indexOf('{'), end=txt.lastIndexOf('}');
    if(idx>=0&&end>idx) txt=txt.slice(idx,end+1);
    const sc=JSON.parse(txt);
    scenarioData={opt:sc.optimista,base:sc.base,pes:sc.pesimista};
    tabs.style.display='flex';
    showScenario('base',document.querySelector('.stab.base'));
  }catch(e){
    out.innerHTML=`<div class="ai-block warn"><div class="ai-tag" style="color:var(--red)">ERROR ///</div><div>No se pudieron generar escenarios: ${esc(e.message)}</div></div>`;
    tabs.style.display='none';
  }
  btn.disabled=false; btn.textContent='🔮 ESCENARIOS';
}

function showScenario(type,el){
  activeScenario=type;
  document.querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  const sc=scenarioData[type];
  if(!sc) return;
  const colors={opt:'var(--green)',base:'var(--yellow)',pes:'var(--red)'};
  const icons={opt:'✅',base:'📊',pes:'⚠'};
  const col=colors[type];
  document.getElementById('scenario-prob').style.display='block';
  document.getElementById('scenario-prob').innerHTML=
    `<span style="color:${col}">${icons[type]} ${esc(sc.titulo||'')}</span> &nbsp;·&nbsp; Probabilidad: <strong style="color:${col}">${esc(sc.prob)}%</strong>`;
  const out=document.getElementById('ai-out');
  out.innerHTML=`
    <div class="ai-block ${type==='pes'?'warn':type==='base'?'pred':''}">
      <div class="ai-tag" style="color:${col}">ESCENARIO ${type==='opt'?'OPTIMISTA':type==='base'?'BASE':'PESIMISTA'} · ${esc(sc.prob)}% PROB. ///</div>
      <div style="margin-bottom:10px">${esc(sc.resumen||'').replace(/\n/g,'<br/>')}</div>
      <div style="font-size:10px;color:var(--dim);letter-spacing:1px;margin-bottom:6px;font-family:'Share Tech Mono',monospace">FACTORES CLAVE:</div>
      ${(sc.factores||[]).map(f=>`<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:11px;font-family:'Share Tech Mono',monospace">· ${esc(f)}</div>`).join('')}
    </div>`;
}

// ── CHAT LIBRE ──
let chatHistory=[];

let _chatBusy=false;
async function sendChat(){
  if(_chatBusy) return;
  const input=document.getElementById('chat-input');
  const msg=input.value.trim();
  if(!msg) return;
  input.value='';

  const msgs=document.getElementById('chat-messages');

  // Añadir mensaje usuario
  const uDiv=document.createElement('div');
  uDiv.className='chat-msg chat-user';
  uDiv.textContent=msg;
  msgs.appendChild(uDiv);

  // Indicador pensando
  const thinkDiv=document.createElement('div');
  thinkDiv.className='chat-msg chat-bot';
  thinkDiv.innerHTML='<div class="thinking" style="padding:0"><div class="dk"></div><div class="dk"></div><div class="dk"></div></div>';
  msgs.appendChild(thinkDiv);
  msgs.scrollTop=msgs.scrollHeight;

  const code=document.getElementById('region-sel').value;
  const d=DATA[code]||DATA.WLD;
  const gScore=Math.round(CAT_KEYS.map(k=>enhancedScore(d[k]?.score||50,k,code)).reduce((a,b)=>a+b,0)/CAT_KEYS.length);
  const top5=CAT_KEYS.map((k,i)=>({k,s:enhancedScore(d[k]?.score||50,k,code),l:CAT_LABELS[i]}))
    .sort((a,b)=>b.s-a.s).slice(0,5).map(x=>`${x.l}(${x.s})`).join(', ');

  const systemCtx=`Eres AETHER, asistente de inteligencia de riesgo global de OkrtSystem Labs. Tienes acceso a datos de riesgo de 10 países en 16 categorías.
Región actual: ${d.name} | Score global: ${gScore}/100 | Top riesgos: ${top5}
Responde en español, de forma concisa y técnica. Máximo 120 palabras.`;

  chatHistory.push({role:'user',content:msg});
  _chatBusy=true;
  try{
    const res=await fetch(getOllamaURL()+'/api/chat',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:getModel(),stream:false,
        messages:[{role:'system',content:systemCtx},...chatHistory.slice(-6)]
      })
    });
    const data=await res.json();
    const reply=data.message?.content||'Sin respuesta.';
    chatHistory.push({role:'assistant',content:reply});
    const _r1=reply.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const _r2=_r1.replace(/\n/g,'<br>');
    thinkDiv.innerHTML=`<strong style="color:var(--green);font-size:10px">AETHER</strong><br>${_r2}`;
  }catch(e){
    thinkDiv.className='chat-msg chat-bot warn';
    thinkDiv.textContent='Error: '+e.message;
  }
  _chatBusy=false;
  msgs.scrollTop=msgs.scrollHeight;
}

// loadRegion v6 wrapper — replaced by unified v6

// ── INIT v6 ──
function initAetherApp2(){
  setTimeout(()=>{
    renderRanking();
    const initCode=document.getElementById('region-sel').value||'WLD';
    initThermo(initCode);
  },3000);
}


// ══════════════════════════════════════════════════════
//  loadRegion ÚNICO — SENTINEL v6 DEFINITIVO
// ══════════════════════════════════════════════════════
const CATS_CFG=[
  {k:'eco',  g:'g-eco',  n:'n-eco',  c:'c-eco',  i:'i-eco',  color:'#FFFFFF'},
  {k:'geo',  g:'g-geo',  n:'n-geo',  c:'c-geo',  i:'i-geo',  color:'#00FFC8'},
  {k:'health',g:'g-health',n:'n-health',c:'c-health',i:'i-health',color:'#FFFFFF'},
  {k:'climate',g:'g-climate',n:'n-climate',c:'c-climate',i:'i-climate',color:'#7DD8F0'},
  {k:'social',g:'g-social',n:'n-social',c:'c-social',i:'i-social',color:'#B0C8E0'},
  {k:'tech',  g:'g-tech',  n:'n-tech',  c:'c-tech',  i:'i-tech',  color:'#00FFC8'},
  {k:'food',  g:'g-food',  n:'n-food',  c:'c-food',  i:'i-food',  color:'#7DD8F0'},
  {k:'mental',g:'g-mental',n:'n-mental',c:'c-mental',i:'i-mental',color:'#B0C8E0'},
  {k:'energy',g:'g-energy',n:'n-energy',c:'c-energy',i:'i-energy',color:'#FFFFFF'},
  {k:'demo',  g:'g-demo',  n:'n-demo',  c:'c-demo',  i:'i-demo',  color:'#B0C8E0'},
  {k:'urban', g:'g-urban', n:'n-urban', c:'c-urban', i:'i-urban', color:'#7DD8F0'},
  {k:'science',g:'g-science',n:'n-science',c:'c-science',i:'i-science',color:'#00FFC8'},
  {k:'justice',g:'g-justice',n:'n-justice',c:'c-justice',i:'i-justice',color:'#FFFFFF'},
  {k:'finance',g:'g-finance',n:'n-finance',c:'c-finance',i:'i-finance',color:'#00FFC8'},
  {k:'ocean',  g:'g-ocean',  n:'n-ocean',  c:'c-ocean',  i:'i-ocean',  color:'#7DD8F0'},
  {k:'bio',    g:'g-bio',    n:'n-bio',    c:'c-bio',    i:'i-bio',    color:'#B0C8E0'},
];

/* T23 · Avisos cuando no hay datos que mostrar.

   Las dos existen por lo mismo: desde que el panel lee data/latest.json
   puede encontrarse sin datos, y un panel de riesgo que en ese caso pinta
   ceros, rayas o medias de relleno esta afirmando algo que no sabe. */

/** No se pudo cargar el fichero de datos. */
function mostrarFalloDeDatos(){
  const num=document.getElementById('gnum');
  const est=document.getElementById('gstatus');
  if(num){ num.textContent='—'; num.style.color='var(--dim)'; }
  if(est){
    est.textContent='SIN DATOS';
    est.style.color='var(--red)';
    est.title='No se ha podido cargar data/latest.json: '+(DATOS_ESTADO.error||'error desconocido');
  }
  for(let i=0;i<16;i++){
    const el=document.getElementById('gs'+i);
    if(el){ el.textContent='—'; el.style.color='var(--dim)'; }
  }
  CATS_CFG.forEach(({g,n,c,i})=>{
    const nEl=document.getElementById(n); if(nEl){ nEl.textContent='—'; nEl.style.color='var(--dim)'; }
    const cEl=document.getElementById(c); if(cEl){ cEl.textContent='SIN DATOS'; cEl.style.color='var(--dim)'; }
    const iEl=document.getElementById(i); if(iEl) iEl.innerHTML='';
    drawGauge(g,0,'var(--dim)');
  });
  actualizarPieDeDatos();
  actualizarTarjetaGlobo();
}

/** El territorio existe en el selector pero ninguna fuente lo publica. */
function mostrarSinDatos(d){
  const num=document.getElementById('gnum');
  const est=document.getElementById('gstatus');
  if(num){ num.textContent='—'; num.style.color='var(--dim)'; }
  if(est){
    est.textContent='SIN FUENTE OFICIAL';
    est.style.color='var(--dim)';
    est.title=d.motivo||'';
  }
  for(let i=0;i<16;i++){
    const el=document.getElementById('gs'+i);
    if(el){ el.textContent='—'; el.style.color='var(--dim)'; }
  }
  CATS_CFG.forEach(({g,n,c,i})=>{
    const nEl=document.getElementById(n); if(nEl){ nEl.textContent='—'; nEl.style.color='var(--dim)'; }
    const cEl=document.getElementById(c); if(cEl){ cEl.textContent='—'; cEl.style.color='var(--dim)'; }
    const iEl=document.getElementById(i);
    if(iEl) iEl.innerHTML='<div class="ind-row"><span class="ind-name">'+esc(d.motivo||'Sin datos')+'</span></div>';
    drawGauge(g,0,'var(--dim)');
  });
  actualizarPieDeDatos();
  actualizarTarjetaGlobo();
}

/** Fecha de los datos y su procedencia, visible en el panel. */
function actualizarPieDeDatos(){
  const el=document.getElementById('datos-pie');
  if(!el) return;
  if(!DATOS_ESTADO.ok){
    el.textContent='DATOS: no disponibles';
    el.title=DATOS_ESTADO.error||'';
    return;
  }
  const n=DATOS_ESTADO.datos ? Object.keys(DATOS_ESTADO.datos.indicadores).length : 0;
  const fuentes=DATOS_ESTADO.datos ? Object.keys(DATOS_ESTADO.datos.fuentes).length : 0;
  el.textContent='DATOS: '+fechaDatos(DATOS_ESTADO.datos)+' · '+n+' indicadores de '+fuentes+' catálogos oficiales'
    +(DATOS_ESTADO.deCache?' · última lectura guardada':'');
  el.title=DATOS_ESTADO.deCache
    ? 'Servidos de la copia del service worker, no recién descargados'
    : 'Descargados por el trabajo semanal; cada dato lleva su fuente y su año';
}

/**
 * El reparto por niveles y la fecha, en la tarjeta del globo.
 *
 * Sale de lo mismo que el ranking y la ficha —`DATA`, que construye
 * datos-dashboard.js a partir de data/latest.json— para que las tres cosas no
 * puedan decir números distintos. La tarjeta sustituye al mapa coroplético,
 * que llevaba vacío desde que el panel pasó a módulos ES.
 */
function actualizarTarjetaGlobo(){
  const caja=document.getElementById('gt-niveles');
  if(!caja) return;

  const cuenta={CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0};
  let total=0;
  for(const [code,d] of Object.entries(DATA)){
    // Los agregados no son países y no entran en el reparto.
    if(code==='WLD'||code==='EUU'||!d||d.sinDatos||!d.nivel) continue;
    if(cuenta[d.nivel]==null) continue;
    cuenta[d.nivel]++; total++;
  }

  const pon=(id,n)=>{const el=document.getElementById(id); if(el) el.textContent=n;};
  pon('gt-critico',cuenta.CRITICAL);
  pon('gt-alto',cuenta.HIGH);
  pon('gt-medio',cuenta.MEDIUM);
  pon('gt-bajo',cuenta.LOW);
  caja.setAttribute('aria-label',
    `Reparto de ${total} países: ${cuenta.CRITICAL} en nivel crítico, `
    +`${cuenta.HIGH} alto, ${cuenta.MEDIUM} medio y ${cuenta.LOW} bajo`);

  const fecha=document.getElementById('gt-fecha');
  if(fecha){
    fecha.textContent=DATOS_ESTADO.ok
      ? `DATOS: ${fechaDatos(DATOS_ESTADO.datos)} · ${total} PAÍSES`
      : 'DATOS: no disponibles';
  }
}

function loadRegion(){
  const code=document.getElementById('region-sel').value;
  const d=DATA[code]||DATA.WLD;

  /* T23: si no hay datos del fichero, decirlo. Antes DATA venia escrita en
     el propio motor y siempre estaba; ahora se descarga, y si falla la
     descarga el panel tiene que decir que no hay datos en lugar de pintar
     una lectura de ceros que parece una lectura de verdad. */
  if(!DATOS_ESTADO.ok){ mostrarFalloDeDatos(); return; }

  /* T23: y si el territorio existe en el selector pero ninguna fuente
     oficial lo publica (Taiwan es el unico caso), se dice tambien, con el
     motivo. Antes el selector lo ofrecia con cifras escritas a mano. */
  if(d && d.sinDatos){ mostrarSinDatos(d); return; }

  // ── 1. Cards: gauges + scores + indicadores ──
  CATS_CFG.forEach(({k,g,n,c,i,color})=>{
    const cat=d[k];
    if(!cat) return;
    /* T27 · Base y ajuste, separados.
       El numero grande es la puntuacion que sale de los datos; el pequeno, lo
       que le anade el modelo (velocidad y correlaciones, las dos tablas
       escritas a mano). La aguja sigue marcando el compuesto. */
    const desg=enhancedScoreDesglosado(cat.score,k,code);
    const eScore=desg.total;
    const gaugeColor=eScore>=75?'#FF3355':eScore>=55?'#FF8C00':eScore>=35?'#FFD700':'#00CC66';
    drawGauge(g,eScore,gaugeColor);
    const nEl=document.getElementById(n);
    if(nEl){
      const colorBase=desg.base>=75?'#FF3355':desg.base>=55?'#FF8C00':desg.base>=35?'#FFD700':'#00CC66';
      const signo=desg.ajuste>0?'+':'';
      nEl.innerHTML=desg.ajuste!==0
        ? esc(String(desg.base))+'<span class="score-ajuste">'+esc(signo+desg.ajuste)+'</span>'
        : esc(String(desg.base));
      nEl.style.color=colorBase;
      const conf=cat.confianza&&cat.confianza.nivel?cat.confianza.nivel:'—';
      nEl.title='Dato: '+desg.base+' (confianza '+conf+')'
        +' · ajuste del modelo: velocidad '+(desg.velocidad>0?'+':'')+desg.velocidad
        +', correlaciones '+(desg.correlacion>0?'+':'')+desg.correlacion
        +' · compuesto '+eScore
        +'. La velocidad y las correlaciones salen de tablas escritas a mano, no de los datos.';
    }
    const[lbl,lc]=riskLabel(eScore);
    const cEl=document.getElementById(c);
    if(cEl){
      cEl.innerHTML=lbl+(typeof velLabel==='function'?' '+velLabel(k,code):'');
      cEl.style.color=lc;
    }
    renderInds(i,cat.inds,color);
  });

  // ── 2. Banner global ──
  /* T23: la cifra del banner es la puntuacion compuesta que calcula
     src/core/scoring.js, y no la media de los enhancedScore de las 16
     categorias que se hacia aqui.

     Dos motivos. El primero es que esa media rellenaba con 50 las
     categorias sin dato, de modo que un pais con la mitad de las categorias
     vacias acababa con una cifra a medio camino que parecia una medicion.
     El segundo es que el globo tiene que mostrar el MISMO numero, y lo que
     se calculaba aqui dependia de VELOCITY, que sigue siendo una tabla
     escrita a mano (la revisa T27). El enhancedScore se mantiene donde
     estaba, en las tarjetas de cada categoria, con su desglose en el title. */
  const scores=CAT_KEYS.map(k=>{
    const cat=d[k];
    if(!cat) return null;
    return typeof enhancedScore==='function' ? enhancedScore(cat.score,k,code) : cat.score;
  });
  const global=(typeof d.score==='number')
    ? d.score
    : Math.round(scores.filter(v=>typeof v==='number').reduce((a,b)=>a+b,0)/Math.max(1,scores.filter(v=>typeof v==='number').length));
  /* La etiqueta sale del NIVEL CALCULADO, no de un umbral fijo.

     riskLabel() tenia sus propios cortes (30/50/70) heredados de cuando las
     puntuaciones estaban escritas a mano. Con el indice actual eso dejaba a
     Espana en "ELEVADO" cuando esta en la mitad con MENOS riesgo del mundo:
     dos escalas distintas contandole al usuario cosas distintas sobre el
     mismo numero.

     Ahora la etiqueta es el tramo en el que cae el pais entre los 217, y la
     interfaz dice que es una clasificacion relativa. */
  const nivel = d.nivel ? NIVEL_INFO[d.nivel] : null;
  const col = nivel ? nivel.color : 'var(--dim)';
  const lbl = nivel ? nivel.etiqueta : '—';
  const gnumEl = document.getElementById('gnum');
  const gstatusEl = document.getElementById('gstatus');
  gnumEl.textContent = global;
  gnumEl.style.color = col;
  gstatusEl.textContent = lbl;
  gstatusEl.style.color = col;
  if (nivel && d.puesto) {
    gstatusEl.title = nivel.descripcion + ' · puesto ' + d.puesto + ' de ' + d.deTotal
      + '. ' + ETIQUETA_RELATIVA;
  }
  actualizarPieDeNivel(d);
  for(let i=0;i<16;i++){
    const el=document.getElementById('gs'+i);
    if(el){
      /* T23: una categoria sin ningun indicador con dato vale null, no 50.
         Se muestra una raya y en gris; antes ese hueco se rellenaba con un
         50 que no distinguia "riesgo medio" de "no lo sabemos". */
      const s=scores[i];
      const tiene=typeof s==='number';
      el.textContent=tiene?s:'—';
      el.title=tiene?'':'Sin ningún indicador con dato en esta categoría';
      el.style.color=!tiene?'var(--dim)':s>=75?'#FF3355':s>=55?'#FF8C00':s>=35?'#FFD700':'#00CC66';
    }
  }
  const seg=document.getElementById('tsegs');
  if(seg){
    const n=Math.ceil((global/100)*10);
    seg.innerHTML=Array.from({length:10},(_,i)=>{
      const pct=(i+1)/10;
      const sc=pct<.35?'var(--green)':pct<.6?'var(--yellow)':pct<.8?'var(--orange)':'var(--red)';
      return`<div class="tseg${i<n?' on':''}" style="background:${sc}"></div>`;
    }).join('');
  }

  // ── 3. Resto de módulos ──
  actualizarPieDeDatos();
  actualizarTarjetaGlobo();
  renderEvents(d);
  if(typeof updateAlgoBanner==='function') updateAlgoBanner(code);
  if(typeof renderChains==='function')     renderChains(code);
  if(typeof initThermo==='function')       initThermo(code);
  if(typeof renderRanking==='function')    renderRanking();
  if(typeof d3!=='undefined' && typeof initNetworkGraph==='function')
    setTimeout(initNetworkGraph,120);
  if(typeof updateCascadeModule==='function') setTimeout(()=>updateCascadeModule(code),300);
}

// ── updateBanner también como alias ──
/* T12/T13: updateBanner estaba declarada tres veces en el ambito global.
   Por hoisting ganaba la ultima, asi que las dos primeras no se ejecutaban
   nunca. En un modulo ES eso es un error de sintaxis, de modo que la
   migracion lo ha destapado. Se conservan solo la que gana hoy. */

function updateBanner(d,code){
  code=code||document.getElementById('region-sel').value;
  loadRegion();
}



// ══════════════════════════════════════════════════════════════════
//  AETHER — MOTOR DE PROPAGACIÓN EN CASCADA v1.0
//  Módulos: PropagationMatrix · CascadeSimulator · MonteCarloEngine
//           ResilienceIndex · InflectionDetector
// ══════════════════════════════════════════════════════════════════

// ── MATRIZ DE PROPAGACIÓN TEMPORAL ──
// {strength, lag (semanas), decay (% por semana)}
const PROP_MATRIX = {
  // eco → otros
  eco:    {geo:{s:.6,l:8,d:.08}, social:{s:.7,l:4,d:.06}, finance:{s:.8,l:2,d:.05},
           mental:{s:.4,l:12,d:.10}, urban:{s:.4,l:16,d:.08}, demo:{s:.3,l:24,d:.06}},
  // geo → otros
  geo:    {eco:{s:.6,l:4,d:.07}, social:{s:.6,l:2,d:.06}, justice:{s:.8,l:1,d:.04},
           tech:{s:.5,l:6,d:.08}, mental:{s:.4,l:8,d:.10}, demo:{s:.4,l:12,d:.08}},
  // climate → otros
  climate:{food:{s:.8,l:4,d:.05}, ocean:{s:.8,l:8,d:.04}, demo:{s:.5,l:16,d:.07},
           health:{s:.5,l:8,d:.08}, social:{s:.4,l:12,d:.09}, urban:{s:.5,l:6,d:.07},
           energy:{s:.5,l:4,d:.08}},
  // health → otros
  health: {eco:{s:.4,l:4,d:.08}, mental:{s:.7,l:2,d:.06}, social:{s:.5,l:6,d:.08},
           demo:{s:.4,l:12,d:.07}, finance:{s:.3,l:8,d:.09}},
  // social → otros
  social: {geo:{s:.6,l:4,d:.06}, mental:{s:.8,l:2,d:.05}, justice:{s:.7,l:6,d:.07},
           eco:{s:.5,l:8,d:.08}, demo:{s:.4,l:16,d:.07}},
  // finance → otros
  finance:{eco:{s:.8,l:1,d:.04}, social:{s:.6,l:4,d:.07}, urban:{s:.4,l:8,d:.09},
           tech:{s:.4,l:6,d:.08}, demo:{s:.3,l:16,d:.08}},
  // food → otros
  food:   {health:{s:.6,l:4,d:.07}, social:{s:.7,l:6,d:.06}, eco:{s:.5,l:8,d:.08},
           mental:{s:.5,l:8,d:.08}, demo:{s:.4,l:16,d:.07}, geo:{s:.4,l:12,d:.09}},
  // energy → otros
  energy: {eco:{s:.6,l:2,d:.06}, climate:{s:.4,l:8,d:.08}, finance:{s:.5,l:4,d:.07},
           urban:{s:.4,l:6,d:.08}, tech:{s:.3,l:8,d:.09}},
  // tech → otros
  tech:   {eco:{s:.4,l:4,d:.08}, finance:{s:.5,l:2,d:.07}, geo:{s:.5,l:6,d:.08},
           science:{s:.7,l:8,d:.06}},
  // justice → otros
  justice:{social:{s:.7,l:2,d:.06}, geo:{s:.8,l:4,d:.05}, eco:{s:.4,l:8,d:.09}},
  // ocean → others
  ocean:  {food:{s:.6,l:6,d:.07}, climate:{s:.4,l:4,d:.08}, health:{s:.3,l:12,d:.09}},
  // bio → others
  bio:    {health:{s:.8,l:1,d:.04}, eco:{s:.5,l:4,d:.08}, social:{s:.5,l:6,d:.07},
           demo:{s:.4,l:8,d:.09}},
  // mental → others
  mental: {social:{s:.6,l:4,d:.07}, eco:{s:.3,l:8,d:.10}, health:{s:.5,l:6,d:.08}},
  // demo → others
  demo:   {eco:{s:.4,l:12,d:.07}, social:{s:.5,l:8,d:.08}, urban:{s:.5,l:8,d:.07},
           finance:{s:.3,l:16,d:.09}},
  // urban → others
  urban:  {eco:{s:.4,l:6,d:.09}, social:{s:.4,l:4,d:.08}, health:{s:.3,l:8,d:.10}},
  // science → others
  science:{tech:{s:.7,l:4,d:.06}, eco:{s:.4,l:12,d:.08}, health:{s:.3,l:16,d:.09}},
};

// ── FACTORES DE RESILIENCIA ──
// Qué categorías amortiguan los shocks entrantes
const RESILIENCE_DECLARADOS = {
  science: 0.18,  // I+D amortigua propagaciones
  eco:     0.15,  // solidez económica
  health:  0.12,  // salud pública fuerte absorbe shocks bio/mental
  tech:    0.12,  // capacidad tecnológica
  justice: 0.10,  // instituciones sólidas
  finance: 0.10,
  urban:   0.08,
  social:  0.08,
  demo:    0.07,
  geo:     0.05,
  climate: 0.03,
  food:    0.02,
  mental:  0.02,
  energy:  0.03,
  ocean:   0.03,
  bio:     0.02,
};

/* T27 · Los pesos de resiliencia sumaban 1,20, no 1.

   El indice de resiliencia es una media ponderada que se usa como un valor de
   0 a 1: (1 - resilience*0,6) amortigua los shocks y (1 - resilience*0,4) los
   atenua al llegar. Con pesos que suman 1,20 un pais perfecto habria dado
   1,20, y el recorte a 0,95 del final estaba tapando el problema: el indice
   llegaba al techo antes de lo debido y todos los paises buenos quedaban
   indistinguibles ahi arriba.

   Se dividen por su suma. Los pesos RELATIVOS no cambian -la ciencia sigue
   pesando nueve veces mas que la alimentacion-; lo que cambia es que ahora el
   indice vive de verdad entre 0 y 1. */
const { pesos: RESILIENCE_WEIGHTS, sumaOriginal: RESILIENCE_SUMA_DECLARADA } =
  normalizarPesos(RESILIENCE_DECLARADOS);

// ══════════════════════════════════════════════════
//  RESILIENCE INDEX — 0 (frágil) a 1 (muy resiliente)
// ══════════════════════════════════════════════════
function computeResilienceIndex(code) {
  const d = DATA[code] || DATA.WLD;
  let resilience = 0;
  CAT_KEYS.forEach(k => {
    const score = d[k]?.score ?? 50;
    const riskNorm = score / 100;       // 0=muy bueno, 1=muy malo
    const strength = 1 - riskNorm;      // invertir: bueno = alta resiliencia
    /* T27: el respaldo era 0,05, un peso del orden de los declarados. Con
       los pesos ya normalizados a 1 ese respaldo estaria fuera de escala, y
       ademas las 16 categorias estan todas declaradas, asi que nunca entra:
       se pone a 0 para que, si alguna vez faltara una, no inventara peso. */
    resilience += strength * (RESILIENCE_WEIGHTS[k] || 0);
  });
  return Math.max(0.05, Math.min(0.95, resilience));
}

// ══════════════════════════════════════════════════
//  INFLECTION DETECTOR — detecta aceleración
// ══════════════════════════════════════════════════
function detectInflections(code) {
  const vel = VELOCITY[code] || VELOCITY.WLD;
  const d = DATA[code] || DATA.WLD;
  const inflections = [];

  CAT_KEYS.forEach(k => {
    const score = d[k]?.score ?? 50;
    const v = vel[k] || 0;
    // Aceleración = velocidad * score (cuanto más alto el score, más peligrosa la aceleración)
    const accel = v * (score / 100);
    const magnitude = Math.abs(accel);

    if (magnitude > 0.12) {
      inflections.push({
        cat: k,
        label: CAT_LABELS[CAT_KEYS.indexOf(k)],
        color: CAT_COLORS[CAT_KEYS.indexOf(k)],
        score,
        velocity: v,
        acceleration: accel,
        type: v > 0 ? 'deteriorating' : 'improving',
        severity: magnitude > 0.25 ? 'critical' : magnitude > 0.18 ? 'high' : 'moderate',
      });
    }
  });

  return inflections.sort((a, b) => Math.abs(b.acceleration) - Math.abs(a.acceleration));
}

// ══════════════════════════════════════════════════
//  CASCADE SIMULATOR — propagación con lag y decay
// ══════════════════════════════════════════════════
/**
 * @param {string} code
 * @param {number} horizonWeeks
 * @param {object} [shockOverrides]  estado inicial alterado por categoria
 * @param {object} [velOverrides]    T26: velocidades alteradas por categoria.
 *   El Monte Carlo las perturbaba y las dejaba en una variable que NO SE
 *   PASABA aqui, asi que las 400 simulaciones usaban todas la misma
 *   velocidad y la unica variacion venia del estado inicial. Ahora entran.
 */
/**
 * T28 · El modelo de un pais, serializable.
 *
 * El worker no puede ver DATA ni las matrices, asi que todo lo que la
 * simulacion necesita se empaqueta aqui: las puntuaciones del pais, sus
 * velocidades, su resiliencia ya calculada, la matriz de propagacion y la
 * dispersion de cada categoria. Son unos pocos kilobytes y se copian con
 * postMessage sin problema.
 */
function modeloDe(code){
  const d = DATA[code] || DATA.WLD;
  const scores = {};
  const sigmas = {};
  for (const k of CAT_KEYS) {
    scores[k] = (d[k] && typeof d[k].score === 'number') ? d[k].score : 50;
    sigmas[k] = sigmaDeCategoria(d, k);
  }
  return {
    catKeys: CAT_KEYS.slice(),
    scores,
    sigmas,
    vel: Object.assign({}, VELOCITY[code] || VELOCITY.WLD),
    resiliencia: computeResilienceIndex(code),
    prop: PROP_MATRIX,
    sigmaVelocidad: SIGMA_VELOCIDAD,
  };
}

function simulateCascade(code, horizonWeeks, shockOverrides = {}, velOverrides = null) {
  /* T28 · El calculo vive en src/dashboard/sim-core.js, que no lee nada de
     fuera y por tanto puede correr tambien dentro de un Web Worker. Esta
     funcion se queda como la puerta de entrada que el resto del motor ya
     usaba: construye el modelo del pais y delega. */
  return simularCascada(modeloDe(code), horizonWeeks, shockOverrides, velOverrides);
}
// ══════════════════════════════════════════════════
//  MONTE CARLO — 500 simulaciones con ruido
// ══════════════════════════════════════════════════
/**
 * Incertidumbre de cada categoria, en puntos de score (T26).
 *
 * Antes la dispersion era `base * 0,06`: proporcional al propio score, de
 * modo que un pais con 80 en una categoria tenia mas incertidumbre que uno
 * con 20 EN LA MISMA CATEGORIA, aunque los dos salieran de los mismos
 * indicadores y de la misma fuente. Eso no es lo que dice el dato.
 *
 * Ahora sale de la CONFIANZA que calcula src/core/scoring.js, que mide dos
 * cosas reales: cuantos indicadores tenia la categoria y de que anos son.
 * Una categoria completa y reciente tiene una banda estrecha; una con un
 * indicador de 2021, ancha.
 */
const SIGMA_POR_CONFIANZA = { alta: 3, media: 7, baja: 12, ninguna: 15 };

function sigmaDeCategoria(d, k) {
  const cat = d && d[k];
  const conf = cat && cat.confianza && cat.confianza.nivel;
  return SIGMA_POR_CONFIANZA[conf] != null ? SIGMA_POR_CONFIANZA[conf] : SIGMA_POR_CONFIANZA.media;
}

/** Dispersion de la velocidad. Fija, porque VELOCITY no tiene confianza. */
const SIGMA_VELOCIDAD = 0.05;

function runMonteCarlo(code, horizonWeeks, nSims = 400) {
  /* T28 · Igual que simulateCascade: el calculo esta en sim-core.js para que
     pueda correr dentro del worker. Esta version sincrona se queda porque la
     usan la consola, las pruebas y el camino de respaldo cuando no hay
     Worker; el panel usa proyeccionDe(), que si va por el worker. */
  return monteCarloLocal(modeloDe(code), horizonWeeks, nSims, semilla());
}

/**
 * T28 · La proyeccion que usa el panel: por el worker y con memoria.
 *
 * Devuelve una promesa. El resultado solo depende del pais, del horizonte, del
 * numero de simulaciones y de la semilla, asi que se puede memorizar: volver a
 * una region ya vista no recalcula nada.
 */
function proyeccionDe(code, horizonWeeks, nSims = 400){
  return proyectar(modeloDe(code), code, horizonWeeks, nSims, semilla());
}

/* ── Box-Muller para ruido gaussiano ──
   T26: el Monte Carlo ya NO usa esta funcion; usa gaussianaCon() con un
   generador sembrado, para que sus bandas sean reproducibles. Esta se queda
   porque la usa el simulador de shocks manual, donde el usuario mueve los
   deslizadores y no hay nada que reproducir. */
function gaussianRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ══════════════════════════════════════════════════
//  RENDER: GRÁFICA DE PROYECCIÓN TEMPORAL
// ══════════════════════════════════════════════════
let cascadeChart = null;

/* T26 · La semilla, visible y repetible.

   Una proyeccion Monte Carlo sin semilla no se puede volver a mirar: cada
   recalculo da bandas distintas. La semilla se muestra junto al grafico y el
   enlace la pone en la URL, de modo que una proyeccion concreta se puede
   compartir y comparar. Con ?seed=N se fija al cargar la pagina. */
function mostrarSemilla(mc, origen){
  const el = document.getElementById('mc-semilla');
  if(!el || !mc) return;
  const comoSeCalculo = origen === 'memoria'
    ? 'memoria'
    : statsSim.modo + (statsSim.msUltimo != null ? ' · ' + statsSim.msUltimo + ' ms' : '');
  el.textContent = mc.simulaciones + ' simulaciones · semilla ' + mc.semilla + ' · ' + comoSeCalculo;
  el.title = 'Con ?seed=' + mc.semilla + ' en la URL esta proyección sale idéntica. '
    + 'La dispersión de cada categoría depende de su confianza, no de su puntuación.';
  const enlace = document.getElementById('mc-repetir');
  if(enlace){
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('seed', String(mc.semilla));
      enlace.href = u.toString();
    } catch (err) { /* sin URL valida, el enlace se queda como esté */ }
  }
}

function renderProjectionChart(code, horizonMonths) {
  const horizonWeeks = horizonMonths * 4.3;
  const canvas = document.getElementById('projection-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.clientWidth || 600;
  const H = 280;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const pad = { top: 24, right: 20, bottom: 40, left: 48 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  // Correr simulación base + Monte Carlo
  const baseHistory = simulateCascade(code, Math.round(horizonWeeks));
  /* T28 · Si el resultado ya esta memorizado se pinta ahora mismo; si no, se
     pide al worker y se vuelve a pintar cuando llegue. El hilo principal no
     se queda bloqueado 86 ms calculando 400 simulaciones. */
  const semanas = Math.round(horizonWeeks);
  const mc = enMemoria(code, semanas, 400, semilla());
  if (!mc) {
    proyeccionDe(code, semanas).then(() => {
      // Si entre tanto se ha cambiado de region, no se pinta la vieja.
      const actual = document.getElementById('region-sel');
      if (!actual || actual.value === code) renderProjectionChart(code, horizonMonths);
    }).catch((err) => console.warn('AETHER: proyeccion fallida:', err));
    const esperando = document.getElementById('mc-semilla');
    if (esperando) esperando.textContent = 'calculando 400 simulaciones…';
    return;
  }
  const { bands, keyFrames } = mc;
  // Venia de la memoria: lo dice la etiqueta, para no atribuirle al worker un
  // calculo que no ha hecho.
  mostrarSemilla(mc, 'memoria');

  // Semanas para eje X (base history)
  const nWeeks = baseHistory.length;
  const xScale = w => pad.left + (w / (nWeeks - 1)) * chartW;
  const yScale = v => pad.top + chartH - ((v - 0) / 100) * chartH;

  // Calcular score global por semana en base history
  const globalBase = baseHistory.map(frame => {
    let s = 0;
    CAT_KEYS.forEach(k => { s += (frame[k] || 50); });
    return s / CAT_KEYS.length;
  });

  // ── Fondo ──
  ctx.fillStyle = 'rgba(5,10,16,0.0)';
  ctx.fillRect(0, 0, W, H);

  // ── Grid lines ──
  ctx.strokeStyle = 'rgba(26,42,68,0.6)';
  ctx.lineWidth = 0.5;
  [20,40,60,80].forEach(v => {
    const y = yScale(v);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(58,79,106,0.7)';
    ctx.font = '9px Share Tech Mono';
    ctx.fillText(v, pad.left - 24, y + 3);
  });

  // ── Zona de riesgo coloreada ──
  const zones = [{min:0,max:30,col:'rgba(0,204,102,0.04)'},{min:30,max:55,col:'rgba(255,215,0,0.04)'},
                 {min:55,max:75,col:'rgba(255,140,0,0.05)'},{min:75,max:100,col:'rgba(255,51,85,0.06)'}];
  zones.forEach(z => {
    ctx.fillStyle = z.col;
    ctx.fillRect(pad.left, yScale(z.max), chartW, yScale(z.min)-yScale(z.max));
  });

  // ── Banda de confianza Monte Carlo (p10-p90) ──
  const mcX = keyFrames.map(w => xScale(Math.round(w)));
  ctx.beginPath();
  mcX.forEach((x, i) => {
    const y = yScale(bands[keyFrames[i]].p90);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  [...mcX].reverse().forEach((x, i) => {
    const ri = keyFrames.length - 1 - i;
    ctx.lineTo(x, yScale(bands[keyFrames[ri]].p10));
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,255,200,0.06)';
  ctx.fill();

  // Banda p25-p75
  ctx.beginPath();
  mcX.forEach((x, i) => {
    const y = yScale(bands[keyFrames[i]].p75);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  [...mcX].reverse().forEach((x, i) => {
    const ri = keyFrames.length - 1 - i;
    ctx.lineTo(x, yScale(bands[keyFrames[ri]].p25));
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,255,200,0.10)';
  ctx.fill();

  // ── Línea mediana MC (p50) ──
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,255,200,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4,3]);
  mcX.forEach((x, i) => {
    const y = yScale(bands[keyFrames[i]].p50);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Líneas de categorías top 4 riesgo ──
  const d = DATA[code] || DATA.WLD;
  const topCats = [...CAT_KEYS].sort((a,b) => (d[b]?.score||0)-(d[a]?.score||0)).slice(0,4);
  topCats.forEach((k, ci) => {
    const col = CAT_COLORS[CAT_KEYS.indexOf(k)];
    const catHistory = baseHistory.map(f => f[k] || 50);
    ctx.beginPath();
    ctx.strokeStyle = col + '88';
    ctx.lineWidth = 1.2;
    catHistory.forEach((v, i) => {
      const x = xScale(i), y = yScale(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Etiqueta al final
    const lastY = yScale(catHistory[catHistory.length-1]);
    ctx.fillStyle = col;
    ctx.font = 'bold 8px Share Tech Mono';
    ctx.fillText(CAT_LABELS[CAT_KEYS.indexOf(k)].substring(0,5), W - pad.right + 2, lastY + 3);
  });

  // ── Línea base global (gruesa) ──
  ctx.beginPath();
  ctx.strokeStyle = '#00FFC8';
  ctx.lineWidth = 2.5;
  globalBase.forEach((v, i) => {
    const x = xScale(i), y = yScale(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Punto final con valor
  const finalScore = Math.round(globalBase[globalBase.length-1]);
  const finalX = xScale(nWeeks-1);
  const finalY = yScale(finalScore);
  ctx.beginPath();
  ctx.arc(finalX, finalY, 5, 0, Math.PI*2);
  ctx.fillStyle = finalScore>65?'#FF3355':finalScore>45?'#FF8C00':'#00FF88';
  ctx.fill();
  ctx.fillStyle = '#D0E8FF';
  ctx.font = 'bold 10px Share Tech Mono';
  ctx.fillText(finalScore, finalX - 12, finalY - 10);

  // ── Punto de inicio ──
  const initScore = Math.round(globalBase[0]);
  ctx.beginPath();
  ctx.arc(xScale(0), yScale(initScore), 4, 0, Math.PI*2);
  ctx.fillStyle = '#00FFC8';
  ctx.fill();

  // ── Eje X: etiquetas de tiempo ──
  ctx.fillStyle = 'rgba(58,79,106,0.8)';
  ctx.font = '9px Share Tech Mono';
  const labels = ['HOY', ...Array.from({length:4},(_,i)=>{
    const m = Math.round((i+1)/4*horizonMonths);
    return m < 12 ? m+'m' : Math.round(m/12)+'a';
  })];
  mcX.forEach((x, i) => {
    ctx.fillText(labels[i]||'', x - 8, H - 6);
    ctx.strokeStyle = 'rgba(26,42,68,0.5)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, H-pad.bottom+4); ctx.stroke();
  });

  // ── Título ──
  ctx.fillStyle = 'rgba(168,192,224,0.5)';
  ctx.font = '9px Share Tech Mono';
  ctx.fillText('SCORE GLOBAL', pad.left, pad.top - 8);

  // Guardar estado para hover
  canvas._baseHistory = baseHistory;
  canvas._globalBase = globalBase;
  canvas._xScale = xScale;
  canvas._yScale = yScale;
  canvas._nWeeks = nWeeks;
  canvas._horizonMonths = horizonMonths;
}

// ══════════════════════════════════════════════════
//  RENDER: ÁRBOL DE CASCADA
// ══════════════════════════════════════════════════
function renderCascadeTree(code) {
  const wrap = document.getElementById('cascade-tree');
  if (!wrap) return;
  const d = DATA[code] || DATA.WLD;
  const inflections = detectInflections(code);
  const resilience = computeResilienceIndex(code);

  if (!inflections.length) {
    wrap.innerHTML = '<div style="color:var(--dim);font-size:11px;font-family:Share Tech Mono,monospace;padding:20px;text-align:center">No se detectan propagaciones activas significativas</div>';
    return;
  }

  // Top 3 fuentes de shock
  const topSources = inflections.filter(i => i.type === 'deteriorating').slice(0, 3);

  let html = `<div style="font-size:9px;color:var(--dim);font-family:Share Tech Mono,monospace;margin-bottom:8px">
    RESILIENCIA SISTÉMICA: <span style="color:${resilience>0.6?'var(--green)':resilience>0.4?'var(--yellow)':'var(--red)'};font-weight:700">${Math.round(resilience*100)}%</span>
    &nbsp;·&nbsp; SHOCKS ACTIVOS: <span style="color:var(--cyan)">${topSources.length}</span>
  </div>`;

  topSources.forEach(src => {
    const props = PROP_MATRIX[src.cat] || {};
    const targets = Object.entries(props)
      .map(([k, {s,l}]) => ({
        k, s, l,
        label: CAT_LABELS[CAT_KEYS.indexOf(k)],
        color: CAT_COLORS[CAT_KEYS.indexOf(k)],
        projectedDelta: Math.round(src.score * src.velocity * s * (1-resilience*0.5)),
      }))
      .filter(t => Math.abs(t.projectedDelta) > 0.5)
      .sort((a,b) => Math.abs(b.projectedDelta) - Math.abs(a.projectedDelta))
      .slice(0, 4);

    const sevColor = src.severity==='critical'?'var(--red)':src.severity==='high'?'var(--orange)':'var(--yellow)';

    html += `<div style="margin-bottom:10px;padding:8px;background:rgba(0,0,0,.3);border-left:2px solid ${src.color};border-radius:0 6px 6px 0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="color:${src.color};font-size:11px;font-weight:700;font-family:Share Tech Mono,monospace">▲ ${src.label}</span>
        <span style="background:${sevColor}22;color:${sevColor};font-size:9px;padding:1px 6px;border-radius:3px;font-family:Share Tech Mono,monospace">${src.severity.toUpperCase()}</span>
        <span style="margin-left:auto;color:var(--dim);font-size:9px;font-family:Share Tech Mono,monospace">vel:+${(src.velocity*100).toFixed(0)}%/sem</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${targets.map(t=>`
          <div style="background:rgba(${t.projectedDelta>3?'255,51,85':t.projectedDelta>1?'255,140,0':'255,215,0'},.08);border:1px solid rgba(${t.projectedDelta>3?'255,51,85':t.projectedDelta>1?'255,140,0':'255,215,0'},.2);border-radius:5px;padding:4px 8px;font-family:Share Tech Mono,monospace">
            <div style="color:${t.color};font-size:9px">${t.label}</div>
            <div style="font-size:9px;color:var(--dim)">+${t.projectedDelta.toFixed(1)}pts · ${t.l}sem</div>
          </div>`).join('')}
      </div>
    </div>`;
  });

  // Mejoras (velocidad negativa)
  const improving = inflections.filter(i => i.type === 'improving').slice(0, 2);
  if (improving.length) {
    html += `<div style="font-size:9px;color:var(--green);font-family:Share Tech Mono,monospace;margin-top:8px;padding:6px;background:rgba(0,255,136,.04);border-radius:6px">
      ▼ TENDENCIAS POSITIVAS: ${improving.map(i=>`<span style="color:${i.color}">${i.label}</span>`).join(', ')}
    </div>`;
  }

  wrap.innerHTML = html;
}

// ══════════════════════════════════════════════════
//  RENDER: SEMÁFORO DE ACELERACIÓN
// ══════════════════════════════════════════════════
function renderAccelerationSemaphore(code) {
  const wrap = document.getElementById('accel-semaphore');
  if (!wrap) return;
  const inflections = detectInflections(code);
  const d = DATA[code] || DATA.WLD;

  const rows = CAT_KEYS.map((k, i) => {
    const score = d[k]?.score ?? 50;
    const vel = (VELOCITY[code]||VELOCITY.WLD)[k] || 0;
    const accel = vel * (score/100);
    const inf = inflections.find(f => f.cat === k);
    const severity = inf?.severity || 'stable';
    const absA = Math.abs(accel);

    return {k, i, score, vel, accel, severity, absA,
      label: CAT_LABELS[i], color: CAT_COLORS[i]};
  }).sort((a,b) => b.absA - a.absA);

  wrap.innerHTML = rows.map(r => {
    const barW = Math.min(100, r.absA * 300);
    const barCol = r.accel > 0
      ? (r.severity==='critical'?'#FF3355':r.severity==='high'?'#FF8C00':'#FFFFFF')
      : (r.severity==='critical'?'#00FF88':r.severity==='high'?'#44DD88':'#00CC66');
    const arrow = r.vel > 0.15 ? '▲' : r.vel < -0.15 ? '▼' : '—';
    const arrowCol = r.vel > 0.15 ? '#FF3355' : r.vel < -0.15 ? '#00FF88' : 'var(--dim)';

    return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid rgba(23,34,56,.4)">
      <span style="color:${r.color};font-size:9px;font-family:Share Tech Mono,monospace;width:52px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis">${r.label.substring(0,7)}</span>
      <div style="width:70px;height:4px;background:var(--border);border-radius:2px;flex-shrink:0">
        <div style="width:${barW}%;height:100%;background:${barCol};border-radius:2px;transition:width .8s ease"></div>
      </div>
      <span style="font-size:10px;font-family:Share Tech Mono,monospace;color:${arrowCol};width:12px">${arrow}</span>
      <span style="font-size:9px;font-family:Share Tech Mono,monospace;color:var(--dim);margin-left:auto">${r.score}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  ACTUALIZAR TODO EL MÓDULO CASCADA
// ══════════════════════════════════════════════════
function updateCascadeModule(code) {
  code = code || document.getElementById('region-sel').value;
  renderProjectionChart(code, horizon);
  renderCascadeTree(code);
  renderAccelerationSemaphore(code);
  // Actualizar resiliencia en banner
  const res = computeResilienceIndex(code);
  const resEl = document.getElementById('resilience-val');
  if (resEl) {
    resEl.textContent = Math.round(res*100)+'%';
    resEl.style.color = res>0.6?'var(--green)':res>0.4?'var(--yellow)':'var(--red)';
  }
}



// ══════════════════════════════════════════════════════════════════
//  AETHER — SHOCK SIMULATOR v1.0
//  Permite al usuario introducir shocks manuales y ver cascada
// ══════════════════════════════════════════════════════════════════

// Estado del simulador
const ShockSim = {
  active: false,
  shocks: {},        // {catKey: deltaValue}  (-50 a +50)
  baseCode: null,
  animFrame: null,
  history: null,
  week: 0,
  playing: false,
};

// ── Abrir/cerrar panel ──
function toggleShockSimulator() {
  const panel = document.getElementById('shock-sim-panel');
  const btn   = document.getElementById('shock-sim-btn');
  ShockSim.active = !ShockSim.active;
  panel.style.display = ShockSim.active ? 'block' : 'none';
  const ph = document.getElementById('shock-sim-placeholder');
  if (ph) ph.style.display = ShockSim.active ? 'none' : 'block';
  btn.style.background = ShockSim.active
    ? 'rgba(255,68,102,.18)' : 'rgba(0,255,200,.08)';
  btn.style.borderColor = ShockSim.active ? 'var(--red)' : 'var(--cyan)';
  btn.style.color       = ShockSim.active ? 'var(--red)' : 'var(--cyan)';
  if (ShockSim.active) {
    ShockSim.baseCode = document.getElementById('region-sel').value;
    resetShocks();
  }
}

// ── Reset sliders ──
function resetShocks() {
  ShockSim.shocks = {};
  ShockSim.week = 0;
  ShockSim.playing = false;
  CAT_KEYS.forEach(k => {
    const sl = document.getElementById('shock-sl-'+k);
    const vl = document.getElementById('shock-vl-'+k);
    if (sl) { sl.value = 0; }
    if (vl) { vl.textContent = '0'; vl.style.color = 'var(--dim)'; }
  });
  renderShockPreview();
}

// ── Actualizar slider ──
function onShockSlider(key, val) {
  const v = parseInt(val);
  ShockSim.shocks[key] = v;
  const vl = document.getElementById('shock-vl-'+key);
  if (vl) {
    vl.textContent = (v > 0 ? '+' : '') + v;
    vl.style.color = v > 10 ? 'var(--red)' : v < -10 ? 'var(--green)' : v !== 0 ? 'var(--yellow)' : 'var(--dim)';
  }
  renderShockPreview();
}

// ── Preview instantáneo ──
function renderShockPreview() {
  const code = ShockSim.baseCode || document.getElementById('region-sel').value;
  const d    = DATA[code] || DATA.WLD;

  // Construir overrides con los shocks
  const overrides = {};
  CAT_KEYS.forEach(k => {
    const base  = d[k]?.score ?? 50;
    const delta = ShockSim.shocks[k] || 0;
    overrides[k] = Math.max(0, Math.min(100, base + delta));
  });

  // Score global antes y después
  const scoreBefore = Math.round(CAT_KEYS.reduce((s,k)=>s+(d[k]?.score??50),0)/CAT_KEYS.length);
  const scoreAfter  = Math.round(CAT_KEYS.reduce((s,k)=>s+overrides[k],0)/CAT_KEYS.length);
  const delta       = scoreAfter - scoreBefore;
  const col         = delta > 5 ? 'var(--red)' : delta < -5 ? 'var(--green)' : 'var(--yellow)';

  const prevEl = document.getElementById('shock-preview');
  if (!prevEl) return;

  const hasShocks = Object.values(ShockSim.shocks).some(v => v !== 0);
  if (!hasShocks) {
    prevEl.innerHTML = '<span style="color:var(--dim);font-size:11px;font-family:Share Tech Mono,monospace">Mueve los sliders para introducir un shock →</span>';
    return;
  }

  // Top categorías afectadas
  const affected = CAT_KEYS
    .filter(k => ShockSim.shocks[k] && ShockSim.shocks[k] !== 0)
    .map(k => {
      const delta = ShockSim.shocks[k];
      return { k, delta, label: CAT_LABELS[CAT_KEYS.indexOf(k)], color: CAT_COLORS[CAT_KEYS.indexOf(k)],
               deltaCol: delta>10?'var(--red)':delta>0?'var(--orange)':delta<-10?'var(--green)':'#44DD88',
               deltaSign: delta>0?'+':'' };
    })
    .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta));

  prevEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px">
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--dim);font-family:'Share Tech Mono',monospace">ANTES</div>
        <div style="font-size:26px;font-weight:700;font-family:'Rajdhani',sans-serif;color:${scoreToColor(scoreBefore)}">${scoreBefore}</div>
      </div>
      <div style="font-size:22px;color:var(--dim)">→</div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--dim);font-family:'Share Tech Mono',monospace">DESPUÉS</div>
        <div style="font-size:26px;font-weight:700;font-family:'Rajdhani',sans-serif;color:${scoreToColor(scoreAfter)}">${scoreAfter}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:var(--dim);font-family:'Share Tech Mono',monospace">IMPACTO</div>
        <div style="font-size:22px;font-weight:700;font-family:'Rajdhani',sans-serif;color:${col}">${delta>0?'+':''}${delta}</div>
      </div>
      <button data-action="run-shock-cascade" class="btn sec" style="margin-left:auto;padding:8px 16px;background:rgba(255,51,85,.12);border-color:var(--red);color:var(--red)">
        ⚡ SIMULAR CASCADA
      </button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${affected.map(a=>`
        <div style="background:rgba(0,0,0,.3);border:1px solid ${a.color}44;border-radius:5px;padding:3px 8px;font-family:'Share Tech Mono',monospace;font-size:10px">
          <span style="color:${a.color}">${a.label}</span>
          '<span style="color:'+a.deltaCol+';font-weight:700;margin-left:4px">'+a.deltaSign+a.delta+'</span>'
        </div>`).join('')}
    </div>`;
}

// ── Correr simulación con shocks aplicados ──
function runShockCascade() {
  const code = ShockSim.baseCode || document.getElementById('region-sel').value;
  const d    = DATA[code] || DATA.WLD;

  // Overrides: base + shocks
  const overrides = {};
  CAT_KEYS.forEach(k => {
    const base  = d[k]?.score ?? 50;
    overrides[k] = Math.max(0, Math.min(100, base + (ShockSim.shocks[k]||0)));
  });

  const horizonWeeks = horizon * 4.3;

  // Simulación con shocks
  ShockSim.history   = simulateCascade(code, Math.round(horizonWeeks), overrides);
  // Simulación baseline (sin shocks)
  ShockSim.baseline  = simulateCascade(code, Math.round(horizonWeeks));
  ShockSim.week      = 0;
  ShockSim.playing   = false;

  renderShockChart(code);
  renderCascadeImpactTable(code);

  // Scroll suave al resultado
  document.getElementById('shock-result').style.display = 'block';
  document.getElementById('shock-result').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

// ── Gráfica comparativa shock vs baseline ──
function renderShockChart(code) {
  const canvas = document.getElementById('shock-canvas');
  if (!canvas || !ShockSim.history) return;

  const ctx  = canvas.getContext('2d');
  const W    = canvas.parentElement.clientWidth || 600;
  const H    = 220;
  canvas.width  = W;
  canvas.height = H;
  ctx.clearRect(0,0,W,H);

  const pad = {top:24, right:20, bottom:36, left:46};
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;
  const nW  = ShockSim.history.length;

  const xSc = w => pad.left + (w/(nW-1))*cW;
  const ySc = v => pad.top  + cH - (v/100)*cH;

  // Score global por semana
  const baseGlobal  = ShockSim.baseline.map(f=>CAT_KEYS.reduce((s,k)=>s+(f[k]||50),0)/CAT_KEYS.length);
  const shockGlobal = ShockSim.history.map( f=>CAT_KEYS.reduce((s,k)=>s+(f[k]||50),0)/CAT_KEYS.length);

  // ── Grid ──
  [20,40,60,80].forEach(v=>{
    ctx.strokeStyle = 'rgba(26,42,68,.5)';
    ctx.lineWidth   = .5;
    ctx.beginPath(); ctx.moveTo(pad.left, ySc(v)); ctx.lineTo(W-pad.right, ySc(v)); ctx.stroke();
    ctx.fillStyle = 'rgba(58,79,106,.7)';
    ctx.font = '9px Share Tech Mono';
    ctx.fillText(v, pad.left-28, ySc(v)+3);
  });

  // ── Zona de diferencia ──
  ctx.beginPath();
  shockGlobal.forEach((v,i)=>{ i===0?ctx.moveTo(xSc(i),ySc(v)):ctx.lineTo(xSc(i),ySc(v)); });
  [...baseGlobal].reverse().forEach((v,i)=>{ ctx.lineTo(xSc(nW-1-i),ySc(v)); });
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,51,85,.08)';
  ctx.fill();

  // ── Línea baseline ──
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,255,200,.5)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5,3]);
  baseGlobal.forEach((v,i)=>{ i===0?ctx.moveTo(xSc(i),ySc(v)):ctx.lineTo(xSc(i),ySc(v)); });
  ctx.stroke(); ctx.setLineDash([]);

  // ── Línea shock ──
  ctx.beginPath();
  ctx.strokeStyle = '#FF3355';
  ctx.lineWidth   = 2.5;
  shockGlobal.forEach((v,i)=>{ i===0?ctx.moveTo(xSc(i),ySc(v)):ctx.lineTo(xSc(i),ySc(v)); });
  ctx.stroke();

  // Punto final shock
  const fv = shockGlobal[nW-1];
  ctx.beginPath(); ctx.arc(xSc(nW-1), ySc(fv), 5, 0, Math.PI*2);
  ctx.fillStyle = '#FF3355'; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Share Tech Mono';
  ctx.fillText(Math.round(fv), xSc(nW-1)-12, ySc(fv)-10);

  // Punto final baseline
  const bv = baseGlobal[nW-1];
  ctx.beginPath(); ctx.arc(xSc(nW-1), ySc(bv), 4, 0, Math.PI*2);
  ctx.fillStyle = '#00FFC8'; ctx.fill();
  ctx.fillStyle = '#00FFC8';
  ctx.font = '9px Share Tech Mono';
  ctx.fillText(Math.round(bv), xSc(nW-1)-12, ySc(bv)-8);

  // ── Marcadores de tiempo ──
  const nMarks = Math.min(5, nW);
  for (let i=0; i<nMarks; i++) {
    const w = Math.round(i/(nMarks-1)*(nW-1));
    const m = Math.round(w/4.3);
    ctx.fillStyle='rgba(58,79,106,.7)';
    ctx.font='9px Share Tech Mono';
    ctx.fillText(i===0?'HOY':m+'m', xSc(w)-10, H-6);
    ctx.strokeStyle='rgba(26,42,68,.4)'; ctx.lineWidth=.5;
    ctx.beginPath(); ctx.moveTo(xSc(w),pad.top); ctx.lineTo(xSc(w),H-pad.bottom+4); ctx.stroke();
  }

  // ── Leyenda ──
  ctx.fillStyle='rgba(0,255,200,.7)'; ctx.font='9px Share Tech Mono';
  ctx.fillText('─── BASELINE', pad.left, pad.top-6);
  ctx.fillStyle='#FF3355';
  ctx.fillText('─── CON SHOCK', pad.left+90, pad.top-6);
}

// ── Tabla de impacto por categoría ──
function renderCascadeImpactTable(code) {
  const wrap = document.getElementById('shock-impact-table');
  if (!wrap || !ShockSim.history || !ShockSim.baseline) return;

  const last    = ShockSim.history[ShockSim.history.length-1];
  const lastBase= ShockSim.baseline[ShockSim.baseline.length-1];
  const d       = DATA[code]||DATA.WLD;

  const rows = CAT_KEYS.map((k,i)=>{
    const initial  = d[k]?.score ?? 50;
    const withShock= Math.round(last[k]||50);
    const baseline = Math.round(lastBase[k]||50);
    const cascadeDelta = withShock - baseline; // impacto puro de la cascada
    return { k, i, initial, withShock, baseline, cascadeDelta,
             label: CAT_LABELS[i], color: CAT_COLORS[i] };
  }).sort((a,b) => Math.abs(b.cascadeDelta)-Math.abs(a.cascadeDelta));

  wrap.innerHTML = `
    <div style="font-size:9px;color:var(--dim);font-family:'Share Tech Mono',monospace;margin-bottom:8px;letter-spacing:1px">
      IMPACTO EN CASCADA AL FINAL DEL HORIZONTE (${horizon} MESES)
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
      ${rows.map(r=>{
        const col = r.cascadeDelta > 5 ? 'var(--red)' : r.cascadeDelta > 2 ? 'var(--orange)' :
                    r.cascadeDelta < -5 ? 'var(--green)' : r.cascadeDelta < -2 ? '#44DD88' : 'var(--dim)';
        const arrow = r.cascadeDelta > 1 ? '▲' : r.cascadeDelta < -1 ? '▼' : '—';
        return `<div style="background:rgba(0,0,0,.3);border:1px solid ${r.color}33;border-radius:6px;padding:6px 8px">
          <div style="color:${r.color};font-size:9px;font-family:'Share Tech Mono',monospace;margin-bottom:4px">${r.label}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:16px;font-weight:700;font-family:'Rajdhani',sans-serif;color:${scoreToColor(r.withShock)}">${r.withShock}</span>
            <span style="font-size:11px;font-weight:700;color:${col};font-family:'Share Tech Mono',monospace">${arrow}${Math.abs(r.cascadeDelta)>0?Math.abs(r.cascadeDelta):''}</span>
          </div>
          <div style="font-size:9px;color:var(--dim);font-family:'Share Tech Mono',monospace">base: ${r.baseline}</div>
        </div>`;
      }).join('')}
    </div>`;
}

// ── Presets de escenarios famosos ──
const SHOCK_PRESETS = {
  'Recesión global':     {eco:+25, finance:+20, social:+8,  mental:+10, urban:+5},
  'Crisis alimentaria':  {food:+30, climate:+15, health:+12, social:+15, demo:+8},
  'Guerra regional':     {geo:+35, eco:+20,    social:+25,  mental:+20, demo:+15, urban:+18},
  'Pandemia':            {bio:+35, health:+30,  eco:+20,    mental:+25, social:+15, demo:+10},
  'Colapso climático':   {climate:+30, food:+20, ocean:+25,  energy:+15, demo:+10},
  'Crisis financiera':   {finance:+30, eco:+25, social:+15,  urban:+8,  mental:+12},
  'Revolución tecnológica':{tech:-20, eco:-10, science:-15, finance:-8},
  'Boom económico':      {eco:-20, finance:-15, social:-10, urban:-8,   mental:-8},
};

function applyPreset(name) {
  const preset = SHOCK_PRESETS[name];
  if (!preset) return;
  resetShocks();
  Object.entries(preset).forEach(([k,v]) => {
    ShockSim.shocks[k] = v;
    const sl = document.getElementById('shock-sl-'+k);
    const vl = document.getElementById('shock-vl-'+k);
    if (sl) sl.value = v;
    if (vl) {
      vl.textContent = (v>0?'+':'')+v;
      vl.style.color = v>10?'var(--red)':v<-10?'var(--green)':'var(--yellow)';
    }
  });
  renderShockPreview();
}



// ── Inicializar shock simulator UI ──
function initShockSimulator() {
  // Presets
  const presetsEl = document.getElementById('preset-btns');
  if (presetsEl) {
    Object.keys(SHOCK_PRESETS).forEach(name => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = 'font-size:10px;font-family:Share Tech Mono,monospace;padding:4px 10px;background:rgba(255,51,85,.06);border:1px solid rgba(255,51,85,.2);color:rgba(255,150,150,.8);border-radius:4px;cursor:pointer;transition:all .2s';
      btn.onmouseover = () => btn.style.background = 'rgba(255,51,85,.15)';
      btn.onmouseout  = () => btn.style.background = 'rgba(255,51,85,.06)';
      btn.onclick = () => applyPreset(name);
      presetsEl.appendChild(btn);
    });
  }
  // Sliders
  const slidersEl = document.getElementById('shock-sliders');
  if (slidersEl) {
    slidersEl.innerHTML = CAT_KEYS.map((k,i) => `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="color:${CAT_COLORS[i]};font-size:9px;font-family:'Share Tech Mono',monospace">${CAT_LABELS[i]}</span>
          <span id="shock-vl-${k}" style="font-size:9px;font-family:'Share Tech Mono',monospace;color:var(--dim);font-weight:700">0</span>
        </div>
        <input type="range" id="shock-sl-${k}" min="-50" max="50" value="0" step="1"
          style="width:100%;height:3px;accent-color:${CAT_COLORS[i]};cursor:pointer"
          data-shock-cat="${esc(k)}">
      </div>`
    ).join('');
  }
}



/* ──────────────────────────────────────────────────────────────────────────
   T4 · Delegacion de eventos
   Sustituye a los manejadores onclick/onmouseover que se generaban dentro de
   cadenas de HTML. Sin ellos se puede quitar 'unsafe-inline' de script-src.
   Un unico listener en document sobrevive a cualquier repintado.
   ────────────────────────────────────────────────────────────────────────── */
document.addEventListener('input', function(ev){
  const slider = ev.target.closest && ev.target.closest('[data-shock-cat]');
  if(slider && typeof onShockSlider === 'function'){
    onShockSlider(slider.getAttribute('data-shock-cat'), slider.value);
  }
});

document.addEventListener('click', function(ev){
  const rankRow = ev.target.closest && ev.target.closest('[data-rank-code]');
  if(rankRow){
    const sel = document.getElementById('region-sel');
    if(sel){ sel.value = rankRow.getAttribute('data-rank-code'); loadRegion(); }
    return;
  }
  const action = ev.target.closest && ev.target.closest('[data-action="run-shock-cascade"]');
  if(action && typeof runShockCascade === 'function'){ runShockCascade(); }
});


/* T23: el pie con la fecha de los datos se rellena al cargar, sin esperar a
   que se entre en el panel. La portada tambien afirma cosas sobre los datos
   (cuantos paises, cuantas categorias), asi que tiene que decir de cuando
   son desde el primer momento. */
(function(){
  function pie(){ try { actualizarPieDeDatos(); } catch (err) { /* el DOM aun no esta */ } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', pie, { once:true });
  else pie();
})();

/* T5: comprobacion automatica de la IA local al cargar la pagina. Si no hay
   Ollama escuchando, el panel lo dice desde el principio en vez de esperar a
   que el usuario pulse y reciba un error de CORS. */
(function(){
  function probe(){ if(typeof checkOllama==='function') checkOllama(true); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(probe,1200));
  else setTimeout(probe,1200);
})();

export {
  DATA, CAT_KEYS, CAT_LABELS, CAT_COLORS, VELOCITY, CORR_MATRIX, PROP_MATRIX,
  EVENT_POOL, ISO_MAP, COUNTRY_FLAGS, REGION_GROUPS, RESILIENCE_WEIGHTS,
  ShockSim, SHOCK_PRESETS, STEPS,
  enhancedScore, enhancedScoreDesglosado, riskLabel, scoreToColor, velLabel,
  simulateCascade, runMonteCarlo, proyeccionDe, modeloDe, gaussianRandom,
  computeResilienceIndex, detectInflections,
  initAetherApp, initAetherApp2, loadRegion, onRegionChange,
  updateBanner, renderInds, renderEvents, renderRanking, renderChains,
  initThermo, updateThermo, renderThermo,
  actualizarTarjetaGlobo,
  initNetworkGraph,
  runAnalysis, runScenarios, showScenario, sendChat, checkOllama,
  getOllamaURL, getModel, setHorizon, exportPDF,
  initShockSimulator, runShockCascade, applyPreset, resetShocks, onShockSlider,
  toggleShockSimulator, updateCascadeModule,
};

/* T12 · Asa de depuracion.
   Al pasar a modulos, DATA y las matrices dejan de estar en el ambito global,
   que es justo lo que se buscaba. Pero las pruebas y la consola del navegador
   necesitan poder consultarlas, asi que se expone una referencia explicita y
   claramente marcada como tal. Ningun modulo la usa. */
window.__AETHER__ = Object.freeze({
  COVERAGE: AETHER_COVERAGE,
  DATA, CAT_KEYS, CAT_LABELS, VELOCITY, CORR_MATRIX, PROP_MATRIX,
  EVENT_POOL, RESILIENCE_WEIGHTS, RESILIENCE_DECLARADOS, INFORME_CORR, ShockSim,
  enhancedScore, riskLabel, simulateCascade, runMonteCarlo, proyeccionDe, modeloDe,
  computeResilienceIndex, detectInflections,
});
