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

/* T16: d3 modular y topojson-client empaquetados. El dashboard usa el mapa
   coropletico (d3-geo), el grafo de fuerzas (d3-force), el zoom y el
   arrastre. Se importa solo eso, no el paquete d3 entero. */
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
} from 'd3-force';
import { geoNaturalEarth1, geoPath, geoGraticule, geoCentroid } from 'd3-geo';
import { min } from 'd3-array';
import { easeCubicInOut, easeQuadOut } from 'd3-ease';
import { feature as topoFeature } from 'topojson-client';

const d3 = {
  select, zoom, zoomIdentity, drag,
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  geoNaturalEarth1, geoPath, geoGraticule, geoCentroid,
  min, easeCubicInOut, easeQuadOut,
};
const topojson = { feature: topoFeature };

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
const DATA={WLD:{'name':'Global',eco:{score:48,inds:[{n:'PIB Crecimiento',v:'2.9%',risk:42},{n:'Inflación',v:'6.8%',risk:62},{n:'Desempleo',v:'5.1%',risk:44},{n:'Deuda Pública',v:'93% PIB',risk:71}]},geo:{score:62,inds:[{n:'Conflictos Activos',v:'56 zonas',risk:78},{n:'Estabilidad Política',v:'-0.4',risk:65},{n:'Estado de Derecho',v:'-0.1',risk:52},{n:'Control Corrupción',v:'-0.2',risk:58}]},health:{score:38,inds:[{n:'Esperanza de Vida',v:'72.3 años',risk:35},{n:'Cobertura Sanitaria',v:'68%',risk:42},{n:'Mort. Infantil',v:'28/1k',risk:48},{n:'Gasto Sanitario',v:'9.8% PIB',risk:28}]},climate:{score:67,inds:[{n:'Anom. Temperatura',v:'+1.2°C',risk:72},{n:'CO₂ Emisiones',v:'4.7t/cáp.',risk:65},{n:'Pérd. Biodiversidad',v:'alta',risk:74},{n:'Eventos Extremos',v:'+34%',risk:68}]},social:{score:58,inds:[{n:'Desigualdad (Gini)',v:'0.38',risk:62},{n:'Desplazados forzados',v:'117M',risk:88},{n:'Índice Democracia',v:'5.5/10',risk:55},{n:'Libertad de Prensa',v:'moderada',risk:58}]},tech:{score:52,inds:[{n:'Ciberataques',v:'+38% anual',risk:72},{n:'Brecha digital',v:'37% excluidos',risk:65},{n:'Dependencia IA',v:'creciendo',risk:55},{n:'Desinformación',v:'alta',risk:68}]},food:{score:55,inds:[{n:'Índice Hambre (GHI)',v:'18.3',risk:58},{n:'Precio cereales',v:'+22% 3a',risk:62},{n:'Pérdida cosechas',v:'+18%',risk:55},{n:'Reservas mundiales',v:'72 días',risk:52}]},mental:{score:61,inds:[{n:'Depresión/Ansiedad',v:'1 de 8',risk:68},{n:'Suicidio /100k',v:'9.0',risk:58},{n:'Burnout laboral',v:'muy alto',risk:72},{n:'Soledad social',v:'creciente',risk:65}]},energy:{score:60,inds:[{n:'Depend. Fósiles',v:'82%',risk:72},{n:'Precio energía',v:'volátil',risk:65},{n:'Reservas petróleo',v:'47 años',risk:58},{n:'Renovables',v:'13% mix',risk:52}]},demo:{score:54,inds:[{n:'Crecim. Poblacional',v:'+0.9%',risk:45},{n:'Envejecimiento',v:'10% >65a',risk:55},{n:'Migración forzada',v:'117M',risk:82},{n:'Urbanización',v:'57%',risk:48}]},urban:{score:56,inds:[{n:'Infra. obsoleta',v:'alta',risk:62},{n:'Acceso agua potable',v:'74%',risk:58},{n:'Ciudades en riesgo',v:'1000+',risk:72},{n:'Vivienda asequible',v:'crisis',risk:65}]},science:{score:44,inds:[{n:'Inversión I+D',v:'2.6% PIB',risk:42},{n:'Brain drain',v:'creciente',risk:55},{n:'Brecha innovación',v:'alta',risk:58},{n:'Acceso ciencia',v:'desigual',risk:52}]},justice:{score:62,inds:[{n:'Presos políticos',v:'estimados',risk:68},{n:'Igualdad género (GII)',v:'0.436',risk:62},{n:'Trabajo infantil',v:'160M niños',risk:72},{n:'Impunidad judicial',v:'alta',risk:65}]},finance:{score:58,inds:[{n:'Deuda global total',v:'307% PIB',risk:78},{n:'Burbuja inmobiliaria',v:'alta',risk:65},{n:'Riesgo banca sombra',v:'elevado',risk:62},{n:'Reservas divisas',v:'declinando',risk:55}]},ocean:{score:68,inds:[{n:'Acidificación',v:'+26% H+',risk:75},{n:'Blanqueo corales',v:'50% afectados',risk:82},{n:'Sobrepesca',v:'34% stocks',risk:72},{n:'Microplásticos',v:'crítico',risk:68}]},bio:{score:55,inds:[{n:'GHS Index',v:'38.9/100',risk:65},{n:'Zoonosis emergentes',v:'alta actividad',risk:72},{n:'Resist. antibiótica',v:'urgente',risk:78},{n:'Vigilancia epidem.',v:'insuficiente',risk:58}]}},USA:{'name':'Estados Unidos',eco:{score:44,inds:[{n:'PIB Crecimiento',v:'2.5%',risk:38},{n:'Inflación',v:'4.1%',risk:52},{n:'Desempleo',v:'3.7%',risk:32},{n:'Deuda Pública',v:'123% PIB',risk:82}]},geo:{score:55,inds:[{n:'Polarización Política',v:'muy alta',risk:82},{n:'Estabilidad Instit.',v:'moderada',risk:48},{n:'Conflictos Externos',v:'2 activos',risk:55},{n:'Control Corrupción',v:'1.2',risk:28}]},health:{score:42,inds:[{n:'Esperanza de Vida',v:'76.4 años',risk:38},{n:'Cobertura Sanitaria',v:'91%',risk:22},{n:'Mort. Infantil',v:'5.4/1k',risk:32},{n:'Gasto Sanitario',v:'16.9% PIB',risk:18}]},climate:{score:61,inds:[{n:'Emisiones CO₂',v:'14.9t/cáp.',risk:78},{n:'Sequías Severas',v:'28% territ.',risk:65},{n:'Eventos Climáticos',v:'+41%',risk:62},{n:'Área Forestal',v:'33%',risk:42}]},social:{score:64,inds:[{n:'Polarización Social',v:'muy alta',risk:88},{n:'Desigualdad (Gini)',v:'0.49',risk:78},{n:'Índice Democracia',v:'7.9/10',risk:38},{n:'Confianza Instit.',v:'27%',risk:72}]},tech:{score:42,inds:[{n:'Ciberdefensa',v:'líder global',risk:22},{n:'Ciberataques recib.',v:'nº1 objetivo',risk:82},{n:'Depend. semicond.',v:'alta Asia',risk:72},{n:'IA dominancia',v:'alta',risk:28}]},food:{score:28,inds:[{n:'Seguridad Aliment.',v:'alta',risk:18},{n:'Obesidad',v:'41.9%',risk:68},{n:'Desperdicio',v:'30-40%',risk:55},{n:'Exportador neto',v:'sí',risk:12}]},mental:{score:68,inds:[{n:'Depresión',v:'21%',risk:75},{n:'Crisis opioides',v:'crítica',risk:88},{n:'Suicidio /100k',v:'14.2',risk:72},{n:'Acceso terapia',v:'limitado',risk:65}]},energy:{score:48,inds:[{n:'Independencia energét.',v:'alta',risk:28},{n:'Emisiones fósiles',v:'muy altas',risk:82},{n:'Renovables',v:'22% mix',risk:48},{n:'Shale oil',v:'líder',risk:32}]},demo:{score:42,inds:[{n:'Natalidad',v:'1.6 hijos',risk:45},{n:'Envejecimiento',v:'17% >65a',risk:52},{n:'Inmigración',v:'polarizada',risk:62},{n:'Brain gain',v:'alto',risk:18}]},urban:{score:52,inds:[{n:'Infra. obsoleta',v:'alta',risk:72},{n:'Vivienda asequible',v:'crisis',risk:78},{n:'Resiliencia climática',v:'media',risk:58},{n:'Transporte público',v:'deficiente',risk:65}]},science:{score:28,inds:[{n:'Inversión I+D',v:'3.4% PIB',risk:22},{n:'Patentes',v:'nº1 global',risk:12},{n:'Universidades top',v:'liderazgo',risk:15},{n:'Financiación ciencia',v:'alta',risk:18}]},justice:{score:55,inds:[{n:'Encarcelamiento',v:'2.1M (1º)',risk:85},{n:'Desigualdad racial',v:'alta',risk:72},{n:'Igualdad género',v:'media',risk:48},{n:'Acceso justicia',v:'desigual',risk:62}]},finance:{score:55,inds:[{n:'Deuda total',v:'350% PIB',risk:78},{n:'Burbuja inmobiliaria',v:'alta',risk:72},{n:'Banca sistémica',v:'alta exposición',risk:65},{n:'Dólar reserva',v:'dominante',risk:22}]},ocean:{score:58,inds:[{n:'Costas en riesgo',v:'alta',risk:72},{n:'Arrecifes Florida',v:'blanqueados',risk:82},{n:'Sobrepesca costera',v:'alta',risk:65},{n:'Subida nivel mar',v:'+3.7mm/a',risk:58}]},bio:{score:42,inds:[{n:'GHS Index',v:'75.9/100',risk:28},{n:'CDC preparación',v:'alta',risk:22},{n:'Resist. antibiótica',v:'crítica',risk:75},{n:'Vigilancia epidem.',v:'alta',risk:25}]}},CHN:{'name':'China',eco:{score:41,inds:[{n:'PIB Crecimiento',v:'5.2%',risk:28},{n:'Inflación',v:'0.2%',risk:38},{n:'Desempleo Juvenil',v:'21%',risk:68},{n:'Deuda Corporativa',v:'160% PIB',risk:79}]},geo:{score:72,inds:[{n:'Tensión Taiwán',v:'muy alta',risk:88},{n:'Disputas Territ.',v:'múltiples',risk:75},{n:'Estado de Derecho',v:'-0.4',risk:68},{n:'Sanciones Activas',v:'parciales',risk:55}]},health:{score:33,inds:[{n:'Esperanza de Vida',v:'77.4 años',risk:30},{n:'Cobertura Sanitaria',v:'87%',risk:28},{n:'Mort. Infantil',v:'6.8/1k',risk:35},{n:'Envejecimiento Pob.',v:'alta',risk:52}]},climate:{score:74,inds:[{n:'Emisiones CO₂',v:'7.1t/cáp.',risk:82},{n:'Calidad del Aire',v:'PM2.5 alta',risk:78},{n:'Estrés Hídrico',v:'72% territ.',risk:74},{n:'Carbón % energía',v:'62%',risk:80}]},social:{score:55,inds:[{n:'Desigualdad (Gini)',v:'0.47',risk:72},{n:'Libertad Civil',v:'muy baja',risk:88},{n:'Migración Interna',v:'300M pers.',risk:58},{n:'Envejecimiento',v:'crítico',risk:75}]},tech:{score:48,inds:[{n:'Ciberataque origen',v:'alta actividad',risk:78},{n:'Vigilancia digital',v:'máxima',risk:85},{n:'Semicond. domésticos',v:'en desarrollo',risk:62},{n:'IA inversión',v:'2º global',risk:32}]},food:{score:44,inds:[{n:'Autosuficiencia',v:'alta',risk:28},{n:'Reservas cereales',v:'50% mundial',risk:18},{n:'Contam. suelos',v:'19% afectado',risk:68},{n:'Agua subterránea',v:'sobreexplot.',risk:75}]},mental:{score:58,inds:[{n:'Depresión',v:'17%',risk:62},{n:'Presión laboral',v:'muy alta',risk:78},{n:'Suicidio /100k',v:'8.1',risk:52},{n:'Recursos salud mental',v:'insuficientes',risk:65}]},energy:{score:65,inds:[{n:'Carbón dependencia',v:'62%',risk:80},{n:'Importación petróleo',v:'72%',risk:72},{n:'Renovables crecim.',v:'acelerado',risk:25},{n:'Emisiones totales',v:'nº1 global',risk:88}]},demo:{score:62,inds:[{n:'Natalidad',v:'1.0 hijos',risk:82},{n:'Envejecimiento',v:'14% >65a',risk:65},{n:'Ratio hombre/mujer',v:'105/100',risk:55},{n:'Población urbana',v:'65%',risk:42}]},urban:{score:48,inds:[{n:'Ciudades fantasma',v:'estimadas',risk:65},{n:'Burbuja inmobil.',v:'crítica',risk:85},{n:'Infra. moderna',v:'alta',risk:22},{n:'Polución urbana',v:'severa',risk:78}]},science:{score:35,inds:[{n:'Inversión I+D',v:'2.4% PIB',risk:32},{n:'Patentes',v:'nº1 cantidad',risk:18},{n:'Espionaje científico',v:'documentado',risk:72},{n:'Talento STEM',v:'muy alto',risk:18}]},justice:{score:82,inds:[{n:'Presos políticos',v:'documentados',risk:88},{n:'Derechos digitales',v:'nulos',risk:92},{n:'Trabajo forzado',v:'documentado',risk:85},{n:'Igualdad género',v:'media-baja',risk:62}]},finance:{score:62,inds:[{n:'Deuda total',v:'280% PIB',risk:72},{n:'Burbuja inmobil.',v:'crítica',risk:88},{n:'Banca pública',v:'expuesta',risk:65},{n:'Yuan internac.',v:'limitado',risk:45}]},ocean:{score:72,inds:[{n:'Pesca industrial',v:'nº1 mundial',risk:85},{n:'Contaminación costera',v:'severa',risk:82},{n:'Mar del Sur China',v:'militarizado',risk:78},{n:'Manglares',v:'pérdida alta',risk:68}]},bio:{score:52,inds:[{n:'GHS Index',v:'52.8/100',risk:52},{n:'Zoonosis origen',v:'alta densidad',risk:78},{n:'Laboratorios BSL-4',v:'activos',risk:65},{n:'Transparencia datos',v:'limitada',risk:82}]}},ESP:{'name':'España',eco:{score:47,inds:[{n:'PIB Crecimiento',v:'2.5%',risk:38},{n:'Inflación',v:'3.5%',risk:48},{n:'Desempleo',v:'11.8%',risk:72},{n:'Deuda Pública',v:'108% PIB',risk:75}]},geo:{score:34,inds:[{n:'Estabilidad Política',v:'moderada',risk:45},{n:'Tensión Territorial',v:'Cataluña',risk:52},{n:'Estado de Derecho',v:'1.1',risk:24},{n:'Posición OTAN',v:'estable',risk:18}]},health:{score:22,inds:[{n:'Esperanza de Vida',v:'83.4 años',risk:14},{n:'Cobertura Sanitaria',v:'97%',risk:12},{n:'Mort. Infantil',v:'2.7/1k',risk:18},{n:'Gasto Sanitario',v:'9.5% PIB',risk:24}]},climate:{score:58,inds:[{n:'Sequías',v:'endémicas',risk:78},{n:'Incendios',v:'creciendo',risk:65},{n:'Temperatura',v:'+1.8°C',risk:62},{n:'Estrés Hídrico',v:'severo sur',risk:72}]},social:{score:42,inds:[{n:'Desigualdad (Gini)',v:'0.33',risk:45},{n:'Desempleo juvenil',v:'28%',risk:78},{n:'Cohesión territorial',v:'moderada',risk:52},{n:'Confianza política',v:'baja',risk:65}]},tech:{score:44,inds:[{n:'Ciberdefensa',v:'media-alta',risk:42},{n:'Depend. cloud ext.',v:'alta',risk:65},{n:'Digital. PYME',v:'en progreso',risk:48},{n:'Ciberataques recib.',v:'moderados',risk:52}]},food:{score:30,inds:[{n:'Autosuficiencia',v:'alta',risk:22},{n:'Sequía agrícola',v:'severa',risk:75},{n:'Exportador neto',v:'sí',risk:15},{n:'Pérdidas calor',v:'crecientes',risk:62}]},mental:{score:48,inds:[{n:'Depresión',v:'10.8%',risk:52},{n:'Suicidio /100k',v:'7.4',risk:48},{n:'Acceso salud mental',v:'medio',risk:45},{n:'Soledad social',v:'creciente',risk:58}]},energy:{score:42,inds:[{n:'Depend. importación',v:'74%',risk:72},{n:'Renovables',v:'46% mix',risk:28},{n:'Precio electricidad',v:'alto',risk:65},{n:'Gas Argelia',v:'dependencia',risk:55}]},demo:{score:52,inds:[{n:'Natalidad',v:'1.19 hijos',risk:78},{n:'Envejecimiento',v:'20% >65a',risk:72},{n:'Emigración jóvenes',v:'alta',risk:68},{n:'Inmigración',v:'moderada',risk:35}]},urban:{score:38,inds:[{n:'Infra. viaria',v:'buena',risk:28},{n:'Vivienda asequible',v:'crisis',risk:78},{n:'Resiliencia hídrica',v:'baja',risk:72},{n:'Smart cities',v:'en progreso',risk:38}]},science:{score:45,inds:[{n:'Inversión I+D',v:'1.4% PIB',risk:62},{n:'Brain drain',v:'alto',risk:72},{n:'Universidades top',v:'media',risk:48},{n:'Startups',v:'creciendo',risk:35}]},justice:{score:32,inds:[{n:'Estado de Derecho',v:'alto',risk:22},{n:'Igualdad género',v:'avanzada',risk:28},{n:'Violencia machista',v:'persistente',risk:55},{n:'Corrupción',v:'moderada',risk:45}]},finance:{score:52,inds:[{n:'Deuda total',v:'210% PIB',risk:65},{n:'Burbuja inmobil.',v:'alta',risk:72},{n:'Banca expuesta',v:'moderada',risk:52},{n:'Riesgo prima',v:'moderado',risk:48}]},ocean:{score:48,inds:[{n:'Mediterráneo calor',v:'récord',risk:75},{n:'Pesca sostenible',v:'en mejora',risk:42},{n:'Costas erosión',v:'moderada',risk:52},{n:'Posidonia',v:'en declive',risk:58}]},bio:{score:32,inds:[{n:'GHS Index',v:'65.5/100',risk:38},{n:'Sistem. vigilancia',v:'alto',risk:28},{n:'Resist. antibiótica',v:'alta UE',risk:62},{n:'Preparación pandém.',v:'media-alta',risk:35}]}},RUS:{'name':'Rusia',eco:{score:71,inds:[{n:'PIB Crecimiento',v:'3.6%',risk:38},{n:'Inflación',v:'7.5%',risk:68},{n:'Sanciones Impacto',v:'severo',risk:88},{n:'Deuda Externa',v:'baja',risk:28}]},geo:{score:91,inds:[{n:'Guerra en Curso',v:'Ucrania',risk:98},{n:'Aislamiento Diplom.',v:'alto',risk:88},{n:'Estado de Derecho',v:'-1.1',risk:85},{n:'Riesgo Escalada',v:'nuclear',risk:78}]},health:{score:55,inds:[{n:'Esperanza de Vida',v:'72.8 años',risk:52},{n:'Mortalidad Hombres',v:'alta',risk:65},{n:'Sistema Sanitario',v:'deteriorado',risk:58},{n:'Emigración Médicos',v:'alta',risk:62}]},climate:{score:44,inds:[{n:'Emisiones CO₂',v:'10.2t/cáp.',risk:72},{n:'Permafrost Fusión',v:'acelerando',risk:68},{n:'Área Forestal',v:'49%',risk:28},{n:'Incendios Sib.',v:'récords',risk:62}]},social:{score:72,inds:[{n:'Emigración talento',v:'+800k 2022',risk:85},{n:'Libertad Civil',v:'muy baja',risk:92},{n:'Cohesión social',v:'fracturada',risk:78},{n:'Desigualdad (Gini)',v:'0.41',risk:65}]},tech:{score:58,inds:[{n:'Ciberataque origen',v:'muy alta',risk:88},{n:'Aislamiento internet',v:'RuNet parcial',risk:72},{n:'Semicond. sancionados',v:'crítico',risk:82},{n:'Drones/IA militar',v:'activo',risk:78}]},food:{score:38,inds:[{n:'Exportador trigo',v:'nº1 mundial',risk:18},{n:'Sanciones agrícolas',v:'parciales',risk:42},{n:'Autosuficiencia',v:'alta',risk:22},{n:'Inflación alimentos',v:'alta',risk:62}]},mental:{score:75,inds:[{n:'Trauma bélico',v:'masivo',risk:88},{n:'Suicidio /100k',v:'17.0',risk:78},{n:'Alcoholismo',v:'alto',risk:72},{n:'Recursos salud mental',v:'muy escasos',risk:82}]},energy:{score:35,inds:[{n:'Exportador neto',v:'petróleo/gas',risk:15},{n:'Depend. ingresos',v:'60% PIB',risk:72},{n:'Sanciones energía',v:'parciales',risk:65},{n:'Diversif. energética',v:'baja',risk:58}]},demo:{score:65,inds:[{n:'Pérdida demográfica',v:'bélica',risk:85},{n:'Emigración masiva',v:'1M+ 2022',risk:82},{n:'Natalidad',v:'1.5 hijos',risk:62},{n:'Envejecimiento',v:'15% >65a',risk:55}]},urban:{score:52,inds:[{n:'Infra. bélica',v:'deterioro',risk:72},{n:'Inversión civil',v:'reducida',risk:68},{n:'Ciudades dañadas',v:'ocupadas',risk:78},{n:'Sanciones constr.',v:'impacto',risk:62}]},science:{score:62,inds:[{n:'Fuga de científicos',v:'masiva',risk:88},{n:'Sanciones I+D',v:'aislamiento',risk:82},{n:'Armamento avanzado',v:'activo',risk:78},{n:'Inversión civil I+D',v:'caída',risk:72}]},justice:{score:92,inds:[{n:'Presos políticos',v:'miles',risk:95},{n:'Crímenes de guerra',v:'documentados',risk:98},{n:'Independencia judicial',v:'nula',risk:92},{n:'Libertad de expresión',v:'eliminada',risk:95}]},finance:{score:65,inds:[{n:'Reservas divisas',v:'parcialmente bloq.',risk:72},{n:'SWIFT exclusión',v:'parcial',risk:68},{n:'Rublo volatilidad',v:'alta',risk:65},{n:'Economía de guerra',v:'activa',risk:78}]},ocean:{score:45,inds:[{n:'Ártico apertura',v:'acelerada',risk:68},{n:'Mar Negro bloq.',v:'activo',risk:75},{n:'Pesca ártica',v:'creciente',risk:52},{n:'Derrames petroleo',v:'moderados',risk:48}]},bio:{score:55,inds:[{n:'GHS Index',v:'44.3/100',risk:58},{n:'Armas biológicas',v:'tratado firmado',risk:65},{n:'Vigilancia epidem.',v:'limitada',risk:62},{n:'Laboratorios',v:'activos',risk:58}]}},IND:{'name':'India',eco:{score:35,inds:[{n:'PIB Crecimiento',v:'6.3%',risk:22},{n:'Inflación',v:'5.7%',risk:58},{n:'Desempleo',v:'7.8%',risk:55},{n:'Infraestructura',v:'en desarrollo',risk:48}]},geo:{score:55,inds:[{n:'Tensión Pak/China',v:'alta',risk:72},{n:'Cohesión Interna',v:'moderada',risk:52},{n:'Estabilidad Política',v:'0.1',risk:45},{n:'Conflictos Frontera',v:'activos',risk:62}]},health:{score:51,inds:[{n:'Esperanza de Vida',v:'70.1 años',risk:52},{n:'Mort. Infantil',v:'25.5/1k',risk:62},{n:'Acceso Agua Potable',v:'88%',risk:42},{n:'Cobertura Sanitaria',v:'71%',risk:48}]},climate:{score:76,inds:[{n:'Olas de Calor',v:'críticas',risk:88},{n:'Estrés Hídrico',v:'extremo',risk:85},{n:'Emisiones CO₂',v:'1.9t/cáp.',risk:42},{n:'Monzón Variabilidad',v:'alta',risk:72}]},social:{score:62,inds:[{n:'Desigualdad (Gini)',v:'0.35',risk:58},{n:'Tensiones religiosas',v:'altas',risk:75},{n:'Discriminación castas',v:'persistente',risk:68},{n:'Índice Democracia',v:'7.2/10',risk:45}]},tech:{score:45,inds:[{n:'Digital expansion',v:'rápida',risk:28},{n:'Ciberataques recib.',v:'top 5',risk:72},{n:'Brecha digital rural',v:'alta',risk:65},{n:'IA outsourcing',v:'líder global',risk:22}]},food:{score:58,inds:[{n:'Desnutrición',v:'16.6%',risk:72},{n:'Estrés hídrico agríc.',v:'extremo',risk:85},{n:'Pérd. post-cosecha',v:'15-20%',risk:62},{n:'Volatilidad monzón',v:'alta',risk:75}]},mental:{score:55,inds:[{n:'Depresión',v:'14%',risk:58},{n:'Suicidio /100k',v:'12.7',risk:65},{n:'Estigma salud mental',v:'muy alto',risk:78},{n:'Recursos',v:'0.3/100k hab.',risk:82}]},energy:{score:58,inds:[{n:'Carbón dependencia',v:'44%',risk:65},{n:'Importación petróleo',v:'85%',risk:78},{n:'Renovables crecim.',v:'acelerado',risk:28},{n:'Acceso energía rural',v:'en mejora',risk:42}]},demo:{score:42,inds:[{n:'Crecim. poblacional',v:'+1.0%',risk:48},{n:'Dividendo demográfico',v:'positivo',risk:18},{n:'Urbanización',v:'36%',risk:55},{n:'Emigración talento',v:'alta',risk:62}]},urban:{score:65,inds:[{n:'Superpoblación urb.',v:'crítica',risk:82},{n:'Saneamiento urb.',v:'deficiente',risk:72},{n:'Contam. aire urb.',v:'severa',risk:78},{n:'Infra. transporte',v:'sobresaturada',risk:68}]},science:{score:42,inds:[{n:'Inversión I+D',v:'0.7% PIB',risk:65},{n:'Talento STEM',v:'muy alto',risk:15},{n:'Brain drain',v:'alta emigrac.',risk:72},{n:'Misión espacial',v:'activa',risk:18}]},justice:{score:55,inds:[{n:'Igualdad género',v:'media-baja',risk:65},{n:'Violencia doméstica',v:'alta',risk:72},{n:'Acceso justicia',v:'desigual',risk:62},{n:'Libertad de prensa',v:'parcial',risk:55}]},finance:{score:45,inds:[{n:'Deuda pública',v:'83% PIB',risk:62},{n:'Rupia estabilidad',v:'moderada',risk:52},{n:'Crecim. reservas',v:'positivo',risk:28},{n:'Crédito privado',v:'expansivo',risk:48}]},ocean:{score:62,inds:[{n:'Arrecifes coralinos',v:'blanqueados',risk:72},{n:'Pesca artesanal',v:'amenazada',risk:65},{n:'Contam. costera',v:'alta',risk:75},{n:'Nivel mar afecta',v:'200M pers.',risk:78}]},bio:{score:55,inds:[{n:'GHS Index',v:'42.8/100',risk:58},{n:'Densidad poblacional',v:'alta riesgo',risk:72},{n:'Resist. antibiótica',v:'muy alta',risk:82},{n:'Vigilancia epidem.',v:'mejorando',risk:48}]}},EUU:{'name':'Unión Europea',eco:{score:52,inds:[{n:'PIB Crecimiento',v:'0.5%',risk:62},{n:'Inflación',v:'5.4%',risk:65},{n:'Desempleo',v:'6.0%',risk:52},{n:'Deuda Pública avg',v:'88% PIB',risk:68}]},geo:{score:58,inds:[{n:'Conflicto Vecino',v:'guerra Ucrania',risk:85},{n:'Cohesión Interna',v:'moderada',risk:52},{n:'Estado de Derecho',v:'1.1',risk:28},{n:'Depend. Energética',v:'alta',risk:68}]},health:{score:28,inds:[{n:'Esperanza de Vida',v:'80.8 años',risk:22},{n:'Cobertura Sanitaria',v:'96%',risk:14},{n:'Mort. Infantil',v:'3.2/1k',risk:22},{n:'Gasto Sanitario',v:'10.2% PIB',risk:20}]},climate:{score:54,inds:[{n:'Emisiones CO₂',v:'6.4t/cáp.',risk:58},{n:'Olas de Calor',v:'frecuencia+',risk:62},{n:'Trans. Energética',v:'en progreso',risk:42},{n:'Biodiversidad',v:'crítica',risk:64}]},social:{score:44,inds:[{n:'Desigualdad avg',v:'0.31',risk:42},{n:'Populismo creciente',v:'alto',risk:65},{n:'Inmigración tensión',v:'alta',risk:62},{n:'Cohesión Social',v:'moderada',risk:48}]},tech:{score:46,inds:[{n:'Ciberdefensa',v:'alta',risk:32},{n:'Depend. cloud EEUU',v:'muy alta',risk:72},{n:'Soberanía digital',v:'en construc.',risk:58},{n:'Desinformación',v:'creciente',risk:62}]},food:{score:32,inds:[{n:'Seguridad Aliment.',v:'alta',risk:22},{n:'Depend. fertiliz.',v:'rusa anterior',risk:55},{n:'Pérd. cosecha calor',v:'crecientes',risk:52},{n:'PAC sostenible',v:'en transición',risk:38}]},mental:{score:52,inds:[{n:'Depresión/Ansiedad',v:'15%',risk:55},{n:'Soledad adultos',v:'alta',risk:62},{n:'Burnout sanitarios',v:'post-COVID',risk:68},{n:'Acceso terapia',v:'variable',risk:48}]},energy:{score:58,inds:[{n:'Depend. gas ruso',v:'reduciendo',risk:65},{n:'Renovables',v:'43% mix',risk:28},{n:'Precio energía',v:'elevado',risk:72},{n:'Almacenamiento',v:'insuficiente',risk:58}]},demo:{score:55,inds:[{n:'Natalidad avg',v:'1.4 hijos',risk:72},{n:'Envejecimiento',v:'21% >65a',risk:68},{n:'Emigración E.del E.',v:'alta',risk:62},{n:'Integración migr.',v:'desafío',risk:55}]},urban:{score:38,inds:[{n:'Infra. transporte',v:'buena',risk:28},{n:'Vivienda asequible',v:'crisis',risk:72},{n:'Resiliencia climática',v:'media',risk:55},{n:'Ciudades sostenibles',v:'progresando',risk:35}]},science:{score:38,inds:[{n:'Inversión I+D avg',v:'2.2% PIB',risk:38},{n:'Horizon Europe',v:'activo',risk:22},{n:'Brain drain a EEUU',v:'moderado',risk:52},{n:'Unicornios tech',v:'creciendo',risk:35}]},justice:{score:28,inds:[{n:'Estado de Derecho',v:'alto',risk:22},{n:'Igualdad género',v:'avanzada',risk:25},{n:'Derechos digitales',v:'GDPR líder',risk:18},{n:'Corrupción',v:'baja-media',risk:35}]},finance:{score:52,inds:[{n:'Deuda soberana',v:'fragmentada',risk:65},{n:'BCE política',v:'restrictiva',risk:58},{n:'Riesgo periférico',v:'moderado',risk:52},{n:'Euro estabilidad',v:'alta',risk:25}]},ocean:{score:52,inds:[{n:'Mediterráneo',v:'warming crítico',risk:75},{n:'Mar del Norte',v:'sobrepescado',risk:62},{n:'Arrecifes europeos',v:'degradados',risk:68},{n:'Política azul',v:'en desarrollo',risk:42}]},bio:{score:35,inds:[{n:'GHS Index avg',v:'62.5/100',risk:38},{n:'ECDC vigilancia',v:'alta',risk:22},{n:'Resist. antibiótica',v:'alta',risk:65},{n:'Preparación',v:'alta',risk:28}]}},BRA:{'name':'Brasil',eco:{score:53,inds:[{n:'PIB Crecimiento',v:'2.9%',risk:42},{n:'Inflación',v:'4.6%',risk:52},{n:'Desigualdad (Gini)',v:'0.53',risk:78},{n:'Deuda Pública',v:'87% PIB',risk:68}]},geo:{score:48,inds:[{n:'Crimen Organizado',v:'alto',risk:75},{n:'Estabilidad Política',v:'moderada',risk:45},{n:'Corrupción',v:'-0.3',risk:62},{n:'Seguridad Frontera',v:'desafíos',risk:52}]},health:{score:45,inds:[{n:'Esperanza de Vida',v:'75.5 años',risk:40},{n:'Mort. Infantil',v:'14.2/1k',risk:52},{n:'Cobertura SUS',v:'80%',risk:38},{n:'Enf. Tropicales',v:'activas',risk:58}]},climate:{score:62,inds:[{n:'Deforestación Amaz.',v:'alta',risk:82},{n:'Sequías Sur',v:'severas',risk:68},{n:'Eventos Extremos',v:'creciendo',risk:65},{n:'Biodiversidad',v:'crítica',risk:78}]},social:{score:68,inds:[{n:'Desigualdad (Gini)',v:'0.53',risk:82},{n:'Violencia urbana',v:'muy alta',risk:85},{n:'Favelas',v:'13M pers.',risk:72},{n:'Polarización',v:'alta',risk:68}]},tech:{score:48,inds:[{n:'Ciberdelito',v:'3º global',risk:72},{n:'Infra. digital',v:'media',risk:52},{n:'Brecha digital',v:'28%',risk:58},{n:'Fintechs',v:'emergentes',risk:28}]},food:{score:35,inds:[{n:'Exportador neto',v:'potencia',risk:12},{n:'Hambre residual',v:'8.1%',risk:55},{n:'Deforestación agríc.',v:'alta',risk:72},{n:'Vulnerabilidad clim.',v:'alta',risk:65}]},mental:{score:62,inds:[{n:'Depresión',v:'12%',risk:62},{n:'Ansiedad',v:'más alto mundo',risk:82},{n:'Suicidio /100k',v:'6.4',risk:45},{n:'Acceso tratamiento',v:'bajo',risk:65}]},energy:{score:38,inds:[{n:'Hidroeléctrica',v:'65% mix',risk:25},{n:'Petróleo Petrobras',v:'exportador',risk:22},{n:'Vulnerabilidad sequía',v:'alta',risk:72},{n:'Biocombustibles',v:'líder',risk:18}]},demo:{score:45,inds:[{n:'Crecim. poblac.',v:'+0.6%',risk:38},{n:'Urbanización',v:'87%',risk:55},{n:'Envejecimiento',v:'10% >65a',risk:48},{n:'Emigración',v:'moderada',risk:42}]},urban:{score:62,inds:[{n:'Favelas riesgo',v:'alta',risk:78},{n:'Saneamiento',v:'deficiente',risk:72},{n:'Violencia urbana',v:'crítica',risk:85},{n:'Infra. transporte',v:'deficiente',risk:65}]},science:{score:48,inds:[{n:'Inversión I+D',v:'1.2% PIB',risk:55},{n:'Embrapa agri-ciencia',v:'líder',risk:15},{n:'Brain drain',v:'moderado',risk:52},{n:'Startups',v:'creciendo',risk:38}]},justice:{score:62,inds:[{n:'Impunidad',v:'alta',risk:78},{n:'Violencia policial',v:'alta',risk:82},{n:'Derechos indígenas',v:'amenazados',risk:72},{n:'Corrupción',v:'alta',risk:68}]},finance:{score:55,inds:[{n:'Tipo interés',v:'10.5%',risk:62},{n:'Deuda pública',v:'87% PIB',risk:68},{n:'Real estabilidad',v:'moderada',risk:52},{n:'Riesgo fiscal',v:'alto',risk:65}]},ocean:{score:55,inds:[{n:'Arrecifes Abrolhos',v:'amenazados',risk:68},{n:'Pesca industrial',v:'alta',risk:62},{n:'Plataforma petrolífera',v:'expansión',risk:58},{n:'Amazonas costera',v:'presión',risk:65}]},bio:{score:48,inds:[{n:'GHS Index',v:'46.5/100',risk:55},{n:'Dengue/Zika',v:'endémicos',risk:72},{n:'Deforestación-zoonosis',v:'relación alta',risk:78},{n:'Vigilancia epidem.',v:'media',risk:52}]}},MEX:{'name':'México',eco:{score:55,inds:[{n:'PIB Crecimiento',v:'3.2%',risk:38},{n:'Inflación',v:'4.7%',risk:55},{n:'Desigualdad (Gini)',v:'0.45',risk:68},{n:'Depend. Export. EEUU',v:'alta',risk:62}]},geo:{score:68,inds:[{n:'Crimen Organizado',v:'muy alto',risk:88},{n:'Homicidios/100k',v:'25',risk:82},{n:'Corrupción',v:'-0.5',risk:72},{n:'Estabilidad Política',v:'moderada',risk:52}]},health:{score:48,inds:[{n:'Esperanza de Vida',v:'75.0 años',risk:42},{n:'Mort. Infantil',v:'11.8/1k',risk:55},{n:'Obesidad',v:'36.1%',risk:65},{n:'Cobertura Sanitaria',v:'74%',risk:52}]},climate:{score:64,inds:[{n:'Sequías Norte',v:'severas',risk:78},{n:'Huracanes',v:'creciendo',risk:72},{n:'Estrés Hídrico',v:'alto',risk:68},{n:'Deforestación',v:'moderada',risk:55}]},social:{score:65,inds:[{n:'Desigualdad (Gini)',v:'0.45',risk:68},{n:'Violencia criminal',v:'muy alta',risk:88},{n:'Migración forzada',v:'alta',risk:72},{n:'Índice Democracia',v:'6.9/10',risk:48}]},tech:{score:50,inds:[{n:'Ciberdelito',v:'alto',risk:68},{n:'Brecha digital',v:'30%',risk:62},{n:'Infra. TIC',v:'media',risk:52},{n:'Vigilancia criminal',v:'preocupante',risk:72}]},food:{score:44,inds:[{n:'Autosuficiencia maíz',v:'dependiente',risk:58},{n:'Desnutrición crónica',v:'12%',risk:65},{n:'Estrés hídrico norte',v:'severo',risk:78},{n:'Pérd. cosecha',v:'moderadas',risk:48}]},mental:{score:55,inds:[{n:'Depresión',v:'11%',risk:58},{n:'Trauma violencia',v:'alto',risk:72},{n:'Suicidio /100k',v:'5.3',risk:42},{n:'Recursos escasos',v:'muy escasos',risk:75}]},energy:{score:55,inds:[{n:'Pemex dependencia',v:'alta',risk:65},{n:'Renovables',v:'25% mix',risk:45},{n:'Reforma energética',v:'revertida',risk:68},{n:'Importación gas EEUU',v:'alta',risk:58}]},demo:{score:48,inds:[{n:'Emigración EEUU',v:'masiva',risk:72},{n:'Natalidad',v:'1.9 hijos',risk:38},{n:'Bono demográfico',v:'activo',risk:22},{n:'Urbanización',v:'82%',risk:48}]},urban:{score:62,inds:[{n:'CDMX hundimiento',v:'40cm/año',risk:85},{n:'Escasez agua urb.',v:'crítica',risk:82},{n:'Violencia urbana',v:'muy alta',risk:88},{n:'Infra. sísmica',v:'riesgo alto',risk:72}]},science:{score:55,inds:[{n:'Inversión I+D',v:'0.3% PIB',risk:78},{n:'Brain drain',v:'muy alto',risk:82},{n:'UNAM referente',v:'regional',risk:28},{n:'Startups',v:'limitadas',risk:62}]},justice:{score:72,inds:[{n:'Impunidad',v:'94% casos',risk:92},{n:'Femicidios',v:'10/día',risk:88},{n:'Prensa asesinada',v:'alta',risk:82},{n:'Corrupción judicial',v:'alta',risk:78}]},finance:{score:52,inds:[{n:'Deuda pública',v:'52% PIB',risk:48},{n:'Peso estabilidad',v:'moderada',risk:55},{n:'Remesas',v:'60B USD/a',risk:22},{n:'Riesgo fiscal',v:'moderado',risk:52}]},ocean:{score:52,inds:[{n:'Golfo México contam.',v:'alta',risk:68},{n:'Arrecife Mesoameric.',v:'amenazado',risk:75},{n:'Pesca ilegal',v:'moderada',risk:58},{n:'Costas turísticas',v:'presión alta',risk:55}]},bio:{score:52,inds:[{n:'GHS Index',v:'47.2/100',risk:55},{n:'Dengue/arbovirosis',v:'endémicos',risk:68},{n:'Frontera vectores',v:'riesgo',risk:62},{n:'Vigilancia epidem.',v:'media',risk:55}]}},JPN:{'name':'Japón',eco:{score:52,inds:[{n:'PIB Crecimiento',v:'1.9%',risk:52},{n:'Inflación',v:'3.3%',risk:48},{n:'Deuda Pública',v:'261% PIB',risk:88},{n:'Envejecimiento Pob.',v:'crítico',risk:82}]},geo:{score:45,inds:[{n:'Tensión RPDC',v:'alta',risk:72},{n:'Disputa Mar China',v:'activa',risk:62},{n:'Alianza EEUU',v:'sólida',risk:22},{n:'Estado de Derecho',v:'1.6',risk:15}]},health:{score:18,inds:[{n:'Esperanza de Vida',v:'84.3 años',risk:10},{n:'Cobertura Sanitaria',v:'100%',risk:8},{n:'Mort. Infantil',v:'1.7/1k',risk:12},{n:'Gasto Sanitario',v:'10.9% PIB',risk:18}]},climate:{score:55,inds:[{n:'Tifones/Ciclones',v:'creciendo',risk:72},{n:'Emisiones CO₂',v:'8.5t/cáp.',risk:68},{n:'Riesgo Sísmico',v:'muy alto',risk:78},{n:'Trans. Energética',v:'en curso',risk:42}]},social:{score:48,inds:[{n:'Envejecimiento extremo',v:'30% >65a',risk:82},{n:'Natalidad',v:'0.7 hijos',risk:88},{n:'Desigualdad (Gini)',v:'0.32',risk:38},{n:'Cohesión social',v:'alta',risk:18}]},tech:{score:38,inds:[{n:'Ciberdefensa',v:'alta',risk:32},{n:'Infra. digital',v:'avanzada',risk:22},{n:'IA inversión',v:'alta',risk:28},{n:'Depend. semicond.',v:'TSMC',risk:62}]},food:{score:45,inds:[{n:'Autosuficiencia',v:'38%',risk:72},{n:'Depend. importac.',v:'muy alta',risk:78},{n:'Desperdicio alim.',v:'bajo',risk:22},{n:'Desastres agrícolas',v:'riesgo sísmico',risk:62}]},mental:{score:65,inds:[{n:'Suicidio /100k',v:'17.5',risk:78},{n:'Karoshi',v:'documentado',risk:82},{n:'Hikikomori',v:'1.5M pers.',risk:72},{n:'Soledad estructural',v:'alta',risk:68}]},energy:{score:58,inds:[{n:'Depend. importación',v:'90%',risk:88},{n:'Nuclear post-Fukushima',v:'reducida',risk:62},{n:'Renovables',v:'22% mix',risk:45},{n:'GNL dependencia',v:'muy alta',risk:75}]},demo:{score:72,inds:[{n:'Natalidad',v:'0.7 hijos',risk:95},{n:'Envejecimiento',v:'30% >65a',risk:88},{n:'Inmigración rígida',v:'muy baja',risk:72},{n:'Colapso demográfico',v:'proyectado',risk:85}]},urban:{score:42,inds:[{n:'Resiliencia sísmica',v:'alta',risk:28},{n:'Infra. avanzada',v:'alta',risk:15},{n:'Ciudades vaciándose',v:'rural',risk:65},{n:'Costo vida urbano',v:'muy alto',risk:62}]},science:{score:32,inds:[{n:'Inversión I+D',v:'3.3% PIB',risk:28},{n:'Premios Nobel',v:'liderazgo',risk:12},{n:'Robótica/IA',v:'líder',risk:18},{n:'Declive talento joven',v:'demográfico',risk:72}]},justice:{score:28,inds:[{n:'Estado de Derecho',v:'muy alto',risk:12},{n:'Igualdad género',v:'media',risk:55},{n:'Derechos trabajador',v:'karoshi',risk:72},{n:'Sistema judicial',v:'eficiente',risk:18}]},finance:{score:55,inds:[{n:'Deuda pública',v:'261% PIB',risk:88},{n:'Yen volatilidad',v:'alta 2023',risk:68},{n:'BoJ política',v:'ultra-laxa',risk:72},{n:'Burbuja inmobil.',v:'moderada',risk:48}]},ocean:{score:48,inds:[{n:'Pesca sostenible',v:'media',risk:52},{n:'Fukushima agua',v:'vertido 2023',risk:72},{n:'Tsunamis riesgo',v:'muy alto',risk:82},{n:'Costas erosión',v:'moderada',risk:45}]},bio:{score:35,inds:[{n:'GHS Index',v:'59.4/100',risk:42},{n:'Influenza vigilancia',v:'alta',risk:28},{n:'Envejecimiento-pandemia',v:'riesgo alto',risk:68},{n:'Preparación',v:'alta',risk:28}]}},
// ── 15 PAÍSES DETALLADOS ──
SAU:{name:'Arabia Saudí',eco:{score:42,inds:[{n:'PIB Crecimiento',v:'8.7%',risk:22},{n:'Inflación',v:'3.1%',risk:38},{n:'Desempleo Nac.',v:'8.3%',risk:55},{n:'Depend. petróleo',v:'67% PIB',risk:78}]},geo:{score:68,inds:[{n:'Tensión Yemen',v:'guerra activa',risk:88},{n:'Rivalidad Irán',v:'alta',risk:75},{n:'Estabilidad intern.',v:'monarquía',risk:55},{n:'Armas importadas',v:'nº2 mundial',risk:72}]},health:{score:32,inds:[{n:'Esperanza de Vida',v:'77.0 años',risk:30},{n:'Cobertura Sanitaria',v:'88%',risk:25},{n:'Obesidad',v:'35.4%',risk:72},{n:'Gasto Sanitario',v:'5.9% PIB',risk:42}]},climate:{score:72,inds:[{n:'Temp. extrema',v:'+2.1°C',risk:85},{n:'Estrés Hídrico',v:'extremo',risk:92},{n:'CO₂/cápita',v:'15.1t',risk:82},{n:'Desertificación',v:'avanzando',risk:78}]},social:{score:62,inds:[{n:'Libertades civiles',v:'muy bajas',risk:88},{n:'Desig. género',v:'alta',risk:82},{n:'Trabajad. migr.',v:'38% poblaç.',risk:65},{n:'Desig. (Gini)',v:'0.45',risk:62}]},tech:{score:38,inds:[{n:'Inversión IA',v:'Vision 2030',risk:28},{n:'Ciberataques',v:'moderados',risk:52},{n:'Penetr. digital',v:'98%',risk:18},{n:'Depend. tech ext.',v:'alta',risk:65}]},food:{score:58,inds:[{n:'Autosuficiencia',v:'20%',risk:82},{n:'Importaciones',v:'80% alim.',risk:85},{n:'Reservas agua',v:'críticas',risk:92},{n:'Precio alimentos',v:'alto',risk:62}]},mental:{score:52,inds:[{n:'Depresión',v:'11.9%',risk:58},{n:'Estigma mental',v:'muy alto',risk:82},{n:'Suicidio /100k',v:'4.1',risk:35},{n:'Recursos escasos',v:'insuficientes',risk:68}]},energy:{score:28,inds:[{n:'Exportador neto',v:'nº2 OPEP',risk:12},{n:'Renovables',v:'0.2% mix',risk:88},{n:'Reservas petróleo',v:'17% mundial',risk:8},{n:'Diversificación',v:'en proceso',risk:55}]},demo:{score:42,inds:[{n:'Crecim. poblac.',v:'+2.4%',risk:45},{n:'Jóvenes <30',v:'63%',risk:35},{n:'Urbanización',v:'84%',risk:38},{n:'Emigración',v:'baja',risk:28}]},urban:{score:35,inds:[{n:'Infra. moderna',v:'alta',risk:22},{n:'Mega proyectos',v:'NEOM activo',risk:32},{n:'Estrés calor urb.',v:'crítico',risk:88},{n:'Agua urbana',v:'desalinización',risk:55}]},science:{score:48,inds:[{n:'Inversión I+D',v:'0.8% PIB',risk:65},{n:'Vision 2030',v:'activo',risk:28},{n:'Universidades',v:'media',risk:52},{n:'Depend. ext.',v:'alta',risk:62}]},justice:{score:75,inds:[{n:'Libertad expresión',v:'muy baja',risk:90},{n:'Derechos mujer',v:'mejorando',risk:65},{n:'Pena de muerte',v:'activa',risk:82},{n:'Independ. judicial',v:'baja',risk:78}]},finance:{score:38,inds:[{n:'Reservas divisas',v:'459B USD',risk:15},{n:'Fondo soberano',v:'PIF 700B',risk:12},{n:'Deuda pública',v:'25% PIB',risk:28},{n:'Oil dependencia',v:'largo plazo',risk:72}]},ocean:{score:55,inds:[{n:'Arrecifes Mar Rojo',v:'blanqueados',risk:72},{n:'Desalinización',v:'nº1 mundial',risk:45},{n:'Pesca limitada',v:'escasa',risk:38},{n:'Contam. costera',v:'moderada',risk:52}]},bio:{score:38,inds:[{n:'GHS Index',v:'54.5/100',risk:48},{n:'Vigilancia epidem.',v:'media-alta',risk:38},{n:'MERS riesgo',v:'camellos',risk:65},{n:'Preparación',v:'media',risk:45}]}},
IRN:{name:'Irán',eco:{score:72,inds:[{n:'PIB Crecimiento',v:'4.7%',risk:42},{n:'Inflación',v:'42%',risk:95},{n:'Sanciones impacto',v:'severo',risk:92},{n:'Desempleo',v:'9.1%',risk:62}]},geo:{score:85,inds:[{n:'Sanciones EEUU/ONU',v:'máximas',risk:95},{n:'Programa nuclear',v:'activo',risk:92},{n:'Proxy wars',v:'activos',risk:88},{n:'Tensión Israel',v:'muy alta',risk:90}]},health:{score:45,inds:[{n:'Esperanza de Vida',v:'75.2 años',risk:42},{n:'Cobertura Sanitaria',v:'72%',risk:48},{n:'Sanciones medicam.',v:'impacto',risk:68},{n:'Gasto Sanitario',v:'5.2% PIB',risk:52}]},climate:{score:68,inds:[{n:'Estrés Hídrico',v:'muy alto',risk:85},{n:'Desertificación',v:'avanzando',risk:78},{n:'Tormentas polvo',v:'frecuentes',risk:72},{n:'Lagos desecándose',v:'crítico',risk:88}]},social:{score:78,inds:[{n:'Libertades civiles',v:'muy bajas',risk:90},{n:'Protestas masivas',v:'recurrentes',risk:82},{n:'Brecha género',v:'alta',risk:85},{n:'Emigración jóvenes',v:'masiva',risk:78}]},tech:{score:55,inds:[{n:'Internet filtrado',v:'alto',risk:85},{n:'Ciberataque origen',v:'activo',risk:78},{n:'Sanciones tech',v:'severas',risk:88},{n:'Tecnol. militar',v:'drones/misiles',risk:82}]},food:{score:55,inds:[{n:'Autosuficiencia',v:'media',risk:52},{n:'Sanciones agrícolas',v:'parciales',risk:62},{n:'Estrés hídrico agríc.',v:'extremo',risk:88},{n:'Inflación alimentos',v:'alta',risk:85}]},mental:{score:68,inds:[{n:'Depresión',v:'alta',risk:72},{n:'Trauma represión',v:'alto',risk:82},{n:'Suicidio /100k',v:'5.3',risk:45},{n:'Recursos',v:'escasos',risk:72}]},energy:{score:32,inds:[{n:'Reservas gas',v:'2º mundial',risk:12},{n:'Sanciones energía',v:'severas',risk:88},{n:'Renovables',v:'0.5% mix',risk:82},{n:'Exportación bloq.',v:'parcial',risk:85}]},demo:{score:45,inds:[{n:'Natalidad',v:'1.7 hijos',risk:52},{n:'Fuga cerebros',v:'masiva',risk:88},{n:'Jóvenes 15-29',v:'24%',risk:35},{n:'Urbanización',v:'76%',risk:42}]},urban:{score:58,inds:[{n:'Riesgo sísmico',v:'muy alto',risk:85},{n:'Teherán contam.',v:'severa',risk:78},{n:'Infra. deteriorada',v:'sanciones',risk:65},{n:'Escasez agua urb.',v:'alta',risk:82}]},science:{score:48,inds:[{n:'Programa nuclear',v:'activo',risk:85},{n:'Sanciones I+D',v:'aislamiento',risk:78},{n:'Talento emigrado',v:'fuga masiva',risk:82},{n:'Inversión I+D',v:'0.6% PIB',risk:70}]},justice:{score:90,inds:[{n:'Ejecuciones',v:'nº2 mundial',risk:95},{n:'Presos políticos',v:'miles',risk:92},{n:'Derechos mujer',v:'muy bajos',risk:90},{n:'Libertad expresión',v:'eliminada',risk:92}]},finance:{score:78,inds:[{n:'Rial colapso',v:'inflación 40%+',risk:92},{n:'SWIFT exclusión',v:'total',risk:95},{n:'Economía paralela',v:'grande',risk:72},{n:'Deuda externa',v:'baja',risk:28}]},ocean:{score:55,inds:[{n:'Golfo Pérsico',v:'contaminado',risk:68},{n:'Pesca declive',v:'moderado',risk:55},{n:'Costas petrolíferas',v:'riesgo',risk:65},{n:'Subida nivel mar',v:'impacto bajo',risk:38}]},bio:{score:55,inds:[{n:'GHS Index',v:'37.9/100',risk:62},{n:'COVID respuesta',v:'tardía',risk:65},{n:'Sanciones vacunas',v:'impacto',risk:72},{n:'Vigilancia epidem.',v:'limitada',risk:62}]}},
ISR:{name:'Israel',eco:{score:38,inds:[{n:'PIB Crecimiento',v:'2.0%',risk:48},{n:'Inflación',v:'3.8%',risk:45},{n:'Desempleo',v:'3.9%',risk:30},{n:'Guerra impacto',v:'2023+',risk:72}]},geo:{score:88,inds:[{n:'Conflicto Gaza',v:'guerra activa',risk:98},{n:'Tensión Irán',v:'muy alta',risk:92},{n:'Hezbollah',v:'amenaza norte',risk:85},{n:'Aislamiento dipl.',v:'creciente',risk:78}]},health:{score:25,inds:[{n:'Esperanza de Vida',v:'82.4 años',risk:18},{n:'Cobertura Sanitaria',v:'99%',risk:10},{n:'Sistema sanitario',v:'avanzado',risk:15},{n:'Trauma bélico',v:'masivo',risk:75}]},climate:{score:55,inds:[{n:'Estrés Hídrico',v:'alto',risk:72},{n:'Temperatura',v:'+1.9°C',risk:65},{n:'Desertificación',v:'sur',risk:58},{n:'Innovación hídrica',v:'líder',risk:15}]},social:{score:58,inds:[{n:'Polarización intern.',v:'muy alta',risk:85},{n:'Tensión Arab-Judía',v:'alta',risk:78},{n:'Ultra-ortodoxos',v:'conflicto civil',risk:65},{n:'Desig. (Gini)',v:'0.39',risk:55}]},tech:{score:22,inds:[{n:'Silicon Wadi',v:'top 5 global',risk:12},{n:'Ciberdefensa 8200',v:'elite',risk:10},{n:'Startups/cápita',v:'nº1 mundial',risk:8},{n:'Depend. EEUU',v:'alta',risk:35}]},food:{score:35,inds:[{n:'Autosuficiencia',v:'media',risk:45},{n:'Tecnol. agríc.',v:'líder global',risk:12},{n:'Depend. importac.',v:'moderada',risk:42},{n:'Riego eficiente',v:'goteo líder',risk:10}]},mental:{score:62,inds:[{n:'Trauma bélico',v:'masivo 2023+',risk:85},{n:'PTSD soldados',v:'alto',risk:78},{n:'Suicidio /100k',v:'5.8',risk:48},{n:'Recursos salud mental',v:'disponibles',risk:35}]},energy:{score:38,inds:[{n:'Gas Leviatan',v:'nuevo campo',risk:18},{n:'Renovables',v:'18% mix',risk:42},{n:'Depend. importac.',v:'reduciendo',risk:38},{n:'Innovación energía',v:'alta',risk:18}]},demo:{score:32,inds:[{n:'Natalidad',v:'2.9 hijos',risk:18},{n:'Aliá continua',v:'inmigración judía',risk:22},{n:'Crecim. poblac.',v:'+1.8%',risk:25},{n:'Urbanización',v:'92%',risk:35}]},urban:{score:35,inds:[{n:'Infra. moderna',v:'alta',risk:22},{n:'Cohetes riesgo',v:'constante',risk:82},{n:'Tel Aviv smartcity',v:'avanzado',risk:15},{n:'Bunkers/hab.',v:'alta resiliencia',risk:18}]},science:{score:18,inds:[{n:'Inversión I+D',v:'5.4% PIB (nº1)',risk:8},{n:'Nobeles/cápita',v:'liderazgo',risk:10},{n:'Bio/Pharma',v:'líder global',risk:12},{n:'IA militar',v:'avanzado',risk:35}]},justice:{score:65,inds:[{n:'Ocupación Palestina',v:'conflicto activo',risk:92},{n:'Asentamientos',v:'expansión',risk:85},{n:'Minorías derechos',v:'desiguales',risk:65},{n:'CPI investigación',v:'activa',risk:72}]},finance:{score:40,inds:[{n:'Shekel estabilidad',v:'afectado 2023',risk:55},{n:'Déficit guerra',v:'creciendo',risk:68},{n:'Rating crediticio',v:'bajado',risk:62},{n:'Inversión extran.',v:'disminuida',risk:58}]},ocean:{score:42,inds:[{n:'Mediterráneo costas',v:'en riesgo',risk:58},{n:'Desalinización',v:'avanzada',risk:25},{n:'Coral Mar Rojo',v:'amenazado',risk:65},{n:'Gestión marina',v:'innovadora',risk:28}]},bio:{score:28,inds:[{n:'GHS Index',v:'70.9/100',risk:30},{n:'Vacunación COVID',v:'líder global',risk:12},{n:'Biodefensa milit.',v:'alta',risk:25},{n:'Vigilancia epidem.',v:'alta',risk:22}]}},
TUR:{name:'Turquía',eco:{score:62,inds:[{n:'PIB Crecimiento',v:'5.1%',risk:35},{n:'Inflación',v:'65%',risk:92},{n:'Tipo cambio',v:'colapso lira',risk:88},{n:'Deuda externa',v:'alta',risk:72}]},geo:{score:68,inds:[{n:'Conflicto Kurdos',v:'activo',risk:75},{n:'Posición OTAN',v:'ambigua',risk:62},{n:'Influencia Siria',v:'presencia mil.',risk:68},{n:'Rivalidad Grecia',v:'tensión',risk:58}]},health:{score:38,inds:[{n:'Esperanza de Vida',v:'77.9 años',risk:32},{n:'Cobertura Sanitaria',v:'82%',risk:35},{n:'Sistema sanitario',v:'medio-alto',risk:38},{n:'Gasto Sanitario',v:'4.6% PIB',risk:48}]},climate:{score:62,inds:[{n:'Sequías',v:'agravándose',risk:72},{n:'Incendios',v:'récords 2021',risk:68},{n:'Inundaciones',v:'crecientes',risk:65},{n:'Temperatura',v:'+1.7°C',risk:62}]},social:{score:58,inds:[{n:'Polarización',v:'alta',risk:72},{n:'Refugiados sirios',v:'3.6M',risk:68},{n:'Libertad prensa',v:'baja',risk:78},{n:'Desig. género',v:'alta',risk:65}]},tech:{score:45,inds:[{n:'Drones Bayraktar',v:'exportador',risk:28},{n:'Ciberdefensa',v:'media',risk:48},{n:'Digital. economía',v:'en progreso',risk:45},{n:'Brecha digital',v:'moderada',risk:52}]},food:{score:35,inds:[{n:'Autosuficiencia',v:'alta',risk:25},{n:'Exportador agríc.',v:'sí',risk:20},{n:'Inflación alimentos',v:'alta',risk:85},{n:'Tierra cultivable',v:'abundante',risk:22}]},mental:{score:52,inds:[{n:'Depresión',v:'11%',risk:55},{n:'Trauma terremotos',v:'2023 masivo',risk:78},{n:'Suicidio /100k',v:'3.7',risk:38},{n:'Recursos',v:'limitados',risk:62}]},energy:{score:55,inds:[{n:'Depend. importac.',v:'72%',risk:75},{n:'TurkStream gas',v:'dep. Rusia',risk:68},{n:'Renovables',v:'37% mix',risk:32},{n:'Nuclear en constr.',v:'activo',risk:42}]},demo:{score:38,inds:[{n:'Crecim. poblac.',v:'+0.7%',risk:38},{n:'Natalidad',v:'1.9 hijos',risk:42},{n:'Urbanización',v:'77%',risk:45},{n:'Emigración EU',v:'moderada',risk:45}]},urban:{score:55,inds:[{n:'Riesgo sísmico',v:'muy alto',risk:88},{n:'Terremoto 2023',v:'50k muertes',risk:82},{n:'Construc. ilegal',v:'alta',risk:75},{n:'Infra. transporte',v:'mejorando',risk:42}]},science:{score:45,inds:[{n:'Inversión I+D',v:'1.1% PIB',risk:58},{n:'Défensa I+D',v:'alta',risk:35},{n:'Fuga cerebros EU',v:'moderada',risk:55},{n:'Tecnol. defensa',v:'creciendo',risk:32}]},justice:{score:65,inds:[{n:'Periodistas presos',v:'nº1 mundial',risk:92},{n:'Independ. judicial',v:'muy baja',risk:82},{n:'Derechos LGTB+',v:'retroceso',risk:78},{n:'Estado de Derecho',v:'-0.4',risk:68}]},finance:{score:68,inds:[{n:'Lira colapso',v:'-80% en 5a',risk:88},{n:'Inflación 65%+',v:'crónica',risk:92},{n:'Deuda externa',v:'alta',risk:72},{n:'Política monetaria',v:'heterodoxa',risk:78}]},ocean:{score:45,inds:[{n:'Mar Negro',v:'contaminado',risk:65},{n:'Mediterráneo E.',v:'sobrepescado',risk:62},{n:'Bósforo tráfico',v:'riesgo',risk:55},{n:'Costas turísticas',v:'presión alta',risk:48}]},bio:{score:42,inds:[{n:'GHS Index',v:'50.4/100',risk:52},{n:'COVID respuesta',v:'moderada',risk:48},{n:'Vigilancia epidem.',v:'media',risk:52},{n:'Frontera vectores',v:'riesgo',risk:55}]}},
GBR:{name:'Reino Unido',eco:{score:48,inds:[{n:'PIB Crecimiento',v:'0.1%',risk:65},{n:'Inflación',v:'6.7%',risk:72},{n:'Desempleo',v:'4.3%',risk:38},{n:'Brexit impacto',v:'negativo',risk:68}]},geo:{score:35,inds:[{n:'OTAN miembro',v:'activo',risk:18},{n:'Influencia global',v:'declinando',risk:48},{n:'Irlanda del Norte',v:'tensión',risk:42},{n:'P5 ONU',v:'perm.',risk:15}]},health:{score:32,inds:[{n:'Esperanza de Vida',v:'81.3 años',risk:22},{n:'NHS en crisis',v:'listas espera',risk:65},{n:'Mort. Infantil',v:'3.6/1k',risk:28},{n:'Gasto Sanitario',v:'10.2% PIB',risk:25}]},climate:{score:42,inds:[{n:'Inundaciones',v:'crecientes',risk:58},{n:'Trans. energética',v:'líder EU',risk:25},{n:'Temperatura',v:'+1.3°C',risk:52},{n:'Tormentas riesgo',v:'moderado',risk:48}]},social:{score:45,inds:[{n:'Desigualdad',v:'0.35',risk:52},{n:'Brecha Brexit',v:'social',risk:65},{n:'Inmigración tensión',v:'alta',risk:62},{n:'Índice Democracia',v:'8.3/10',risk:28}]},tech:{score:30,inds:[{n:'IA inversión',v:'3º global',risk:20},{n:'Ciberdefensa GCHQ',v:'alta',risk:18},{n:'Post-Brexit I+D',v:'impacto neg.',risk:55},{n:'Sector financiero',v:'global líder',risk:18}]},food:{score:38,inds:[{n:'Autosuficiencia',v:'55%',risk:52},{n:'Brexit supply chain',v:'disrupciones',risk:62},{n:'Exportador neto',v:'no',risk:48},{n:'Desperdicio alim.',v:'alto',risk:55}]},mental:{score:50,inds:[{n:'Depresión',v:'12.7%',risk:58},{n:'NHS salud mental',v:'en crisis',risk:72},{n:'Suicidio /100k',v:'7.9',risk:55},{n:'Soledad social',v:'alta',risk:65}]},energy:{score:38,inds:[{n:'Renovables',v:'42% mix',risk:28},{n:'Gas Mar del Norte',v:'declive',risk:58},{n:'Nuclear nueva',v:'en constr.',risk:42},{n:'Precio energía',v:'elevado',risk:68}]},demo:{score:40,inds:[{n:'Natalidad',v:'1.6 hijos',risk:52},{n:'Envejecimiento',v:'18% >65a',risk:55},{n:'Inmigración neta',v:'alta',risk:42},{n:'Brain gain',v:'moderado',risk:28}]},urban:{score:42,inds:[{n:'Vivienda asequible',v:'crisis',risk:78},{n:'Infra. transporte',v:'envejecida',risk:62},{n:'Inundaciones urb.',v:'crecientes',risk:58},{n:'Londres smartcity',v:'líder',risk:22}]},science:{score:25,inds:[{n:'Inversión I+D',v:'1.7% PIB',risk:45},{n:'Oxford/Cambridge',v:'top mundial',risk:12},{n:'Post-Brexit cienc.',v:'impacto neg.',risk:52},{n:'Startups',v:'2º EU',risk:18}]},justice:{score:28,inds:[{n:'Estado de Derecho',v:'muy alto',risk:15},{n:'Igualdad género',v:'avanzada',risk:25},{n:'Libertad prensa',v:'alta',risk:22},{n:'Acceso justicia',v:'bueno',risk:28}]},finance:{score:42,inds:[{n:'Libra esterlina',v:'estable',risk:35},{n:'Deuda pública',v:'102% PIB',risk:65},{n:'City post-Brexit',v:'impacto',risk:52},{n:'Inflación persist.',v:'alta',risk:68}]},ocean:{score:38,inds:[{n:'Mar del Norte',v:'petróleo/gas',risk:42},{n:'Costas erosión',v:'moderada',risk:52},{n:'Pesca post-Brexit',v:'disputas',risk:58},{n:'Biodiversidad mar.',v:'en mejora',risk:35}]},bio:{score:28,inds:[{n:'GHS Index',v:'75.5/100',risk:25},{n:'UKHSA vigilancia',v:'alta',risk:20},{n:'Resist. antibiótica',v:'alta',risk:65},{n:'Preparación',v:'alta',risk:22}]}},
UKR:{name:'Ucrania',eco:{score:82,inds:[{n:'PIB caída',v:'-29% 2022',risk:95},{n:'Inflación',v:'26%',risk:85},{n:'Infraestr. destrozada',v:'masiva',risk:95},{n:'Ayuda externa',v:'dependiente',risk:78}]},geo:{score:98,inds:[{n:'Guerra Rusia',v:'invasión total',risk:100},{n:'Territorio ocupado',v:'~20%',risk:98},{n:'Riesgo nuclear',v:'amenaza activa',risk:85},{n:'OTAN candidato',v:'proceso',risk:55}]},health:{score:68,inds:[{n:'Sistema sanitario',v:'destruido parcial',risk:85},{n:'Bajas civiles',v:'decenas de miles',risk:92},{n:'Hospitales bomb.',v:'documentado',risk:88},{n:'Desplazados',v:'5.9M intern.',risk:82}]},climate:{score:48,inds:[{n:'Tierra agrícola',v:'contaminada',risk:72},{n:'Central Kakhovka',v:'destruida',risk:85},{n:'Contaminación war',v:'severa',risk:78},{n:'Cambio climático',v:'moderado',risk:48}]},social:{score:85,inds:[{n:'Refugiados extern.',v:'6.5M fuera',risk:95},{n:'Desplazados intern.',v:'5.9M',risk:92},{n:'Trauma bélico',v:'masivo',risk:95},{n:'Cohesión nac.',v:'alta resistencia',risk:15}]},tech:{score:45,inds:[{n:'IT sector',v:'resistiendo',risk:35},{n:'Ciberataques Rusia',v:'continuos',risk:92},{n:'Drones UAV',v:'innovación líder',risk:22},{n:'Infra. digital',v:'parcialm. dañada',risk:72}]},food:{score:55,inds:[{n:'Granero Europa',v:'exportac. bloq.',risk:82},{n:'Tierra minada',v:'inutilizada',risk:88},{n:'Autosuficiencia',v:'alta base',risk:25},{n:'Impacto mundial',v:'cereales',risk:72}]},mental:{score:88,inds:[{n:'Trauma guerra',v:'masivo',risk:98},{n:'PTSD estimado',v:'millones',risk:95},{n:'Salud mental',v:'colapsada',risk:88},{n:'Infantes afectados',v:'generación',risk:92}]},energy:{score:78,inds:[{n:'Centrales atacadas',v:'continuo',risk:95},{n:'Apagones masivos',v:'inviernos',risk:88},{n:'Depend. ayuda ext.',v:'alta',risk:78},{n:'Zaporiyia nuclear',v:'riesgo activo',risk:85}]},demo:{score:85,inds:[{n:'Pérdida demográfica',v:'~8M emigrados',risk:95},{n:'Bajas militares',v:'decenas de miles',risk:92},{n:'Natalidad colapso',v:'mínimo hist.',risk:88},{n:'Envejecimiento acel.',v:'guerra',risk:82}]},urban:{score:90,inds:[{n:'Ciudades destruidas',v:'Mariupol etc.',risk:98},{n:'Infra. civil',v:'objetivo militar',risk:92},{n:'Desminado',v:'décadas necesario',risk:85},{n:'Reconstrucción',v:'500B$ estim.',risk:78}]},science:{score:55,inds:[{n:'IT sector offshore',v:'activo',risk:28},{n:'Científicos emigr.',v:'alta',risk:82},{n:'Drones innovación',v:'liderazgo',risk:22},{n:'Inversión I+D',v:'0.4% PIB',risk:72}]},justice:{score:72,inds:[{n:'Crímenes de guerra',v:'documentados',risk:92},{n:'CPI órdenes arrest.',v:'vs Rusia',risk:75},{n:'Corrupción',v:'alta pre-guerra',risk:68},{n:'Reformas judiciales',v:'en proceso',risk:52}]},finance:{score:78,inds:[{n:'Deuda de guerra',v:'creciendo',risk:88},{n:'Depende FMI',v:'total',risk:85},{n:'Hryvnia',v:'artificialmente estab.',risk:72},{n:'Reconstrucción',v:'500B USD',risk:82}]},ocean:{score:55,inds:[{n:'Mar Negro bloq.',v:'parcialmente',risk:72},{n:'Kakhovka desastre',v:'ecosistema',risk:88},{n:'Contaminación war',v:'ríos/suelos',risk:82},{n:'Pesca paralizada',v:'zonas guerra',risk:78}]},bio:{score:62,inds:[{n:'Sistema sanitario',v:'bajo presión',risk:82},{n:'Trauma/enfermedad',v:'guerra',risk:85},{n:'Vectores post-war',v:'riesgo',risk:58},{n:'GHS Index',v:'en deterioro',risk:65}]}},
POL:{name:'Polonia',eco:{score:42,inds:[{n:'PIB Crecimiento',v:'0.2%',risk:62},{n:'Inflación',v:'11.4%',risk:78},{n:'Desempleo',v:'2.8%',risk:22},{n:'Gasto defensa',v:'4% PIB',risk:55}]},geo:{score:52,inds:[{n:'Flanco OTAN',v:'1ª línea',risk:72},{n:'Frontera Ucrania',v:'guerra vecina',risk:78},{n:'Frontera Bielorrusia',v:'presión migrat.',risk:65},{n:'Estado de Derecho',v:'controvert.',risk:58}]},health:{score:35,inds:[{n:'Esperanza de Vida',v:'76.5 años',risk:38},{n:'Cobertura Sanitaria',v:'82%',risk:38},{n:'Sistema público',v:'sobrecargado',risk:58},{n:'Gasto Sanitario',v:'6.5% PIB',risk:42}]},climate:{score:55,inds:[{n:'Carbón dependencia',v:'60% energía',risk:82},{n:'Contaminación aire',v:'alta UE',risk:75},{n:'Inundaciones',v:'moderadas',risk:48},{n:'Trans. energética',v:'lenta',risk:68}]},social:{score:45,inds:[{n:'Refugiados Ucrania',v:'1M+ acogidos',risk:42},{n:'Derechos LGTB+',v:'retroceso',risk:72},{n:'Polarización',v:'alta',risk:68},{n:'Desig. (Gini)',v:'0.30',risk:35}]},tech:{score:38,inds:[{n:'Sector IT',v:'creciendo',risk:28},{n:'Ciberdefensa',v:'mejorando',risk:42},{n:'Digital. PYME',v:'media',risk:52},{n:'Startups',v:'emergentes',risk:38}]},food:{score:28,inds:[{n:'Autosuficiencia',v:'alta',risk:22},{n:'Exportador agríc.',v:'EU fuerte',risk:18},{n:'Inflación alim.',v:'alta',risk:72},{n:'Seguridad aliment.',v:'alta',risk:20}]},mental:{score:48,inds:[{n:'Depresión',v:'10%',risk:52},{n:'Suicidio /100k',v:'12.8',risk:68},{n:'Recursos escasos',v:'insuficientes',risk:62},{n:'Ansiedad guerra',v:'cercana',risk:65}]},energy:{score:60,inds:[{n:'Carbón depend.',v:'60%',risk:82},{n:'Gas ruso',v:'eliminando',risk:65},{n:'Renovables',v:'20% mix',risk:48},{n:'Nuclear proyecto',v:'en proceso',risk:38}]},demo:{score:48,inds:[{n:'Natalidad',v:'1.3 hijos',risk:78},{n:'Emigración EU',v:'histórica',risk:65},{n:'Envejecimiento',v:'19% >65a',risk:62},{n:'Retorno emigrantes',v:'parcial',risk:42}]},urban:{score:38,inds:[{n:'Infra. moderna',v:'EU fondos',risk:28},{n:'Vivienda asequible',v:'presión',risk:62},{n:'Smog ciudades',v:'peor UE',risk:78},{n:'Transporte público',v:'bueno',risk:28}]},science:{score:42,inds:[{n:'Inversión I+D',v:'1.4% PIB',risk:55},{n:'Talento IT',v:'fuerte',risk:25},{n:'Brain drain',v:'moderado',risk:52},{n:'Universidades',v:'media',risk:48}]},justice:{score:55,inds:[{n:'Estado de Derecho',v:'controvertido',risk:68},{n:'Judicial reforma',v:'conflicto EU',risk:72},{n:'Libertad prensa',v:'reducida',risk:65},{n:'Igualdad género',v:'media',risk:52}]},finance:{score:42,inds:[{n:'Deuda pública',v:'49% PIB',risk:42},{n:'Zloty estable',v:'moderado',risk:45},{n:'Gasto defensa',v:'+presupuesto',risk:48},{n:'Fondos EU',v:'receptor neto',risk:18}]},ocean:{score:35,inds:[{n:'Mar Báltico',v:'contaminado',risk:65},{n:'Pesca Báltico',v:'en declive',risk:55},{n:'Política marina',v:'EU marcos',risk:35},{n:'Costas limitadas',v:'baja exposición',risk:28}]},bio:{score:35,inds:[{n:'GHS Index',v:'60.2/100',risk:42},{n:'Sistema vigilancia',v:'bueno',risk:32},{n:'Resist. antibiótica',v:'alta EU',risk:62},{n:'Preparación',v:'media-alta',risk:38}]}},
ARG:{name:'Argentina',eco:{score:78,inds:[{n:'PIB Crecim.',v:'-2.5%',risk:75},{n:'Inflación',v:'211%',risk:98},{n:'Pobreza',v:'40%',risk:82},{n:'Deuda FMI',v:'44B USD',risk:88}]},geo:{score:38,inds:[{n:'Estabilidad polít.',v:'turbulenta',risk:62},{n:'Crimen organiz.',v:'creciendo',risk:55},{n:'Malvinas tensión',v:'latente',risk:42},{n:'Relac. internac.',v:'neutras',risk:35}]},health:{score:42,inds:[{n:'Esperanza Vida',v:'77.1 años',risk:35},{n:'Cobertura Sanitaria',v:'87%',risk:30},{n:'Mort. Infantil',v:'8.5/1k',risk:48},{n:'Gasto Sanitario',v:'9.8% PIB',risk:28}]},climate:{score:55,inds:[{n:'Sequía Pampa',v:'severa',risk:72},{n:'Derretim. Patagonia',v:'acelerado',risk:65},{n:'Inundaciones norte',v:'cíclicas',risk:62},{n:'CO₂/cápita',v:'4.1t',risk:45}]},social:{score:65,inds:[{n:'Pobreza',v:'40%',risk:82},{n:'Desig. (Gini)',v:'0.42',risk:65},{n:'Clase media caída',v:'masiva',risk:78},{n:'Índice Democracia',v:'7.9/10',risk:35}]},tech:{score:45,inds:[{n:'Sector IT',v:'exportador',risk:25},{n:'Talento tech',v:'alto',risk:22},{n:'Emigración IT',v:'masiva crisis',risk:82},{n:'Infraestr. digital',v:'media',risk:52}]},food:{score:25,inds:[{n:'Exportador soja',v:'nº3 mundial',risk:12},{n:'Exportador carne',v:'nº3 mundial',risk:12},{n:'Autosuficiencia',v:'muy alta',risk:8},{n:'Inflación alim.',v:'200%+',risk:95}]},mental:{score:62,inds:[{n:'Psicólogos/cápita',v:'nº1 mundial',risk:8},{n:'Estrés económico',v:'muy alto',risk:88},{n:'Depresión',v:'11%',risk:58},{n:'Suicidio /100k',v:'9.3',risk:62}]},energy:{score:42,inds:[{n:'Gas Vaca Muerta',v:'2º reservas',risk:12},{n:'Renovables',v:'16% mix',risk:48},{n:'Subsidios energía',v:'insostenibles',risk:75},{n:'Crisis eléctr.',v:'intermitente',risk:65}]},demo:{score:38,inds:[{n:'Natalidad',v:'2.2 hijos',risk:32},{n:'Emigración',v:'acelerada',risk:72},{n:'Urbanización',v:'92%',risk:42},{n:'Envejecimiento',v:'moderado',risk:45}]},urban:{score:55,inds:[{n:'Vivienda asequible',v:'crisis',risk:72},{n:'Villas miseria',v:'grandes',risk:75},{n:'Infra. deteriorada',v:'falta inversión',risk:65},{n:'Buenos Aires',v:'megalópolis',risk:55}]},science:{score:42,inds:[{n:'CONICET',v:'institución fuerte',risk:25},{n:'Brain drain',v:'masivo crisis',risk:88},{n:'Inversión I+D',v:'0.5% PIB',risk:68},{n:'Nobeles',v:'5 premios',risk:20}]},justice:{score:52,inds:[{n:'Corrupción',v:'alta',risk:68},{n:'Impunidad',v:'alta',risk:72},{n:'Igualdad género',v:'Ley Paridad',risk:38},{n:'Acceso justicia',v:'desigual',risk:58}]},finance:{score:85,inds:[{n:'Default serial',v:'9 veces',risk:92},{n:'Inflación 211%',v:'crónica',risk:98},{n:'Reservas negativas',v:'crítico',risk:95},{n:'Cepo cambiario',v:'activo',risk:85}]},ocean:{score:35,inds:[{n:'Pesca austral',v:'sostenible',risk:28},{n:'Costas patagónicas',v:'prístinas',risk:18},{n:'Pesca ilegal',v:'ZEE presión',risk:65},{n:'Biodiversidad mar.',v:'alta',risk:22}]},bio:{score:38,inds:[{n:'GHS Index',v:'58.8/100',risk:42},{n:'Dengue endémico',v:'norte',risk:65},{n:'Sistema vigilancia',v:'bueno',risk:35},{n:'Preparación',v:'media',risk:45}]}},
KOR:{name:'Corea del Sur',eco:{score:35,inds:[{n:'PIB Crecimiento',v:'1.4%',risk:55},{n:'Inflación',v:'3.6%',risk:45},{n:'Desempleo',v:'2.7%',risk:22},{n:'Deuda hogares',v:'muy alta',risk:78}]},geo:{score:65,inds:[{n:'RPDC amenaza',v:'nuclear activa',risk:92},{n:'Misiles RPDC',v:'frecuentes',risk:85},{n:'Alianza EEUU',v:'sólida',risk:18},{n:'Tensión Japón',v:'histórica',risk:45}]},health:{score:20,inds:[{n:'Esperanza Vida',v:'83.6 años',risk:12},{n:'Cobertura Sanitaria',v:'100%',risk:10},{n:'Mort. Infantil',v:'2.5/1k',risk:15},{n:'Gasto Sanitario',v:'8.8% PIB',risk:22}]},climate:{score:52,inds:[{n:'Ondas calor',v:'crecientes',risk:62},{n:'Emisiones CO₂',v:'11.9t/cáp.',risk:75},{n:'Tifones',v:'creciendo',risk:65},{n:'Trans. energética',v:'en proceso',risk:48}]},social:{score:55,inds:[{n:'Presión social',v:'extrema',risk:82},{n:'Suicidio jóvenes',v:'alta presión',risk:78},{n:'Polarización polít.',v:'alta',risk:65},{n:'Desig. (Gini)',v:'0.31',risk:38}]},tech:{score:18,inds:[{n:'Samsung/LG/SK',v:'líderes glob.',risk:8},{n:'Semiconductores',v:'TSMC rival',risk:12},{n:'5G cobertura',v:'nº1 mundial',risk:8},{n:'Ciberataque RPDC',v:'constante',risk:72}]},food:{score:42,inds:[{n:'Autosuficiencia',v:'25%',risk:72},{n:'Depend. importac.',v:'muy alta',risk:78},{n:'Tecnol. agríc.',v:'avanzada',risk:22},{n:'Desperdicio alim.',v:'bajo',risk:22}]},mental:{score:72,inds:[{n:'Suicidio /100k',v:'23.6 (1º OCDE)',risk:88},{n:'Burnout estud.',v:'extremo',risk:85},{n:'Soledad jóvenes',v:'alta',risk:78},{n:'Depresión',v:'12%',risk:65}]},energy:{score:55,inds:[{n:'Nuclear 30% mix',v:'activa',risk:38},{n:'Depend. importac.',v:'93%',risk:88},{n:'Renovables',v:'9% mix',risk:62},{n:'GNL depend.',v:'muy alta',risk:75}]},demo:{score:72,inds:[{n:'Natalidad',v:'0.72 hijos',risk:98},{n:'Envejecimiento',v:'18% >65a',risk:72},{n:'Colapso demogr.',v:'proyectado',risk:92},{n:'Inmigración',v:'rígida',risk:65}]},urban:{score:35,inds:[{n:'Seúl smartcity',v:'top 5 global',risk:15},{n:'Infra. avanzada',v:'alta',risk:12},{n:'Vivienda asequible',v:'crisis',risk:72},{n:'Transporte público',v:'excelente',risk:10}]},science:{score:20,inds:[{n:'Inversión I+D',v:'4.9% PIB (nº1)',risk:10},{n:'Patentes',v:'top 5 global',risk:12},{n:'Semiconductores',v:'liderazgo',risk:10},{n:'Talento STEM',v:'excelente',risk:12}]},justice:{score:35,inds:[{n:'Estado de Derecho',v:'alto',risk:20},{n:'Igualdad género',v:'mejorando',risk:45},{n:'Corrupción chaebol',v:'moderada',risk:52},{n:'Libertad prensa',v:'alta',risk:25}]},finance:{score:40,inds:[{n:'Deuda hogares',v:'105% PIB',risk:78},{n:'Won estabilidad',v:'moderada',risk:48},{n:'Reservas divisas',v:'altas',risk:18},{n:'Sistema bancario',v:'sólido',risk:28}]},ocean:{score:45,inds:[{n:'Mar Amarillo',v:'contaminado',risk:68},{n:'Pesca sostenible',v:'media',risk:52},{n:'Plásticos marinos',v:'alta prod.',risk:62},{n:'Subida nivel mar',v:'impacto costas',risk:55}]},bio:{score:25,inds:[{n:'GHS Index',v:'70.2/100',risk:28},{n:'K-BIO preparación',v:'alta post-MERS',risk:22},{n:'Vigilancia epidem.',v:'alta',risk:18},{n:'Capacidad resp.',v:'alta',risk:20}]}},
NGA:{name:'Nigeria',eco:{score:62,inds:[{n:'PIB Crecimiento',v:'2.9%',risk:58},{n:'Inflación',v:'28%',risk:85},{n:'Desempleo',v:'33%',risk:88},{n:'Naira colapso',v:'devaluación',risk:82}]},geo:{score:72,inds:[{n:'Boko Haram',v:'norte activo',risk:82},{n:'Niger Delta',v:'conflicto',risk:75},{n:'Tensiones étnicas',v:'alta',risk:72},{n:'Inseguridad',v:'alta',risk:78}]},health:{score:68,inds:[{n:'Esperanza Vida',v:'54.3 años',risk:78},{n:'Mort. Infantil',v:'72/1k',risk:85},{n:'Cobertura Sanitaria',v:'42%',risk:72},{n:'Malaria/Polio',v:'activos',risk:68}]},climate:{score:72,inds:[{n:'Desertificación norte',v:'avanzando',risk:82},{n:'Inundaciones sur',v:'cíclicas',risk:75},{n:'Delta Níger',v:'degradado',risk:78},{n:'Temperatura',v:'+1.5°C',risk:72}]},social:{score:68,inds:[{n:'Pobreza extrema',v:'40%',risk:82},{n:'250 etnias',v:'tensiones',risk:72},{n:'Desplazados intern.',v:'3.6M',risk:78},{n:'Desig. (Gini)',v:'0.43',risk:68}]},tech:{score:48,inds:[{n:'Fintech hub África',v:'Lagos líder',risk:25},{n:'Brecha digital',v:'45%',risk:65},{n:'Startups',v:'ecosistema creciente',risk:28},{n:'Infraestr. digital',v:'deficiente',risk:68}]},food:{score:65,inds:[{n:'Inseguridad alim.',v:'25M personas',risk:82},{n:'Importaciones',v:'dependiente',risk:72},{n:'Inflación alim.',v:'alta',risk:82},{n:'Tierras sub-explot.',v:'potencial',risk:55}]},mental:{score:55,inds:[{n:'Trauma violencia',v:'alto',risk:75},{n:'Recursos',v:'muy escasos',risk:88},{n:'Estigma mental',v:'muy alto',risk:85},{n:'Suicidio /100k',v:'4.0',risk:38}]},energy:{score:58,inds:[{n:'Petróleo export.',v:'1º África',risk:15},{n:'Acceso electricidad',v:'59%',risk:72},{n:'Gas flaring',v:'alto',risk:82},{n:'Renovables',v:'21% mix',risk:45}]},demo:{score:42,inds:[{n:'Crecim. poblac.',v:'+2.4%',risk:45},{n:'Fertilidad',v:'5.2 hijos',risk:52},{n:'Bono demográfico',v:'potencial',risk:18},{n:'Urbanización',v:'54%',risk:55}]},urban:{score:68,inds:[{n:'Lagos 25M hab.',v:'megalópolis',risk:72},{n:'Saneamiento',v:'deficiente',risk:82},{n:'Infra. crítica',v:'muy deficiente',risk:78},{n:'Slums',v:'alta densidad',risk:75}]},science:{score:58,inds:[{n:'Inversión I+D',v:'0.2% PIB',risk:82},{n:'Brain drain',v:'masivo',risk:88},{n:'Universidades',v:'en crisis',risk:72},{n:'Potencial joven',v:'alto',risk:25}]},justice:{score:72,inds:[{n:'Corrupción',v:'muy alta',risk:85},{n:'Impunidad',v:'alta',risk:82},{n:'Violencia policial',v:'documentada',risk:78},{n:'Acceso justicia',v:'muy limitado',risk:80}]},finance:{score:65,inds:[{n:'Deuda externa',v:'creciendo',risk:68},{n:'Reservas divisas',v:'bajas',risk:72},{n:'Depend. petróleo',v:'90% exportac.',risk:82},{n:'Banca informal',v:'alta',risk:62}]},ocean:{score:62,inds:[{n:'Delta Níger contam.',v:'severa',risk:88},{n:'Pesca artesanal',v:'amenazada',risk:72},{n:'Derrames petróleo',v:'frecuentes',risk:85},{n:'Costas erosión',v:'alta',risk:68}]},bio:{score:65,inds:[{n:'GHS Index',v:'34.6/100',risk:68},{n:'Mpox endémico',v:'activo',risk:72},{n:'Polio residual',v:'monitoreado',risk:65},{n:'Vigilancia epidem.',v:'deficiente',risk:72}]}},
AUS:{name:'Australia',eco:{score:30,inds:[{n:'PIB Crecimiento',v:'2.0%',risk:48},{n:'Inflación',v:'4.1%',risk:52},{n:'Desempleo',v:'3.7%',risk:28},{n:'Deuda hogares',v:'alta',risk:65}]},geo:{score:30,inds:[{n:'Alianza AUKUS',v:'activa',risk:18},{n:'Tensión China',v:'comercial',risk:52},{n:'Pacífico Sur',v:'influencia China',risk:48},{n:'Estabilidad',v:'alta',risk:15}]},health:{score:18,inds:[{n:'Esperanza Vida',v:'83.9 años',risk:10},{n:'Medicare universal',v:'100%',risk:10},{n:'Mort. Infantil',v:'3.0/1k',risk:18},{n:'Gasto Sanitario',v:'10.6% PIB',risk:18}]},climate:{score:72,inds:[{n:'Megaincendios',v:'récords',risk:88},{n:'Gran Barrera Coral',v:'amenazada',risk:85},{n:'Sequías El Niño',v:'severas',risk:78},{n:'Temperatura',v:'+1.4°C',risk:72}]},social:{score:28,inds:[{n:'Cohesión social',v:'alta',risk:20},{n:'Desig. (Gini)',v:'0.34',risk:38},{n:'Indígenas derechos',v:'en mejora',risk:48},{n:'Índice Democracia',v:'9.5/10',risk:10}]},tech:{score:25,inds:[{n:'Ciberdefensa ASD',v:'líder',risk:20},{n:'Infraestr. digital',v:'alta',risk:18},{n:'IA investigación',v:'avanzada',risk:22},{n:'Innovación',v:'media-alta',risk:35}]},food:{score:20,inds:[{n:'Exportador neto',v:'grande',risk:10},{n:'Autosuficiencia',v:'muy alta',risk:8},{n:'Seguridad aliment.',v:'muy alta',risk:10},{n:'Sequía impacto',v:'moderado',risk:48}]},mental:{score:48,inds:[{n:'Suicidio /100k',v:'11.3',risk:62},{n:'Depresión',v:'11.6%',risk:55},{n:'Soledad post-COVID',v:'alta',risk:58},{n:'Acceso terapia',v:'bueno',risk:32}]},energy:{score:55,inds:[{n:'Carbón exportador',v:'nº2 mundial',risk:72},{n:'Renovables',v:'35% mix',risk:35},{n:'GNL exportador',v:'nº2',risk:18},{n:'Trans. energética',v:'acelerada',risk:38}]},demo:{score:25,inds:[{n:'Inmigración neta',v:'alta',risk:18},{n:'Natalidad',v:'1.7 hijos',risk:48},{n:'Envejecimiento',v:'17% >65a',risk:45},{n:'Urbanización',v:'86%',risk:35}]},urban:{score:35,inds:[{n:'Infra. moderna',v:'alta',risk:18},{n:'Vivienda asequible',v:'crisis',risk:78},{n:'Resiliencia climát.',v:'mejorando',risk:45},{n:'Ciudades sostenibl.',v:'en progreso',risk:32}]},science:{score:25,inds:[{n:'Inversión I+D',v:'1.7% PIB',risk:42},{n:'Universidades top',v:'ANU/Melbourne',risk:18},{n:'Ciencias del mar',v:'liderazgo',risk:15},{n:'Brain gain',v:'alto',risk:18}]},justice:{score:22,inds:[{n:'Estado de Derecho',v:'muy alto',risk:12},{n:'Igualdad género',v:'avanzada',risk:22},{n:'Derechos Indígenas',v:'en mejora',risk:42},{n:'Libertad prensa',v:'alta',risk:18}]},finance:{score:30,inds:[{n:'Deuda hogares',v:'alta',risk:65},{n:'Sistema bancario',v:'sólido',risk:18},{n:'Dólar australiano',v:'estable',risk:28},{n:'Superannuation',v:'pensiones fuertes',risk:15}]},ocean:{score:68,inds:[{n:'Gran Barrera Coral',v:'50% blanqueada',risk:88},{n:'Acidificación',v:'alta',risk:78},{n:'Costas en riesgo',v:'alta',risk:72},{n:'Pesca sostenible',v:'media',risk:48}]},bio:{score:22,inds:[{n:'GHS Index',v:'71.1/100',risk:25},{n:'Biodefensa',v:'alta',risk:20},{n:'Vigilancia epidem.',v:'alta',risk:18},{n:'Preparación',v:'alta',risk:18}]}},
CAN:{name:'Canadá',eco:{score:32,inds:[{n:'PIB Crecimiento',v:'1.2%',risk:52},{n:'Inflación',v:'3.4%',risk:45},{n:'Desempleo',v:'5.8%',risk:38},{n:'Deuda hogares',v:'alta',risk:68}]},geo:{score:22,inds:[{n:'Alianza OTAN',v:'activa',risk:15},{n:'Relac. EEUU',v:'muy estrechas',risk:18},{n:'Ártico soberanía',v:'disputa',risk:42},{n:'Estabilidad intern.',v:'alta',risk:12}]},health:{score:22,inds:[{n:'Esperanza Vida',v:'82.7 años',risk:15},{n:'Medicare universal',v:'cobertura',risk:12},{n:'Mort. Infantil',v:'4.5/1k',risk:25},{n:'Gasto Sanitario',v:'12.2% PIB',risk:18}]},climate:{score:58,inds:[{n:'Incendios',v:'récords 2023',risk:82},{n:'Permafrost fusión',v:'acelerada',risk:72},{n:'Emisiones CO₂',v:'14.4t/cáp.',risk:78},{n:'Ártico calentam.',v:'3x promedio',risk:75}]},social:{score:25,inds:[{n:'Multiculturalismo',v:'modelo mundial',risk:15},{n:'Desig. (Gini)',v:'0.31',risk:35},{n:'Indígenas derechos',v:'TRC proceso',risk:52},{n:'Índice Democracia',v:'9.2/10',risk:12}]},tech:{score:22,inds:[{n:'IA Montreal/Toronto',v:'hub global',risk:12},{n:'Ciberdefensa CSIS',v:'alta',risk:18},{n:'Sector tech',v:'robusto',risk:18},{n:'Depend. EEUU tech',v:'alta',risk:45}]},food:{score:15,inds:[{n:'Exportador neto',v:'grande',risk:8},{n:'Autosuficiencia',v:'muy alta',risk:8},{n:'Seguridad aliment.',v:'muy alta',risk:8},{n:'Incendios impacto',v:'limitado agríc.',risk:35}]},mental:{score:42,inds:[{n:'Opioides crisis',v:'alta',risk:72},{n:'Depresión',v:'9.7%',risk:48},{n:'Suicidio /100k',v:'11.0',risk:58},{n:'Acceso terapia',v:'bueno',risk:28}]},energy:{score:32,inds:[{n:'Oil sands export.',v:'alta',risk:22},{n:'Hidro-eléctrica',v:'60% mix',risk:18},{n:'Emisiones industria',v:'alta',risk:72},{n:'Trans. energética',v:'en progreso',risk:38}]},demo:{score:20,inds:[{n:'Inmigración neta',v:'muy alta',risk:15},{n:'Brain gain',v:'muy alto',risk:10},{n:'Natalidad',v:'1.4 hijos',risk:55},{n:'Envejecimiento',v:'18% >65a',risk:48}]},urban:{score:35,inds:[{n:'Infra. moderna',v:'alta',risk:20},{n:'Vivienda asequible',v:'crisis Vncvr/TO',risk:85},{n:'Incendios urb. riesgo',v:'creciente',risk:58},{n:'Transporte público',v:'bueno',risk:25}]},science:{score:22,inds:[{n:'IA investigación',v:'Bengio/LeCun',risk:12},{n:'Inversión I+D',v:'1.6% PIB',risk:45},{n:'Universidades top',v:'UofT/McGill',risk:18},{n:'Brain gain',v:'alto',risk:15}]},justice:{score:15,inds:[{n:'Estado de Derecho',v:'muy alto',risk:10},{n:'Igualdad género',v:'avanzada',risk:15},{n:'Derechos Indígenas',v:'TRC proceso',risk:42},{n:'Libertad prensa',v:'muy alta',risk:12}]},finance:{score:28,inds:[{n:'Deuda hogares',v:'alta',risk:65},{n:'Sistema bancario',v:'muy sólido',risk:12},{n:'Dólar canadiense',v:'estable',risk:25},{n:'Deuda pública',v:'107% PIB',risk:55}]},ocean:{score:40,inds:[{n:'Ártico calentam.',v:'crítico',risk:82},{n:'Pesca sostenible',v:'media',risk:45},{n:'Gran Banco recuperac.',v:'en proceso',risk:45},{n:'Costas árticas',v:'en riesgo',risk:68}]},bio:{score:20,inds:[{n:'GHS Index',v:'75.3/100',risk:22},{n:'PHAC vigilancia',v:'alta',risk:18},{n:'Preparación',v:'alta',risk:18},{n:'Resist. antibiótica',v:'moderada',risk:52}]}},
ZAF:{name:'Sudáfrica',eco:{score:62,inds:[{n:'PIB Crecimiento',v:'0.6%',risk:68},{n:'Desempleo',v:'32%',risk:92},{n:'Load shedding',v:'crítico',risk:88},{n:'Desig. (Gini)',v:'0.63 (1º)',risk:95}]},geo:{score:48,inds:[{n:'Crimen violento',v:'muy alto',risk:82},{n:'Estabilidad polít.',v:'ANC debilitado',risk:55},{n:'BRICS miembro',v:'activo',risk:35},{n:'Liderazgo regional',v:'África',risk:28}]},health:{score:55,inds:[{n:'Esperanza Vida',v:'63.9 años',risk:62},{n:'VIH/SIDA',v:'7.5M infectados',risk:82},{n:'TB activa',v:'alta',risk:78},{n:'Sistema sanitario',v:'dual priv/púb.',risk:58}]},climate:{score:65,inds:[{n:'Sequías',v:'severas',risk:78},{n:'Coal 82% electricidad',v:'alta contamin.',risk:88},{n:'Estrés Hídrico',v:'alto',risk:72},{n:'Day zero riesgo',v:'Ciudad del Cabo',risk:75}]},social:{score:72,inds:[{n:'Desig. extrema',v:'Gini 0.63',risk:95},{n:'Violencia de género',v:'muy alta',risk:85},{n:'Pobreza',v:'55%',risk:82},{n:'Tierra distribución',v:'pendiente',risk:82}]},tech:{score:45,inds:[{n:'Fintech hub',v:'Johannesburgo',risk:28},{n:'Brecha digital',v:'alta',risk:65},{n:'Infraestr. TIC',v:'media',risk:55},{n:'Startups',v:'creciendo',risk:35}]},food:{score:48,inds:[{n:'Autosuficiencia',v:'media',risk:48},{n:'Sequía impacto',v:'alto',risk:72},{n:'Hambre crónica',v:'10%',risk:65},{n:'Tierra productiva',v:'desigual',risk:72}]},mental:{score:58,inds:[{n:'Trauma violencia',v:'muy alto',risk:82},{n:'Depresión',v:'alta',risk:68},{n:'Recursos',v:'insuficientes',risk:85},{n:'Suicidio /100k',v:'11.4',risk:65}]},energy:{score:72,inds:[{n:'Eskom crisis',v:'apagones 10h/día',risk:95},{n:'Coal 82% mix',v:'alta contamin.',risk:88},{n:'Renovables',v:'12% creciendo',risk:42},{n:'Inversión energía',v:'insuficiente',risk:78}]},demo:{score:42,inds:[{n:'Crecim. poblac.',v:'+1.4%',risk:45},{n:'Jóvenes 15-35',v:'34%',risk:28},{n:'Emigración talento',v:'alta',risk:68},{n:'Urbanización',v:'67%',risk:52}]},urban:{score:65,inds:[{n:'Township pobreza',v:'masiva',risk:85},{n:'Saneamiento',v:'deficiente',risk:75},{n:'Apagones infra.',v:'crítica',risk:88},{n:'Crimen urbano',v:'muy alto',risk:82}]},science:{score:48,inds:[{n:'Inversión I+D',v:'0.6% PIB',risk:65},{n:'Brain drain',v:'alta',risk:78},{n:'UCT/Wits',v:'líderes África',risk:28},{n:'Ciencia aplicada',v:'media',risk:52}]},justice:{score:62,inds:[{n:'Corrupción state cap.',v:'alta',risk:82},{n:'Violencia de género',v:'alta',risk:85},{n:'Impunidad',v:'alta',risk:78},{n:'Sistema judicial',v:'independiente',risk:38}]},finance:{score:58,inds:[{n:'Rand volatilidad',v:'alta',risk:65},{n:'Deuda pública',v:'69% PIB',risk:62},{n:'Rating junk',v:'Moody/S&P',risk:72},{n:'Inversión extran.',v:'baja',risk:68}]},ocean:{score:35,inds:[{n:'Cabo de Buena Esp.',v:'biodiversidad',risk:18},{n:'Pesca industrial',v:'sostenible',risk:32},{n:'Costas prístinas',v:'biodiversidad',risk:22},{n:'Ruta marítima',v:'estratégica',risk:28}]},bio:{score:52,inds:[{n:'GHS Index',v:'47.5/100',risk:55},{n:'VIH gestión',v:'programa activo',risk:42},{n:'Mpox activo',v:'endémico',risk:65},{n:'Vigilancia epidem.',v:'media',risk:52}]}},
PAK:{name:'Pakistán',eco:{score:72,inds:[{n:'PIB Crecimiento',v:'2.0%',risk:58},{n:'Inflación',v:'29%',risk:88},{n:'Deuda externa',v:'crítica',risk:85},{n:'FMI rescate',v:'dependiente',risk:82}]},geo:{score:78,inds:[{n:'Tensión India',v:'nuclear',risk:88},{n:'Afganistán frontera',v:'inestable',risk:82},{n:'TTP terrorismo',v:'activo',risk:78},{n:'Armas nucleares',v:'~170 ojivas',risk:85}]},health:{score:58,inds:[{n:'Esperanza Vida',v:'67.1 años',risk:62},{n:'Mort. Infantil',v:'55/1k',risk:78},{n:'Polio residual',v:'activo',risk:72},{n:'Cobertura Sanitaria',v:'52%',risk:68}]},climate:{score:75,inds:[{n:'Inundaciones 2022',v:'33% territorio',risk:92},{n:'Glaciares fusión',v:'3000 en riesgo',risk:85},{n:'Calor extremo',v:'récords',risk:82},{n:'Estrés Hídrico',v:'muy alto',risk:78}]},social:{score:70,inds:[{n:'Pobreza extrema',v:'24%',risk:75},{n:'Desig. género',v:'muy alta',risk:88},{n:'Tensiones étnicas',v:'altas',risk:72},{n:'Desplazados intern.',v:'millones',risk:75}]},tech:{score:52,inds:[{n:'IT exportaciones',v:'creciendo',risk:35},{n:'Brecha digital',v:'40%',risk:65},{n:'Censura internet',v:'alta',risk:72},{n:'Infraestr. TIC',v:'deficiente',risk:65}]},food:{score:60,inds:[{n:'Inseguridad alim.',v:'36%',risk:78},{n:'Inundaciones agríc.',v:'devastadoras',risk:88},{n:'Importaciones',v:'dependiente',risk:72},{n:'Sequías norte',v:'frecuentes',risk:75}]},mental:{score:62,inds:[{n:'Trauma colectivo',v:'alto',risk:75},{n:'Recursos',v:'muy escasos',risk:88},{n:'Estigma mental',v:'muy alto',risk:85},{n:'Suicidio /100k',v:'3.1',risk:30}]},energy:{score:65,inds:[{n:'Apagones crónicos',v:'12h/día',risk:82},{n:'Deuda energética',v:'circular',risk:78},{n:'China CPEC',v:'deuda',risk:72},{n:'Renovables',v:'crecimiento',risk:48}]},demo:{score:48,inds:[{n:'Crecim. poblac.',v:'+2.0%',risk:52},{n:'Fertilidad',v:'3.3 hijos',risk:48},{n:'Jóvenes 60%',v:'<30 años',risk:28},{n:'Urbanización',v:'37%',risk:55}]},urban:{score:65,inds:[{n:'Karachi 15M',v:'infra. deficiente',risk:78},{n:'Saneamiento',v:'muy deficiente',risk:82},{n:'Contam. Lahore',v:'peor mundial',risk:85},{n:'Inundaciones urb.',v:'frecuentes',risk:78}]},science:{score:62,inds:[{n:'Inversión I+D',v:'0.2% PIB',risk:85},{n:'Brain drain',v:'masivo',risk:88},{n:'Programa nuclear',v:'activo',risk:72},{n:'Talento potencial',v:'no capturado',risk:55}]},justice:{score:72,inds:[{n:'Corrupción',v:'alta',risk:78},{n:'Blasfemia ley',v:'pena muerte',risk:85},{n:'Derechos mujer',v:'bajos',risk:82},{n:'Independ. judicial',v:'limitada',risk:72}]},finance:{score:75,inds:[{n:'Reservas divisas',v:'mínimas',risk:88},{n:'Deuda externa',v:'crítica',risk:85},{n:'Rupia devaluación',v:'masiva',risk:82},{n:'China CPEC deuda',v:'alta',risk:72}]},ocean:{score:45,inds:[{n:'Mar Arábigo costas',v:'contaminadas',risk:65},{n:'Manglares pérdida',v:'alta',risk:68},{n:'Pesca artesanal',v:'amenazada',risk:62},{n:'Inundaciones cost.',v:'riesgo',risk:72}]},bio:{score:62,inds:[{n:'GHS Index',v:'35.5/100',risk:65},{n:'Polio activo',v:'endémico',risk:72},{n:'Dengue/Cólera',v:'activos',risk:68},{n:'Vigilancia epidem.',v:'deficiente',risk:72}]}},
EGY:{name:'Egipto',eco:{score:65,inds:[{n:'PIB Crecimiento',v:'3.8%',risk:52},{n:'Inflación',v:'38%',risk:92},{n:'Deuda externa',v:'alta',risk:78},{n:'FMI rescates',v:'múltiples',risk:75}]},geo:{score:58,inds:[{n:'Sinaí terrorismo',v:'moderado',risk:62},{n:'Libia frontera',v:'inestable',risk:58},{n:'Nilo disputa',v:'Etiopía tensión',risk:72},{n:'Sudán crisis',v:'frontera',risk:55}]},health:{score:48,inds:[{n:'Esperanza Vida',v:'72.1 años',risk:48},{n:'Cobertura Sanitaria',v:'62%',risk:58},{n:'Mort. Infantil',v:'17/1k',risk:55},{n:'Hepatitis C',v:'alta prevalencia',risk:65}]},climate:{score:68,inds:[{n:'Delta Nilo',v:'subida mar',risk:82},{n:'Calor extremo',v:'récords',risk:78},{n:'Estrés Hídrico',v:'extremo',risk:88},{n:'Desertificación',v:'avanzando',risk:72}]},social:{score:62,inds:[{n:'Libertades civiles',v:'muy bajas',risk:85},{n:'Pobreza',v:'29.7%',risk:72},{n:'Desempleo jóvenes',v:'22%',risk:68},{n:'Desig. (Gini)',v:'0.32',risk:42}]},tech:{score:48,inds:[{n:'Digital hub MENA',v:'El Cairo',risk:28},{n:'Brecha digital',v:'40%',risk:62},{n:'Cibervigilancia',v:'alta',risk:72},{n:'Startups',v:'creciendo',risk:35}]},food:{score:62,inds:[{n:'Importaciones trigo',v:'nº1 mundial',risk:88},{n:'Subsidios pan',v:'insostenibles',risk:72},{n:'Nilo depend. agua',v:'100%',risk:85},{n:'Autosuficiencia',v:'baja',risk:78}]},mental:{score:52,inds:[{n:'Depresión',v:'alta',risk:62},{n:'Estigma mental',v:'muy alto',risk:82},{n:'Recursos',v:'insuficientes',risk:78},{n:'Suicidio /100k',v:'3.4',risk:32}]},energy:{score:42,inds:[{n:'Gas Zohr',v:'exportador',risk:22},{n:'Renovables solar',v:'desierto',risk:32},{n:'Subsidios energía',v:'insostenibles',risk:72},{n:'Electricidad acceso',v:'99%',risk:18}]},demo:{score:42,inds:[{n:'Crecim. poblac.',v:'+1.9%',risk:48},{n:'Jóvenes 60%',v:'<30 años',risk:35},{n:'Urbanización',v:'43%',risk:52},{n:'Cairo 21M',v:'megalópolis',risk:58}]},urban:{score:58,inds:[{n:'Cairo contaminación',v:'severa',risk:75},{n:'Saneamiento',v:'deficiente',risk:68},{n:'Infra. deteriorada',v:'alta',risk:65},{n:'Informalidad urb.',v:'alta',risk:72}]},science:{score:52,inds:[{n:'Inversión I+D',v:'0.7% PIB',risk:68},{n:'Brain drain',v:'alta',risk:78},{n:'El Cairo universidad',v:'antigua',risk:42},{n:'Talento potencial',v:'alto',risk:32}]},justice:{score:72,inds:[{n:'Presos políticos',v:'60k estimados',risk:88},{n:'Libertad prensa',v:'muy baja',risk:85},{n:'Derechos LGTB+',v:'criminalizados',risk:88},{n:'Independ. judicial',v:'baja',risk:75}]},finance:{score:68,inds:[{n:'Libra egipcia',v:'devaluación masiva',risk:85},{n:'Inflación 38%',v:'crónica',risk:92},{n:'Deuda externa',v:'alta',risk:78},{n:'Reservas FX',v:'bajas',risk:72}]},ocean:{score:45,inds:[{n:'Mar Rojo comercio',v:'estratégico',risk:45},{n:'Coral Mar Rojo',v:'blanqueado',risk:68},{n:'Mediterráneo costas',v:'contaminadas',risk:62},{n:'Pesca declining',v:'moderado',risk:55}]},bio:{score:48,inds:[{n:'GHS Index',v:'43.8/100',risk:55},{n:'Hepatitis C prog.',v:'activo',risk:42},{n:'Vigilancia epidem.',v:'media',risk:55},{n:'Preparación',v:'media',risk:52}]}},
// ── COBERTURA MUNDIAL ──
NOR:{name:'Noruega',flag:'🇳🇴',
    eco:{score:20,inds:[]},geo:{score:18,inds:[]},health:{score:10,inds:[]},
    climate:{score:35,inds:[]},social:{score:12,inds:[]},tech:{score:18,inds:[]},
    food:{score:10,inds:[]},mental:{score:38,inds:[]},energy:{score:22,inds:[]},
    demo:{score:45,inds:[]},urban:{score:20,inds:[]},science:{score:18,inds:[]},
    justice:{score:12,inds:[]},finance:{score:20,inds:[]},ocean:{score:25,inds:[]},
    bio:{score:18,inds:[]}},
SWE:{name:'Suecia',flag:'🇸🇪',
    eco:{score:22,inds:[]},geo:{score:20,inds:[]},health:{score:12,inds:[]},
    climate:{score:38,inds:[]},social:{score:18,inds:[]},tech:{score:20,inds:[]},
    food:{score:12,inds:[]},mental:{score:42,inds:[]},energy:{score:25,inds:[]},
    demo:{score:52,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:14,inds:[]},finance:{score:22,inds:[]},ocean:{score:28,inds:[]},
    bio:{score:20,inds:[]}},
DNK:{name:'Dinamarca',flag:'🇩🇰',
    eco:{score:22,inds:[]},geo:{score:18,inds:[]},health:{score:12,inds:[]},
    climate:{score:35,inds:[]},social:{score:15,inds:[]},tech:{score:18,inds:[]},
    food:{score:12,inds:[]},mental:{score:38,inds:[]},energy:{score:22,inds:[]},
    demo:{score:50,inds:[]},urban:{score:20,inds:[]},science:{score:18,inds:[]},
    justice:{score:12,inds:[]},finance:{score:20,inds:[]},ocean:{score:25,inds:[]},
    bio:{score:18,inds:[]}},
FIN:{name:'Finlandia',flag:'🇫🇮',
    eco:{score:20,inds:[]},geo:{score:22,inds:[]},health:{score:12,inds:[]},
    climate:{score:38,inds:[]},social:{score:15,inds:[]},tech:{score:20,inds:[]},
    food:{score:12,inds:[]},mental:{score:40,inds:[]},energy:{score:22,inds:[]},
    demo:{score:48,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:12,inds:[]},finance:{score:20,inds:[]},ocean:{score:25,inds:[]},
    bio:{score:20,inds:[]}},
ISL:{name:'Islandia',flag:'🇮🇸',
    eco:{score:18,inds:[]},geo:{score:15,inds:[]},health:{score:10,inds:[]},
    climate:{score:45,inds:[]},social:{score:12,inds:[]},tech:{score:18,inds:[]},
    food:{score:15,inds:[]},mental:{score:35,inds:[]},energy:{score:28,inds:[]},
    demo:{score:35,inds:[]},urban:{score:18,inds:[]},science:{score:15,inds:[]},
    justice:{score:12,inds:[]},finance:{score:18,inds:[]},ocean:{score:22,inds:[]},
    bio:{score:18,inds:[]}},
CHE:{name:'Suiza',flag:'🇨🇭',
    eco:{score:25,inds:[]},geo:{score:18,inds:[]},health:{score:12,inds:[]},
    climate:{score:32,inds:[]},social:{score:18,inds:[]},tech:{score:22,inds:[]},
    food:{score:12,inds:[]},mental:{score:38,inds:[]},energy:{score:22,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:18,inds:[]},
    justice:{score:12,inds:[]},finance:{score:18,inds:[]},ocean:{score:25,inds:[]},
    bio:{score:18,inds:[]}},
AUT:{name:'Austria',flag:'🇦🇹',
    eco:{score:28,inds:[]},geo:{score:20,inds:[]},health:{score:15,inds:[]},
    climate:{score:38,inds:[]},social:{score:20,inds:[]},tech:{score:22,inds:[]},
    food:{score:15,inds:[]},mental:{score:42,inds:[]},energy:{score:25,inds:[]},
    demo:{score:45,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:15,inds:[]},finance:{score:22,inds:[]},ocean:{score:28,inds:[]},
    bio:{score:20,inds:[]}},
NLD:{name:'Países Bajos',flag:'🇳🇱',
    eco:{score:30,inds:[]},geo:{score:18,inds:[]},health:{score:15,inds:[]},
    climate:{score:52,inds:[]},social:{score:22,inds:[]},tech:{score:20,inds:[]},
    food:{score:18,inds:[]},mental:{score:40,inds:[]},energy:{score:28,inds:[]},
    demo:{score:42,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:15,inds:[]},finance:{score:20,inds:[]},ocean:{score:30,inds:[]},
    bio:{score:20,inds:[]}},
BEL:{name:'Bélgica',flag:'🇧🇪',
    eco:{score:32,inds:[]},geo:{score:22,inds:[]},health:{score:15,inds:[]},
    climate:{score:40,inds:[]},social:{score:25,inds:[]},tech:{score:20,inds:[]},
    food:{score:18,inds:[]},mental:{score:42,inds:[]},energy:{score:28,inds:[]},
    demo:{score:42,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:15,inds:[]},finance:{score:22,inds:[]},ocean:{score:30,inds:[]},
    bio:{score:20,inds:[]}},
DEU:{name:'Alemania',flag:'🇩🇪',
    eco:{score:35,inds:[]},geo:{score:22,inds:[]},health:{score:18,inds:[]},
    climate:{score:42,inds:[]},social:{score:28,inds:[]},tech:{score:22,inds:[]},
    food:{score:18,inds:[]},mental:{score:42,inds:[]},energy:{score:30,inds:[]},
    demo:{score:48,inds:[]},urban:{score:25,inds:[]},science:{score:20,inds:[]},
    justice:{score:18,inds:[]},finance:{score:22,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:22,inds:[]}},
FRA:{name:'Francia',flag:'🇫🇷',
    eco:{score:38,inds:[]},geo:{score:28,inds:[]},health:{score:18,inds:[]},
    climate:{score:45,inds:[]},social:{score:32,inds:[]},tech:{score:22,inds:[]},
    food:{score:20,inds:[]},mental:{score:45,inds:[]},energy:{score:30,inds:[]},
    demo:{score:42,inds:[]},urban:{score:25,inds:[]},science:{score:20,inds:[]},
    justice:{score:18,inds:[]},finance:{score:25,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:25,inds:[]}},
ITA:{name:'Italia',flag:'🇮🇹',
    eco:{score:45,inds:[]},geo:{score:30,inds:[]},health:{score:22,inds:[]},
    climate:{score:52,inds:[]},social:{score:35,inds:[]},tech:{score:28,inds:[]},
    food:{score:22,inds:[]},mental:{score:48,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:25,inds:[]},
    justice:{score:20,inds:[]},finance:{score:30,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:28,inds:[]}},
PRT:{name:'Portugal',flag:'🇵🇹',
    eco:{score:38,inds:[]},geo:{score:22,inds:[]},health:{score:18,inds:[]},
    climate:{score:55,inds:[]},social:{score:28,inds:[]},tech:{score:28,inds:[]},
    food:{score:22,inds:[]},mental:{score:45,inds:[]},energy:{score:32,inds:[]},
    demo:{score:40,inds:[]},urban:{score:28,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:28,inds:[]}},
GRC:{name:'Grecia',flag:'🇬🇷',
    eco:{score:52,inds:[]},geo:{score:28,inds:[]},health:{score:22,inds:[]},
    climate:{score:58,inds:[]},social:{score:32,inds:[]},tech:{score:30,inds:[]},
    food:{score:25,inds:[]},mental:{score:50,inds:[]},energy:{score:35,inds:[]},
    demo:{score:38,inds:[]},urban:{score:30,inds:[]},science:{score:25,inds:[]},
    justice:{score:22,inds:[]},finance:{score:32,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:30,inds:[]}},
CZE:{name:'República Checa',flag:'🇨🇿',
    eco:{score:32,inds:[]},geo:{score:25,inds:[]},health:{score:18,inds:[]},
    climate:{score:42,inds:[]},social:{score:25,inds:[]},tech:{score:25,inds:[]},
    food:{score:18,inds:[]},mental:{score:42,inds:[]},energy:{score:28,inds:[]},
    demo:{score:42,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:15,inds:[]},finance:{score:25,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:22,inds:[]}},
SVK:{name:'Eslovaquia',flag:'🇸🇰',
    eco:{score:35,inds:[]},geo:{score:28,inds:[]},health:{score:20,inds:[]},
    climate:{score:42,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:20,inds:[]},mental:{score:45,inds:[]},energy:{score:30,inds:[]},
    demo:{score:42,inds:[]},urban:{score:25,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:22,inds:[]}},
HUN:{name:'Hungría',flag:'🇭🇺',
    eco:{score:42,inds:[]},geo:{score:35,inds:[]},health:{score:22,inds:[]},
    climate:{score:42,inds:[]},social:{score:38,inds:[]},tech:{score:28,inds:[]},
    food:{score:22,inds:[]},mental:{score:48,inds:[]},energy:{score:32,inds:[]},
    demo:{score:45,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:20,inds:[]},finance:{score:35,inds:[]},ocean:{score:40,inds:[]},
    bio:{score:25,inds:[]}},
ROU:{name:'Rumanía',flag:'🇷🇴',
    eco:{score:42,inds:[]},geo:{score:30,inds:[]},health:{score:25,inds:[]},
    climate:{score:45,inds:[]},social:{score:35,inds:[]},tech:{score:28,inds:[]},
    food:{score:25,inds:[]},mental:{score:50,inds:[]},energy:{score:32,inds:[]},
    demo:{score:45,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:20,inds:[]},finance:{score:35,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
BGR:{name:'Bulgaria',flag:'🇧🇬',
    eco:{score:45,inds:[]},geo:{score:30,inds:[]},health:{score:25,inds:[]},
    climate:{score:48,inds:[]},social:{score:38,inds:[]},tech:{score:30,inds:[]},
    food:{score:25,inds:[]},mental:{score:52,inds:[]},energy:{score:32,inds:[]},
    demo:{score:45,inds:[]},urban:{score:30,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:38,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
HRV:{name:'Croacia',flag:'🇭🇷',
    eco:{score:38,inds:[]},geo:{score:25,inds:[]},health:{score:20,inds:[]},
    climate:{score:45,inds:[]},social:{score:28,inds:[]},tech:{score:28,inds:[]},
    food:{score:20,inds:[]},mental:{score:45,inds:[]},energy:{score:30,inds:[]},
    demo:{score:40,inds:[]},urban:{score:25,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:25,inds:[]}},
SRB:{name:'Serbia',flag:'🇷🇸',
    eco:{score:45,inds:[]},geo:{score:35,inds:[]},health:{score:25,inds:[]},
    climate:{score:45,inds:[]},social:{score:35,inds:[]},tech:{score:30,inds:[]},
    food:{score:25,inds:[]},mental:{score:48,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:35,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
BIH:{name:'Bosnia-Herz.',flag:'🇧🇦',
    eco:{score:48,inds:[]},geo:{score:42,inds:[]},health:{score:28,inds:[]},
    climate:{score:45,inds:[]},social:{score:42,inds:[]},tech:{score:32,inds:[]},
    food:{score:28,inds:[]},mental:{score:52,inds:[]},energy:{score:35,inds:[]},
    demo:{score:42,inds:[]},urban:{score:30,inds:[]},science:{score:30,inds:[]},
    justice:{score:25,inds:[]},finance:{score:40,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:30,inds:[]}},
MKD:{name:'Macedonia del N.',flag:'🇲🇰',
    eco:{score:45,inds:[]},geo:{score:38,inds:[]},health:{score:25,inds:[]},
    climate:{score:45,inds:[]},social:{score:38,inds:[]},tech:{score:30,inds:[]},
    food:{score:25,inds:[]},mental:{score:50,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:38,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
ALB:{name:'Albania',flag:'🇦🇱',
    eco:{score:45,inds:[]},geo:{score:35,inds:[]},health:{score:28,inds:[]},
    climate:{score:48,inds:[]},social:{score:38,inds:[]},tech:{score:30,inds:[]},
    food:{score:28,inds:[]},mental:{score:52,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:38,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
MNE:{name:'Montenegro',flag:'🇲🇪',
    eco:{score:42,inds:[]},geo:{score:32,inds:[]},health:{score:25,inds:[]},
    climate:{score:45,inds:[]},social:{score:35,inds:[]},tech:{score:28,inds:[]},
    food:{score:25,inds:[]},mental:{score:48,inds:[]},energy:{score:30,inds:[]},
    demo:{score:40,inds:[]},urban:{score:25,inds:[]},science:{score:28,inds:[]},
    justice:{score:20,inds:[]},finance:{score:35,inds:[]},ocean:{score:40,inds:[]},
    bio:{score:25,inds:[]}},
SVN:{name:'Eslovenia',flag:'🇸🇮',
    eco:{score:28,inds:[]},geo:{score:20,inds:[]},health:{score:15,inds:[]},
    climate:{score:40,inds:[]},social:{score:22,inds:[]},tech:{score:22,inds:[]},
    food:{score:15,inds:[]},mental:{score:40,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:15,inds:[]},finance:{score:22,inds:[]},ocean:{score:30,inds:[]},
    bio:{score:22,inds:[]}},
LTU:{name:'Lituania',flag:'🇱🇹',
    eco:{score:32,inds:[]},geo:{score:28,inds:[]},health:{score:18,inds:[]},
    climate:{score:42,inds:[]},social:{score:25,inds:[]},tech:{score:25,inds:[]},
    food:{score:18,inds:[]},mental:{score:42,inds:[]},energy:{score:28,inds:[]},
    demo:{score:40,inds:[]},urban:{score:22,inds:[]},science:{score:25,inds:[]},
    justice:{score:15,inds:[]},finance:{score:25,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:22,inds:[]}},
LVA:{name:'Letonia',flag:'🇱🇻',
    eco:{score:35,inds:[]},geo:{score:28,inds:[]},health:{score:20,inds:[]},
    climate:{score:42,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:20,inds:[]},mental:{score:45,inds:[]},energy:{score:28,inds:[]},
    demo:{score:40,inds:[]},urban:{score:25,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:22,inds:[]}},
EST:{name:'Estonia',flag:'🇪🇪',
    eco:{score:28,inds:[]},geo:{score:25,inds:[]},health:{score:15,inds:[]},
    climate:{score:38,inds:[]},social:{score:22,inds:[]},tech:{score:22,inds:[]},
    food:{score:15,inds:[]},mental:{score:38,inds:[]},energy:{score:25,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:12,inds:[]},finance:{score:22,inds:[]},ocean:{score:28,inds:[]},
    bio:{score:20,inds:[]}},
BLR:{name:'Bielorrusia',flag:'🇧🇾',
    eco:{score:55,inds:[]},geo:{score:65,inds:[]},health:{score:35,inds:[]},
    climate:{score:42,inds:[]},social:{score:58,inds:[]},tech:{score:55,inds:[]},
    food:{score:30,inds:[]},mental:{score:52,inds:[]},energy:{score:38,inds:[]},
    demo:{score:42,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:28,inds:[]},finance:{score:58,inds:[]},ocean:{score:52,inds:[]},
    bio:{score:35,inds:[]}},
MDA:{name:'Moldavia',flag:'🇲🇩',
    eco:{score:55,inds:[]},geo:{score:48,inds:[]},health:{score:32,inds:[]},
    climate:{score:45,inds:[]},social:{score:45,inds:[]},tech:{score:38,inds:[]},
    food:{score:30,inds:[]},mental:{score:52,inds:[]},energy:{score:35,inds:[]},
    demo:{score:42,inds:[]},urban:{score:32,inds:[]},science:{score:32,inds:[]},
    justice:{score:25,inds:[]},finance:{score:42,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:30,inds:[]}},
GEO:{name:'Georgia',flag:'🇬🇪',
    eco:{score:45,inds:[]},geo:{score:52,inds:[]},health:{score:28,inds:[]},
    climate:{score:45,inds:[]},social:{score:38,inds:[]},tech:{score:32,inds:[]},
    food:{score:25,inds:[]},mental:{score:48,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:20,inds:[]},finance:{score:35,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
ARM:{name:'Armenia',flag:'🇦🇲',
    eco:{score:48,inds:[]},geo:{score:55,inds:[]},health:{score:28,inds:[]},
    climate:{score:48,inds:[]},social:{score:42,inds:[]},tech:{score:32,inds:[]},
    food:{score:28,inds:[]},mental:{score:50,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:30,inds:[]},
    justice:{score:22,inds:[]},finance:{score:38,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:28,inds:[]}},
AZE:{name:'Azerbaiyán',flag:'🇦🇿',
    eco:{score:48,inds:[]},geo:{score:58,inds:[]},health:{score:30,inds:[]},
    climate:{score:48,inds:[]},social:{score:45,inds:[]},tech:{score:38,inds:[]},
    food:{score:28,inds:[]},mental:{score:50,inds:[]},energy:{score:35,inds:[]},
    demo:{score:42,inds:[]},urban:{score:30,inds:[]},science:{score:30,inds:[]},
    justice:{score:22,inds:[]},finance:{score:42,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:30,inds:[]}},
KOS:{name:'Kosovo',flag:'🇽🇰',
    eco:{score:52,inds:[]},geo:{score:45,inds:[]},health:{score:30,inds:[]},
    climate:{score:45,inds:[]},social:{score:42,inds:[]},tech:{score:32,inds:[]},
    food:{score:28,inds:[]},mental:{score:52,inds:[]},energy:{score:32,inds:[]},
    demo:{score:40,inds:[]},urban:{score:28,inds:[]},science:{score:32,inds:[]},
    justice:{score:25,inds:[]},finance:{score:42,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:28,inds:[]}},
LIE:{name:'Liechtenstein',flag:'🇱🇮',
    eco:{score:18,inds:[]},geo:{score:15,inds:[]},health:{score:10,inds:[]},
    climate:{score:30,inds:[]},social:{score:12,inds:[]},tech:{score:18,inds:[]},
    food:{score:10,inds:[]},mental:{score:28,inds:[]},energy:{score:18,inds:[]},
    demo:{score:25,inds:[]},urban:{score:15,inds:[]},science:{score:15,inds:[]},
    justice:{score:8,inds:[]},finance:{score:15,inds:[]},ocean:{score:18,inds:[]},
    bio:{score:15,inds:[]}},
LUX:{name:'Luxemburgo',flag:'🇱🇺',
    eco:{score:20,inds:[]},geo:{score:15,inds:[]},health:{score:12,inds:[]},
    climate:{score:38,inds:[]},social:{score:15,inds:[]},tech:{score:18,inds:[]},
    food:{score:12,inds:[]},mental:{score:32,inds:[]},energy:{score:22,inds:[]},
    demo:{score:32,inds:[]},urban:{score:18,inds:[]},science:{score:18,inds:[]},
    justice:{score:10,inds:[]},finance:{score:18,inds:[]},ocean:{score:22,inds:[]},
    bio:{score:18,inds:[]}},
MCO:{name:'Mónaco',flag:'🇲🇨',
    eco:{score:18,inds:[]},geo:{score:14,inds:[]},health:{score:10,inds:[]},
    climate:{score:38,inds:[]},social:{score:12,inds:[]},tech:{score:16,inds:[]},
    food:{score:10,inds:[]},mental:{score:28,inds:[]},energy:{score:20,inds:[]},
    demo:{score:28,inds:[]},urban:{score:14,inds:[]},science:{score:15,inds:[]},
    justice:{score:8,inds:[]},finance:{score:15,inds:[]},ocean:{score:18,inds:[]},
    bio:{score:14,inds:[]}},
AND:{name:'Andorra',flag:'🇦🇩',
    eco:{score:20,inds:[]},geo:{score:15,inds:[]},health:{score:10,inds:[]},
    climate:{score:35,inds:[]},social:{score:12,inds:[]},tech:{score:18,inds:[]},
    food:{score:10,inds:[]},mental:{score:28,inds:[]},energy:{score:18,inds:[]},
    demo:{score:28,inds:[]},urban:{score:15,inds:[]},science:{score:15,inds:[]},
    justice:{score:8,inds:[]},finance:{score:15,inds:[]},ocean:{score:20,inds:[]},
    bio:{score:15,inds:[]}},
SMR:{name:'San Marino',flag:'🇸🇲',
    eco:{score:18,inds:[]},geo:{score:14,inds:[]},health:{score:10,inds:[]},
    climate:{score:32,inds:[]},social:{score:12,inds:[]},tech:{score:16,inds:[]},
    food:{score:10,inds:[]},mental:{score:28,inds:[]},energy:{score:18,inds:[]},
    demo:{score:25,inds:[]},urban:{score:14,inds:[]},science:{score:15,inds:[]},
    justice:{score:8,inds:[]},finance:{score:15,inds:[]},ocean:{score:18,inds:[]},
    bio:{score:14,inds:[]}},
MKD2:{name:'North Macedonia',flag:'🇲🇰',
    eco:{score:45,inds:[]},geo:{score:38,inds:[]},health:{score:25,inds:[]},
    climate:{score:45,inds:[]},social:{score:38,inds:[]},tech:{score:30,inds:[]},
    food:{score:25,inds:[]},mental:{score:50,inds:[]},energy:{score:32,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:38,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
KAZ:{name:'Kazajistán',flag:'🇰🇿',
    eco:{score:48,inds:[]},geo:{score:45,inds:[]},health:{score:35,inds:[]},
    climate:{score:55,inds:[]},social:{score:45,inds:[]},tech:{score:38,inds:[]},
    food:{score:35,inds:[]},mental:{score:50,inds:[]},energy:{score:42,inds:[]},
    demo:{score:35,inds:[]},urban:{score:32,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:42,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:35,inds:[]}},
UZB:{name:'Uzbekistán',flag:'🇺🇿',
    eco:{score:52,inds:[]},geo:{score:50,inds:[]},health:{score:40,inds:[]},
    climate:{score:58,inds:[]},social:{score:50,inds:[]},tech:{score:42,inds:[]},
    food:{score:38,inds:[]},mental:{score:52,inds:[]},energy:{score:45,inds:[]},
    demo:{score:38,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:30,inds:[]},finance:{score:48,inds:[]},ocean:{score:52,inds:[]},
    bio:{score:38,inds:[]}},
TKM:{name:'Turkmenistán',flag:'🇹🇲',
    eco:{score:52,inds:[]},geo:{score:68,inds:[]},health:{score:42,inds:[]},
    climate:{score:62,inds:[]},social:{score:62,inds:[]},tech:{score:48,inds:[]},
    food:{score:40,inds:[]},mental:{score:55,inds:[]},energy:{score:45,inds:[]},
    demo:{score:35,inds:[]},urban:{score:35,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:55,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:40,inds:[]}},
KGZ:{name:'Kirguistán',flag:'🇰🇬',
    eco:{score:55,inds:[]},geo:{score:52,inds:[]},health:{score:42,inds:[]},
    climate:{score:58,inds:[]},social:{score:52,inds:[]},tech:{score:42,inds:[]},
    food:{score:38,inds:[]},mental:{score:55,inds:[]},energy:{score:45,inds:[]},
    demo:{score:40,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:30,inds:[]},finance:{score:50,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:40,inds:[]}},
TJK:{name:'Tayikistán',flag:'🇹🇯',
    eco:{score:60,inds:[]},geo:{score:52,inds:[]},health:{score:48,inds:[]},
    climate:{score:62,inds:[]},social:{score:55,inds:[]},tech:{score:45,inds:[]},
    food:{score:45,inds:[]},mental:{score:58,inds:[]},energy:{score:48,inds:[]},
    demo:{score:42,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:35,inds:[]},finance:{score:52,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:42,inds:[]}},
MNG:{name:'Mongolia',flag:'🇲🇳',
    eco:{score:48,inds:[]},geo:{score:38,inds:[]},health:{score:35,inds:[]},
    climate:{score:62,inds:[]},social:{score:42,inds:[]},tech:{score:35,inds:[]},
    food:{score:38,inds:[]},mental:{score:50,inds:[]},energy:{score:45,inds:[]},
    demo:{score:40,inds:[]},urban:{score:30,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:38,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:35,inds:[]}},
AFG:{name:'Afganistán',flag:'🇦🇫',
    eco:{score:85,inds:[]},geo:{score:92,inds:[]},health:{score:78,inds:[]},
    climate:{score:72,inds:[]},social:{score:88,inds:[]},tech:{score:72,inds:[]},
    food:{score:82,inds:[]},mental:{score:82,inds:[]},energy:{score:68,inds:[]},
    demo:{score:55,inds:[]},urban:{score:68,inds:[]},science:{score:62,inds:[]},
    justice:{score:55,inds:[]},finance:{score:88,inds:[]},ocean:{score:82,inds:[]},
    bio:{score:68,inds:[]}},
TWN:{name:'Taiwán',flag:'🇹🇼',
    eco:{score:35,inds:[]},geo:{score:72,inds:[]},health:{score:18,inds:[]},
    climate:{score:45,inds:[]},social:{score:32,inds:[]},tech:{score:22,inds:[]},
    food:{score:18,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:20,inds:[]},
    justice:{score:15,inds:[]},finance:{score:22,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:22,inds:[]}},
HKG:{name:'Hong Kong',flag:'🇭🇰',
    eco:{score:42,inds:[]},geo:{score:65,inds:[]},health:{score:15,inds:[]},
    climate:{score:45,inds:[]},social:{score:38,inds:[]},tech:{score:22,inds:[]},
    food:{score:15,inds:[]},mental:{score:40,inds:[]},energy:{score:25,inds:[]},
    demo:{score:35,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:12,inds:[]},finance:{score:22,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:18,inds:[]}},
MMR:{name:'Myanmar',flag:'🇲🇲',
    eco:{score:65,inds:[]},geo:{score:78,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:72,inds:[]},tech:{score:58,inds:[]},
    food:{score:62,inds:[]},mental:{score:65,inds:[]},energy:{score:58,inds:[]},
    demo:{score:52,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:48,inds:[]},finance:{score:68,inds:[]},ocean:{score:72,inds:[]},
    bio:{score:58,inds:[]}},
THA:{name:'Tailandia',flag:'🇹🇭',
    eco:{score:45,inds:[]},geo:{score:52,inds:[]},health:{score:38,inds:[]},
    climate:{score:58,inds:[]},social:{score:45,inds:[]},tech:{score:38,inds:[]},
    food:{score:35,inds:[]},mental:{score:48,inds:[]},energy:{score:40,inds:[]},
    demo:{score:48,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:28,inds:[]},finance:{score:42,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:38,inds:[]}},
VNM:{name:'Vietnam',flag:'🇻🇳',
    eco:{score:42,inds:[]},geo:{score:45,inds:[]},health:{score:35,inds:[]},
    climate:{score:58,inds:[]},social:{score:42,inds:[]},tech:{score:38,inds:[]},
    food:{score:35,inds:[]},mental:{score:48,inds:[]},energy:{score:38,inds:[]},
    demo:{score:48,inds:[]},urban:{score:32,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:40,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:38,inds:[]}},
KHM:{name:'Camboya',flag:'🇰🇭',
    eco:{score:58,inds:[]},geo:{score:50,inds:[]},health:{score:52,inds:[]},
    climate:{score:62,inds:[]},social:{score:55,inds:[]},tech:{score:52,inds:[]},
    food:{score:50,inds:[]},mental:{score:58,inds:[]},energy:{score:48,inds:[]},
    demo:{score:52,inds:[]},urban:{score:42,inds:[]},science:{score:42,inds:[]},
    justice:{score:38,inds:[]},finance:{score:52,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:48,inds:[]}},
LAO:{name:'Laos',flag:'🇱🇦',
    eco:{score:58,inds:[]},geo:{score:52,inds:[]},health:{score:52,inds:[]},
    climate:{score:62,inds:[]},social:{score:55,inds:[]},tech:{score:52,inds:[]},
    food:{score:50,inds:[]},mental:{score:58,inds:[]},energy:{score:48,inds:[]},
    demo:{score:52,inds:[]},urban:{score:42,inds:[]},science:{score:42,inds:[]},
    justice:{score:38,inds:[]},finance:{score:52,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:48,inds:[]}},
MYS:{name:'Malasia',flag:'🇲🇾',
    eco:{score:40,inds:[]},geo:{score:42,inds:[]},health:{score:28,inds:[]},
    climate:{score:55,inds:[]},social:{score:38,inds:[]},tech:{score:32,inds:[]},
    food:{score:30,inds:[]},mental:{score:42,inds:[]},energy:{score:32,inds:[]},
    demo:{score:45,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:35,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:32,inds:[]}},
SGP:{name:'Singapur',flag:'🇸🇬',
    eco:{score:22,inds:[]},geo:{score:35,inds:[]},health:{score:12,inds:[]},
    climate:{score:45,inds:[]},social:{score:25,inds:[]},tech:{score:18,inds:[]},
    food:{score:12,inds:[]},mental:{score:28,inds:[]},energy:{score:18,inds:[]},
    demo:{score:25,inds:[]},urban:{score:18,inds:[]},science:{score:18,inds:[]},
    justice:{score:8,inds:[]},finance:{score:15,inds:[]},ocean:{score:22,inds:[]},
    bio:{score:18,inds:[]}},
BRN:{name:'Brunéi',flag:'🇧🇳',
    eco:{score:32,inds:[]},geo:{score:28,inds:[]},health:{score:18,inds:[]},
    climate:{score:45,inds:[]},social:{score:28,inds:[]},tech:{score:28,inds:[]},
    food:{score:20,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:25,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:15,inds:[]},finance:{score:28,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:22,inds:[]}},
PHL:{name:'Filipinas',flag:'🇵🇭',
    eco:{score:55,inds:[]},geo:{score:52,inds:[]},health:{score:48,inds:[]},
    climate:{score:72,inds:[]},social:{score:52,inds:[]},tech:{score:45,inds:[]},
    food:{score:50,inds:[]},mental:{score:58,inds:[]},energy:{score:45,inds:[]},
    demo:{score:52,inds:[]},urban:{score:42,inds:[]},science:{score:42,inds:[]},
    justice:{score:38,inds:[]},finance:{score:50,inds:[]},ocean:{score:52,inds:[]},
    bio:{score:58,inds:[]}},
IDN:{name:'Indonesia',flag:'🇮🇩',
    eco:{score:48,inds:[]},geo:{score:45,inds:[]},health:{score:42,inds:[]},
    climate:{score:68,inds:[]},social:{score:48,inds:[]},tech:{score:40,inds:[]},
    food:{score:42,inds:[]},mental:{score:50,inds:[]},energy:{score:40,inds:[]},
    demo:{score:52,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:45,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:52,inds:[]}},
TLS:{name:'Timor-Leste',flag:'🇹🇱',
    eco:{score:62,inds:[]},geo:{score:45,inds:[]},health:{score:55,inds:[]},
    climate:{score:65,inds:[]},social:{score:55,inds:[]},tech:{score:52,inds:[]},
    food:{score:55,inds:[]},mental:{score:60,inds:[]},energy:{score:52,inds:[]},
    demo:{score:52,inds:[]},urban:{score:48,inds:[]},science:{score:45,inds:[]},
    justice:{score:42,inds:[]},finance:{score:55,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:52,inds:[]}},
NPL:{name:'Nepal',flag:'🇳🇵',
    eco:{score:62,inds:[]},geo:{score:48,inds:[]},health:{score:52,inds:[]},
    climate:{score:68,inds:[]},social:{score:58,inds:[]},tech:{score:52,inds:[]},
    food:{score:55,inds:[]},mental:{score:58,inds:[]},energy:{score:52,inds:[]},
    demo:{score:52,inds:[]},urban:{score:48,inds:[]},science:{score:45,inds:[]},
    justice:{score:42,inds:[]},finance:{score:55,inds:[]},ocean:{score:60,inds:[]},
    bio:{score:52,inds:[]}},
BTN:{name:'Bután',flag:'🇧🇹',
    eco:{score:40,inds:[]},geo:{score:32,inds:[]},health:{score:38,inds:[]},
    climate:{score:58,inds:[]},social:{score:35,inds:[]},tech:{score:38,inds:[]},
    food:{score:35,inds:[]},mental:{score:42,inds:[]},energy:{score:38,inds:[]},
    demo:{score:42,inds:[]},urban:{score:30,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:38,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:35,inds:[]}},
BGD:{name:'Bangladesh',flag:'🇧🇩',
    eco:{score:62,inds:[]},geo:{score:48,inds:[]},health:{score:58,inds:[]},
    climate:{score:82,inds:[]},social:{score:58,inds:[]},tech:{score:52,inds:[]},
    food:{score:62,inds:[]},mental:{score:60,inds:[]},energy:{score:52,inds:[]},
    demo:{score:55,inds:[]},urban:{score:52,inds:[]},science:{score:45,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:60,inds:[]},
    bio:{score:58,inds:[]}},
LKA:{name:'Sri Lanka',flag:'🇱🇰',
    eco:{score:58,inds:[]},geo:{score:55,inds:[]},health:{score:35,inds:[]},
    climate:{score:62,inds:[]},social:{score:52,inds:[]},tech:{score:42,inds:[]},
    food:{score:42,inds:[]},mental:{score:52,inds:[]},energy:{score:40,inds:[]},
    demo:{score:48,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:38,inds:[]}},
MDV:{name:'Maldivas',flag:'🇲🇻',
    eco:{score:38,inds:[]},geo:{score:28,inds:[]},health:{score:22,inds:[]},
    climate:{score:72,inds:[]},social:{score:28,inds:[]},tech:{score:28,inds:[]},
    food:{score:25,inds:[]},mental:{score:38,inds:[]},energy:{score:35,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:58,inds:[]}},
YEM:{name:'Yemen',flag:'🇾🇪',
    eco:{score:88,inds:[]},geo:{score:95,inds:[]},health:{score:85,inds:[]},
    climate:{score:72,inds:[]},social:{score:88,inds:[]},tech:{score:72,inds:[]},
    food:{score:88,inds:[]},mental:{score:82,inds:[]},energy:{score:72,inds:[]},
    demo:{score:68,inds:[]},urban:{score:75,inds:[]},science:{score:68,inds:[]},
    justice:{score:62,inds:[]},finance:{score:85,inds:[]},ocean:{score:88,inds:[]},
    bio:{score:65,inds:[]}},
SYR:{name:'Siria',flag:'🇸🇾',
    eco:{score:85,inds:[]},geo:{score:95,inds:[]},health:{score:82,inds:[]},
    climate:{score:68,inds:[]},social:{score:88,inds:[]},tech:{score:72,inds:[]},
    food:{score:82,inds:[]},mental:{score:82,inds:[]},energy:{score:68,inds:[]},
    demo:{score:62,inds:[]},urban:{score:72,inds:[]},science:{score:65,inds:[]},
    justice:{score:58,inds:[]},finance:{score:85,inds:[]},ocean:{score:88,inds:[]},
    bio:{score:62,inds:[]}},
IRQ:{name:'Iraq',flag:'🇮🇶',
    eco:{score:72,inds:[]},geo:{score:78,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:72,inds:[]},tech:{score:62,inds:[]},
    food:{score:65,inds:[]},mental:{score:68,inds:[]},energy:{score:60,inds:[]},
    demo:{score:58,inds:[]},urban:{score:58,inds:[]},science:{score:52,inds:[]},
    justice:{score:48,inds:[]},finance:{score:72,inds:[]},ocean:{score:75,inds:[]},
    bio:{score:58,inds:[]}},
JOR:{name:'Jordania',flag:'🇯🇴',
    eco:{score:52,inds:[]},geo:{score:48,inds:[]},health:{score:38,inds:[]},
    climate:{score:58,inds:[]},social:{score:48,inds:[]},tech:{score:42,inds:[]},
    food:{score:50,inds:[]},mental:{score:50,inds:[]},energy:{score:42,inds:[]},
    demo:{score:48,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:42,inds:[]}},
LBN:{name:'Líbano',flag:'🇱🇧',
    eco:{score:82,inds:[]},geo:{score:78,inds:[]},health:{score:65,inds:[]},
    climate:{score:58,inds:[]},social:{score:72,inds:[]},tech:{score:58,inds:[]},
    food:{score:70,inds:[]},mental:{score:72,inds:[]},energy:{score:58,inds:[]},
    demo:{score:52,inds:[]},urban:{score:62,inds:[]},science:{score:55,inds:[]},
    justice:{score:48,inds:[]},finance:{score:72,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:52,inds:[]}},
PSE:{name:'Palestina',flag:'🇵🇸',
    eco:{score:85,inds:[]},geo:{score:92,inds:[]},health:{score:72,inds:[]},
    climate:{score:58,inds:[]},social:{score:82,inds:[]},tech:{score:65,inds:[]},
    food:{score:72,inds:[]},mental:{score:75,inds:[]},energy:{score:62,inds:[]},
    demo:{score:55,inds:[]},urban:{score:68,inds:[]},science:{score:62,inds:[]},
    justice:{score:55,inds:[]},finance:{score:78,inds:[]},ocean:{score:82,inds:[]},
    bio:{score:52,inds:[]}},
KWT:{name:'Kuwait',flag:'🇰🇼',
    eco:{score:35,inds:[]},geo:{score:45,inds:[]},health:{score:22,inds:[]},
    climate:{score:72,inds:[]},social:{score:42,inds:[]},tech:{score:28,inds:[]},
    food:{score:30,inds:[]},mental:{score:42,inds:[]},energy:{score:28,inds:[]},
    demo:{score:22,inds:[]},urban:{score:22,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:38,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:28,inds:[]}},
BHR:{name:'Baréin',flag:'🇧🇭',
    eco:{score:38,inds:[]},geo:{score:48,inds:[]},health:{score:22,inds:[]},
    climate:{score:70,inds:[]},social:{score:45,inds:[]},tech:{score:30,inds:[]},
    food:{score:28,inds:[]},mental:{score:42,inds:[]},energy:{score:28,inds:[]},
    demo:{score:25,inds:[]},urban:{score:22,inds:[]},science:{score:28,inds:[]},
    justice:{score:18,inds:[]},finance:{score:42,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:28,inds:[]}},
QAT:{name:'Catar',flag:'🇶🇦',
    eco:{score:30,inds:[]},geo:{score:38,inds:[]},health:{score:18,inds:[]},
    climate:{score:72,inds:[]},social:{score:38,inds:[]},tech:{score:25,inds:[]},
    food:{score:25,inds:[]},mental:{score:35,inds:[]},energy:{score:28,inds:[]},
    demo:{score:20,inds:[]},urban:{score:18,inds:[]},science:{score:22,inds:[]},
    justice:{score:15,inds:[]},finance:{score:35,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:25,inds:[]}},
ARE:{name:'Emiratos Árabes',flag:'🇦🇪',
    eco:{score:32,inds:[]},geo:{score:38,inds:[]},health:{score:20,inds:[]},
    climate:{score:70,inds:[]},social:{score:40,inds:[]},tech:{score:25,inds:[]},
    food:{score:28,inds:[]},mental:{score:35,inds:[]},energy:{score:28,inds:[]},
    demo:{score:22,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:15,inds:[]},finance:{score:35,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:25,inds:[]}},
OMN:{name:'Omán',flag:'🇴🇲',
    eco:{score:38,inds:[]},geo:{score:40,inds:[]},health:{score:25,inds:[]},
    climate:{score:70,inds:[]},social:{score:42,inds:[]},tech:{score:30,inds:[]},
    food:{score:32,inds:[]},mental:{score:42,inds:[]},energy:{score:32,inds:[]},
    demo:{score:25,inds:[]},urban:{score:25,inds:[]},science:{score:28,inds:[]},
    justice:{score:20,inds:[]},finance:{score:40,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:28,inds:[]}},
MDG:{name:'Madagascar',flag:'🇲🇬',
    eco:{score:72,inds:[]},geo:{score:52,inds:[]},health:{score:68,inds:[]},
    climate:{score:72,inds:[]},social:{score:65,inds:[]},tech:{score:62,inds:[]},
    food:{score:72,inds:[]},mental:{score:65,inds:[]},energy:{score:62,inds:[]},
    demo:{score:58,inds:[]},urban:{score:58,inds:[]},science:{score:52,inds:[]},
    justice:{score:48,inds:[]},finance:{score:65,inds:[]},ocean:{score:68,inds:[]},
    bio:{score:58,inds:[]}},
CYP:{name:'Chipre',flag:'🇨🇾',
    eco:{score:38,inds:[]},geo:{score:42,inds:[]},health:{score:22,inds:[]},
    climate:{score:48,inds:[]},social:{score:32,inds:[]},tech:{score:28,inds:[]},
    food:{score:22,inds:[]},mental:{score:42,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:25,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:30,inds:[]}},
DZA:{name:'Argelia',flag:'🇩🇿',
    eco:{score:55,inds:[]},geo:{score:58,inds:[]},health:{score:45,inds:[]},
    climate:{score:70,inds:[]},social:{score:55,inds:[]},tech:{score:48,inds:[]},
    food:{score:48,inds:[]},mental:{score:55,inds:[]},energy:{score:45,inds:[]},
    demo:{score:42,inds:[]},urban:{score:42,inds:[]},science:{score:42,inds:[]},
    justice:{score:35,inds:[]},finance:{score:55,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:45,inds:[]}},
TUN:{name:'Túnez',flag:'🇹🇳',
    eco:{score:55,inds:[]},geo:{score:48,inds:[]},health:{score:40,inds:[]},
    climate:{score:65,inds:[]},social:{score:52,inds:[]},tech:{score:45,inds:[]},
    food:{score:45,inds:[]},mental:{score:52,inds:[]},energy:{score:42,inds:[]},
    demo:{score:42,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:52,inds:[]},ocean:{score:52,inds:[]},
    bio:{score:42,inds:[]}},
LBY:{name:'Libia',flag:'🇱🇾',
    eco:{score:78,inds:[]},geo:{score:82,inds:[]},health:{score:68,inds:[]},
    climate:{score:68,inds:[]},social:{score:75,inds:[]},tech:{score:65,inds:[]},
    food:{score:65,inds:[]},mental:{score:70,inds:[]},energy:{score:60,inds:[]},
    demo:{score:55,inds:[]},urban:{score:62,inds:[]},science:{score:58,inds:[]},
    justice:{score:52,inds:[]},finance:{score:75,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:58,inds:[]}},
MAR:{name:'Marruecos',flag:'🇲🇦',
    eco:{score:48,inds:[]},geo:{score:42,inds:[]},health:{score:42,inds:[]},
    climate:{score:65,inds:[]},social:{score:48,inds:[]},tech:{score:42,inds:[]},
    food:{score:45,inds:[]},mental:{score:50,inds:[]},energy:{score:40,inds:[]},
    demo:{score:45,inds:[]},urban:{score:35,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:42,inds:[]}},
MRT:{name:'Mauritania',flag:'🇲🇷',
    eco:{score:68,inds:[]},geo:{score:55,inds:[]},health:{score:62,inds:[]},
    climate:{score:75,inds:[]},social:{score:65,inds:[]},tech:{score:58,inds:[]},
    food:{score:68,inds:[]},mental:{score:62,inds:[]},energy:{score:60,inds:[]},
    demo:{score:55,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:48,inds:[]},finance:{score:65,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:55,inds:[]}},
SDN:{name:'Sudán',flag:'🇸🇩',
    eco:{score:78,inds:[]},geo:{score:82,inds:[]},health:{score:72,inds:[]},
    climate:{score:72,inds:[]},social:{score:78,inds:[]},tech:{score:65,inds:[]},
    food:{score:78,inds:[]},mental:{score:72,inds:[]},energy:{score:68,inds:[]},
    demo:{score:58,inds:[]},urban:{score:65,inds:[]},science:{score:60,inds:[]},
    justice:{score:55,inds:[]},finance:{score:78,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:62,inds:[]}},
SSD:{name:'Sudán del Sur',flag:'🇸🇸',
    eco:{score:88,inds:[]},geo:{score:90,inds:[]},health:{score:85,inds:[]},
    climate:{score:72,inds:[]},social:{score:88,inds:[]},tech:{score:72,inds:[]},
    food:{score:88,inds:[]},mental:{score:82,inds:[]},energy:{score:80,inds:[]},
    demo:{score:65,inds:[]},urban:{score:75,inds:[]},science:{score:68,inds:[]},
    justice:{score:62,inds:[]},finance:{score:85,inds:[]},ocean:{score:88,inds:[]},
    bio:{score:68,inds:[]}},
SEN:{name:'Senegal',flag:'🇸🇳',
    eco:{score:58,inds:[]},geo:{score:42,inds:[]},health:{score:55,inds:[]},
    climate:{score:68,inds:[]},social:{score:55,inds:[]},tech:{score:52,inds:[]},
    food:{score:58,inds:[]},mental:{score:58,inds:[]},energy:{score:52,inds:[]},
    demo:{score:52,inds:[]},urban:{score:45,inds:[]},science:{score:45,inds:[]},
    justice:{score:40,inds:[]},finance:{score:55,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:52,inds:[]}},
GHA:{name:'Ghana',flag:'🇬🇭',
    eco:{score:52,inds:[]},geo:{score:40,inds:[]},health:{score:50,inds:[]},
    climate:{score:65,inds:[]},social:{score:50,inds:[]},tech:{score:48,inds:[]},
    food:{score:52,inds:[]},mental:{score:52,inds:[]},energy:{score:48,inds:[]},
    demo:{score:50,inds:[]},urban:{score:40,inds:[]},science:{score:40,inds:[]},
    justice:{score:35,inds:[]},finance:{score:50,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
CIV:{name:'Costa de Marfil',flag:'🇨🇮',
    eco:{score:62,inds:[]},geo:{score:50,inds:[]},health:{score:60,inds:[]},
    climate:{score:68,inds:[]},social:{score:58,inds:[]},tech:{score:55,inds:[]},
    food:{score:62,inds:[]},mental:{score:60,inds:[]},energy:{score:55,inds:[]},
    demo:{score:55,inds:[]},urban:{score:48,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:60,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:55,inds:[]}},
GIN:{name:'Guinea',flag:'🇬🇳',
    eco:{score:72,inds:[]},geo:{score:55,inds:[]},health:{score:68,inds:[]},
    climate:{score:70,inds:[]},social:{score:65,inds:[]},tech:{score:62,inds:[]},
    food:{score:70,inds:[]},mental:{score:65,inds:[]},energy:{score:62,inds:[]},
    demo:{score:58,inds:[]},urban:{score:58,inds:[]},science:{score:55,inds:[]},
    justice:{score:50,inds:[]},finance:{score:68,inds:[]},ocean:{score:72,inds:[]},
    bio:{score:60,inds:[]}},
SLE:{name:'Sierra Leona',flag:'🇸🇱',
    eco:{score:75,inds:[]},geo:{score:55,inds:[]},health:{score:72,inds:[]},
    climate:{score:70,inds:[]},social:{score:68,inds:[]},tech:{score:65,inds:[]},
    food:{score:72,inds:[]},mental:{score:68,inds:[]},energy:{score:65,inds:[]},
    demo:{score:60,inds:[]},urban:{score:62,inds:[]},science:{score:58,inds:[]},
    justice:{score:52,inds:[]},finance:{score:70,inds:[]},ocean:{score:72,inds:[]},
    bio:{score:62,inds:[]}},
LBR:{name:'Liberia',flag:'🇱🇷',
    eco:{score:72,inds:[]},geo:{score:52,inds:[]},health:{score:68,inds:[]},
    climate:{score:70,inds:[]},social:{score:65,inds:[]},tech:{score:62,inds:[]},
    food:{score:70,inds:[]},mental:{score:65,inds:[]},energy:{score:62,inds:[]},
    demo:{score:58,inds:[]},urban:{score:58,inds:[]},science:{score:55,inds:[]},
    justice:{score:50,inds:[]},finance:{score:68,inds:[]},ocean:{score:70,inds:[]},
    bio:{score:60,inds:[]}},
MLI:{name:'Mali',flag:'🇲🇱',
    eco:{score:78,inds:[]},geo:{score:75,inds:[]},health:{score:72,inds:[]},
    climate:{score:75,inds:[]},social:{score:72,inds:[]},tech:{score:65,inds:[]},
    food:{score:75,inds:[]},mental:{score:70,inds:[]},energy:{score:68,inds:[]},
    demo:{score:58,inds:[]},urban:{score:65,inds:[]},science:{score:60,inds:[]},
    justice:{score:55,inds:[]},finance:{score:75,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:62,inds:[]}},
BFA:{name:'Burkina Faso',flag:'🇧🇫',
    eco:{score:78,inds:[]},geo:{score:78,inds:[]},health:{score:72,inds:[]},
    climate:{score:75,inds:[]},social:{score:72,inds:[]},tech:{score:65,inds:[]},
    food:{score:75,inds:[]},mental:{score:70,inds:[]},energy:{score:68,inds:[]},
    demo:{score:58,inds:[]},urban:{score:65,inds:[]},science:{score:60,inds:[]},
    justice:{score:55,inds:[]},finance:{score:75,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:62,inds:[]}},
NER:{name:'Níger',flag:'🇳🇪',
    eco:{score:80,inds:[]},geo:{score:72,inds:[]},health:{score:78,inds:[]},
    climate:{score:78,inds:[]},social:{score:75,inds:[]},tech:{score:68,inds:[]},
    food:{score:80,inds:[]},mental:{score:75,inds:[]},energy:{score:72,inds:[]},
    demo:{score:60,inds:[]},urban:{score:68,inds:[]},science:{score:65,inds:[]},
    justice:{score:58,inds:[]},finance:{score:78,inds:[]},ocean:{score:80,inds:[]},
    bio:{score:65,inds:[]}},
TCD:{name:'Chad',flag:'🇹🇩',
    eco:{score:82,inds:[]},geo:{score:78,inds:[]},health:{score:78,inds:[]},
    climate:{score:75,inds:[]},social:{score:78,inds:[]},tech:{score:70,inds:[]},
    food:{score:80,inds:[]},mental:{score:75,inds:[]},energy:{score:72,inds:[]},
    demo:{score:62,inds:[]},urban:{score:70,inds:[]},science:{score:65,inds:[]},
    justice:{score:60,inds:[]},finance:{score:80,inds:[]},ocean:{score:82,inds:[]},
    bio:{score:65,inds:[]}},
CMR:{name:'Camerún',flag:'🇨🇲',
    eco:{score:65,inds:[]},geo:{score:58,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:58,inds:[]}},
GNB:{name:'Guinea-Bisáu',flag:'🇬🇼',
    eco:{score:72,inds:[]},geo:{score:58,inds:[]},health:{score:68,inds:[]},
    climate:{score:68,inds:[]},social:{score:65,inds:[]},tech:{score:60,inds:[]},
    food:{score:68,inds:[]},mental:{score:65,inds:[]},energy:{score:62,inds:[]},
    demo:{score:58,inds:[]},urban:{score:58,inds:[]},science:{score:55,inds:[]},
    justice:{score:50,inds:[]},finance:{score:65,inds:[]},ocean:{score:68,inds:[]},
    bio:{score:58,inds:[]}},
GMB:{name:'Gambia',flag:'🇬🇲',
    eco:{score:62,inds:[]},geo:{score:48,inds:[]},health:{score:58,inds:[]},
    climate:{score:68,inds:[]},social:{score:58,inds:[]},tech:{score:55,inds:[]},
    food:{score:62,inds:[]},mental:{score:58,inds:[]},energy:{score:55,inds:[]},
    demo:{score:52,inds:[]},urban:{score:50,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:60,inds:[]},
    bio:{score:52,inds:[]}},
CPV:{name:'Cabo Verde',flag:'🇨🇻',
    eco:{score:42,inds:[]},geo:{score:28,inds:[]},health:{score:38,inds:[]},
    climate:{score:58,inds:[]},social:{score:35,inds:[]},tech:{score:38,inds:[]},
    food:{score:38,inds:[]},mental:{score:42,inds:[]},energy:{score:38,inds:[]},
    demo:{score:42,inds:[]},urban:{score:32,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:38,inds:[]},ocean:{score:40,inds:[]},
    bio:{score:40,inds:[]}},
STP:{name:'Santo Tomé',flag:'🇸🇹',
    eco:{score:50,inds:[]},geo:{score:30,inds:[]},health:{score:45,inds:[]},
    climate:{score:62,inds:[]},social:{score:42,inds:[]},tech:{score:45,inds:[]},
    food:{score:45,inds:[]},mental:{score:48,inds:[]},energy:{score:42,inds:[]},
    demo:{score:45,inds:[]},urban:{score:38,inds:[]},science:{score:35,inds:[]},
    justice:{score:30,inds:[]},finance:{score:45,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:45,inds:[]}},
GNQ:{name:'Guinea Ecuatorial',flag:'🇬🇶',
    eco:{score:60,inds:[]},geo:{score:58,inds:[]},health:{score:58,inds:[]},
    climate:{score:65,inds:[]},social:{score:62,inds:[]},tech:{score:55,inds:[]},
    food:{score:58,inds:[]},mental:{score:60,inds:[]},energy:{score:55,inds:[]},
    demo:{score:45,inds:[]},urban:{score:52,inds:[]},science:{score:50,inds:[]},
    justice:{score:45,inds:[]},finance:{score:60,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:55,inds:[]}},
GAB:{name:'Gabón',flag:'🇬🇦',
    eco:{score:55,inds:[]},geo:{score:50,inds:[]},health:{score:52,inds:[]},
    climate:{score:65,inds:[]},social:{score:55,inds:[]},tech:{score:50,inds:[]},
    food:{score:52,inds:[]},mental:{score:55,inds:[]},energy:{score:50,inds:[]},
    demo:{score:45,inds:[]},urban:{score:45,inds:[]},science:{score:45,inds:[]},
    justice:{score:40,inds:[]},finance:{score:55,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:50,inds:[]}},
COG:{name:'Rep. del Congo',flag:'🇨🇬',
    eco:{score:65,inds:[]},geo:{score:58,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:52,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:55,inds:[]}},
COD:{name:'RD del Congo',flag:'🇨🇩',
    eco:{score:82,inds:[]},geo:{score:85,inds:[]},health:{score:80,inds:[]},
    climate:{score:72,inds:[]},social:{score:82,inds:[]},tech:{score:72,inds:[]},
    food:{score:82,inds:[]},mental:{score:78,inds:[]},energy:{score:75,inds:[]},
    demo:{score:62,inds:[]},urban:{score:72,inds:[]},science:{score:65,inds:[]},
    justice:{score:60,inds:[]},finance:{score:82,inds:[]},ocean:{score:82,inds:[]},
    bio:{score:68,inds:[]}},
AGO:{name:'Angola',flag:'🇦🇴',
    eco:{score:65,inds:[]},geo:{score:55,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:50,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:60,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:55,inds:[]}},
TOG:{name:'Togo',flag:'🇹🇬',
    eco:{score:65,inds:[]},geo:{score:52,inds:[]},health:{score:60,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:55,inds:[]}},
BEN:{name:'Benín',flag:'🇧🇯',
    eco:{score:60,inds:[]},geo:{score:45,inds:[]},health:{score:55,inds:[]},
    climate:{score:68,inds:[]},social:{score:58,inds:[]},tech:{score:55,inds:[]},
    food:{score:60,inds:[]},mental:{score:58,inds:[]},energy:{score:55,inds:[]},
    demo:{score:52,inds:[]},urban:{score:50,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:60,inds:[]},
    bio:{score:52,inds:[]}},
ETH:{name:'Etiopía',flag:'🇪🇹',
    eco:{score:72,inds:[]},geo:{score:68,inds:[]},health:{score:68,inds:[]},
    climate:{score:72,inds:[]},social:{score:68,inds:[]},tech:{score:62,inds:[]},
    food:{score:72,inds:[]},mental:{score:68,inds:[]},energy:{score:65,inds:[]},
    demo:{score:58,inds:[]},urban:{score:62,inds:[]},science:{score:58,inds:[]},
    justice:{score:52,inds:[]},finance:{score:68,inds:[]},ocean:{score:70,inds:[]},
    bio:{score:60,inds:[]}},
ERI:{name:'Eritrea',flag:'🇪🇷',
    eco:{score:75,inds:[]},geo:{score:78,inds:[]},health:{score:70,inds:[]},
    climate:{score:70,inds:[]},social:{score:75,inds:[]},tech:{score:68,inds:[]},
    food:{score:75,inds:[]},mental:{score:72,inds:[]},energy:{score:68,inds:[]},
    demo:{score:60,inds:[]},urban:{score:65,inds:[]},science:{score:62,inds:[]},
    justice:{score:55,inds:[]},finance:{score:75,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:62,inds:[]}},
DJI:{name:'Yibuti',flag:'🇩🇯',
    eco:{score:65,inds:[]},geo:{score:52,inds:[]},health:{score:58,inds:[]},
    climate:{score:72,inds:[]},social:{score:62,inds:[]},tech:{score:55,inds:[]},
    food:{score:62,inds:[]},mental:{score:60,inds:[]},energy:{score:58,inds:[]},
    demo:{score:52,inds:[]},urban:{score:52,inds:[]},science:{score:50,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:55,inds:[]}},
SOM:{name:'Somalia',flag:'🇸🇴',
    eco:{score:88,inds:[]},geo:{score:90,inds:[]},health:{score:85,inds:[]},
    climate:{score:75,inds:[]},social:{score:88,inds:[]},tech:{score:75,inds:[]},
    food:{score:88,inds:[]},mental:{score:82,inds:[]},energy:{score:80,inds:[]},
    demo:{score:65,inds:[]},urban:{score:78,inds:[]},science:{score:70,inds:[]},
    justice:{score:65,inds:[]},finance:{score:88,inds:[]},ocean:{score:88,inds:[]},
    bio:{score:70,inds:[]}},
KEN:{name:'Kenia',flag:'🇰🇪',
    eco:{score:58,inds:[]},geo:{score:52,inds:[]},health:{score:55,inds:[]},
    climate:{score:68,inds:[]},social:{score:55,inds:[]},tech:{score:50,inds:[]},
    food:{score:58,inds:[]},mental:{score:58,inds:[]},energy:{score:52,inds:[]},
    demo:{score:52,inds:[]},urban:{score:45,inds:[]},science:{score:45,inds:[]},
    justice:{score:38,inds:[]},finance:{score:55,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:52,inds:[]}},
UGA:{name:'Uganda',flag:'🇺🇬',
    eco:{score:62,inds:[]},geo:{score:55,inds:[]},health:{score:58,inds:[]},
    climate:{score:68,inds:[]},social:{score:58,inds:[]},tech:{score:55,inds:[]},
    food:{score:62,inds:[]},mental:{score:60,inds:[]},energy:{score:55,inds:[]},
    demo:{score:55,inds:[]},urban:{score:50,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:55,inds:[]}},
TZA:{name:'Tanzania',flag:'🇹🇿',
    eco:{score:60,inds:[]},geo:{score:48,inds:[]},health:{score:55,inds:[]},
    climate:{score:68,inds:[]},social:{score:55,inds:[]},tech:{score:52,inds:[]},
    food:{score:60,inds:[]},mental:{score:58,inds:[]},energy:{score:52,inds:[]},
    demo:{score:52,inds:[]},urban:{score:45,inds:[]},science:{score:45,inds:[]},
    justice:{score:38,inds:[]},finance:{score:55,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:52,inds:[]}},
RWA:{name:'Ruanda',flag:'🇷🇼',
    eco:{score:52,inds:[]},geo:{score:45,inds:[]},health:{score:50,inds:[]},
    climate:{score:65,inds:[]},social:{score:50,inds:[]},tech:{score:48,inds:[]},
    food:{score:52,inds:[]},mental:{score:52,inds:[]},energy:{score:48,inds:[]},
    demo:{score:50,inds:[]},urban:{score:40,inds:[]},science:{score:40,inds:[]},
    justice:{score:35,inds:[]},finance:{score:50,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
BDI:{name:'Burundi',flag:'🇧🇮',
    eco:{score:75,inds:[]},geo:{score:65,inds:[]},health:{score:70,inds:[]},
    climate:{score:70,inds:[]},social:{score:70,inds:[]},tech:{score:65,inds:[]},
    food:{score:72,inds:[]},mental:{score:68,inds:[]},energy:{score:65,inds:[]},
    demo:{score:58,inds:[]},urban:{score:62,inds:[]},science:{score:58,inds:[]},
    justice:{score:52,inds:[]},finance:{score:70,inds:[]},ocean:{score:72,inds:[]},
    bio:{score:60,inds:[]}},
MOZ:{name:'Mozambique',flag:'🇲🇿',
    eco:{score:72,inds:[]},geo:{score:55,inds:[]},health:{score:68,inds:[]},
    climate:{score:72,inds:[]},social:{score:68,inds:[]},tech:{score:62,inds:[]},
    food:{score:72,inds:[]},mental:{score:68,inds:[]},energy:{score:65,inds:[]},
    demo:{score:58,inds:[]},urban:{score:60,inds:[]},science:{score:55,inds:[]},
    justice:{score:50,inds:[]},finance:{score:68,inds:[]},ocean:{score:70,inds:[]},
    bio:{score:60,inds:[]}},
ZMB:{name:'Zambia',flag:'🇿🇲',
    eco:{score:65,inds:[]},geo:{score:48,inds:[]},health:{score:60,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:55,inds:[]}},
ZWE:{name:'Zimbabue',flag:'🇿🇼',
    eco:{score:72,inds:[]},geo:{score:58,inds:[]},health:{score:65,inds:[]},
    climate:{score:68,inds:[]},social:{score:68,inds:[]},tech:{score:58,inds:[]},
    food:{score:68,inds:[]},mental:{score:65,inds:[]},energy:{score:62,inds:[]},
    demo:{score:55,inds:[]},urban:{score:58,inds:[]},science:{score:55,inds:[]},
    justice:{score:48,inds:[]},finance:{score:65,inds:[]},ocean:{score:68,inds:[]},
    bio:{score:58,inds:[]}},
MWI:{name:'Malaui',flag:'🇲🇼',
    eco:{score:70,inds:[]},geo:{score:45,inds:[]},health:{score:65,inds:[]},
    climate:{score:72,inds:[]},social:{score:65,inds:[]},tech:{score:62,inds:[]},
    food:{score:70,inds:[]},mental:{score:65,inds:[]},energy:{score:62,inds:[]},
    demo:{score:58,inds:[]},urban:{score:58,inds:[]},science:{score:55,inds:[]},
    justice:{score:50,inds:[]},finance:{score:65,inds:[]},ocean:{score:68,inds:[]},
    bio:{score:58,inds:[]}},
COM:{name:'Comoras',flag:'🇰🇲',
    eco:{score:68,inds:[]},geo:{score:50,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:55,inds:[]}},
SYC:{name:'Seychelles',flag:'🇸🇨',
    eco:{score:38,inds:[]},geo:{score:25,inds:[]},health:{score:30,inds:[]},
    climate:{score:55,inds:[]},social:{score:30,inds:[]},tech:{score:30,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:30,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:38,inds:[]}},
MUS:{name:'Mauricio',flag:'🇲🇺',
    eco:{score:38,inds:[]},geo:{score:25,inds:[]},health:{score:30,inds:[]},
    climate:{score:52,inds:[]},social:{score:28,inds:[]},tech:{score:28,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:38,inds:[]}},
NAM:{name:'Namibia',flag:'🇳🇦',
    eco:{score:52,inds:[]},geo:{score:38,inds:[]},health:{score:45,inds:[]},
    climate:{score:68,inds:[]},social:{score:52,inds:[]},tech:{score:45,inds:[]},
    food:{score:50,inds:[]},mental:{score:52,inds:[]},energy:{score:45,inds:[]},
    demo:{score:50,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
BWA:{name:'Botsuana',flag:'🇧🇼',
    eco:{score:45,inds:[]},geo:{score:32,inds:[]},health:{score:40,inds:[]},
    climate:{score:68,inds:[]},social:{score:45,inds:[]},tech:{score:42,inds:[]},
    food:{score:45,inds:[]},mental:{score:48,inds:[]},energy:{score:42,inds:[]},
    demo:{score:48,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:28,inds:[]},finance:{score:42,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:45,inds:[]}},
LSO:{name:'Lesoto',flag:'🇱🇸',
    eco:{score:65,inds:[]},geo:{score:35,inds:[]},health:{score:60,inds:[]},
    climate:{score:65,inds:[]},social:{score:60,inds:[]},tech:{score:55,inds:[]},
    food:{score:65,inds:[]},mental:{score:60,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:52,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:60,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:52,inds:[]}},
SWZ:{name:'Esuatini',flag:'🇸🇿',
    eco:{score:62,inds:[]},geo:{score:35,inds:[]},health:{score:58,inds:[]},
    climate:{score:65,inds:[]},social:{score:58,inds:[]},tech:{score:52,inds:[]},
    food:{score:62,inds:[]},mental:{score:58,inds:[]},energy:{score:55,inds:[]},
    demo:{score:52,inds:[]},urban:{score:50,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:60,inds:[]},
    bio:{score:52,inds:[]}},
CHL:{name:'Chile',flag:'🇨🇱',
    eco:{score:38,inds:[]},geo:{score:28,inds:[]},health:{score:28,inds:[]},
    climate:{score:58,inds:[]},social:{score:35,inds:[]},tech:{score:28,inds:[]},
    food:{score:32,inds:[]},mental:{score:40,inds:[]},energy:{score:32,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:28,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:38,inds:[]}},
COL:{name:'Colombia',flag:'🇨🇴',
    eco:{score:55,inds:[]},geo:{score:58,inds:[]},health:{score:45,inds:[]},
    climate:{score:65,inds:[]},social:{score:55,inds:[]},tech:{score:45,inds:[]},
    food:{score:50,inds:[]},mental:{score:55,inds:[]},energy:{score:48,inds:[]},
    demo:{score:52,inds:[]},urban:{score:40,inds:[]},science:{score:40,inds:[]},
    justice:{score:35,inds:[]},finance:{score:50,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:52,inds:[]}},
VEN:{name:'Venezuela',flag:'🇻🇪',
    eco:{score:78,inds:[]},geo:{score:72,inds:[]},health:{score:68,inds:[]},
    climate:{score:65,inds:[]},social:{score:72,inds:[]},tech:{score:62,inds:[]},
    food:{score:72,inds:[]},mental:{score:70,inds:[]},energy:{score:65,inds:[]},
    demo:{score:55,inds:[]},urban:{score:62,inds:[]},science:{score:58,inds:[]},
    justice:{score:52,inds:[]},finance:{score:72,inds:[]},ocean:{score:78,inds:[]},
    bio:{score:58,inds:[]}},
PER:{name:'Perú',flag:'🇵🇪',
    eco:{score:52,inds:[]},geo:{score:45,inds:[]},health:{score:45,inds:[]},
    climate:{score:65,inds:[]},social:{score:52,inds:[]},tech:{score:42,inds:[]},
    food:{score:50,inds:[]},mental:{score:52,inds:[]},energy:{score:48,inds:[]},
    demo:{score:50,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:52,inds:[]}},
BOL:{name:'Bolivia',flag:'🇧🇴',
    eco:{score:58,inds:[]},geo:{score:45,inds:[]},health:{score:52,inds:[]},
    climate:{score:65,inds:[]},social:{score:55,inds:[]},tech:{score:48,inds:[]},
    food:{score:55,inds:[]},mental:{score:55,inds:[]},energy:{score:52,inds:[]},
    demo:{score:52,inds:[]},urban:{score:42,inds:[]},science:{score:42,inds:[]},
    justice:{score:38,inds:[]},finance:{score:52,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:52,inds:[]}},
PRY:{name:'Paraguay',flag:'🇵🇾',
    eco:{score:55,inds:[]},geo:{score:42,inds:[]},health:{score:48,inds:[]},
    climate:{score:65,inds:[]},social:{score:52,inds:[]},tech:{score:45,inds:[]},
    food:{score:50,inds:[]},mental:{score:52,inds:[]},energy:{score:48,inds:[]},
    demo:{score:50,inds:[]},urban:{score:40,inds:[]},science:{score:40,inds:[]},
    justice:{score:35,inds:[]},finance:{score:50,inds:[]},ocean:{score:52,inds:[]},
    bio:{score:48,inds:[]}},
URY:{name:'Uruguay',flag:'🇺🇾',
    eco:{score:32,inds:[]},geo:{score:22,inds:[]},health:{score:25,inds:[]},
    climate:{score:48,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:25,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:22,inds:[]},ocean:{score:30,inds:[]},
    bio:{score:30,inds:[]}},
ECU:{name:'Ecuador',flag:'🇪🇨',
    eco:{score:55,inds:[]},geo:{score:48,inds:[]},health:{score:42,inds:[]},
    climate:{score:68,inds:[]},social:{score:52,inds:[]},tech:{score:42,inds:[]},
    food:{score:50,inds:[]},mental:{score:52,inds:[]},energy:{score:48,inds:[]},
    demo:{score:52,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:52,inds:[]},
    bio:{score:52,inds:[]}},
GUY:{name:'Guyana',flag:'🇬🇾',
    eco:{score:52,inds:[]},geo:{score:38,inds:[]},health:{score:45,inds:[]},
    climate:{score:65,inds:[]},social:{score:50,inds:[]},tech:{score:45,inds:[]},
    food:{score:48,inds:[]},mental:{score:50,inds:[]},energy:{score:45,inds:[]},
    demo:{score:48,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
SUR:{name:'Surinam',flag:'🇸🇷',
    eco:{score:52,inds:[]},geo:{score:40,inds:[]},health:{score:45,inds:[]},
    climate:{score:65,inds:[]},social:{score:50,inds:[]},tech:{score:45,inds:[]},
    food:{score:48,inds:[]},mental:{score:50,inds:[]},energy:{score:45,inds:[]},
    demo:{score:48,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
GUF:{name:'Guayana Francesa',flag:'🇬🇫',
    eco:{score:40,inds:[]},geo:{score:20,inds:[]},health:{score:32,inds:[]},
    climate:{score:62,inds:[]},social:{score:32,inds:[]},tech:{score:32,inds:[]},
    food:{score:35,inds:[]},mental:{score:42,inds:[]},energy:{score:35,inds:[]},
    demo:{score:40,inds:[]},urban:{score:25,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:30,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:40,inds:[]}},
GTM:{name:'Guatemala',flag:'🇬🇹',
    eco:{score:62,inds:[]},geo:{score:58,inds:[]},health:{score:55,inds:[]},
    climate:{score:65,inds:[]},social:{score:60,inds:[]},tech:{score:52,inds:[]},
    food:{score:58,inds:[]},mental:{score:58,inds:[]},energy:{score:55,inds:[]},
    demo:{score:52,inds:[]},urban:{score:48,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:52,inds:[]}},
BLZ:{name:'Belice',flag:'🇧🇿',
    eco:{score:52,inds:[]},geo:{score:38,inds:[]},health:{score:45,inds:[]},
    climate:{score:65,inds:[]},social:{score:50,inds:[]},tech:{score:45,inds:[]},
    food:{score:48,inds:[]},mental:{score:50,inds:[]},energy:{score:45,inds:[]},
    demo:{score:48,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
HND:{name:'Honduras',flag:'🇭🇳',
    eco:{score:65,inds:[]},geo:{score:62,inds:[]},health:{score:58,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:55,inds:[]},
    food:{score:62,inds:[]},mental:{score:60,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:50,inds:[]},science:{score:50,inds:[]},
    justice:{score:45,inds:[]},finance:{score:60,inds:[]},ocean:{score:65,inds:[]},
    bio:{score:55,inds:[]}},
SLV:{name:'El Salvador',flag:'🇸🇻',
    eco:{score:62,inds:[]},geo:{score:58,inds:[]},health:{score:55,inds:[]},
    climate:{score:65,inds:[]},social:{score:58,inds:[]},tech:{score:52,inds:[]},
    food:{score:58,inds:[]},mental:{score:58,inds:[]},energy:{score:55,inds:[]},
    demo:{score:52,inds:[]},urban:{score:48,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:52,inds:[]}},
NIC:{name:'Nicaragua',flag:'🇳🇮',
    eco:{score:62,inds:[]},geo:{score:58,inds:[]},health:{score:55,inds:[]},
    climate:{score:65,inds:[]},social:{score:60,inds:[]},tech:{score:52,inds:[]},
    food:{score:58,inds:[]},mental:{score:60,inds:[]},energy:{score:55,inds:[]},
    demo:{score:52,inds:[]},urban:{score:48,inds:[]},science:{score:48,inds:[]},
    justice:{score:42,inds:[]},finance:{score:58,inds:[]},ocean:{score:62,inds:[]},
    bio:{score:52,inds:[]}},
CRI:{name:'Costa Rica',flag:'🇨🇷',
    eco:{score:35,inds:[]},geo:{score:22,inds:[]},health:{score:28,inds:[]},
    climate:{score:55,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:22,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:35,inds:[]}},
PAN:{name:'Panamá',flag:'🇵🇦',
    eco:{score:42,inds:[]},geo:{score:35,inds:[]},health:{score:35,inds:[]},
    climate:{score:62,inds:[]},social:{score:38,inds:[]},tech:{score:32,inds:[]},
    food:{score:38,inds:[]},mental:{score:42,inds:[]},energy:{score:35,inds:[]},
    demo:{score:42,inds:[]},urban:{score:28,inds:[]},science:{score:30,inds:[]},
    justice:{score:22,inds:[]},finance:{score:35,inds:[]},ocean:{score:40,inds:[]},
    bio:{score:42,inds:[]}},
CUB:{name:'Cuba',flag:'🇨🇺',
    eco:{score:58,inds:[]},geo:{score:62,inds:[]},health:{score:35,inds:[]},
    climate:{score:52,inds:[]},social:{score:60,inds:[]},tech:{score:55,inds:[]},
    food:{score:48,inds:[]},mental:{score:58,inds:[]},energy:{score:48,inds:[]},
    demo:{score:45,inds:[]},urban:{score:42,inds:[]},science:{score:42,inds:[]},
    justice:{score:35,inds:[]},finance:{score:58,inds:[]},ocean:{score:60,inds:[]},
    bio:{score:42,inds:[]}},
JAM:{name:'Jamaica',flag:'🇯🇲',
    eco:{score:52,inds:[]},geo:{score:45,inds:[]},health:{score:38,inds:[]},
    climate:{score:60,inds:[]},social:{score:50,inds:[]},tech:{score:42,inds:[]},
    food:{score:48,inds:[]},mental:{score:52,inds:[]},energy:{score:45,inds:[]},
    demo:{score:48,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:48,inds:[]},ocean:{score:50,inds:[]},
    bio:{score:48,inds:[]}},
HTI:{name:'Haití',flag:'🇭🇹',
    eco:{score:82,inds:[]},geo:{score:68,inds:[]},health:{score:78,inds:[]},
    climate:{score:70,inds:[]},social:{score:78,inds:[]},tech:{score:68,inds:[]},
    food:{score:80,inds:[]},mental:{score:75,inds:[]},energy:{score:72,inds:[]},
    demo:{score:60,inds:[]},urban:{score:68,inds:[]},science:{score:62,inds:[]},
    justice:{score:58,inds:[]},finance:{score:78,inds:[]},ocean:{score:80,inds:[]},
    bio:{score:62,inds:[]}},
DOM:{name:'Rep. Dominicana',flag:'🇩🇴',
    eco:{score:48,inds:[]},geo:{score:40,inds:[]},health:{score:38,inds:[]},
    climate:{score:62,inds:[]},social:{score:45,inds:[]},tech:{score:38,inds:[]},
    food:{score:42,inds:[]},mental:{score:48,inds:[]},energy:{score:42,inds:[]},
    demo:{score:48,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:28,inds:[]},finance:{score:42,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:48,inds:[]}},
PRI:{name:'Puerto Rico',flag:'🇵🇷',
    eco:{score:42,inds:[]},geo:{score:22,inds:[]},health:{score:28,inds:[]},
    climate:{score:62,inds:[]},social:{score:35,inds:[]},tech:{score:28,inds:[]},
    food:{score:30,inds:[]},mental:{score:42,inds:[]},energy:{score:32,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:25,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:42,inds:[]}},
TTO:{name:'Trinidad y Tobago',flag:'🇹🇹',
    eco:{score:48,inds:[]},geo:{score:38,inds:[]},health:{score:35,inds:[]},
    climate:{score:60,inds:[]},social:{score:45,inds:[]},tech:{score:38,inds:[]},
    food:{score:40,inds:[]},mental:{score:48,inds:[]},energy:{score:38,inds:[]},
    demo:{score:42,inds:[]},urban:{score:32,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:42,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:45,inds:[]}},
BRB:{name:'Barbados',flag:'🇧🇧',
    eco:{score:35,inds:[]},geo:{score:22,inds:[]},health:{score:28,inds:[]},
    climate:{score:55,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:22,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:32,inds:[]}},
LCA:{name:'Santa Lucía',flag:'🇱🇨',
    eco:{score:40,inds:[]},geo:{score:25,inds:[]},health:{score:32,inds:[]},
    climate:{score:60,inds:[]},social:{score:30,inds:[]},tech:{score:28,inds:[]},
    food:{score:32,inds:[]},mental:{score:40,inds:[]},energy:{score:30,inds:[]},
    demo:{score:40,inds:[]},urban:{score:25,inds:[]},science:{score:25,inds:[]},
    justice:{score:20,inds:[]},finance:{score:28,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:40,inds:[]}},
VCT:{name:'San Vicente',flag:'🇻🇨',
    eco:{score:42,inds:[]},geo:{score:25,inds:[]},health:{score:32,inds:[]},
    climate:{score:60,inds:[]},social:{score:32,inds:[]},tech:{score:28,inds:[]},
    food:{score:32,inds:[]},mental:{score:40,inds:[]},energy:{score:32,inds:[]},
    demo:{score:40,inds:[]},urban:{score:25,inds:[]},science:{score:25,inds:[]},
    justice:{score:20,inds:[]},finance:{score:28,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:40,inds:[]}},
GRD:{name:'Granada',flag:'🇬🇩',
    eco:{score:38,inds:[]},geo:{score:22,inds:[]},health:{score:30,inds:[]},
    climate:{score:58,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:25,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:38,inds:[]}},
ATG:{name:'Antigua y Barbuda',flag:'🇦🇬',
    eco:{score:35,inds:[]},geo:{score:22,inds:[]},health:{score:28,inds:[]},
    climate:{score:58,inds:[]},social:{score:28,inds:[]},tech:{score:25,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:22,inds:[]},ocean:{score:32,inds:[]},
    bio:{score:38,inds:[]}},
DMA:{name:'Dominica',flag:'🇩🇲',
    eco:{score:40,inds:[]},geo:{score:22,inds:[]},health:{score:32,inds:[]},
    climate:{score:60,inds:[]},social:{score:30,inds:[]},tech:{score:28,inds:[]},
    food:{score:30,inds:[]},mental:{score:38,inds:[]},energy:{score:30,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:25,inds:[]},
    justice:{score:18,inds:[]},finance:{score:25,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:40,inds:[]}},
KNA:{name:'San Cristóbal',flag:'🇰🇳',
    eco:{score:35,inds:[]},geo:{score:20,inds:[]},health:{score:28,inds:[]},
    climate:{score:55,inds:[]},social:{score:25,inds:[]},tech:{score:22,inds:[]},
    food:{score:25,inds:[]},mental:{score:35,inds:[]},energy:{score:25,inds:[]},
    demo:{score:35,inds:[]},urban:{score:18,inds:[]},science:{score:20,inds:[]},
    justice:{score:15,inds:[]},finance:{score:20,inds:[]},ocean:{score:30,inds:[]},
    bio:{score:35,inds:[]}},
BHS:{name:'Bahamas',flag:'🇧🇸',
    eco:{score:38,inds:[]},geo:{score:25,inds:[]},health:{score:28,inds:[]},
    climate:{score:58,inds:[]},social:{score:30,inds:[]},tech:{score:25,inds:[]},
    food:{score:28,inds:[]},mental:{score:38,inds:[]},energy:{score:28,inds:[]},
    demo:{score:38,inds:[]},urban:{score:22,inds:[]},science:{score:22,inds:[]},
    justice:{score:18,inds:[]},finance:{score:25,inds:[]},ocean:{score:35,inds:[]},
    bio:{score:38,inds:[]}},
MEX2:{name:'México',flag:'🇲🇽',
    eco:{score:55,inds:[]},geo:{score:68,inds:[]},health:{score:48,inds:[]},
    climate:{score:64,inds:[]},social:{score:65,inds:[]},tech:{score:50,inds:[]},
    food:{score:44,inds:[]},mental:{score:55,inds:[]},energy:{score:55,inds:[]},
    demo:{score:48,inds:[]},urban:{score:65,inds:[]},science:{score:72,inds:[]},
    justice:{score:62,inds:[]},finance:{score:52,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:52,inds:[]}},
NZL:{name:'Nueva Zelanda',flag:'🇳🇿',
    eco:{score:25,inds:[]},geo:{score:18,inds:[]},health:{score:15,inds:[]},
    climate:{score:52,inds:[]},social:{score:20,inds:[]},tech:{score:20,inds:[]},
    food:{score:18,inds:[]},mental:{score:38,inds:[]},energy:{score:20,inds:[]},
    demo:{score:38,inds:[]},urban:{score:20,inds:[]},science:{score:18,inds:[]},
    justice:{score:12,inds:[]},finance:{score:18,inds:[]},ocean:{score:22,inds:[]},
    bio:{score:35,inds:[]}},
FJI:{name:'Fiyi',flag:'🇫🇯',
    eco:{score:45,inds:[]},geo:{score:28,inds:[]},health:{score:38,inds:[]},
    climate:{score:65,inds:[]},social:{score:38,inds:[]},tech:{score:38,inds:[]},
    food:{score:38,inds:[]},mental:{score:45,inds:[]},energy:{score:38,inds:[]},
    demo:{score:42,inds:[]},urban:{score:30,inds:[]},science:{score:30,inds:[]},
    justice:{score:25,inds:[]},finance:{score:35,inds:[]},ocean:{score:40,inds:[]},
    bio:{score:45,inds:[]}},
PNG:{name:'Papúa Nueva Guinea',flag:'🇵🇬',
    eco:{score:68,inds:[]},geo:{score:52,inds:[]},health:{score:62,inds:[]},
    climate:{score:68,inds:[]},social:{score:62,inds:[]},tech:{score:58,inds:[]},
    food:{score:65,inds:[]},mental:{score:62,inds:[]},energy:{score:58,inds:[]},
    demo:{score:55,inds:[]},urban:{score:55,inds:[]},science:{score:52,inds:[]},
    justice:{score:45,inds:[]},finance:{score:62,inds:[]},ocean:{score:68,inds:[]},
    bio:{score:58,inds:[]}},
SLB:{name:'Islas Salomón',flag:'🇸🇧',
    eco:{score:62,inds:[]},geo:{score:40,inds:[]},health:{score:55,inds:[]},
    climate:{score:68,inds:[]},social:{score:55,inds:[]},tech:{score:52,inds:[]},
    food:{score:58,inds:[]},mental:{score:58,inds:[]},energy:{score:52,inds:[]},
    demo:{score:50,inds:[]},urban:{score:48,inds:[]},science:{score:45,inds:[]},
    justice:{score:40,inds:[]},finance:{score:55,inds:[]},ocean:{score:58,inds:[]},
    bio:{score:55,inds:[]}},
VUT:{name:'Vanuatu',flag:'🇻🇺',
    eco:{score:58,inds:[]},geo:{score:35,inds:[]},health:{score:52,inds:[]},
    climate:{score:70,inds:[]},social:{score:52,inds:[]},tech:{score:50,inds:[]},
    food:{score:55,inds:[]},mental:{score:55,inds:[]},energy:{score:50,inds:[]},
    demo:{score:48,inds:[]},urban:{score:45,inds:[]},science:{score:42,inds:[]},
    justice:{score:38,inds:[]},finance:{score:52,inds:[]},ocean:{score:55,inds:[]},
    bio:{score:55,inds:[]}},
WSM:{name:'Samoa',flag:'🇼🇸',
    eco:{score:50,inds:[]},geo:{score:28,inds:[]},health:{score:42,inds:[]},
    climate:{score:65,inds:[]},social:{score:42,inds:[]},tech:{score:42,inds:[]},
    food:{score:42,inds:[]},mental:{score:48,inds:[]},energy:{score:42,inds:[]},
    demo:{score:45,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:30,inds:[]},finance:{score:42,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:48,inds:[]}},
TON:{name:'Tonga',flag:'🇹🇴',
    eco:{score:48,inds:[]},geo:{score:28,inds:[]},health:{score:40,inds:[]},
    climate:{score:65,inds:[]},social:{score:40,inds:[]},tech:{score:40,inds:[]},
    food:{score:40,inds:[]},mental:{score:45,inds:[]},energy:{score:40,inds:[]},
    demo:{score:42,inds:[]},urban:{score:32,inds:[]},science:{score:32,inds:[]},
    justice:{score:28,inds:[]},finance:{score:40,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:45,inds:[]}},
KIR:{name:'Kiribati',flag:'🇰🇮',
    eco:{score:55,inds:[]},geo:{score:25,inds:[]},health:{score:45,inds:[]},
    climate:{score:82,inds:[]},social:{score:45,inds:[]},tech:{score:48,inds:[]},
    food:{score:48,inds:[]},mental:{score:52,inds:[]},energy:{score:45,inds:[]},
    demo:{score:45,inds:[]},urban:{score:38,inds:[]},science:{score:38,inds:[]},
    justice:{score:32,inds:[]},finance:{score:45,inds:[]},ocean:{score:48,inds:[]},
    bio:{score:72,inds:[]}},
FSM:{name:'Micronesia',flag:'🇫🇲',
    eco:{score:52,inds:[]},geo:{score:25,inds:[]},health:{score:42,inds:[]},
    climate:{score:72,inds:[]},social:{score:42,inds:[]},tech:{score:45,inds:[]},
    food:{score:45,inds:[]},mental:{score:50,inds:[]},energy:{score:42,inds:[]},
    demo:{score:42,inds:[]},urban:{score:35,inds:[]},science:{score:35,inds:[]},
    justice:{score:30,inds:[]},finance:{score:42,inds:[]},ocean:{score:45,inds:[]},
    bio:{score:65,inds:[]}},
MHL:{name:'Islas Marshall',flag:'🇲🇭',
    eco:{score:52,inds:[]},geo:{score:22,inds:[]},health:{score:40,inds:[]},
    climate:{score:82,inds:[]},social:{score:40,inds:[]},tech:{score:42,inds:[]},
    food:{score:42,inds:[]},mental:{score:48,inds:[]},energy:{score:40,inds:[]},
    demo:{score:40,inds:[]},urban:{score:32,inds:[]},science:{score:35,inds:[]},
    justice:{score:28,inds:[]},finance:{score:40,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:72,inds:[]}},
PLW:{name:'Palaos',flag:'🇵🇼',
    eco:{score:42,inds:[]},geo:{score:20,inds:[]},health:{score:35,inds:[]},
    climate:{score:65,inds:[]},social:{score:35,inds:[]},tech:{score:35,inds:[]},
    food:{score:35,inds:[]},mental:{score:42,inds:[]},energy:{score:35,inds:[]},
    demo:{score:38,inds:[]},urban:{score:28,inds:[]},science:{score:28,inds:[]},
    justice:{score:22,inds:[]},finance:{score:35,inds:[]},ocean:{score:38,inds:[]},
    bio:{score:55,inds:[]}},
NRU:{name:'Nauru',flag:'🇳🇷',
    eco:{score:45,inds:[]},geo:{score:20,inds:[]},health:{score:38,inds:[]},
    climate:{score:70,inds:[]},social:{score:38,inds:[]},tech:{score:38,inds:[]},
    food:{score:38,inds:[]},mental:{score:42,inds:[]},energy:{score:38,inds:[]},
    demo:{score:40,inds:[]},urban:{score:30,inds:[]},science:{score:30,inds:[]},
    justice:{score:25,inds:[]},finance:{score:38,inds:[]},ocean:{score:40,inds:[]},
    bio:{score:58,inds:[]}},
TUV:{name:'Tuvalu',flag:'🇹🇻',
    eco:{score:50,inds:[]},geo:{score:20,inds:[]},health:{score:40,inds:[]},
    climate:{score:82,inds:[]},social:{score:40,inds:[]},tech:{score:42,inds:[]},
    food:{score:42,inds:[]},mental:{score:48,inds:[]},energy:{score:40,inds:[]},
    demo:{score:40,inds:[]},urban:{score:32,inds:[]},science:{score:35,inds:[]},
    justice:{score:28,inds:[]},finance:{score:40,inds:[]},ocean:{score:42,inds:[]},
    bio:{score:75,inds:[]}}
,
CAF:{name:'Rep. Centroafricana',flag:'🇨🇫',eco:{score:82,inds:[]},geo:{score:85,inds:[]},health:{score:80,inds:[]},climate:{score:72,inds:[]},social:{score:82,inds:[]},tech:{score:68,inds:[]},food:{score:85,inds:[]},mental:{score:72,inds:[]},energy:{score:70,inds:[]},demo:{score:58,inds:[]},urban:{score:78,inds:[]},science:{score:72,inds:[]},justice:{score:85,inds:[]},finance:{score:78,inds:[]},ocean:{score:35,inds:[]},bio:{score:72,inds:[]}}
,
IRL:{name:'Irlanda',flag:'🇮🇪',eco:{score:28,inds:[]},geo:{score:20,inds:[]},health:{score:22,inds:[]},climate:{score:40,inds:[]},social:{score:25,inds:[]},tech:{score:22,inds:[]},food:{score:30,inds:[]},mental:{score:48,inds:[]},energy:{score:42,inds:[]},demo:{score:22,inds:[]},urban:{score:35,inds:[]},science:{score:22,inds:[]},justice:{score:18,inds:[]},finance:{score:25,inds:[]},ocean:{score:38,inds:[]},bio:{score:20,inds:[]}},
MLT:{name:'Malta',flag:'🇲🇹',eco:{score:30,inds:[]},geo:{score:22,inds:[]},health:{score:25,inds:[]},climate:{score:55,inds:[]},social:{score:28,inds:[]},tech:{score:28,inds:[]},food:{score:42,inds:[]},mental:{score:42,inds:[]},energy:{score:52,inds:[]},demo:{score:35,inds:[]},urban:{score:38,inds:[]},science:{score:32,inds:[]},justice:{score:22,inds:[]},finance:{score:28,inds:[]},ocean:{score:45,inds:[]},bio:{score:25,inds:[]}},
PRK:{name:'Corea del Norte',flag:'🇰🇵',eco:{score:82,inds:[]},geo:{score:92,inds:[]},health:{score:72,inds:[]},climate:{score:62,inds:[]},social:{score:90,inds:[]},tech:{score:68,inds:[]},food:{score:82,inds:[]},mental:{score:80,inds:[]},energy:{score:72,inds:[]},demo:{score:55,inds:[]},urban:{score:65,inds:[]},science:{score:55,inds:[]},justice:{score:98,inds:[]},finance:{score:88,inds:[]},ocean:{score:48,inds:[]},bio:{score:62,inds:[]}},
ESH:{name:'Sáhara Occidental',flag:'🏳',eco:{score:72,inds:[]},geo:{score:82,inds:[]},health:{score:58,inds:[]},climate:{score:78,inds:[]},social:{score:72,inds:[]},tech:{score:62,inds:[]},food:{score:68,inds:[]},mental:{score:65,inds:[]},energy:{score:58,inds:[]},demo:{score:52,inds:[]},urban:{score:60,inds:[]},science:{score:65,inds:[]},justice:{score:80,inds:[]},finance:{score:72,inds:[]},ocean:{score:42,inds:[]},bio:{score:55,inds:[]}}
}
;

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
  el.innerHTML=inds.map(d=>{
    const bc=d.risk>66?'var(--red)':d.risk>40?'var(--yellow)':color;
    return`<div class="ind-row">
      <span class="ind-name">${d.n}</span>
      <div class="ind-track"><div class="ind-fill" style="width:${d.risk}%;background:${bc}"></div></div>
      <span class="ind-val" style="color:${bc}">${d.v}</span>
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

function showArcDetail(conn, info, cfg){
  const [fromCode,toCode,type,intensity,label] = conn;
  const panel = document.getElementById('arc-detail-panel');
  if(!panel) return;
  const typeEl    = document.getElementById('arc-detail-type');
  const titleEl   = document.getElementById('arc-detail-title');
  const descEl    = document.getElementById('arc-detail-desc');
  const intEl     = document.getElementById('arc-detail-intensity');
  const riskEl    = document.getElementById('arc-detail-risk');
  const fromName  = DATA[fromCode]?.name || fromCode;
  const toName    = DATA[toCode]?.name   || toCode;
  if(typeEl)  { typeEl.textContent  = cfg.label; typeEl.style.color = cfg.color; }
  if(titleEl) titleEl.textContent   = info.title || `${fromName} — ${toName}`;
  if(descEl)  descEl.textContent    = info.desc  || label || '';
  if(intEl)   intEl.textContent     = `INTENSIDAD: ${Math.round(intensity*100)}%`;
  if(riskEl)  {
    riskEl.textContent  = info.trend || '';
    riskEl.style.color  = info.trend?.includes('↑') ? '#FF3355'
                        : info.trend?.includes('↓') ? '#00CC66' : '#FFD700';
  }
  panel.style.borderColor = cfg.color;
  panel.classList.add('visible');
}

function hideArcDetail(){
  const panel = document.getElementById('arc-detail-panel');
  if(panel) panel.classList.remove('visible');
}

function filterArcType(type){
  // Toggle: si ya está activo, quitar filtro
  window.arcTypeFilter = (window.arcTypeFilter === type) ? null : type;
  // Actualizar visual de leyenda
  document.querySelectorAll('.arc-leg-item').forEach(el=>{
    el.classList.remove('active-filter');
  });
  if(window.arcTypeFilter){
    const idx = ['WAR','PROXY','NUKE','CRISIS','TENSION','SANCTION','INFLUENCE',null]
                .indexOf(window.arcTypeFilter);
    const items = document.querySelectorAll('.arc-leg-item');
    if(items[idx]) items[idx].classList.add('active-filter');
  }
  if(typeof window._drawGlobeArcs==='function') window._drawGlobeArcs();
}

function toggleGlobeArcs() {
  arcsVisible = !arcsVisible;
  const btn    = document.getElementById('arc-toggle-btn');
  const legend = document.getElementById('arc-legend');
  const counter= document.getElementById('arc-conflict-counter');
  if(btn)     btn.classList.toggle('active', arcsVisible);
  if(legend)  legend.classList.toggle('visible', arcsVisible);
  if(counter) counter.style.display = arcsVisible ? 'flex' : 'none';
  if(typeof arcGroup!=='undefined' && arcGroup){
    if(!arcsVisible){
      arcGroup.selectAll('[data-timer]').each(function(){
        const tid=+d3.select(this).attr('data-timer');
        if(tid) clearInterval(tid);
      });
      arcGroup.selectAll('*').remove();
      const panel=document.getElementById('arc-detail-panel');
      if(panel) panel.classList.remove('visible');
    } else {
      if(typeof window._drawGlobeArcs==='function') window._drawGlobeArcs();
    }
  }
}



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
const VELOCITY={"WLD": {"eco": 0.1, "geo": 0.4, "health": -0.1, "climate": 0.5, "social": 0.2, "tech": 0.3, "food": 0.2, "mental": 0.4, "energy": 0.1, "demo": 0.2, "urban": 0.3, "science": 0.1, "justice": 0.1, "finance": 0.3, "ocean": 0.5, "bio": 0.2}, "USA": {"eco": -0.1, "geo": 0.3, "health": -0.1, "climate": 0.2, "social": 0.4, "tech": 0.1, "food": -0.1, "mental": 0.5, "energy": -0.2, "demo": 0.1, "urban": 0.3, "science": -0.1, "justice": 0.2, "finance": 0.4, "ocean": 0.2, "bio": -0.1}, "CHN": {"eco": 0.3, "geo": 0.5, "health": -0.1, "climate": 0.2, "social": 0.1, "tech": 0.2, "food": -0.1, "mental": 0.3, "energy": -0.1, "demo": 0.5, "urban": -0.1, "science": -0.2, "justice": 0.1, "finance": 0.5, "ocean": 0.3, "bio": 0.1}, "ESP": {"eco": -0.1, "geo": -0.1, "health": -0.1, "climate": 0.5, "social": 0.1, "tech": -0.1, "food": 0.2, "mental": 0.2, "energy": -0.2, "demo": 0.4, "urban": 0.3, "science": 0.1, "justice": -0.1, "finance": 0.2, "ocean": 0.4, "bio": -0.1}, "RUS": {"eco": 0.2, "geo": 0.6, "health": 0.2, "climate": 0.2, "social": 0.5, "tech": 0.2, "food": -0.1, "mental": 0.6, "energy": 0.1, "demo": 0.5, "urban": 0.3, "science": 0.4, "justice": 0.4, "finance": 0.3, "ocean": 0.2, "bio": 0.2}, "IND": {"eco": -0.3, "geo": 0.2, "health": -0.1, "climate": 0.5, "social": 0.1, "tech": -0.2, "food": 0.2, "mental": 0.2, "energy": -0.2, "demo": -0.1, "urban": 0.3, "science": -0.1, "justice": 0.1, "finance": -0.1, "ocean": 0.3, "bio": 0.2}, "EUU": {"eco": 0.2, "geo": 0.3, "health": -0.1, "climate": 0.2, "social": 0.2, "tech": 0.1, "food": 0.1, "mental": 0.3, "energy": -0.1, "demo": 0.2, "urban": 0.2, "science": -0.1, "justice": -0.1, "finance": 0.2, "ocean": 0.3, "bio": -0.1}, "BRA": {"eco": -0.1, "geo": 0.1, "health": 0.1, "climate": 0.4, "social": 0.2, "tech": 0.1, "food": -0.1, "mental": 0.3, "energy": -0.1, "demo": -0.1, "urban": 0.2, "science": 0.1, "justice": 0.1, "finance": 0.2, "ocean": 0.3, "bio": 0.2}, "MEX": {"eco": 0.1, "geo": 0.3, "health": 0.1, "climate": 0.4, "social": 0.2, "tech": 0.1, "food": 0.2, "mental": 0.2, "energy": 0.2, "demo": 0.1, "urban": 0.4, "science": 0.2, "justice": 0.2, "finance": 0.1, "ocean": 0.2, "bio": 0.2}, "JPN": {"eco": 0.1, "geo": 0.2, "health": -0.1, "climate": 0.2, "social": 0.2, "tech": -0.1, "food": 0.1, "mental": 0.1, "energy": 0.1, "demo": 0.6, "urban": -0.1, "science": -0.1, "justice": -0.1, "finance": 0.3, "ocean": 0.2, "bio": -0.1}};
const CORR_MATRIX=[[1.0, 0.6, 0.3, 0.3, 0.7, 0.4, 0.5, 0.4, 0.6, 0.2, 0.4, 0.3, 0.4, 0.8, 0.2, 0.2], [0.6, 1.0, 0.2, 0.3, 0.6, 0.5, 0.4, 0.3, 0.5, 0.3, 0.3, 0.2, 0.8, 0.4, 0.3, 0.3], [0.3, 0.2, 1.0, 0.5, 0.3, 0.2, 0.5, 0.6, 0.2, 0.4, 0.4, 0.3, 0.2, 0.2, 0.3, 0.8], [0.3, 0.3, 0.5, 1.0, 0.4, 0.2, 0.8, 0.3, 0.5, 0.3, 0.5, 0.2, 0.2, 0.2, 0.8, 0.4], [0.7, 0.6, 0.3, 0.4, 1.0, 0.4, 0.4, 0.8, 0.3, 0.6, 0.5, 0.3, 0.7, 0.5, 0.2, 0.3], [0.4, 0.5, 0.2, 0.2, 0.4, 1.0, 0.2, 0.3, 0.4, 0.2, 0.4, 0.7, 0.3, 0.5, 0.2, 0.2], [0.5, 0.4, 0.5, 0.8, 0.4, 0.2, 1.0, 0.4, 0.4, 0.3, 0.4, 0.2, 0.3, 0.3, 0.6, 0.4], [0.4, 0.3, 0.6, 0.3, 0.8, 0.3, 0.4, 1.0, 0.2, 0.4, 0.4, 0.3, 0.4, 0.3, 0.2, 0.2], [0.6, 0.5, 0.2, 0.5, 0.3, 0.4, 0.4, 0.2, 1.0, 0.2, 0.4, 0.3, 0.2, 0.5, 0.4, 0.2], [0.2, 0.3, 0.4, 0.3, 0.6, 0.2, 0.3, 0.4, 0.2, 1.0, 0.6, 0.2, 0.3, 0.2, 0.2, 0.3], [0.4, 0.3, 0.4, 0.5, 0.5, 0.4, 0.4, 0.4, 0.4, 0.6, 1.0, 0.3, 0.3, 0.4, 0.3, 0.3], [0.3, 0.2, 0.3, 0.2, 0.3, 0.7, 0.2, 0.3, 0.3, 0.2, 0.3, 1.0, 0.2, 0.3, 0.2, 0.4], [0.4, 0.8, 0.2, 0.2, 0.7, 0.3, 0.3, 0.4, 0.2, 0.3, 0.3, 0.2, 1.0, 0.4, 0.2, 0.2], [0.8, 0.4, 0.2, 0.2, 0.5, 0.5, 0.3, 0.3, 0.5, 0.2, 0.4, 0.3, 0.4, 1.0, 0.2, 0.2], [0.2, 0.3, 0.3, 0.8, 0.2, 0.2, 0.6, 0.2, 0.4, 0.2, 0.3, 0.2, 0.2, 0.2, 1.0, 0.4], [0.2, 0.3, 0.8, 0.4, 0.3, 0.2, 0.4, 0.2, 0.2, 0.3, 0.3, 0.4, 0.2, 0.2, 0.4, 1.0]];
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
function enhancedScore(baseScore, catKey, countryCode){
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
  return Math.min(100, Math.max(0, Math.round(baseScore + velAdj + corrBoost)));
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
let mapSvg=null;

function setMapCat(el,cat){
  mapCatMode=cat;
  document.querySelectorAll('#map-cat-btns .hbtn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  const labels={'global':'ÍNDICE GLOBAL','eco':'RIESGO ECONÓMICO','geo':'RIESGO GEOPOLÍTICO','climate':'RIESGO CLIMÁTICO','bio':'RIESGO BIOSEGURIDAD','finance':'RIESGO FINANCIERO'};
  document.getElementById('map-cat-label').textContent=labels[cat]||cat.toUpperCase();
  updateMapColors();
}

function getMapScore(countryKey){
  if(!countryKey) return null;
  const d=DATA[countryKey];
  if(!d) return null;
  try{
    const keys=['eco','geo','health','climate','social','tech','food','mental',
                'energy','demo','urban','science','justice','finance','ocean','bio'];
    if(mapCatMode==='global'){
      let sum=0,cnt=0;
      keys.forEach(k=>{const cat=d[k];if(cat&&typeof cat.score==='number'){sum+=cat.score;cnt++;}});
      return cnt>0?Math.round(sum/cnt):null;
    }
    const cat=d[mapCatMode];
    return cat&&typeof cat.score==='number'?cat.score:null;
  }catch(e){return null;}
}

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

// ── Estado de los arcos
// Estado de los arcos
let arcsVisible = true;
let arcGroup = null;
let arcAnimTick = 0;

/**
 * Controles de zoom del mapa. initWorldMap() los rellena cuando el mapa
 * existe; antes de eso son null y los botones no hacen nada.
 */
export const mapControls = { zoomIn: null, zoomOut: null, reset: null };

function initWorldMap(){
  const wrap=document.getElementById('world-map-wrap');
  if(!wrap||typeof d3==='undefined'||typeof topojson==='undefined') return;

  const W=wrap.clientWidth||900, H=wrap.clientHeight||440;

  const svg=d3.select('#world-map-wrap').append('svg')
    .attr('viewBox',`0 0 ${W} ${H}`)
    .attr('preserveAspectRatio','xMidYMid meet')
    .style('cursor','default');
  mapSvg=svg;

  // Defs: filtro glow para arcos
  const defs=svg.append('defs');
  const arcFilter=defs.append('filter')
    .attr('id','arc-glow-filter')
    .attr('x','-40%').attr('y','-40%')
    .attr('width','180%').attr('height','180%');
  arcFilter.append('feGaussianBlur')
    .attr('in','SourceGraphic').attr('stdDeviation','3')
    .attr('result','blur');
  const feMerge=arcFilter.append('feMerge');
  feMerge.append('feMergeNode').attr('in','blur');
  feMerge.append('feMergeNode').attr('in','SourceGraphic');

  // Fondo oceánico
  svg.append('rect')
    .attr('width',W).attr('height',H)
    .style('fill','#060D18');

  // Proyección Natural Earth — mapa plano
  const proj=d3.geoNaturalEarth1();
  proj.fitExtent([[18,24],[W-18,H-24]], {type:'Sphere'});
  const path=d3.geoPath().projection(proj);
  const tip=document.getElementById('map-tip');

  // arcGroup se crea dentro del .then() para quedar ENCIMA de países

  // ── TopoJSON embebido ──
  const __WORLD_TOPO__ = {"type":"Topology","objects":{"countries":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","arcs":[[[0]],[[1]]],"id":"242","properties":{"name":"Fiji"}},{"type":"Polygon","arcs":[[2,3,4,5,6,7,8,9,10]],"id":"834","properties":{"name":"Tanzania"}},{"type":"Polygon","arcs":[[11,12,13,14]],"id":"732","properties":{"name":"W. Sahara"}},{"type":"MultiPolygon","arcs":[[[15,16,17,18]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]]],"id":"124","properties":{"name":"Canada"}},{"type":"MultiPolygon","arcs":[[[-19,48,49,50]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[-17,58]],[[59]]],"id":"840","properties":{"name":"United States of America"}},{"type":"Polygon","arcs":[[60,61,62,63,64,65]],"id":"398","properties":{"name":"Kazakhstan"}},{"type":"Polygon","arcs":[[-63,66,67,68,69]],"id":"860","properties":{"name":"Uzbekistan"}},{"type":"MultiPolygon","arcs":[[[70,71]],[[72]],[[73]],[[74]]],"id":"598","properties":{"name":"Papua New Guinea"}},{"type":"MultiPolygon","arcs":[[[-72,75]],[[76,77]],[[78]],[[79,80]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]]],"id":"360","properties":{"name":"Indonesia"}},{"type":"MultiPolygon","arcs":[[[90,91]],[[92,93,94,95,96,97]]],"id":"032","properties":{"name":"Argentina"}},{"type":"MultiPolygon","arcs":[[[-92,98]],[[99,-95,100,101]]],"id":"152","properties":{"name":"Chile"}},{"type":"Polygon","arcs":[[-8,102,103,104,105,106,107,108,109,110,111]],"id":"180","properties":{"name":"Dem. Rep. Congo"}},{"type":"Polygon","arcs":[[112,113,114,115]],"id":"706","properties":{"name":"Somalia"}},{"type":"Polygon","arcs":[[-3,116,117,118,-113,119]],"id":"404","properties":{"name":"Kenya"}},{"type":"Polygon","arcs":[[120,121,122,123,124,125,126,127]],"id":"729","properties":{"name":"Sudan"}},{"type":"Polygon","arcs":[[-122,128,129,130,131]],"id":"148","properties":{"name":"Chad"}},{"type":"Polygon","arcs":[[132,133]],"id":"332","properties":{"name":"Haiti"}},{"type":"Polygon","arcs":[[-133,134]],"id":"214","properties":{"name":"Dominican Rep."}},{"type":"MultiPolygon","arcs":[[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[141,142,143]],[[144]],[[145]],[[146,147,148,149,-66,150,151,152,153,154,155,156,157,158,159,160,161]],[[162]],[[163,164]]],"id":"643","properties":{"name":"Russia"}},{"type":"MultiPolygon","arcs":[[[165]],[[166]],[[167]]],"id":"044","properties":{"name":"Bahamas"}},{"type":"Polygon","arcs":[[168]],"id":"238","properties":{"name":"Falkland Is."}},{"type":"MultiPolygon","arcs":[[[169]],[[-161,170,171,172]],[[173]],[[174]]],"id":"578","properties":{"name":"Norway"}},{"type":"Polygon","arcs":[[175]],"id":"304","properties":{"name":"Greenland"}},{"type":"Polygon","arcs":[[176]],"id":"260","properties":{"name":"Fr. S. Antarctic Lands"}},{"type":"Polygon","arcs":[[177,-77]],"id":"626","properties":{"name":"Timor-Leste"}},{"type":"Polygon","arcs":[[178,179,180,181,182,183,184],[185]],"id":"710","properties":{"name":"South Africa"}},{"type":"Polygon","arcs":[[-186]],"id":"426","properties":{"name":"Lesotho"}},{"type":"Polygon","arcs":[[-50,186,187,188,189]],"id":"484","properties":{"name":"Mexico"}},{"type":"Polygon","arcs":[[190,191,-93]],"id":"858","properties":{"name":"Uruguay"}},{"type":"Polygon","arcs":[[-191,-98,192,193,194,195,196,197,198,199,200]],"id":"076","properties":{"name":"Brazil"}},{"type":"Polygon","arcs":[[-194,201,-96,-100,202]],"id":"068","properties":{"name":"Bolivia"}},{"type":"Polygon","arcs":[[-195,-203,-102,203,204,205]],"id":"604","properties":{"name":"Peru"}},{"type":"Polygon","arcs":[[-196,-206,206,207,208,209,210]],"id":"170","properties":{"name":"Colombia"}},{"type":"Polygon","arcs":[[-209,211,212,213]],"id":"591","properties":{"name":"Panama"}},{"type":"Polygon","arcs":[[-213,214,215,216]],"id":"188","properties":{"name":"Costa Rica"}},{"type":"Polygon","arcs":[[-216,217,218,219]],"id":"558","properties":{"name":"Nicaragua"}},{"type":"Polygon","arcs":[[-219,220,221,222,223]],"id":"340","properties":{"name":"Honduras"}},{"type":"Polygon","arcs":[[-222,224,225]],"id":"222","properties":{"name":"El Salvador"}},{"type":"Polygon","arcs":[[-189,226,227,-223,-226,228]],"id":"320","properties":{"name":"Guatemala"}},{"type":"Polygon","arcs":[[-188,229,-227]],"id":"084","properties":{"name":"Belize"}},{"type":"Polygon","arcs":[[-197,-211,230,231]],"id":"862","properties":{"name":"Venezuela"}},{"type":"Polygon","arcs":[[-198,-232,232,233]],"id":"328","properties":{"name":"Guyana"}},{"type":"Polygon","arcs":[[-199,-234,234,235]],"id":"740","properties":{"name":"Suriname"}},{"type":"MultiPolygon","arcs":[[[-200,-236,236]],[[237,238,239,240,241,242,243,244]],[[245]]],"id":"250","properties":{"name":"France"}},{"type":"Polygon","arcs":[[-205,246,-207]],"id":"218","properties":{"name":"Ecuador"}},{"type":"Polygon","arcs":[[247]],"id":"630","properties":{"name":"Puerto Rico"}},{"type":"Polygon","arcs":[[248]],"id":"388","properties":{"name":"Jamaica"}},{"type":"Polygon","arcs":[[249]],"id":"192","properties":{"name":"Cuba"}},{"type":"Polygon","arcs":[[-181,250,251,252]],"id":"716","properties":{"name":"Zimbabwe"}},{"type":"Polygon","arcs":[[-180,253,254,-251]],"id":"072","properties":{"name":"Botswana"}},{"type":"Polygon","arcs":[[-179,255,256,257,-254]],"id":"516","properties":{"name":"Namibia"}},{"type":"Polygon","arcs":[[258,259,260,261,262,263,264]],"id":"686","properties":{"name":"Senegal"}},{"type":"Polygon","arcs":[[-261,265,266,267,268,269,270]],"id":"466","properties":{"name":"Mali"}},{"type":"Polygon","arcs":[[-13,271,-266,-260,272]],"id":"478","properties":{"name":"Mauritania"}},{"type":"Polygon","arcs":[[273,274,275,276,277]],"id":"204","properties":{"name":"Benin"}},{"type":"Polygon","arcs":[[-131,278,279,-277,280,-268,281,282]],"id":"562","properties":{"name":"Niger"}},{"type":"Polygon","arcs":[[-278,-280,283,284]],"id":"566","properties":{"name":"Nigeria"}},{"type":"Polygon","arcs":[[-130,285,286,287,288,289,-284,-279]],"id":"120","properties":{"name":"Cameroon"}},{"type":"Polygon","arcs":[[-275,290,291,292]],"id":"768","properties":{"name":"Togo"}},{"type":"Polygon","arcs":[[-292,293,294,295]],"id":"288","properties":{"name":"Ghana"}},{"type":"Polygon","arcs":[[-270,296,-295,297,298,299]],"id":"384","properties":{"name":"Côte d'Ivoire"}},{"type":"Polygon","arcs":[[-262,-271,-300,300,301,302,303]],"id":"324","properties":{"name":"Guinea"}},{"type":"Polygon","arcs":[[-263,-304,304]],"id":"624","properties":{"name":"Guinea-Bissau"}},{"type":"Polygon","arcs":[[-299,305,306,-301]],"id":"430","properties":{"name":"Liberia"}},{"type":"Polygon","arcs":[[-302,-307,307]],"id":"694","properties":{"name":"Sierra Leone"}},{"type":"Polygon","arcs":[[-269,-281,-276,-293,-296,-297]],"id":"854","properties":{"name":"Burkina Faso"}},{"type":"Polygon","arcs":[[-108,308,-286,-129,-121,309]],"id":"140","properties":{"name":"Central African Rep."}},{"type":"Polygon","arcs":[[-107,310,311,312,-287,-309]],"id":"178","properties":{"name":"Congo"}},{"type":"Polygon","arcs":[[-288,-313,313,314]],"id":"266","properties":{"name":"Gabon"}},{"type":"Polygon","arcs":[[-289,-315,315]],"id":"226","properties":{"name":"Eq. Guinea"}},{"type":"Polygon","arcs":[[-7,316,317,-252,-255,-258,318,-103]],"id":"894","properties":{"name":"Zambia"}},{"type":"Polygon","arcs":[[-6,319,-317]],"id":"454","properties":{"name":"Malawi"}},{"type":"Polygon","arcs":[[-5,320,-184,321,-182,-253,-318,-320]],"id":"508","properties":{"name":"Mozambique"}},{"type":"Polygon","arcs":[[-183,-322]],"id":"748","properties":{"name":"eSwatini"}},{"type":"MultiPolygon","arcs":[[[-106,322,-311]],[[-104,-319,-257,323]]],"id":"024","properties":{"name":"Angola"}},{"type":"Polygon","arcs":[[-9,-112,324]],"id":"108","properties":{"name":"Burundi"}},{"type":"Polygon","arcs":[[325,326,327,328,329,330,331]],"id":"376","properties":{"name":"Israel"}},{"type":"Polygon","arcs":[[-331,332,333]],"id":"422","properties":{"name":"Lebanon"}},{"type":"Polygon","arcs":[[334]],"id":"450","properties":{"name":"Madagascar"}},{"type":"Polygon","arcs":[[-327,335]],"id":"275","properties":{"name":"Palestine"}},{"type":"Polygon","arcs":[[-265,336]],"id":"270","properties":{"name":"Gambia"}},{"type":"Polygon","arcs":[[337,338,339]],"id":"788","properties":{"name":"Tunisia"}},{"type":"Polygon","arcs":[[-12,340,341,-338,342,-282,-267,-272]],"id":"012","properties":{"name":"Algeria"}},{"type":"Polygon","arcs":[[-326,343,344,345,346,-328,-336]],"id":"400","properties":{"name":"Jordan"}},{"type":"Polygon","arcs":[[347,348,349,350,351]],"id":"784","properties":{"name":"United Arab Emirates"}},{"type":"Polygon","arcs":[[352,353]],"id":"634","properties":{"name":"Qatar"}},{"type":"Polygon","arcs":[[354,355,356]],"id":"414","properties":{"name":"Kuwait"}},{"type":"Polygon","arcs":[[-345,357,358,359,360,-357,361]],"id":"368","properties":{"name":"Iraq"}},{"type":"MultiPolygon","arcs":[[[-351,362,363,364]],[[-349,365]]],"id":"512","properties":{"name":"Oman"}},{"type":"MultiPolygon","arcs":[[[366]],[[367]]],"id":"548","properties":{"name":"Vanuatu"}},{"type":"Polygon","arcs":[[368,369,370,371]],"id":"116","properties":{"name":"Cambodia"}},{"type":"Polygon","arcs":[[-369,372,373,374,375,376]],"id":"764","properties":{"name":"Thailand"}},{"type":"Polygon","arcs":[[-370,-377,377,378,379]],"id":"418","properties":{"name":"Laos"}},{"type":"Polygon","arcs":[[-376,380,381,382,383,-378]],"id":"104","properties":{"name":"Myanmar"}},{"type":"Polygon","arcs":[[-371,-380,384,385]],"id":"704","properties":{"name":"Vietnam"}},{"type":"MultiPolygon","arcs":[[[386,386,386]],[[-147,387,388,389,390]]],"id":"408","properties":{"name":"North Korea"}},{"type":"Polygon","arcs":[[-389,391]],"id":"410","properties":{"name":"South Korea"}},{"type":"Polygon","arcs":[[-149,392]],"id":"496","properties":{"name":"Mongolia"}},{"type":"Polygon","arcs":[[-383,393,394,395,396,397,398,399,400]],"id":"356","properties":{"name":"India"}},{"type":"Polygon","arcs":[[-382,401,-394]],"id":"050","properties":{"name":"Bangladesh"}},{"type":"Polygon","arcs":[[-400,402]],"id":"064","properties":{"name":"Bhutan"}},{"type":"Polygon","arcs":[[-398,403]],"id":"524","properties":{"name":"Nepal"}},{"type":"Polygon","arcs":[[-396,404,405,406,407]],"id":"586","properties":{"name":"Pakistan"}},{"type":"Polygon","arcs":[[-69,408,409,-407,410,411]],"id":"004","properties":{"name":"Afghanistan"}},{"type":"Polygon","arcs":[[-68,412,413,-409]],"id":"762","properties":{"name":"Tajikistan"}},{"type":"Polygon","arcs":[[-62,414,-413,-67]],"id":"417","properties":{"name":"Kyrgyzstan"}},{"type":"Polygon","arcs":[[-64,-70,-412,415,416]],"id":"795","properties":{"name":"Turkmenistan"}},{"type":"Polygon","arcs":[[-360,417,418,419,420,421,-416,-411,-406,422]],"id":"364","properties":{"name":"Iran"}},{"type":"Polygon","arcs":[[-332,-334,423,424,-358,-344]],"id":"760","properties":{"name":"Syria"}},{"type":"Polygon","arcs":[[-420,425,426,427,428]],"id":"051","properties":{"name":"Armenia"}},{"type":"Polygon","arcs":[[-172,429,430]],"id":"752","properties":{"name":"Sweden"}},{"type":"Polygon","arcs":[[-156,431,432,433,434]],"id":"112","properties":{"name":"Belarus"}},{"type":"Polygon","arcs":[[-155,435,-164,436,437,438,439,440,441,442,-432]],"id":"804","properties":{"name":"Ukraine"}},{"type":"Polygon","arcs":[[-433,-443,443,444,445,446,-142,447]],"id":"616","properties":{"name":"Poland"}},{"type":"Polygon","arcs":[[448,449,450,451,452,453,454]],"id":"040","properties":{"name":"Austria"}},{"type":"Polygon","arcs":[[-441,455,456,457,458,-449,459]],"id":"348","properties":{"name":"Hungary"}},{"type":"Polygon","arcs":[[-439,460]],"id":"498","properties":{"name":"Moldova"}},{"type":"Polygon","arcs":[[-438,461,462,463,-456,-440,-461]],"id":"642","properties":{"name":"Romania"}},{"type":"Polygon","arcs":[[-434,-448,-144,464,465]],"id":"440","properties":{"name":"Lithuania"}},{"type":"Polygon","arcs":[[-157,-435,-466,466,467]],"id":"428","properties":{"name":"Latvia"}},{"type":"Polygon","arcs":[[-158,-468,468]],"id":"233","properties":{"name":"Estonia"}},{"type":"Polygon","arcs":[[-446,469,-453,470,-238,471,472,473,474,475,476]],"id":"276","properties":{"name":"Germany"}},{"type":"Polygon","arcs":[[-463,477,478,479,480,481]],"id":"100","properties":{"name":"Bulgaria"}},{"type":"MultiPolygon","arcs":[[[482]],[[-480,483,484,485,486]]],"id":"300","properties":{"name":"Greece"}},{"type":"MultiPolygon","arcs":[[[-359,-425,487,488,-427,-418]],[[-479,489,-484]]],"id":"792","properties":{"name":"Turkey"}},{"type":"Polygon","arcs":[[-486,490,491,492,493]],"id":"008","properties":{"name":"Albania"}},{"type":"Polygon","arcs":[[-458,494,495,496,497,498]],"id":"191","properties":{"name":"Croatia"}},{"type":"Polygon","arcs":[[-452,499,-239,-471]],"id":"756","properties":{"name":"Switzerland"}},{"type":"Polygon","arcs":[[-472,-245,500]],"id":"442","properties":{"name":"Luxembourg"}},{"type":"Polygon","arcs":[[-473,-501,-244,501,502]],"id":"056","properties":{"name":"Belgium"}},{"type":"Polygon","arcs":[[-474,-503,503]],"id":"528","properties":{"name":"Netherlands"}},{"type":"Polygon","arcs":[[504,505]],"id":"620","properties":{"name":"Portugal"}},{"type":"Polygon","arcs":[[-505,506,-242,507]],"id":"724","properties":{"name":"Spain"}},{"type":"Polygon","arcs":[[508,509]],"id":"372","properties":{"name":"Ireland"}},{"type":"Polygon","arcs":[[510]],"id":"540","properties":{"name":"New Caledonia"}},{"type":"MultiPolygon","arcs":[[[511]],[[512]],[[513]],[[514]],[[515]]],"id":"090","properties":{"name":"Solomon Is."}},{"type":"MultiPolygon","arcs":[[[516]],[[517]]],"id":"554","properties":{"name":"New Zealand"}},{"type":"MultiPolygon","arcs":[[[518]],[[519]]],"id":"036","properties":{"name":"Australia"}},{"type":"Polygon","arcs":[[520]],"id":"144","properties":{"name":"Sri Lanka"}},{"type":"MultiPolygon","arcs":[[[521]],[[-61,-150,-393,-148,-391,522,-385,-379,-384,-401,-403,-399,-404,-397,-408,-410,-414,-415]]],"id":"156","properties":{"name":"China"}},{"type":"Polygon","arcs":[[523]],"id":"158","properties":{"name":"Taiwan"}},{"type":"MultiPolygon","arcs":[[[-451,524,525,-240,-500]],[[526]],[[527]]],"id":"380","properties":{"name":"Italy"}},{"type":"MultiPolygon","arcs":[[[-476,528]],[[529]]],"id":"208","properties":{"name":"Denmark"}},{"type":"MultiPolygon","arcs":[[[-510,530]],[[531]]],"id":"826","properties":{"name":"United Kingdom"}},{"type":"Polygon","arcs":[[532]],"id":"352","properties":{"name":"Iceland"}},{"type":"MultiPolygon","arcs":[[[-152,533,-421,-429,534]],[[-419,-426]]],"id":"031","properties":{"name":"Azerbaijan"}},{"type":"Polygon","arcs":[[-153,-535,-428,-489,535]],"id":"268","properties":{"name":"Georgia"}},{"type":"MultiPolygon","arcs":[[[536]],[[537]],[[538]],[[539]],[[540]],[[541]],[[542]]],"id":"608","properties":{"name":"Philippines"}},{"type":"MultiPolygon","arcs":[[[-374,543]],[[-81,544,545,546]]],"id":"458","properties":{"name":"Malaysia"}},{"type":"Polygon","arcs":[[-546,547]],"id":"096","properties":{"name":"Brunei"}},{"type":"Polygon","arcs":[[-450,-459,-499,548,-525]],"id":"705","properties":{"name":"Slovenia"}},{"type":"Polygon","arcs":[[-160,549,-430,-171]],"id":"246","properties":{"name":"Finland"}},{"type":"Polygon","arcs":[[-442,-460,-455,550,-444]],"id":"703","properties":{"name":"Slovakia"}},{"type":"Polygon","arcs":[[-445,-551,-454,-470]],"id":"203","properties":{"name":"Czechia"}},{"type":"Polygon","arcs":[[-126,551,552,553]],"id":"232","properties":{"name":"Eritrea"}},{"type":"MultiPolygon","arcs":[[[554]],[[555]],[[556]]],"id":"392","properties":{"name":"Japan"}},{"type":"Polygon","arcs":[[-193,-97,-202]],"id":"600","properties":{"name":"Paraguay"}},{"type":"Polygon","arcs":[[-364,557,558]],"id":"887","properties":{"name":"Yemen"}},{"type":"Polygon","arcs":[[-346,-362,-356,559,-354,560,-352,-365,-559,561]],"id":"682","properties":{"name":"Saudi Arabia"}},{"type":"MultiPolygon","arcs":[[[562]],[[563]],[[564]],[[565]],[[566]],[[567]],[[568]],[[569]]],"id":"010","properties":{"name":"Antarctica"}},{"type":"Polygon","arcs":[[570,571]],"properties":{"name":"N. Cyprus"}},{"type":"Polygon","arcs":[[-572,572]],"id":"196","properties":{"name":"Cyprus"}},{"type":"Polygon","arcs":[[-341,-15,573]],"id":"504","properties":{"name":"Morocco"}},{"type":"Polygon","arcs":[[-124,574,575,-329,576]],"id":"818","properties":{"name":"Egypt"}},{"type":"Polygon","arcs":[[-123,-132,-283,-343,-340,577,-575]],"id":"434","properties":{"name":"Libya"}},{"type":"Polygon","arcs":[[-114,-119,578,-127,-554,579,580]],"id":"231","properties":{"name":"Ethiopia"}},{"type":"Polygon","arcs":[[-553,581,582,-580]],"id":"262","properties":{"name":"Djibouti"}},{"type":"Polygon","arcs":[[-115,-581,-583,583]],"properties":{"name":"Somaliland"}},{"type":"Polygon","arcs":[[-11,584,-110,585,-117]],"id":"800","properties":{"name":"Uganda"}},{"type":"Polygon","arcs":[[-10,-325,-111,-585]],"id":"646","properties":{"name":"Rwanda"}},{"type":"Polygon","arcs":[[-496,586,587]],"id":"070","properties":{"name":"Bosnia and Herz."}},{"type":"Polygon","arcs":[[-481,-487,-494,588,589]],"id":"807","properties":{"name":"Macedonia"}},{"type":"Polygon","arcs":[[-457,-464,-482,-590,590,591,-587,-495]],"id":"688","properties":{"name":"Serbia"}},{"type":"Polygon","arcs":[[-492,592,-497,-588,-592,593]],"id":"499","properties":{"name":"Montenegro"}},{"type":"Polygon","arcs":[[-493,-594,-591,-589]],"properties":{"name":"Kosovo"}},{"type":"Polygon","arcs":[[594]],"id":"780","properties":{"name":"Trinidad and Tobago"}},{"type":"Polygon","arcs":[[-109,-310,-128,-579,-118,-586]],"id":"728","properties":{"name":"S. Sudan"}}]},"land":{"type":"GeometryCollection","geometries":[{"type":"MultiPolygon","arcs":[[[0]],[[1]],[[3,320,184,255,323,104,322,311,313,315,289,284,273,290,293,297,305,307,302,304,263,336,258,272,13,573,341,338,577,575,329,332,423,487,535,153,435,164,436,461,477,489,484,490,592,497,548,525,240,507,505,506,242,501,503,474,528,476,446,142,464,466,468,158,549,430,172,161,387,391,389,522,385,371,372,543,374,380,401,394,404,422,360,354,559,352,560,347,365,349,362,557,561,346,576,124,551,581,583,115,119],[421,416,64,150,533]],[[17,48,186,229,227,223,219,216,213,209,230,232,234,236,200,191,93,100,203,246,207,211,214,217,220,224,228,189,50,15,58]],[[19]],[[20]],[[21]],[[22]],[[23]],[[24]],[[25]],[[26]],[[27]],[[28]],[[29]],[[30]],[[31]],[[32]],[[33]],[[34]],[[35]],[[36]],[[37]],[[38]],[[39]],[[40]],[[41]],[[42]],[[43]],[[44]],[[45]],[[46]],[[47]],[[51]],[[52]],[[53]],[[54]],[[55]],[[56]],[[57]],[[59]],[[70,75]],[[72]],[[73]],[[74]],[[77,177]],[[78]],[[546,79,544,547]],[[81]],[[82]],[[83]],[[84]],[[85]],[[86]],[[87]],[[88]],[[89]],[[90,98]],[[133,134]],[[135]],[[136]],[[137]],[[138]],[[139]],[[140]],[[144]],[[145]],[[162]],[[165]],[[166]],[[167]],[[168]],[[169]],[[173]],[[174]],[[175]],[[176]],[[245]],[[247]],[[248]],[[249]],[[334]],[[366]],[[367]],[[482]],[[508,530]],[[510]],[[511]],[[512]],[[513]],[[514]],[[515]],[[516]],[[517]],[[518]],[[519]],[[520]],[[521]],[[523]],[[526]],[[527]],[[529]],[[531]],[[532]],[[536]],[[537]],[[538]],[[539]],[[540]],[[541]],[[542]],[[554]],[[555]],[[556]],[[562]],[[563]],[[564]],[[565]],[[566]],[[567]],[[568]],[[569]],[[570,572]],[[594]]]}]}},"arcs":[[[99478,40237],[69,98],[96,-171],[-46,-308],[-172,-81],[-153,73],[-27,260],[107,203],[126,-74]],[[0,41087],[57,27],[-34,-284],[-23,-32],[99822,-145],[-177,-124],[-36,220],[139,121],[88,33],[163,184],[-99999,0]],[[59417,50018],[47,-65],[1007,-1203],[19,-343],[399,-590]],[[60889,47817],[-128,-728],[16,-335],[178,-216],[8,-153],[-76,-357],[16,-180],[-18,-282],[97,-370],[115,-583],[101,-129]],[[61198,44484],[-221,-342],[-303,-230],[-167,10],[-99,-177],[-193,-16],[-73,-74],[-334,166],[-209,-48]],[[59599,43773],[-77,804],[-95,275],[-55,164],[-273,110]],[[59099,45126],[-157,177],[-177,100],[-111,99],[-116,150]],[[58538,45652],[-150,745],[-161,330],[-55,343],[27,307],[-50,544]],[[58149,47921],[115,28],[101,214],[108,308],[69,124],[-3,192],[-60,134],[-16,233]],[[58463,49154],[80,74],[16,348],[-110,333]],[[58449,49909],[98,71],[304,-7],[566,45]],[[47592,66920],[1,-40],[-6,-114]],[[47587,66766],[-1,-895],[-911,31],[9,-1512],[-261,-53],[-68,-304],[53,-853],[-1088,4],[-60,-197]],[[45260,62987],[12,249]],[[45272,63236],[5,-1],[625,48],[33,213],[114,265],[92,816],[386,637],[131,745],[86,44],[91,460],[234,63],[100,-76],[126,0],[90,134],[172,19],[-7,317],[42,0]],[[15878,79530],[-38,1],[-537,581],[-199,255],[-503,244],[-155,523],[40,363],[-356,252],[-48,476],[-336,429],[-6,304]],[[13740,82958],[154,285],[-7,373],[-473,376],[-284,674],[-173,424],[-255,266],[-187,242],[-147,306],[-279,-192],[-270,-330],[-247,388],[-194,259],[-271,164],[-273,17],[1,3364],[2,2193]],[[10837,91767],[518,-142],[438,-285],[289,-54],[244,247],[336,184],[413,-72],[416,259],[455,148],[191,-245],[207,138],[62,278],[192,-63],[470,-530],[369,401],[38,-449],[341,97],[105,173],[337,-34],[424,-248],[650,-217],[383,-100],[272,38],[374,-300],[-390,-293],[502,-127],[750,70],[236,103],[296,-354],[302,299],[-283,251],[179,202],[338,27],[223,59],[224,-141],[279,-321],[310,47],[491,-266],[431,94],[405,-14],[-32,367],[247,103],[431,-200],[-2,-559],[177,471],[223,-16],[126,594],[-298,364],[-324,239],[22,653],[329,429],[366,-95],[281,-261],[378,-666],[-247,-290],[517,-120],[-1,-604],[371,463],[332,-380],[-83,-438],[269,-399],[290,427],[202,510],[16,649],[394,-46],[411,-87],[373,-293],[17,-293],[-207,-315],[196,-316],[-36,-288],[-544,-413],[-386,-91],[-287,178],[-83,-297],[-268,-498],[-81,-259],[-322,-399],[-397,-39],[-220,-250],[-18,-384],[-323,-74],[-340,-479],[-301,-665],[-108,-466],[-16,-686],[409,-99],[125,-553],[130,-448],[388,117],[517,-256],[277,-225],[199,-279],[348,-163],[294,-248],[459,-34],[302,-58],[-45,-511],[86,-594],[201,-661],[414,-561],[214,192],[150,607],[-145,934],[-196,311],[445,276],[314,415],[154,411],[-23,395],[-188,502],[-338,445],[328,619],[-121,535],[-93,922],[194,137],[476,-161],[286,-57],[230,155],[258,-200],[342,-343],[85,-229],[495,-45],[-8,-496],[92,-747],[254,-92],[201,-348],[402,328],[266,652],[184,274],[216,-527],[362,-754],[307,-709],[-112,-371],[370,-333],[250,-338],[442,-152],[179,-189],[110,-500],[216,-78],[112,-223],[20,-664],[-202,-222],[-199,-207],[-458,-210],[-349,-486],[-470,-96],[-594,125],[-417,4],[-287,-41],[-233,-424],[-354,-262],[-401,-782],[-320,-545],[236,97],[446,776],[583,493],[415,58],[246,-289],[-262,-397],[88,-637],[91,-446],[361,-295],[459,86],[278,664],[19,-429],[180,-214],[-344,-387],[-615,-351],[-276,-239],[-310,-426],[-211,44],[-11,500],[483,488],[-445,-19],[-309,-72]],[[31350,77248],[-181,334],[0,805],[-123,171],[-187,-100],[-92,155],[-212,-446],[-84,-460],[-99,-269],[-118,-91],[-89,-30],[-28,-146],[-512,0],[-422,-4],[-125,-109],[-294,-425],[-34,-46],[-89,-231],[-255,1],[-273,-3],[-125,-93],[44,-116],[25,-181],[-5,-60],[-363,-293],[-286,-93],[-323,-316],[-70,0],[-94,93],[-31,85],[6,61],[61,207],[131,325],[81,349],[-56,514],[-59,536],[-290,277],[35,105],[-41,73],[-76,0],[-56,93],[-14,140],[-54,-61],[-75,18],[17,59],[-65,58],[-27,155],[-216,189],[-224,197],[-272,229],[-261,214],[-248,-167],[-91,-6],[-342,154],[-225,-77],[-269,183],[-284,94],[-194,36],[-86,100],[-49,325],[-94,-3],[-1,-227],[-575,0],[-951,0],[-944,0],[-833,0],[-834,0],[-819,0],[-847,0],[-273,0],[-824,0],[-789,0]],[[26668,87478],[207,273],[381,-6],[-6,-114],[-325,-326],[-196,13],[-61,160]],[[27840,93593],[-306,313],[12,213],[133,39],[636,-63],[479,-325],[25,-163],[-296,17],[-299,13],[-304,-80],[-80,36]],[[27690,87261],[107,177],[114,-13],[70,-121],[-108,-310],[-123,50],[-73,176],[13,41]],[[23996,94879],[-151,-229],[-403,44],[-337,155],[148,266],[399,159],[243,-208],[101,-187]],[[23933,96380],[-126,-17],[-521,38],[-74,165],[559,-9],[195,-109],[-33,-68]],[[23124,97116],[332,-205],[-76,-214],[-411,-122],[-226,138],[-119,221],[-22,245],[360,-24],[162,-39]],[[25514,94532],[-449,73],[-738,190],[-96,325],[-34,293],[-279,258],[-574,72],[-322,183],[104,242],[573,-37],[308,-190],[547,1],[240,-194],[-64,-222],[319,-134],[177,-140],[374,-26],[406,-50],[441,128],[566,51],[451,-42],[298,-223],[62,-244],[-174,-157],[-414,-127],[-355,72],[-797,-91],[-570,-11]],[[19093,96754],[392,-92],[-93,-177],[-518,-170],[-411,191],[224,188],[406,60]],[[19177,97139],[361,-120],[-339,-115],[-461,1],[5,84],[285,177],[149,-27]],[[34555,80899],[-148,-372],[-184,-517],[181,199],[187,-126],[-98,-206],[247,-162],[128,144],[277,-182],[-86,-433],[194,101],[36,-313],[86,-367],[-117,-520],[-125,-22],[-183,111],[60,484],[-77,75],[-322,-513],[-166,21],[196,277],[-267,144],[-298,-35],[-539,18],[-43,175],[173,208],[-121,160],[234,356],[287,941],[172,336],[241,204],[129,-26],[-54,-160]],[[26699,89048],[304,-203],[318,-184],[25,-281],[204,46],[199,-196],[-247,-186],[-432,142],[-156,266],[-275,-314],[-396,-306],[-95,346],[-377,-57],[242,292],[35,465],[95,542],[201,-49],[51,-259],[143,91],[161,-155]],[[28119,93327],[263,235],[616,-299],[383,-282],[36,-258],[515,134],[290,-376],[670,-234],[242,-238],[263,-553],[-510,-275],[654,-386],[441,-130],[400,-543],[437,-39],[-87,-414],[-487,-687],[-342,253],[-437,568],[-359,-74],[-35,-338],[292,-344],[377,-272],[114,-157],[181,-584],[-96,-425],[-350,160],[-697,473],[393,-509],[289,-357],[45,-206],[-753,236],[-596,343],[-337,287],[97,167],[-414,304],[-405,286],[5,-171],[-803,-94],[-235,203],[183,435],[522,10],[571,76],[-92,211],[96,294],[360,576],[-77,261],[-107,203],[-425,286],[-563,201],[178,150],[-294,367],[-245,34],[-219,201],[-149,-175],[-503,-76],[-1011,132],[-588,174],[-450,89],[-231,207],[290,270],[-394,2],[-88,599],[213,528],[286,241],[717,158],[-204,-382],[219,-369],[256,477],[704,242],[477,-611],[-42,-387],[550,172]],[[23749,94380],[579,-20],[530,-144],[-415,-526],[-331,-115],[-298,-442],[-317,22],[-173,519],[4,294],[145,251],[276,161]],[[15873,95551],[472,442],[570,383],[426,-9],[381,87],[-38,-454],[-214,-205],[-259,-29],[-517,-252],[-444,-91],[-377,128]],[[13136,82508],[267,47],[-84,-671],[242,-475],[-111,1],[-167,270],[-103,272],[-140,184],[-51,260],[16,188],[131,-76]],[[20696,97433],[546,-81],[751,-215],[212,-281],[108,-247],[-453,66],[-457,192],[-619,21],[268,176],[-335,142],[-21,227]],[[15692,79240],[-140,-82],[-456,269],[-84,209],[-248,207],[-50,168],[-286,107],[-107,321],[24,137],[291,-129],[171,-89],[261,-63],[94,-204],[138,-280],[277,-244],[115,-327]],[[16239,94566],[397,-123],[709,-33],[270,-171],[298,-249],[-349,-149],[-681,-415],[-344,-414],[0,-257],[-731,-285],[-147,259],[-641,312],[119,250],[192,432],[241,388],[-272,362],[939,93]],[[20050,95391],[247,99],[291,-26],[49,-289],[-169,-281],[-940,-91],[-701,-256],[-423,-14],[-35,193],[577,261],[-1255,-70],[-389,106],[379,577],[262,165],[782,-199],[493,-350],[485,-45],[-397,565],[255,215],[286,-68],[94,-282],[109,-210]],[[20410,93755],[311,-239],[175,-575],[86,-417],[466,-293],[502,-279],[-31,-260],[-456,-48],[178,-227],[-94,-217],[-503,93],[-478,160],[-322,-36],[-522,-201],[-704,-88],[-494,-56],[-151,279],[-379,161],[-246,-66],[-343,468],[185,62],[429,101],[392,-26],[362,103],[-537,138],[-594,-47],[-394,12],[-146,217],[644,237],[-428,-9],[-485,156],[233,443],[193,235],[744,359],[284,-114],[-139,-277],[618,179],[386,-298],[314,302],[254,-194],[227,-580],[140,244],[-197,606],[244,86],[276,-94]],[[22100,93536],[-306,386],[329,286],[331,-124],[496,75],[72,-172],[-259,-283],[420,-254],[-50,-532],[-455,-229],[-268,50],[-192,225],[-690,456],[5,189],[567,-73]],[[20389,94064],[372,24],[211,-130],[-244,-390],[-434,413],[95,83]],[[22639,95907],[212,-273],[9,-303],[-127,-440],[-458,-60],[-298,94],[5,345],[-455,-46],[-18,457],[299,-18],[419,201],[390,-34],[22,77]],[[23329,98201],[192,180],[285,42],[-122,135],[646,30],[355,-315],[468,-127],[455,-112],[220,-390],[334,-190],[-381,-176],[-513,-445],[-492,-42],[-575,76],[-299,240],[4,215],[220,157],[-508,-4],[-306,196],[-176,268],[193,262]],[[24559,98965],[413,112],[324,19],[545,96],[409,220],[344,-30],[300,-166],[211,319],[367,95],[498,65],[849,24],[148,-63],[802,100],[601,-38],[602,-37],[742,-47],[597,-75],[508,-161],[-12,-157],[-678,-257],[-672,-119],[-251,-133],[605,3],[-656,-358],[-452,-167],[-476,-483],[-573,-98],[-177,-120],[-841,-64],[383,-74],[-192,-105],[230,-292],[-264,-202],[-429,-167],[-132,-232],[-388,-176],[39,-134],[475,23],[6,-144],[-742,-355],[-726,163],[-816,-91],[-414,71],[-525,31],[-35,284],[514,133],[-137,427],[170,41],[742,-255],[-379,379],[-450,113],[225,229],[492,141],[79,206],[-392,231],[-118,304],[759,-26],[220,-64],[433,216],[-625,68],[-972,-38],[-491,201],[-232,239],[-324,173],[-61,202]],[[29106,90427],[-180,-174],[-312,-30],[-69,289],[118,331],[255,82],[217,-163],[3,-253],[-32,-82]],[[23262,91636],[169,-226],[-173,-207],[-374,179],[-226,-65],[-380,266],[245,183],[194,256],[295,-168],[166,-106],[84,-112]],[[32078,80046],[96,49],[365,-148],[284,-247],[8,-108],[-135,-11],[-360,186],[-258,279]],[[32218,78370],[97,-288],[202,-79],[257,16],[-137,-242],[-102,-38],[-353,250],[-69,198],[105,183]],[[31350,77248],[48,-194],[-296,-286],[-286,-204],[-293,-175],[-147,-351],[-47,-133],[-3,-313],[92,-313],[115,-15],[-29,216],[83,-131],[-22,-169],[-188,-96],[-133,11],[-205,-103],[-121,-29],[-162,-29],[-231,-171],[408,111],[82,-112],[-389,-177],[-177,-1],[8,72],[-84,-164],[82,-27],[-60,-424],[-203,-455],[-20,152],[-61,30],[-91,148],[57,-318],[69,-105],[5,-223],[-89,-230],[-157,-472],[-25,24],[86,402],[-142,225],[-33,491],[-53,-255],[59,-375],[-183,93],[191,-191],[12,-562],[79,-41],[29,-204],[39,-591],[-176,-439],[-288,-175],[-182,-346],[-139,-38],[-141,-217],[-39,-199],[-305,-383],[-157,-281],[-131,-351],[-43,-419],[50,-411],[92,-505],[124,-418],[1,-256],[132,-685],[-9,-398],[-12,-230],[-69,-361],[-83,-75],[-137,72],[-44,259],[-105,136],[-148,508],[-129,452],[-42,231],[57,393],[-77,325],[-217,494],[-108,90],[-281,-268],[-49,30],[-135,275],[-174,147],[-314,-75],[-247,66],[-212,-41],[-114,-92],[50,-157],[-5,-240],[59,-117],[-53,-77],[-103,87],[-104,-112],[-202,18],[-207,312],[-242,-73],[-202,137],[-173,-42],[-234,-138],[-253,-438],[-276,-255],[-152,-282],[-63,-266],[-3,-407],[14,-284],[52,-201]],[[23016,65864],[-108,-18],[-197,130],[-217,184],[-78,277],[-61,414],[-164,337],[-96,346],[-139,404],[-196,236],[-227,-11],[-175,-467],[-230,177],[-144,178],[-69,325],[-92,309],[-165,260],[-142,186],[-102,210],[-481,0],[0,-244],[-221,0],[-552,-4],[-634,416],[-419,287],[26,116],[-353,-64],[-316,-46]],[[17464,69802],[-46,302],[-180,340],[-130,71],[-30,169],[-156,30],[-100,159],[-258,59],[-71,95],[-33,324],[-270,594],[-231,821],[10,137],[-123,195],[-215,495],[-38,482],[-148,323],[61,489],[-10,507],[-89,453],[109,557],[34,536],[33,536],[-50,792],[-88,506],[-80,274],[33,115],[402,-200],[148,-558],[69,156],[-45,484],[-94,485]],[[6833,62443],[49,-51],[45,-79],[71,-207],[-7,-33],[-108,-126],[-89,-92],[-41,-99],[-69,84],[8,165],[-46,216],[14,65],[48,97],[-19,116],[16,55],[21,-11],[107,-100]],[[6668,62848],[-23,-71],[-94,-43],[-47,125],[-32,48],[-3,37],[27,50],[99,-56],[73,-90]],[[6456,63091],[-9,-63],[-149,17],[21,72],[137,-26]],[[6104,63411],[23,-38],[80,-196],[-15,-34],[-19,8],[-97,21],[-35,133],[-11,24],[74,82]],[[5732,63705],[5,-138],[-33,-58],[-93,107],[14,43],[43,58],[64,-12]],[[3759,86256],[220,-54],[27,-226],[-171,-92],[-182,110],[-168,161],[274,101]],[[7436,84829],[185,-40],[117,-183],[-240,-281],[-277,-225],[-142,152],[-43,277],[252,210],[148,90]],[[13740,82958],[-153,223],[-245,188],[-78,515],[-358,478],[-150,558],[-267,38],[-441,15],[-326,170],[-574,613],[-266,112],[-486,211],[-385,-51],[-546,272],[-330,252],[-309,-125],[58,-411],[-154,-38],[-321,-123],[-245,-199],[-308,-126],[-39,348],[125,580],[295,182],[-76,148],[-354,-329],[-190,-394],[-400,-420],[203,-287],[-262,-424],[-299,-248],[-278,-180],[-69,-261],[-434,-305],[-87,-278],[-325,-252],[-191,45],[-259,-165],[-282,-201],[-231,-197],[-477,-169],[-43,99],[304,276],[271,182],[296,324],[345,66],[137,243],[385,353],[62,119],[205,208],[48,448],[141,349],[-320,-179],[-90,102],[-150,-215],[-181,300],[-75,-212],[-104,294],[-278,-236],[-170,0],[-24,352],[50,216],[-179,211],[-361,-113],[-235,277],[-190,142],[-1,334],[-214,252],[108,340],[226,330],[99,303],[225,43],[191,-94],[224,285],[201,-51],[212,183],[-52,270],[-155,106],[205,228],[-170,-7],[-295,-128],[-85,-131],[-219,131],[-392,-67],[-407,142],[-117,238],[-351,343],[390,247],[620,289],[228,0],[-38,-296],[586,23],[-225,366],[-342,225],[-197,296],[-267,252],[-381,187],[155,309],[493,19],[350,270],[66,287],[284,281],[271,68],[526,262],[256,-40],[427,315],[421,-124],[201,-266],[123,114],[469,-35],[-16,-136],[425,-101],[283,59],[585,-186],[534,-56],[214,-77],[370,96],[421,-177],[302,-83]],[[2297,88264],[171,-113],[173,61],[225,-156],[276,-79],[-23,-64],[-211,-125],[-211,128],[-106,107],[-245,-34],[-66,52],[17,223]],[[74266,79657],[-212,-393],[-230,-56],[-13,-592],[-155,-267],[-551,194],[-200,-1058],[-143,-131],[-550,-236],[250,-1026],[-190,-154],[22,-337]],[[72294,75601],[-171,87],[-140,212],[-412,62],[-461,16],[-100,-65],[-396,248],[-158,-122],[-43,-349],[-457,204],[-183,-84],[-62,-259]],[[69711,75551],[-159,-109],[-367,-412],[-121,-422],[-104,-4],[-76,280],[-353,19],[-57,484],[-135,4],[21,593],[-333,431],[-476,-46],[-326,-86],[-265,533],[-227,223],[-431,423],[-52,51],[-715,-349],[11,-2178]],[[65546,74986],[-142,-29],[-195,463],[-188,166],[-315,-123],[-123,-197]],[[64583,75266],[-15,144],[68,246],[-53,206],[-322,202],[-125,530],[-154,150],[-9,192],[270,-56],[11,432],[236,96],[243,-88],[50,576],[-50,365],[-278,-28],[-236,144],[-321,-260],[-259,-124]],[[63639,77993],[-142,96],[29,304],[-177,395],[-207,-17],[-235,401],[160,448],[-81,120],[222,649],[285,-342],[35,431],[573,643],[434,15],[612,-409],[329,-239],[295,249],[440,12],[356,-306],[80,175],[391,-25],[69,280],[-450,406],[267,288],[-52,161],[266,153],[-200,405],[127,202],[1039,205],[136,146],[695,218],[250,245],[499,-127],[88,-612],[290,144],[356,-202],[-23,-322],[267,33],[696,558],[-102,-185],[355,-457],[620,-1500],[148,309],[383,-340],[399,151],[154,-106],[133,-341],[194,-115],[119,-251],[358,79],[147,-361]],[[69711,75551],[83,-58],[-234,-382],[205,-223],[198,147],[329,-311],[-355,-425],[-212,58]],[[69725,74357],[-114,-15],[-40,164],[58,274],[-371,-137],[-89,-380],[-132,-326],[-232,28],[-72,-261],[204,-140],[60,-440],[-156,-598]],[[68841,72526],[-210,124],[-154,4]],[[68477,72654],[7,362],[-369,253],[-291,289],[-181,278],[-317,408],[-137,609],[-93,108],[-301,-27],[-106,121],[-30,471],[-374,312],[-234,-343],[-237,-204],[45,-297],[-313,-8]],[[89166,49043],[482,-407],[513,-338],[192,-302],[154,-297],[43,-349],[462,-365],[68,-313],[-256,-64],[62,-393],[248,-388],[180,-627],[159,20],[-11,-262],[215,-100],[-84,-111],[295,-249],[-30,-171],[-184,-41],[-69,153],[-238,66],[-281,89],[-216,377],[-158,325],[-144,517],[-362,259],[-235,-169],[-170,-195],[35,-436],[-218,-203],[-155,99],[-288,25]],[[89175,45193],[-4,1925],[-5,1925]],[[92399,48417],[106,-189],[33,-307],[-87,-157],[-52,348],[-65,229],[-126,193],[-158,252],[-200,174],[77,143],[150,-166],[94,-130],[117,-142],[111,-248]],[[92027,47129],[-152,-144],[-142,-138],[-148,1],[-228,171],[-158,165],[23,183],[249,-86],[152,46],[42,283],[40,15],[27,-314],[158,45],[78,202],[155,211],[-30,348],[166,11],[56,-97],[-5,-327],[-93,-361],[-146,-48],[-44,-166]],[[92988,47425],[84,-134],[135,-375],[131,-200],[-39,-166],[-78,-59],[-120,227],[-122,375],[-59,450],[38,57],[30,-175]],[[89175,45193],[-247,485],[-282,118],[-69,-168],[-352,-18],[118,481],[175,164],[-72,642],[-134,496],[-538,500],[-229,50],[-417,546],[-82,-287],[-107,-52],[-63,216],[-1,257],[-212,290],[299,213],[198,-11],[-23,156],[-407,1],[-110,352],[-248,109],[-117,293],[374,143],[142,192],[446,-242],[44,-220],[78,-955],[287,-354],[232,627],[319,356],[247,1],[238,-206],[206,-212],[298,-113]],[[84713,45326],[28,-117],[5,-179]],[[84746,45030],[-181,-441],[-238,-130],[-33,71],[25,201],[119,360],[275,235]],[[87280,46506],[-27,445],[49,212],[58,200],[63,-173],[0,-282],[-143,-402]],[[82744,53024],[-158,-533],[204,-560],[-48,-272],[312,-546],[-329,-70],[-93,-403],[12,-535],[-267,-404],[-7,-589],[-107,-903],[-41,210],[-316,-266],[-110,361],[-198,34],[-139,189],[-330,-212],[-101,285],[-182,-32],[-229,68],[-43,793],[-138,164],[-134,505],[-38,517],[32,548],[165,392]],[[80461,51765],[47,-395],[190,-334],[179,121],[177,-43],[162,299],[133,52],[263,-166],[226,126],[143,822],[107,205],[96,672],[319,0],[241,-100]],[[85936,48924],[305,-172],[101,-452],[-234,244],[-232,49],[-157,-39],[-192,21],[65,325],[344,24]],[[85242,48340],[-192,108],[-54,254],[281,29],[69,-195],[-104,-196]],[[85536,51864],[20,-322],[164,-52],[26,-241],[-15,-517],[-143,58],[-42,-359],[114,-312],[-78,-71],[-112,374],[-82,755],[56,472],[92,215]],[[84146,51097],[319,25],[275,429],[48,-132],[-223,-587],[-209,-113],[-267,115],[-463,-29],[-243,-85],[-39,-447],[248,-526],[150,268],[518,201],[-22,-272],[-121,86],[-121,-347],[-245,-229],[263,-757],[-50,-203],[249,-682],[-2,-388],[-148,-173],[-109,207],[134,484],[-273,-229],[-69,164],[36,228],[-200,346],[21,576],[-186,-179],[24,-689],[11,-846],[-176,-85],[-119,173],[79,544],[-43,570],[-117,4],[-86,405],[115,387],[40,469],[139,891],[58,243],[237,439],[217,-174],[350,-82]],[[83414,44519],[-368,414],[259,116],[146,-180],[97,-180],[-17,-159],[-117,-11]],[[83705,45536],[185,45],[249,216],[-41,-328],[-417,-168],[-370,73],[0,216],[220,123],[174,-177]],[[82849,45639],[172,48],[69,-251],[-321,-119],[-193,-79],[-149,5],[95,340],[153,5],[74,209],[100,-158]],[[80134,46785],[38,-210],[533,-59],[61,244],[515,-284],[101,-383],[417,-108],[341,-351],[-317,-225],[-306,238],[-251,-16],[-288,44],[-260,106],[-322,225],[-204,59],[-116,-74],[-506,243],[-48,254],[-255,44],[191,564],[337,-35],[224,-231],[115,-45]],[[78991,49939],[47,-412],[97,-330],[204,-52],[135,-374],[-70,-735],[-11,-914],[-308,-12],[-234,494],[-356,482],[-119,358],[-210,481],[-138,443],[-212,827],[-244,493],[-81,508],[-103,461],[-250,372],[-145,506],[-209,330],[-290,652],[-24,300],[178,-24],[430,-114],[246,-577],[215,-401],[153,-246],[263,-635],[283,-9],[233,-405],[161,-495],[211,-270],[-111,-482],[159,-205],[100,-15]],[[30935,19481],[106,-274],[139,-443],[361,-355],[389,-147],[-125,-296],[-264,-29],[-141,208]],[[31400,18145],[-168,16],[-297,1],[0,1319]],[[33993,32727],[-70,-473],[-74,-607],[3,-588],[-61,-132],[-21,-382]],[[33770,30545],[-19,-308],[353,-506],[-38,-408],[173,-257],[-14,-289],[-267,-757],[-412,-317],[-557,-123],[-305,59],[59,-352],[-57,-442],[51,-298],[-167,-208],[-284,-82],[-267,216],[-108,-155],[39,-587],[188,-178],[152,186],[82,-307],[-255,-183],[-223,-367],[-41,-595],[-66,-316],[-262,-2],[-218,-302],[-80,-443],[273,-433],[266,-119],[-96,-531],[-328,-333],[-180,-692],[-254,-234],[-113,-276],[89,-614],[185,-342],[-117,30]],[[30952,19680],[-257,93],[-672,79],[-115,344],[6,443],[-185,-38],[-98,214],[-24,626],[213,260],[88,375],[-33,299],[148,504],[101,782],[-30,347],[122,112],[-30,223],[-129,118],[92,248],[-126,224],[-65,682],[112,120],[-47,720],[65,605],[75,527],[166,215],[-84,576],[-1,543],[210,386],[-7,494],[159,576],[1,544],[-72,108],[-128,1020],[171,607],[-27,572],[100,537],[182,555],[196,367],[-83,232],[58,190],[-9,985],[302,291],[96,614],[-34,148]],[[31359,37147],[231,534],[364,-144],[163,-427],[109,475],[316,-24],[45,-127]],[[32587,37434],[511,-964],[227,-89],[339,-437],[286,-231],[40,-261],[-273,-898],[280,-160],[312,-91],[220,95],[252,453],[45,521]],[[34826,35372],[138,114],[139,-341],[-6,-472],[-234,-326],[-186,-241],[-314,-573],[-370,-806]],[[31400,18145],[-92,-239],[-238,-183],[-137,19],[-164,48],[-202,177],[-291,86],[-350,330],[-283,317],[-383,662],[229,-124],[390,-395],[369,-212],[143,271],[90,405],[256,244],[198,-70]],[[30669,40193],[136,-402],[37,-426],[146,-250],[-88,-572],[150,-663],[109,-814],[200,81]],[[30952,19680],[-247,4],[-134,-145],[-250,-213],[-45,-552],[-118,-14],[-313,192],[-318,412],[-346,338],[-87,374],[79,346],[-140,393],[-36,1007],[119,568],[293,457],[-422,172],[265,522],[94,982],[309,-208],[145,1224],[-186,157],[-87,-738],[-175,83],[87,845],[95,1095],[127,404],[-80,576],[-22,666],[117,19],[170,954],[192,945],[118,881],[-64,885],[83,487],[-34,730],[163,721],[50,1143],[89,1227],[87,1321],[-20,967],[-58,832]],[[30452,39739],[143,151],[74,303]],[[58538,45652],[-109,60],[-373,-99],[-75,-71],[-79,-377],[62,-261],[-49,-699],[-34,-593],[75,-105],[194,-230],[76,107],[23,-637],[-212,5],[-114,325],[-103,252],[-213,82],[-62,310],[-170,-187],[-222,83],[-93,268],[-176,55],[-131,-15],[-15,184],[-96,15]],[[56642,44124],[-127,35],[-172,-89],[-121,15],[-68,-54],[15,703],[-93,219],[-21,363],[41,356],[-56,228],[-5,372],[-337,-5],[24,213],[-142,-2],[-15,-103],[-172,-23],[-69,-344],[-42,-148],[-154,83],[-91,-83],[-184,-47],[-106,309],[-64,191],[-80,354],[-68,440],[-820,8],[-98,-71],[-80,11],[-115,-79]],[[53422,46976],[-39,183]],[[53383,47159],[71,62],[9,258],[45,152],[101,124]],[[53609,47755],[73,-60],[95,226],[152,-6],[17,-167],[104,-105],[164,370],[161,289],[71,189],[-10,486],[121,574],[127,304],[183,285],[32,189],[7,216],[45,205],[-14,335],[34,524],[55,368],[83,316],[16,357]],[[55125,52650],[25,412],[108,300],[149,190],[229,-200],[177,-218],[203,-59],[207,-115],[83,357],[38,46],[127,-60],[309,295],[110,-125],[90,18],[41,143],[104,51],[209,-62],[178,-14],[91,63]],[[57603,53672],[169,-488],[124,-71],[75,99],[128,-39],[155,125],[66,-252],[244,-393]],[[58564,52653],[-16,-691],[111,-80],[-89,-210],[-107,-157],[-106,-308],[-59,-274],[-15,-475],[-65,-225],[-2,-446]],[[58216,49787],[-80,-165],[-10,-351],[-38,-46],[-26,-323]],[[58062,48902],[70,-268],[17,-713]],[[61551,49585],[-165,488],[-3,2152],[243,670]],[[61626,52895],[76,186],[178,11],[247,417],[362,26],[785,1773]],[[63274,55308],[194,493],[125,363],[0,308],[0,596],[1,244],[2,9]],[[63596,57321],[89,12],[128,88],[147,59],[132,202],[105,2],[6,-163],[-25,-344],[1,-310],[-59,-214],[-78,-639],[-134,-659],[-172,-755],[-238,-866],[-237,-661],[-327,-806],[-278,-479],[-415,-586],[-259,-450],[-304,-715],[-64,-312],[-63,-140]],[[59417,50018],[-3,627],[80,239],[137,391],[101,431],[-123,678],[-32,296],[-132,411]],[[59445,53091],[171,352],[188,390]],[[59804,53833],[145,-99],[0,-332],[95,-194],[193,0],[352,-502],[87,-6],[65,16],[62,-68],[185,-47],[82,247],[254,247],[112,-200],[190,0]],[[61551,49585],[-195,-236],[-68,-246],[-104,-44],[-40,-416],[-89,-238],[-54,-393],[-112,-195]],[[56824,55442],[-212,258],[-96,170],[-18,184],[45,246],[-1,241],[-160,369],[-31,253]],[[56351,57163],[3,143],[-102,174],[-3,343],[-58,228],[-98,-34],[28,217],[72,246],[-32,245],[92,181],[-58,138],[73,365],[127,435],[240,-41],[-14,2345]],[[56621,62148],[3,248],[320,2],[0,1180]],[[56944,63578],[1117,0],[1077,0],[1102,0]],[[60240,63578],[90,-580],[-61,-107],[40,-608],[102,-706],[106,-145],[152,-219]],[[60669,61213],[-141,-337],[-204,-97],[-88,-181],[-27,-393],[-120,-868],[30,-236]],[[60119,59101],[-45,-508],[-112,-582],[-168,-293],[-119,-451],[-28,-241],[-132,-166],[-82,-618],[4,-531]],[[59437,55711],[-3,460],[-39,12],[5,294],[-33,203],[-143,233],[-34,426],[34,436],[-129,41],[-19,-132],[-167,-30],[67,-173],[23,-355],[-152,-324],[-138,-426],[-144,-61],[-233,345],[-105,-122],[-29,-172],[-143,-112],[-9,-122],[-277,0],[-38,122],[-200,20],[-100,-101],[-77,51],[-143,344],[-48,163],[-200,-81],[-76,-274],[-72,-528],[-95,-111],[-85,-65],[189,-230]],[[56351,57163],[-176,-101],[-141,-239],[-201,-645],[-261,-273],[-269,36],[-78,-54],[28,-208],[-145,-207],[-118,-230],[-350,-226],[-69,134],[-46,11],[-52,-152],[-229,-44]],[[54244,54965],[43,160],[-87,407],[-39,245],[-121,100],[-164,345],[60,279],[127,-60],[78,42],[155,-6],[-151,537],[10,393],[-18,392],[-111,378]],[[54026,58177],[28,279],[-178,13],[0,380],[-115,219],[120,778],[354,557],[15,769],[107,1199],[60,254],[-116,203],[-4,188],[-104,153],[-68,919]],[[54125,64088],[280,323],[1108,-1132],[1108,-1131]],[[30080,62227],[24,-321],[-21,-228],[-68,-99],[71,-177],[-5,-161]],[[30081,61241],[-185,100],[-131,-41],[-169,43],[-130,-110],[-149,184],[24,190],[256,-82],[210,-47],[100,131],[-127,256],[2,226],[-175,92],[62,163],[170,-26],[241,-93]],[[30080,62227],[34,101],[217,-3],[165,-152],[73,15],[50,-209],[152,11],[-9,-176],[124,-21],[136,-217],[-103,-240],[-132,128],[-127,-25],[-92,28],[-50,-107],[-106,-37],[-43,144],[-92,-85],[-111,-405],[-71,94],[-14,170]],[[76049,98451],[600,133],[540,-297],[640,-572],[-69,-531],[-606,-73],[-773,170],[-462,226],[-213,423],[-379,117],[722,404]],[[78565,97421],[704,-336],[-82,-240],[-1566,-228],[507,776],[229,66],[208,-38]],[[88563,95563],[734,-26],[1004,-313],[-219,-439],[-1023,16],[-461,-139],[-550,384],[149,406],[366,111]],[[91172,95096],[697,-155],[-321,-234],[-444,53],[-516,233],[66,192],[518,-89]],[[88850,93928],[263,234],[348,54],[394,-226],[34,-155],[-421,-4],[-569,66],[-49,31]],[[62457,98194],[542,107],[422,8],[57,-160],[159,142],[262,97],[412,-129],[-107,-90],[-373,-78],[-250,-45],[-39,-97],[-324,-98],[-301,140],[158,185],[-618,18]],[[56314,82678],[-511,-9],[-342,67]],[[55461,82736],[63,260],[383,191]],[[55907,83187],[291,-103],[123,-94],[-30,-162],[23,-150]],[[64863,94153],[665,518],[-75,268],[621,312],[917,380],[925,110],[475,220],[541,76],[193,-233],[-187,-184],[-984,-293],[-848,-282],[-863,-562],[-414,-577],[-435,-568],[56,-491],[531,-484],[-164,-52],[-907,77],[-74,262],[-503,158],[-40,320],[284,126],[-10,323],[551,503],[-255,73]],[[89698,82309],[96,-569],[-7,-581],[114,-597],[280,-1046],[-411,195],[-171,-854],[271,-605],[-8,-413],[-211,356],[-182,-457],[-51,496],[31,575],[-32,638],[64,446],[13,790],[-163,581],[24,808],[257,271],[-110,274],[123,83],[73,-391]],[[86327,75524],[-39,104]],[[86288,75628],[-2,300],[142,16],[40,698],[-73,506],[238,208],[338,-104],[186,575],[96,647],[107,216],[146,532],[-459,-175],[-240,-233],[-423,1],[-112,555],[-329,420],[-483,189],[-103,579],[-97,363],[-104,254],[-172,596],[-244,217],[-415,176],[-369,-16],[-345,-106],[-229,-294],[152,-141],[4,-326],[-155,-189],[-251,-627],[3,-260],[-392,-373],[-333,223]],[[82410,80055],[-331,-49],[-146,198],[-166,63],[-407,-416],[-366,-98],[-255,-146],[-350,96],[-258,-6],[-168,302],[-272,284],[-279,78],[-351,-78],[-263,-109],[-394,248],[-53,443],[-327,152],[-252,69],[-311,244],[-288,-612],[113,-348],[-270,-411],[-402,148],[-277,22],[-186,276],[-289,8],[-242,182],[-423,-278],[-530,-509],[-292,-102]],[[74375,79706],[-109,-49]],[[63639,77993],[-127,-350],[-269,-97],[-276,-610],[252,-561],[-27,-398],[303,-696]],[[63495,75281],[-166,-238],[-48,-150],[-122,40],[-191,359],[-78,20]],[[62890,75312],[-175,137],[-85,242],[-259,124],[-169,-93],[-48,110],[-378,283],[-409,96],[-235,101],[-34,-70]],[[61098,76242],[-354,499],[-317,223],[-240,347],[202,95],[231,494],[-156,234],[410,241],[-8,129],[-249,-95]],[[60617,78409],[9,262],[143,165],[269,43],[44,197],[-62,326],[113,310],[-3,173],[-410,192],[-162,-6],[-172,277],[-213,-94],[-352,208],[6,116],[-99,256],[-222,29],[-23,183],[70,120],[-178,334],[-288,-57],[-84,30],[-70,-134],[-104,23]],[[58829,81362],[-68,379],[-66,196],[54,55],[224,-20],[108,129],[-80,157],[-187,104],[16,107],[-113,108],[-174,387],[60,159],[-27,277],[-272,141],[-146,-70],[-39,146],[-293,149]],[[57826,83766],[-89,348],[-24,287],[-134,136]],[[57579,84537],[120,187],[-83,551],[198,341],[-42,103]],[[57772,85719],[316,327],[-291,280]],[[57797,86326],[594,755],[258,341],[105,301],[-411,405],[113,385],[-250,440],[187,506],[-323,673],[256,445],[-425,394],[41,414]],[[57942,91385],[224,54],[473,237]],[[58639,91676],[286,206],[456,-358],[761,-140],[1050,-668],[213,-281],[18,-393],[-308,-311],[-454,-157],[-1240,449],[-204,-75],[453,-433],[18,-274],[18,-604],[358,-180],[217,-153],[36,286],[-168,254],[177,224],[672,-368],[233,144],[-186,433],[647,578],[256,-34],[260,-206],[161,406],[-231,352],[136,353],[-204,367],[777,-190],[158,-331],[-351,-73],[1,-328],[219,-203],[429,128],[68,377],[580,282],[970,507],[209,-29],[-273,-359],[344,-61],[199,202],[521,16],[412,245],[317,-356],[315,391],[-291,343],[145,195],[820,-179],[385,-185],[1006,-675],[186,309],[-282,313],[-8,125],[-335,58],[92,280],[-149,461],[-8,189],[512,535],[183,537],[206,116],[736,-156],[57,-328],[-263,-479],[173,-189],[89,-413],[-63,-809],[307,-362],[-120,-395],[-544,-839],[318,-87],[110,213],[306,151],[74,293],[240,281],[-162,336],[130,390],[-304,49],[-67,328],[222,593],[-361,482],[497,398],[-64,421],[139,13],[145,-328],[-109,-570],[297,-108],[-127,426],[465,233],[577,31],[513,-337],[-247,492],[-28,630],[483,119],[669,-26],[602,77],[-226,309],[321,388],[319,16],[540,293],[734,79],[93,162],[729,55],[227,-133],[624,314],[510,-10],[77,255],[265,252],[656,242],[476,-191],[-378,-146],[629,-90],[75,-292],[254,143],[812,-7],[626,-289],[223,-221],[-69,-307],[-307,-175],[-730,-328],[-209,-175],[345,-83],[410,-149],[251,112],[141,-379],[122,153],[444,93],[892,-97],[67,-276],[1162,-88],[15,451],[590,-104],[443,4],[449,-312],[128,-378],[-165,-247],[349,-465],[437,-240],[268,620],[446,-266],[473,159],[538,-182],[204,166],[455,-83],[-201,549],[367,256],[2509,-384],[236,-351],[727,-451],[1122,112],[553,-98],[231,-244],[-33,-432],[342,-168],[372,121],[492,15],[525,-116],[526,66],[484,-526],[344,189],[-224,378],[123,262],[886,-165],[578,36],[799,-282],[-99610,-258],[681,-451],[728,-588],[-24,-367],[187,-147],[-64,429],[754,-88],[544,-553],[-276,-257],[-455,-61],[-7,-578],[-111,-122],[-260,17],[-212,206],[-369,172],[-62,257],[-283,96],[-315,-76],[-151,207],[60,219],[-333,-140],[126,-278],[-158,-251],[99997,-3],[-357,-260],[-360,44],[250,-315],[166,-487],[128,-159],[32,-244],[-71,-157],[-518,129],[-777,-445],[-247,-69],[-425,-415],[-403,-362],[-102,-269],[-397,409],[-724,-464],[-126,219],[-268,-253],[-371,81],[-90,-388],[-333,-572],[10,-239],[316,-132],[-37,-860],[-258,-22],[-119,-494],[116,-255],[-486,-302],[-96,-674],[-415,-144],[-83,-600],[-400,-551],[-103,407],[-119,862],[-155,1313],[134,819],[234,353],[14,276],[432,132],[496,744],[479,608],[499,471],[223,833],[-337,-50],[-167,-487],[-705,-649],[-227,727],[-717,-201],[-696,-990],[230,-362],[-620,-154],[-430,-61],[20,427],[-431,90],[-344,-291],[-850,102],[-914,-175],[-899,-1153],[-1065,-1394],[438,-74],[136,-370],[270,-132],[178,295],[305,-38],[401,-650],[9,-503],[-217,-590],[-23,-705],[-126,-945],[-418,-855],[-94,-409],[-377,-688],[-374,-682],[-179,-349],[-370,-346],[-175,-8],[-175,287],[-373,-432],[-43,-197]],[[0,92833],[36,24],[235,-1],[402,-169],[-24,-81],[-286,-141],[-363,-36],[99694,-30],[-49,187],[-99645,247]],[[59287,77741],[73,146],[198,-127],[89,-23],[36,-117],[42,-18]],[[59725,77602],[2,-51],[136,-142],[284,35],[-55,-210],[-304,-103],[-377,-342],[-154,121],[61,277],[-304,173],[50,113],[265,197],[-42,71]],[[28061,66408],[130,47],[184,-18],[8,-153],[-303,-95],[-19,219]],[[28391,66555],[220,-265],[-48,-420],[-51,75],[4,309],[-124,234],[-1,67]],[[28280,65474],[84,-23],[97,-491],[1,-343],[-68,-29],[-70,340],[-104,171],[60,375]],[[33000,19946],[333,354],[236,-148],[167,237],[222,-266],[-83,-207],[-375,-177],[-125,207],[-236,-266],[-139,266]],[[54206,97653],[105,202],[408,20],[350,-206],[915,-440],[-699,-233],[-155,-435],[-243,-111],[-132,-490],[-335,-23],[-598,361],[252,210],[-416,170],[-541,499],[-216,463],[757,212],[152,-207],[396,8]],[[57942,91385],[117,414],[-356,235],[-431,-200],[-137,-433],[-265,-262],[-298,143],[-362,-29],[-309,312],[-167,-156]],[[55734,91409],[-172,-24],[-41,-389],[-523,95],[-74,-329],[-267,2],[-183,-421],[-278,-655],[-431,-831],[101,-202],[-97,-234],[-275,10],[-180,-554],[17,-784],[177,-300],[-92,-694],[-231,-405],[-122,-341]],[[53063,85353],[-187,363],[-548,-684],[-371,-138],[-384,301],[-99,635],[-88,1363],[256,381],[733,496],[549,609],[508,824],[668,1141],[465,444],[763,741],[610,259],[457,-31],[423,489],[506,-26],[499,118],[869,-433],[-358,-158],[305,-371]],[[57613,97879],[-412,-318],[-806,-70],[-819,98],[-50,163],[-398,11],[-304,271],[858,165],[403,-142],[281,177],[702,-148],[545,-207]],[[56867,96577],[-620,-241],[-490,137],[191,152],[-167,189],[575,119],[110,-222],[401,-134]],[[37010,99398],[932,353],[975,-27],[354,218],[982,57],[2219,-74],[1737,-469],[-513,-227],[-1062,-26],[-1496,-58],[140,-105],[984,65],[836,-204],[540,181],[231,-212],[-305,-344],[707,220],[1348,229],[833,-114],[156,-253],[-1132,-420],[-157,-136],[-888,-102],[643,-28],[-324,-431],[-224,-383],[9,-658],[333,-386],[-434,-24],[-457,-187],[513,-313],[65,-502],[-297,-55],[360,-508],[-617,-42],[322,-241],[-91,-208],[-391,-91],[-388,-2],[348,-400],[4,-263],[-549,244],[-143,-158],[375,-148],[364,-361],[105,-476],[-495,-114],[-214,228],[-344,340],[95,-401],[-322,-311],[732,-25],[383,-32],[-745,-515],[-755,-466],[-813,-204],[-306,-2],[-288,-228],[-386,-624],[-597,-414],[-192,-24],[-370,-145],[-399,-138],[-238,-365],[-4,-415],[-141,-388],[-453,-472],[112,-462],[-125,-488],[-142,-577],[-391,-36],[-410,482],[-556,3],[-269,324],[-186,577],[-481,735],[-141,385],[-38,530],[-384,546],[100,435],[-186,208],[275,691],[418,220],[110,247],[58,461],[-318,-209],[-151,-88],[-249,-84],[-341,193],[-19,401],[109,314],[258,9],[567,-157],[-478,375],[-249,202],[-276,-83],[-232,147],[310,550],[-169,220],[-220,409],[-335,626],[-353,230],[3,247],[-745,346],[-590,43],[-743,-24],[-677,-44],[-323,188],[-482,372],[729,186],[559,31],[-1188,154],[-627,241],[39,229],[1051,285],[1018,284],[107,214],[-750,213],[243,235],[961,413],[404,63],[-115,265],[658,156],[854,93],[853,5],[303,-184],[737,325],[663,-221],[390,-46],[577,-192],[-660,318],[38,253]],[[69148,21851],[179,-186],[263,-74],[9,-112],[-77,-269],[-427,-38],[-7,314],[41,244],[19,121]],[[84713,45326],[32,139],[239,133],[194,20],[87,74],[105,-74],[-102,-160],[-289,-258],[-233,-170]],[[54540,33696],[133,292],[109,-162],[47,-252],[125,-43],[175,-112],[149,43],[248,302],[0,2182]],[[55526,35946],[75,-88],[165,-562],[-26,-360],[62,-207],[199,60],[139,264],[132,177],[68,283],[135,137],[117,-71],[133,-166],[226,-29],[178,138],[28,184],[48,283],[152,47],[83,222],[93,393],[249,442],[393,435]],[[58175,37528],[113,-7],[134,-100],[94,71],[148,-59]],[[58664,37433],[133,-832],[72,-419],[-49,-659],[23,-212]],[[58843,35311],[-140,108],[-80,-42],[-26,-172],[-76,-222],[2,-204],[166,-320],[163,63],[56,263]],[[58908,34785],[211,-5]],[[59119,34780],[-70,-430],[-32,-491],[-72,-267],[-190,-298],[-54,-86],[-118,-300],[-77,-303],[-158,-424],[-314,-609],[-196,-355],[-210,-269],[-290,-229],[-141,-31],[-36,-164],[-169,88],[-138,-113],[-301,114],[-168,-72],[-115,31],[-286,-233],[-238,-94],[-171,-223],[-127,-14],[-117,210],[-94,11],[-120,264],[-13,-82],[-37,159],[2,346],[-90,396],[89,108],[-7,453],[-182,553],[-139,501],[-1,1],[-199,768]],[[58049,33472],[-121,182],[-130,-120],[-151,-232],[-148,-374],[209,-454],[99,59],[51,188],[155,93],[47,192],[85,288],[-96,178]],[[23016,65864],[-107,-518],[-49,-426],[-20,-791],[-27,-289],[48,-322],[86,-288],[56,-458],[184,-440],[65,-337],[109,-291],[295,-157],[114,-247],[244,165],[212,60],[208,106],[175,101],[176,241],[67,345],[22,496],[48,173],[188,155],[294,137],[246,-21],[169,50],[66,-125],[-9,-285],[-149,-351],[-66,-360],[51,-103],[-42,-255],[-69,-461],[-71,152],[-58,-10]],[[25472,61510],[-53,-8],[-99,-357],[-51,70],[-33,-27],[2,-87]],[[25238,61101],[-257,7],[-259,-1],[-1,-333],[-125,-1],[103,-198],[103,-136],[31,-128],[45,-36],[-7,-201],[-357,-2],[-133,-481],[39,-111],[-32,-138],[-7,-172]],[[24381,59170],[-314,636],[-144,191],[-226,155],[-156,-43],[-223,-223],[-140,-58],[-196,156],[-208,112],[-260,271],[-208,83],[-314,275],[-233,282],[-70,158],[-155,35],[-284,187],[-116,270],[-299,335],[-139,373],[-66,288],[93,57],[-29,169],[64,153],[1,204],[-93,266],[-25,235],[-94,298],[-244,587],[-280,462],[-135,368],[-238,241],[-51,145],[42,365],[-142,138],[-164,287],[-69,412],[-149,48],[-162,311],[-130,288],[-12,184],[-149,446],[-99,452],[5,227],[-201,234],[-93,-25],[-159,163],[-44,-240],[46,-284],[27,-444],[95,-243],[206,-407],[46,-139],[42,-42],[37,-203],[49,8],[56,-381],[85,-150],[59,-210],[174,-300],[92,-550],[83,-259],[77,-277],[15,-311],[134,-20],[112,-268],[100,-264],[-6,-106],[-117,-217],[-49,3],[-74,359],[-181,337],[-201,286],[-142,150],[9,432],[-42,320],[-132,183],[-191,264],[-37,-76],[-70,154],[-171,143],[-164,343],[20,44],[115,-33],[103,221],[10,266],[-214,422],[-163,163],[-102,369],[-103,388],[-129,472],[-113,531]],[[33993,32727],[180,63],[279,-457],[103,18],[286,-379],[218,-327],[160,-402],[-122,-280],[77,-334]],[[35174,30629],[-121,-372],[-313,-328],[-205,118],[-151,-63],[-256,253],[-189,-19],[-169,327]],[[34826,35372],[54,341],[38,350],[0,325],[-100,107],[-104,-96],[-103,26],[-33,228],[-26,541],[-52,177],[-187,160],[-114,-116],[-293,113],[18,802],[-82,329]],[[33842,38659],[87,122],[-27,337],[77,259],[49,465],[-66,367],[-151,166],[-30,233],[41,342],[-533,24],[-107,688],[81,10],[-3,255],[-55,172],[-12,342],[-161,175],[-175,-6],[-115,172],[-188,117],[-109,220],[-311,98],[-302,529],[23,396],[-34,227],[29,443],[-363,-100],[-147,-222],[-243,-239],[-62,-179],[-143,-13],[-206,50]],[[30686,44109],[-157,-102],[-126,68],[18,898],[-228,-348],[-245,15],[-105,315],[-184,34],[59,254],[-155,359],[-115,532],[73,108],[0,250],[168,171],[-28,319],[71,206],[20,275],[318,402],[227,114],[37,89],[251,-28]],[[30585,48040],[125,1620],[6,256],[-43,339],[-123,215],[1,430],[156,97],[56,-61],[9,226],[-162,61],[-4,370],[541,-13],[92,203],[77,-187],[55,-349],[52,73]],[[31423,51320],[153,-312],[216,38],[54,181],[206,138],[115,97],[32,250],[198,168],[-15,124],[-235,51],[-39,372],[12,396],[-125,153],[52,55],[206,-76],[221,-148],[80,140],[200,92],[310,221],[102,225],[-37,167]],[[33129,53652],[145,26],[64,-136],[-36,-259],[96,-90],[63,-274],[-77,-209],[-44,-502],[71,-299],[20,-274],[171,-277],[137,-29],[30,116],[88,25],[126,104],[90,157],[154,-50],[67,21]],[[34294,51702],[151,-48],[25,120],[-46,118],[28,171],[112,-53],[131,61],[159,-125]],[[34854,51946],[121,-122],[86,160],[62,-25],[38,-166],[133,42],[107,224],[85,436],[164,540]],[[35650,53035],[95,28],[69,-327],[155,-1033],[149,-97],[7,-408],[-208,-487],[86,-178],[491,-92],[10,-593],[211,388],[349,-212],[462,-361],[135,-346],[-45,-327],[323,182],[540,-313],[415,23],[411,-489],[355,-662],[214,-170],[237,-24],[101,-186],[94,-752],[46,-358],[-110,-977],[-142,-385],[-391,-822],[-177,-668],[-206,-513],[-69,-11],[-78,-435],[20,-1107],[-77,-910],[-30,-390],[-88,-233],[-49,-790],[-282,-771],[-47,-610],[-225,-256],[-65,-355],[-302,2],[-437,-227],[-195,-263],[-311,-173],[-327,-470],[-235,-586],[-41,-441],[46,-326],[-51,-597],[-63,-289],[-195,-325],[-308,-1040],[-244,-468],[-189,-277],[-127,-562],[-183,-337]],[[33842,38659],[-4,182],[-259,302],[-258,9],[-484,-172],[-133,-520],[-7,-318],[-110,-708]],[[30669,40193],[175,638],[-119,496],[63,199],[-49,219],[108,295],[6,503],[13,415],[60,200],[-240,951]],[[30452,39739],[-279,340],[-24,242],[-551,593],[-498,646],[-214,365],[-115,488],[46,170],[-236,775],[-274,1090],[-262,1177],[-114,269],[-87,435],[-216,386],[-198,239],[90,264],[-134,563],[86,414],[221,373]],[[27693,48568],[33,-246],[-79,-141],[8,-216],[114,47],[113,-64],[116,-298],[157,243],[53,398],[170,514],[334,233],[303,619],[86,384],[-38,449]],[[29063,50490],[74,56],[184,-280],[89,-279],[129,-152],[163,-620],[207,-74],[153,157],[101,-103],[166,51],[213,-276],[-179,-602],[83,-14],[139,-314]],[[29063,50490],[-119,140],[-137,195],[-79,-94],[-235,82],[-68,255],[-52,-10],[-278,338]],[[28095,51396],[-37,183],[103,44],[-12,296],[65,214],[138,40],[117,371],[106,310],[-102,141],[52,343],[-62,540],[59,155],[-44,500],[-112,315]],[[28366,54848],[36,287],[89,-43],[52,176],[-64,348],[34,86]],[[28513,55702],[143,-18],[209,412],[114,63],[3,195],[51,500],[159,274],[175,11],[22,123],[218,-49],[218,298],[109,132],[134,285],[98,-36],[73,-156],[-54,-199]],[[30185,57537],[-178,-99],[-71,-295],[-107,-169],[-81,-220],[-34,-422],[-77,-345],[144,-40],[35,-271],[62,-130],[21,-238],[-33,-219],[10,-123],[69,-49],[66,-207],[357,57],[161,-75],[196,-508],[112,63],[200,-32],[158,68],[99,-102],[-50,-318],[-62,-199],[-22,-423],[56,-393],[79,-175],[9,-133],[-140,-294],[100,-130],[74,-207],[85,-589]],[[28366,54848],[-93,170],[-59,319],[68,158],[-70,40],[-52,196],[-138,164],[-122,-38],[-56,-205],[-112,-149],[-61,-20],[-27,-123],[132,-321],[-75,-76],[-40,-87],[-130,-30],[-48,353],[-36,-101],[-92,35],[-56,238],[-114,39],[-72,69],[-119,-1],[-8,-128],[-32,89]],[[26954,55439],[14,117],[23,120],[-10,107],[41,70],[-58,88],[-1,238],[107,53]],[[27070,56232],[100,-212],[-6,-126],[111,-26],[26,48],[77,-145],[136,42],[119,150],[168,119],[95,176],[153,-34],[-10,-58],[155,-21],[124,-102],[90,-177],[105,-164]],[[26954,55439],[-151,131],[-56,124],[32,103],[-11,130],[-77,142],[-109,116],[-95,76],[-19,173],[-73,105],[18,-172],[-55,-141],[-64,164],[-89,58],[-38,120],[2,179],[36,187],[-78,83],[64,114]],[[26191,57131],[42,76],[183,-156],[63,77],[89,-50],[46,-121],[82,-40],[66,126]],[[26762,57043],[70,-321],[108,-238],[130,-252]],[[26191,57131],[-96,186],[-130,238],[-61,200],[-117,185],[-140,267],[31,91],[46,-88],[21,41]],[[25745,58251],[86,25],[35,135],[41,5],[-6,290],[65,14],[58,-4],[60,158],[82,-120],[29,74],[51,70],[97,163],[4,121],[27,-5],[36,141],[29,17],[47,-90],[56,-27],[61,76],[70,0],[97,77],[38,81],[95,-12]],[[26903,59440],[-24,-57],[-14,-132],[29,-216],[-64,-202],[-30,-237],[-9,-261],[15,-152],[7,-266],[-43,-58],[-26,-253],[19,-156],[-56,-151],[12,-159],[43,-97]],[[25745,58251],[-48,185],[-84,51]],[[25613,58487],[19,237],[-38,64],[-57,42],[-122,-70],[-10,79],[-84,95],[-60,118],[-82,50]],[[25179,59102],[58,150],[-22,116],[20,113],[131,166],[127,225]],[[25493,59872],[29,-23],[61,104],[79,8],[26,-48],[43,29],[129,-53],[128,15],[90,66],[32,66],[89,-31],[66,-40],[73,14],[55,51],[127,-82],[44,-13],[85,-110],[80,-132],[101,-91],[73,-162]],[[25613,58487],[-31,-139],[-161,9],[-100,57],[-115,117],[-154,37],[-79,127]],[[24973,58695],[9,86],[95,149],[52,66],[-15,69],[65,37]],[[25238,61101],[-2,-468],[-22,-667],[83,0]],[[25297,59966],[90,-107],[24,88],[82,-75]],[[24973,58695],[-142,103],[-174,11],[-127,117],[-149,244]],[[25472,61510],[1,-87],[53,-3],[-5,-160],[-45,-256],[24,-91],[-29,-212],[18,-56],[-32,-299],[-55,-156],[-50,-19],[-55,-205]],[[30185,57537],[-8,-139],[-163,-69],[91,-268],[-3,-309],[-123,-344],[105,-468],[120,38],[62,427],[-86,208],[-14,447],[346,241],[-38,278],[97,186],[100,-415],[195,-9],[180,-330],[11,-195],[249,-6],[297,61],[159,-264],[213,-74],[155,185],[4,149],[344,35],[333,9],[-236,-175],[95,-279],[222,-44],[210,-291],[45,-473],[144,13],[109,-139]],[[33400,55523],[-220,-347],[-24,-215],[95,-220],[-69,-110],[-171,-95],[5,-273],[-75,-163],[188,-448]],[[33400,55523],[183,-217],[171,-385],[8,-304],[105,-14],[149,-289],[109,-205]],[[34125,54109],[-44,-532],[-169,-154],[15,-139],[-51,-305],[123,-429],[89,-1],[37,-333],[169,-514]],[[34125,54109],[333,-119],[30,107],[225,43],[298,-159]],[[35011,53981],[-144,-508],[22,-404],[109,-351],[-49,-254],[-24,-270],[-71,-248]],[[35011,53981],[95,-65],[204,-140],[294,-499],[46,-242]],[[51718,79804],[131,-155],[400,-109],[-140,-404],[-35,-421]],[[52074,78715],[-77,-101],[-126,54],[9,-150],[-203,-332],[-5,-267],[133,92],[95,-259]],[[51900,77752],[-11,-167],[82,-222],[-97,-180],[72,-457],[151,-75],[-32,-256]],[[52065,76395],[-252,-334],[-548,160],[-404,-192],[-32,-355]],[[50829,75674],[-322,-77],[-313,267],[-101,-127],[-511,268],[-111,230]],[[49471,76235],[144,354],[53,1177],[-287,620],[-205,299],[-424,227],[-28,431],[360,129],[466,-152],[-88,669],[263,-254],[646,461],[84,484],[243,119]],[[50698,80799],[40,-207],[129,-10],[129,-237],[194,-279],[143,46],[243,-269]],[[51576,79843],[62,-52],[80,13]],[[52429,75765],[179,226],[47,-507],[-92,-456],[-126,120],[-64,398],[56,219]],[[27693,48568],[148,442],[-60,258],[-106,-275],[-166,259],[56,167],[-47,536],[97,89],[52,368],[105,381],[-20,241],[153,126],[190,236]],[[31588,61519],[142,-52],[50,-118],[-71,-149],[-209,4],[-163,-21],[-16,253],[40,86],[227,-3]],[[28453,61504],[187,-53],[147,-142],[46,-161],[-195,-11],[-84,-99],[-156,95],[-159,215],[34,135],[116,41],[64,-20]],[[27147,64280],[240,-42],[219,-7],[261,-201],[110,-216],[260,66],[98,-138],[235,-366],[173,-267],[92,8],[165,-120],[-20,-167],[205,-24],[210,-242],[-33,-138],[-185,-75],[-187,-29],[-191,46],[-398,-57],[186,329],[-113,154],[-179,39],[-96,171],[-66,336],[-157,-23],[-259,159],[-83,124],[-362,91],[-97,115],[104,148],[-273,30],[-199,-307],[-115,-8],[-40,-144],[-138,-65],[-118,56],[146,183],[60,213],[126,131],[142,116],[210,56],[67,65]],[[58175,37528],[-177,267],[-215,90],[-82,375],[0,208],[-119,64],[-315,649],[-87,342],[-56,105],[-107,473]],[[57017,40101],[311,-65],[90,-68],[94,13],[154,383],[241,486],[100,46],[33,205],[159,235],[210,81]],[[58409,41417],[18,-220],[232,12],[128,-125],[60,-146],[132,-43],[145,-190],[0,-748],[-54,-409],[-12,-442],[45,-175],[-31,-348],[-42,-53],[-74,-426],[-292,-671]],[[55526,35946],[0,1725],[274,20],[8,2105],[207,19],[428,207],[106,-243],[177,231],[85,2],[156,133]],[[56967,40145],[50,-44]],[[54540,33696],[-207,446],[-108,432],[-62,575],[-68,428],[-93,910],[-7,707],[-35,322],[-108,243],[-144,489],[-146,708],[-60,371],[-226,577],[-17,453]],[[53259,40357],[134,113],[166,100],[180,-17],[166,-267],[42,41],[1126,26],[192,-284],[673,-83],[510,241]],[[56448,40227],[228,134],[180,-34],[109,-133],[2,-49]],[[45357,58612],[-115,460],[-138,210],[122,112],[134,415],[66,304]],[[45426,60113],[96,189],[138,-51],[135,129],[155,6],[133,-173],[184,-157],[168,-435],[184,-405]],[[46619,59216],[13,-368],[54,-338],[104,-166],[24,-229],[-13,-184]],[[46801,57931],[-40,-33],[-151,47],[-21,-66],[-61,-13],[-200,144],[-134,6]],[[46194,58016],[-513,25],[-75,-67],[-92,19],[-147,-96]],[[45367,57897],[-46,453]],[[45321,58350],[253,-13],[67,83],[50,5],[103,136],[119,-124],[121,-11],[120,133],[-56,170],[-92,-99],[-86,3],[-110,145],[-88,-9],[-63,-140],[-302,-17]],[[46619,59216],[93,107],[47,348],[88,14],[194,-165],[157,117],[107,-39],[42,131],[1114,9],[62,414],[-48,73],[-134,2550],[-134,2550],[425,10]],[[48632,65335],[937,-1289],[937,-1289],[66,-277],[173,-169],[129,-96],[3,-376],[308,58]],[[51185,61897],[1,-1361],[-152,-394],[-24,-364],[-247,-94],[-379,-51],[-102,-210],[-178,-23]],[[50104,59400],[-178,-3],[-70,114],[-153,-84],[-259,-246],[-53,-184],[-216,-265],[-38,-152],[-116,-120],[-134,79],[-76,-144],[-41,-405],[-221,-490],[7,-200],[-76,-250],[18,-343]],[[48498,56707],[-114,-88],[-65,-74],[-43,253],[-80,-67],[-48,11],[-51,-172],[-215,5],[-77,89],[-36,-54]],[[47769,56610],[-85,170],[15,176],[-35,69],[-59,-58],[11,192],[57,152],[-114,248],[-33,163],[-62,130],[-55,15],[-67,-83],[-90,-79],[-76,-128],[-119,48],[-77,150],[-46,19],[-73,-78],[-44,-1],[-16,216]],[[47587,66766],[1045,-1431]],[[45426,60113],[-24,318],[78,291],[34,557],[-30,583],[-34,294],[28,295],[-72,281],[-146,255]],[[50747,54278],[-229,-69]],[[50518,54209],[-69,407],[13,1357],[-56,122],[-11,290],[-96,207],[-85,174],[35,311]],[[50249,57077],[96,67],[56,258],[136,56],[61,176]],[[50598,57634],[93,173],[100,2],[212,-340]],[[51003,57469],[-11,-197],[62,-350],[-54,-238],[29,-159],[-135,-366],[-86,-181],[-52,-372],[7,-376],[-16,-952]],[[54026,58177],[-78,-34],[-9,-188]],[[53939,57955],[-52,-13],[-188,647],[-65,24],[-217,-331],[-215,173],[-150,34],[-80,-83],[-163,18],[-164,-252],[-141,-14],[-337,305],[-131,-145],[-142,10],[-104,223],[-279,221],[-298,-70],[-72,-128],[-39,-340],[-80,-238],[-19,-527]],[[50598,57634],[6,405],[-320,134],[-9,286],[-156,386],[-37,269],[22,286]],[[51185,61897],[392,263],[804,1161],[952,1126]],[[53333,64447],[439,-255],[156,-324],[197,220]],[[53939,57955],[110,-235],[-31,-107],[-14,-196],[-234,-457],[-74,-377],[-39,-307],[-59,-132],[-56,-414],[-148,-243],[-43,-299],[-63,-238],[-26,-246],[-191,-199],[-156,243],[-105,-10],[-165,-345],[-81,-6],[-132,-570],[-71,-418]],[[52361,53399],[-289,-213],[-105,31],[-107,-132],[-222,13],[-149,370],[-91,427],[-197,389],[-209,-7],[-245,1]],[[54244,54965],[-140,-599],[-67,-107],[-21,-458],[28,-249],[-23,-176],[132,-309],[23,-212],[103,-305],[127,-190],[12,-269],[29,-172]],[[54447,51919],[-20,-319],[-220,140],[-225,156],[-350,23]],[[53632,51919],[-35,32],[-164,-76],[-169,79],[-132,-38]],[[53132,51916],[-452,13]],[[52680,51929],[40,466],[-108,391],[-127,100],[-56,265],[-72,85],[4,163]],[[50518,54209],[-224,-126]],[[50294,54083],[-62,207],[-74,375],[-22,294],[61,532],[-69,215],[-27,466],[1,429],[-116,305],[20,184]],[[50006,57090],[243,-13]],[[50294,54083],[-436,-346],[-154,-203],[-250,-171],[-248,168]],[[49206,53531],[13,233],[-121,509],[73,667],[117,496],[-74,841]],[[49214,56277],[-38,444],[7,336],[482,27],[123,-43],[90,96],[128,-47]],[[48498,56707],[125,-129],[49,-195],[125,-125],[97,149],[130,22],[190,-152]],[[49206,53531],[-126,-7],[-194,116],[-178,-7],[-329,-103],[-193,-170],[-275,-217],[-54,15]],[[47857,53158],[22,487],[26,74],[-8,233],[-118,247],[-88,40],[-81,162],[60,262],[-28,286],[13,172]],[[47655,55121],[44,0],[17,258],[-22,114],[27,82],[103,71],[-69,473],[-64,245],[23,200],[55,46]],[[47655,55121],[-78,15],[-57,-238],[-78,3],[-55,126],[19,237],[-116,362],[-73,-67],[-59,-13]],[[47158,55546],[-77,-34],[3,217],[-44,155],[9,171],[-60,249],[-78,211],[-222,1],[-65,-112],[-76,-13],[-48,-128],[-32,-163],[-148,-260]],[[46320,55840],[-122,349],[-108,232],[-71,76],[-69,118],[-32,261],[-41,130],[-80,97]],[[45797,57103],[123,288],[84,-11],[73,99],[61,1],[44,78],[-24,196],[31,62],[5,200]],[[45797,57103],[-149,247],[-117,39],[-63,166],[1,90],[-84,125],[-18,127]],[[47857,53158],[-73,-5],[-286,282],[-252,449],[-237,324],[-187,381]],[[46822,54589],[66,189],[15,172],[126,320],[129,276]],[[46822,54589],[-75,44],[-200,238],[-144,316],[-49,216],[-34,437]],[[55125,52650],[-178,33],[-188,99],[-166,-313],[-146,-550]],[[56824,55442],[152,-239],[2,-192],[187,-308],[116,-255],[70,-355],[208,-234],[44,-187]],[[53609,47755],[-104,203],[-84,-100],[-112,-255]],[[53309,47603],[-228,626]],[[53081,48229],[212,326],[-105,391],[95,148],[187,73],[23,261],[148,-283],[245,-25],[85,279],[36,393],[-31,461],[-131,350],[120,684],[-69,117],[-207,-48],[-78,305],[21,258]],[[53081,48229],[-285,596],[-184,488],[-169,610],[9,196],[61,189],[67,430],[56,438]],[[52636,51176],[94,35],[404,-6],[-2,711]],[[52636,51176],[-52,90],[96,663]],[[59099,45126],[131,-264],[71,-501],[-47,-160],[-56,-479],[53,-490],[-87,-205],[-85,-549],[147,-153]],[[59226,42325],[-843,-487],[26,-421]],[[56448,40227],[-181,369],[-188,483],[13,1880],[579,-7],[-24,203],[41,222],[-49,277],[32,286],[-29,184]],[[59599,43773],[-77,-449],[77,-768],[97,9],[100,-191],[116,-427],[24,-760],[-120,-124],[-85,-410],[-181,365],[-21,417],[59,274],[-16,237],[-110,149],[-77,-54],[-159,284]],[[61198,44484],[45,-265],[-11,-588],[34,-519],[11,-923],[49,-290],[-83,-422],[-108,-410],[-177,-366],[-254,-225],[-313,-287],[-313,-634],[-107,-108],[-194,-420],[-115,-136],[-23,-421],[132,-448],[54,-346],[4,-177],[49,29],[-8,-579],[-45,-275],[65,-101],[-41,-245],[-116,-211],[-229,-199],[-334,-320],[-122,-219],[24,-248],[71,-40],[-24,-311]],[[58908,34785],[-24,261],[-41,265]],[[53383,47159],[-74,444]],[[53259,40357],[-26,372],[38,519],[96,541],[15,254],[90,532],[66,243],[159,386],[90,263],[29,438],[-15,335],[-83,211],[-74,358],[-68,355],[15,122],[85,235],[-84,570],[-57,396],[-139,374],[26,115]],[[58062,48902],[169,-46],[85,336],[147,-38]],[[59922,69905],[-49,-186]],[[59873,69719],[-100,82],[-58,-394],[69,-66],[-71,-81],[-12,-156],[131,80]],[[59832,69184],[7,-230],[-139,-944]],[[59700,68010],[-27,153],[-155,862]],[[59518,69025],[80,194],[-19,34],[74,276],[56,446],[40,149],[8,6]],[[59757,70130],[93,-1],[25,104],[75,8]],[[59950,70241],[4,-242],[-38,-90],[6,-4]],[[59757,70130],[99,482],[138,416],[5,21]],[[59999,71049],[125,-31],[45,-231],[-151,-223],[-68,-323]],[[63761,43212],[74,-251],[69,-390],[45,-711],[72,-276],[-28,-284],[-49,-174],[-94,347],[-53,-175],[53,-438],[-24,-250],[-77,-137],[-18,-500],[-109,-689],[-137,-814],[-172,-1120],[-106,-821],[-125,-685],[-226,-140],[-243,-250],[-160,151],[-220,211],[-77,312],[-18,524],[-98,471],[-26,425],[50,426],[128,102],[1,197],[133,447],[25,377],[-65,280],[-52,372],[-23,544],[97,331],[38,375],[138,22],[155,121],[103,107],[122,7],[158,337],[229,364],[83,297],[-38,253],[118,-71],[153,410],[6,356],[92,264],[96,-254]],[[59873,69719],[0,-362],[-41,-173]],[[45321,58350],[36,262]],[[52633,68486],[-118,1061],[-171,238],[-3,143],[-227,352],[-24,445],[171,330],[65,487],[-44,563],[57,303]],[[52339,72408],[302,239],[195,-71],[-9,-299],[236,217],[20,-113],[-139,-290],[-2,-273],[96,-147],[-36,-511],[-183,-297],[53,-322],[143,-10],[70,-281],[106,-92]],[[53191,70158],[-16,-454],[-135,-170],[-86,-189],[-191,-228],[30,-244],[-24,-250],[-136,-137]],[[47592,66920],[-2,700],[449,436],[277,90],[227,159],[107,295],[324,234],[12,438],[161,51],[126,219],[363,99],[51,230],[-73,125],[-96,624],[-17,359],[-104,379]],[[49397,71358],[267,323],[300,102],[175,244],[268,180],[471,105],[459,48],[140,-87],[262,232],[297,5],[113,-137],[190,35]],[[52633,68486],[90,-522],[15,-274],[-49,-482],[21,-270],[-36,-323],[24,-371],[-110,-247],[164,-431],[11,-253],[99,-330],[130,109],[219,-275],[122,-370]],[[59922,69905],[309,-234],[544,630]],[[60775,70301],[112,-720]],[[60887,69581],[-53,-89],[-556,-296],[277,-591],[-92,-101],[-46,-197],[-212,-82],[-66,-213],[-120,-182],[-310,94]],[[59709,67924],[-9,86]],[[64327,64904],[49,29],[11,-162],[217,93],[230,-15],[168,-18],[190,400],[207,379],[176,364]],[[65575,65974],[52,-202]],[[65627,65772],[38,-466]],[[65665,65306],[-142,-3],[-23,-384],[50,-82],[-126,-117],[-1,-241],[-81,-245],[-7,-238]],[[65335,63996],[-56,-125],[-835,298],[-106,599],[-11,136]],[[64113,65205],[-18,430],[75,310],[76,64],[84,-185],[5,-346],[-61,-348]],[[64274,65130],[-77,-42],[-84,117]],[[63326,68290],[58,-261],[-25,-135],[89,-445]],[[63448,67449],[-196,-16],[-69,282],[-248,57]],[[62935,67772],[204,567],[187,-49]],[[60775,70301],[615,614],[105,715],[-26,431],[152,146],[142,369]],[[61763,72576],[119,92],[324,-77],[97,-150],[133,100]],[[62436,72541],[180,-705],[182,-177],[21,-345],[-139,-204],[-65,-461],[193,-562],[340,-324],[143,-449],[-46,-428],[89,0],[3,-314],[153,-311]],[[63490,68261],[-164,29]],[[62935,67772],[-516,47],[-784,1188],[-413,414],[-335,160]],[[65665,65306],[125,-404],[155,-214],[203,-78],[165,-107],[125,-339],[75,-196],[100,-75],[-1,-132],[-101,-352],[-44,-166],[-117,-189],[-104,-404],[-126,31],[-58,-141],[-44,-300],[34,-395],[-26,-72],[-128,2],[-174,-221],[-27,-288],[-63,-125],[-173,5],[-109,-149],[1,-238],[-134,-165],[-153,56],[-186,-199],[-128,-34]],[[64752,60417],[-91,413],[-217,975]],[[64444,61805],[833,591],[185,1182],[-127,418]],[[65575,65974],[80,201],[35,-51],[-26,-244],[-37,-108]],[[96448,41190],[175,-339],[-92,-78],[-93,259],[10,158]],[[96330,41322],[-39,163],[-6,453],[133,-182],[45,-476],[-75,74],[-58,-32]],[[78495,57780],[-66,713],[178,492],[359,112],[261,-84]],[[79227,59013],[229,-232],[126,407],[246,-217]],[[79828,58971],[64,-394],[-34,-708],[-467,-455],[122,-358],[-292,-43],[-240,-238]],[[78981,56775],[-233,87],[-112,307],[-141,611]],[[78495,57780],[-249,271],[-238,-11],[41,464],[-245,-3],[-22,-650],[-150,-863],[-90,-522],[19,-428],[181,-18],[113,-539],[50,-512],[155,-338],[168,-69],[144,-306]],[[78372,54256],[-91,-243],[-183,-71],[-22,304],[-227,258],[-48,-105]],[[77801,54399],[-110,227],[-47,292],[-148,334],[-135,280],[-45,-347],[-53,328],[30,369],[82,566]],[[77375,56448],[135,607],[152,551],[-108,539],[4,274],[-32,330],[-185,470],[-66,296],[96,109],[101,514],[-113,390],[-177,431],[-134,519],[117,107],[127,639],[196,26],[162,256],[159,137]],[[77809,62643],[120,-182],[16,-355],[188,-27],[-68,-623],[6,-530],[293,353],[83,-104],[163,17],[56,205],[210,-40],[211,-480],[18,-583],[224,-515],[-12,-500],[-90,-266]],[[77809,62643],[59,218],[237,384]],[[78105,63245],[25,-139],[148,-16],[-42,676],[144,86]],[[78380,63852],[162,-466],[125,-537],[342,-5],[108,-515],[-178,-155],[-80,-212],[333,-353],[231,-699],[175,-520],[210,-411],[70,-418],[-50,-590]],[[77375,56448],[-27,439],[86,452],[-94,350],[23,644],[-113,306],[-90,707],[-50,746],[-121,490],[-183,-297],[-315,-421],[-156,53],[-172,138],[96,732],[-58,554],[-218,681],[34,213],[-163,76],[-197,481]],[[75657,62792],[-18,476],[97,-90],[6,424]],[[75742,63602],[137,140],[-30,251],[63,201],[11,612],[217,-135],[124,487],[14,288],[153,496],[-8,338],[359,408],[199,-107],[-23,364],[97,108],[-20,224]],[[77035,67277],[162,44],[93,-348],[121,-141],[8,-452],[-11,-487],[-263,-493],[-33,-701],[293,98],[66,-544],[176,-115],[-81,-490],[206,-222],[121,-109],[203,172],[9,-244]],[[78380,63852],[149,145],[221,-3],[271,68],[236,315],[134,-222],[254,-108],[-44,-340],[132,-240],[280,-154]],[[80013,63313],[-371,-505],[-231,-558],[-61,-410],[212,-623],[260,-772],[252,-365],[169,-475],[127,-1093],[-37,-1039],[-232,-389],[-318,-381],[-227,-492],[-346,-550],[-101,378],[78,401],[-206,335]],[[86327,75524],[0,0]],[[86327,75524],[-106,36],[-120,-200],[-83,-202],[10,-424],[-143,-130],[-50,-105],[-104,-174],[-185,-97],[-121,-159],[-9,-256],[-32,-65],[111,-96],[157,-259]],[[85652,73393],[-40,-143],[-118,-39],[-197,-29],[-108,-266],[-124,21],[-17,-54]],[[85048,72883],[-135,112],[-34,-111],[-81,-49],[-10,112],[-72,54],[-75,94],[76,260],[66,69],[-25,108],[71,319],[-18,96],[-163,65],[-131,158]],[[84517,74170],[227,379],[306,318],[191,419],[131,-185],[241,-22],[-44,312],[429,254],[111,331],[179,-348]],[[85652,73393],[240,-697],[68,-383],[3,-681],[-105,-325],[-252,-113],[-222,-245],[-250,-51],[-31,322],[51,443],[-122,615],[206,99],[-190,506]],[[82410,80055],[-135,-446],[-197,-590],[72,-241],[157,74],[274,-92],[214,219],[223,-189],[251,-413],[-30,-210],[-219,66],[-404,-78],[-195,-168],[-204,-391],[-423,-229],[-277,-313],[-286,120],[-156,53],[-146,-381],[89,-227],[45,-195],[-194,-199],[-200,-316],[-324,-208],[-417,-22],[-448,-205],[-324,-318],[-123,184],[-336,-1],[-411,359],[-274,88],[-369,-82],[-574,133],[-306,-14],[-163,351],[-127,544],[-171,66],[-336,368],[-374,83],[-330,101],[-100,256],[107,690],[-192,476],[-396,222],[-233,313],[-73,413]],[[75742,63602],[-147,937],[-76,-2],[-46,-377],[-152,306],[86,336],[124,34],[128,500],[-160,101],[-257,-8],[-265,81],[-24,410],[-133,30],[-220,255],[-98,-401],[200,-313],[-173,-220],[-62,-215],[171,-159],[-47,-356],[96,-444],[43,-486]],[[74730,63611],[-39,-216],[-189,7],[-343,-122],[16,-445],[-148,-349],[-400,-398],[-311,-695],[-209,-373],[-276,-387],[-1,-271],[-138,-146],[-251,-212],[-129,-31],[-84,-450],[58,-769],[15,-490],[-118,-561],[-1,-1004],[-144,-29],[-126,-450],[84,-195],[-253,-168],[-93,-401],[-112,-170],[-263,552],[-128,827],[-107,596],[-97,279],[-148,568],[-69,739],[-48,369],[-253,811],[-115,1145],[-83,756],[1,716],[-54,553],[-404,-353],[-196,70],[-362,716],[133,214],[-82,232],[-326,501]],[[68937,64577],[185,395],[612,-2],[-56,507],[-156,300],[-31,455],[-182,265],[306,619],[323,-45],[290,620],[174,599],[270,593],[-4,421],[236,342],[-224,292],[-96,400],[-99,517],[137,255],[421,-144],[310,88],[268,496]],[[71621,71550],[298,-692],[-28,-482],[111,-303],[-9,-301],[-200,79],[78,-651],[273,-374],[386,-413]],[[72530,68413],[-176,-268],[-108,-553],[269,-224],[262,-289],[362,-332],[381,-76],[160,-301],[215,-56],[334,-138],[231,10],[32,234],[-36,375],[21,255]],[[74477,67050],[170,124],[23,-465]],[[74670,66709],[6,-119],[252,-224],[175,92],[234,-39],[227,17],[20,363],[-113,189]],[[75471,66988],[224,74],[252,439],[321,376],[233,-145],[198,249],[130,-367],[-94,-248],[300,-89]],[[75657,62792],[-79,308],[-16,301],[-53,285],[-116,344],[-256,23],[25,-243],[-87,-329],[-118,120],[-41,-108],[-78,65],[-108,53]],[[74670,66709],[184,439],[150,150],[198,-137],[147,-14],[122,-159]],[[72530,68413],[115,141],[223,-182],[280,-385],[157,-84],[93,-284],[216,-117],[225,-259],[314,-136],[324,-57]],[[68937,64577],[-203,150],[-83,424],[-215,450],[-512,-111],[-451,-11],[-391,-83]],[[67082,65396],[105,687],[400,305],[-23,272],[-133,96],[-7,520],[-266,260],[-112,357],[-137,310]],[[66909,68203],[465,-301],[278,88],[166,-75],[56,129],[194,-52],[361,246],[10,503],[154,334],[207,-1],[31,166],[212,77],[103,-55],[108,166],[-15,355],[118,356],[177,150],[-110,390],[265,-18],[76,213],[-12,227],[139,248],[-32,294],[-66,250],[163,258],[298,124],[319,68],[141,109],[162,67]],[[70877,72519],[205,-276],[82,-454],[457,-239]],[[68841,72526],[85,-72],[201,189],[93,-114],[90,271],[166,-12],[43,86],[29,239],[120,205],[150,-134],[-30,-181],[84,-28],[-26,-496],[110,-194],[97,125],[123,58],[173,265],[192,-44],[286,-1]],[[70827,72688],[50,-169]],[[66909,68203],[252,536],[-23,380],[-210,100],[-22,375],[-91,472],[119,323],[-121,87],[76,430],[113,736]],[[67002,71642],[284,-224],[209,79],[58,268],[219,89],[157,180],[55,472],[234,114],[44,211],[131,-158],[84,-19]],[[69725,74357],[-101,-182],[-303,98],[-26,-340],[301,46],[343,-192],[526,89]],[[70465,73876],[70,-546],[91,59],[169,-134],[-10,-230],[42,-337]],[[72294,75601],[-39,-134],[-438,-320],[-99,-234],[-356,-70],[-105,-378],[-294,80],[-192,-116],[-266,-279],[39,-138],[-79,-136]],[[67002,71642],[-24,498],[-207,21],[-318,523],[-221,65],[-308,299],[-197,55],[-122,-110],[-186,17],[-197,-338],[-244,-114]],[[64978,72558],[-52,417],[40,618],[-216,200],[71,405],[-184,34],[61,498],[262,-145],[244,189],[-202,355],[-80,338],[-224,-151],[-28,-433],[-87,383]],[[62436,72541],[-152,473],[55,183],[-87,678],[190,168]],[[62442,74043],[44,-223],[141,-273],[190,-78]],[[62817,73469],[101,17]],[[62918,73486],[327,436],[104,44],[82,-174],[-95,-292],[173,-309],[69,29]],[[63578,73220],[88,-436],[263,-123],[193,-296],[395,-102],[434,156],[27,139]],[[67082,65396],[-523,179],[-303,136],[-313,76],[-118,725],[-133,105],[-214,-106],[-280,-286],[-339,196],[-281,454],[-267,168],[-186,561],[-205,788],[-149,-96],[-177,196],[-104,-231]],[[59999,71049],[-26,452],[68,243]],[[60041,71744],[74,129],[75,130],[15,329],[91,-115],[306,165],[147,-112],[229,2],[320,222],[149,-10],[316,92]],[[62817,73469],[-113,342],[1,91],[-123,-2],[-82,159],[-58,-16]],[[62442,74043],[-109,172],[-207,147],[27,288],[-47,208]],[[62106,74858],[386,92]],[[62492,74950],[57,-155],[106,-103],[-56,-148],[148,-202],[-78,-189],[118,-160],[124,-97],[7,-410]],[[55734,91409],[371,-289],[433,-402],[8,-910],[93,-230]],[[56639,89578],[-478,-167],[-269,-413],[43,-361],[-441,-475],[-537,-509],[-202,-832],[198,-416],[265,-328],[-255,-666],[-289,-138],[-106,-992],[-157,-554],[-337,57],[-158,-468],[-321,-27],[-89,558],[-232,671],[-211,835]],[[58829,81362],[-239,-35],[-85,-129],[-18,-298],[-111,57],[-250,-28],[-73,138],[-104,-103],[-105,86],[-218,12],[-310,141],[-281,47],[-215,-14],[-152,-160],[-133,-23]],[[56535,81053],[-6,263],[-85,274],[166,121],[2,235],[-77,225],[-12,261]],[[56523,82432],[268,-4],[302,223],[64,333],[228,190],[-26,264]],[[57359,83438],[169,100],[298,228]],[[60617,78409],[-222,-48],[-185,-191],[-260,-31],[-239,-220],[14,-317]],[[59287,77741],[-38,64],[-432,149],[-19,221],[-257,-73],[-103,-325],[-215,-437]],[[58223,77340],[-126,101],[-131,-95],[-124,109]],[[57842,77455],[70,64],[49,203],[76,188],[-20,106],[58,47],[27,-81],[164,-18],[74,44],[-52,60],[19,88],[-97,150],[-40,247],[-101,97],[20,200],[-125,159],[-115,22],[-204,184],[-185,-58],[-66,-87]],[[57394,79070],[-118,0],[-69,-139],[-205,-56],[-95,-91],[-129,144],[-178,3],[-172,65],[-120,-127]],[[56308,78869],[-19,159],[-155,161]],[[56134,79189],[55,238],[77,154]],[[56266,79581],[60,-35],[-71,266],[252,491],[138,69],[29,166],[-139,515]],[[56266,79581],[-264,227],[-200,-84],[-131,61],[-165,-127],[-140,210],[-114,-81],[-16,36]],[[55236,79823],[-127,291],[-207,36],[-26,185],[-191,66],[-41,-153],[-151,122],[17,163],[-207,51],[-132,191]],[[54171,80775],[-114,377],[22,204],[-69,316],[-101,210],[77,158],[-64,300]],[[53922,82340],[189,174],[434,273],[350,200],[277,-100],[21,-144],[268,-7]],[[56314,82678],[142,-64],[67,-182]],[[54716,79012],[-21,-241],[-156,-2],[53,-128],[-92,-380]],[[54500,78261],[-53,-100],[-243,-14],[-140,-134],[-229,45]],[[53835,78058],[-398,153],[-62,205],[-274,-102],[-32,-113],[-169,84]],[[52900,78285],[-142,16],[-125,108],[42,145],[-10,104]],[[52665,78658],[83,33],[141,-164],[39,156],[245,-25],[199,106],[133,-18],[87,-121],[26,100],[-40,385],[100,75],[98,272]],[[53776,79457],[206,-190],[157,242],[98,44],[215,-180],[131,30],[128,-111]],[[54711,79292],[-23,-75],[28,-205]],[[56308,78869],[-170,-123],[-131,-401],[-168,-401],[-223,-111]],[[55616,77833],[-173,26],[-213,-155]],[[55230,77704],[-104,-89],[-229,114],[-208,253],[-88,73]],[[54601,78055],[-54,200],[-47,6]],[[54716,79012],[141,-151],[103,-65],[233,73],[22,118],[111,18],[135,92],[30,-38],[130,74],[66,139],[91,36],[297,-180],[59,61]],[[57842,77455],[-50,270],[30,252],[-9,259],[-160,352],[-89,249],[-86,175],[-84,58]],[[58223,77340],[6,-152],[-135,-128],[-84,56],[-78,-713]],[[57932,76403],[-163,62],[-202,215],[-327,-138],[-138,-150],[-408,31],[-213,92],[-108,-43],[-80,243]],[[56293,76715],[-51,103],[65,99],[-69,74],[-87,-133],[-162,172],[-22,244],[-169,139],[-31,188],[-151,232]],[[55907,83187],[-59,497]],[[55848,83684],[318,181],[466,-38],[273,59],[39,-123],[148,-38],[267,-287]],[[55848,83684],[10,445],[136,371],[262,202],[221,-442],[223,12],[53,453]],[[56753,84725],[237,105],[121,-73],[239,-219],[229,-1]],[[56753,84725],[32,349],[-102,-75],[-176,210],[-24,340],[351,164],[350,86],[301,-97],[287,17]],[[54171,80775],[-124,-62],[-73,68],[-70,-113],[-200,-114],[-103,-147],[-202,-129],[49,-176],[30,-249],[141,-142],[157,-254]],[[52665,78658],[-298,181],[-57,-128],[-236,4]],[[51718,79804],[16,259],[-56,133]],[[51678,80196],[32,400]],[[51710,80596],[-47,619],[167,0],[70,222],[69,541],[-51,200]],[[51918,82178],[54,125],[232,32],[52,-130],[188,291],[-63,222],[-13,335]],[[52368,83053],[210,-78],[178,90]],[[52756,83065],[4,-228],[281,-138],[-3,-210],[283,111],[156,162],[313,-233],[132,-189]],[[57932,76403],[-144,-245],[-101,-422],[89,-337]],[[57776,75399],[-239,79],[-283,-186]],[[57254,75292],[-3,-294],[-252,-56],[-196,206],[-222,-162],[-206,17]],[[56375,75003],[-20,391],[-139,189]],[[56216,75583],[46,84],[-30,70],[47,188],[105,185],[-135,255],[-24,216],[68,134]],[[57302,71436],[-35,-175],[-400,-50],[3,98],[-339,115],[52,251],[152,-199],[216,34],[207,-42],[-7,-103],[151,71]],[[57254,75292],[135,-157],[-86,-369],[-66,-67]],[[57237,74699],[-169,17],[-145,56],[-336,-154],[192,-332],[-141,-96],[-154,-1],[-147,305],[-52,-130],[62,-353],[139,-277],[-105,-129],[155,-273],[137,-171],[4,-334],[-257,157],[82,-302],[-176,-62],[105,-521],[-184,-8],[-228,257],[-104,473],[-49,393],[-108,272],[-143,337],[-18,168]],[[55597,73991],[129,287],[16,192],[91,85],[5,155]],[[55838,74710],[182,53],[106,129],[150,-12],[46,103],[53,20]],[[60041,71744],[-102,268],[105,222],[-169,-51],[-233,136],[-191,-340],[-421,-66],[-225,317],[-300,20],[-64,-245],[-192,-70],[-268,314],[-303,-11],[-165,588],[-203,328],[135,459],[-176,283],[308,565],[428,23],[117,449],[529,-78],[334,383],[324,167],[459,13],[485,-417],[399,-228],[323,91],[239,-53],[328,309]],[[61542,75120],[296,28],[268,-290]],[[57776,75399],[33,-228],[243,-190],[-51,-145],[-330,-33],[-118,-182],[-232,-319],[-87,276],[3,121]],[[55597,73991],[-48,41],[-5,130],[-154,199],[-24,281],[23,403],[38,184],[-47,93]],[[55380,75322],[-18,188],[120,291],[18,-111],[75,52]],[[55575,75742],[59,-159],[66,-60],[19,-214]],[[55719,75309],[-35,-201],[39,-254],[115,-144]],[[55230,77704],[67,-229],[89,-169],[-107,-222]],[[55279,77084],[-126,131],[-192,-8],[-239,98],[-130,-13],[-60,-123],[-99,136],[-59,-245],[136,-277],[61,-183],[127,-221],[106,-130],[105,-247],[246,-224]],[[55155,75778],[-31,-100]],[[55124,75678],[-261,218],[-161,213],[-254,176],[-233,434],[56,45],[-127,248],[-5,200],[-179,93],[-85,-255],[-82,198],[6,205],[10,9]],[[53809,77462],[194,-20],[51,100],[94,-97],[109,-11],[-1,165],[97,60],[27,239],[221,157]],[[52900,78285],[-22,-242],[-122,-100],[-206,75],[-60,-239],[-132,-19],[-48,94],[-156,-200],[-134,-28],[-120,126]],[[51576,79843],[30,331],[72,22]],[[50698,80799],[222,117]],[[50920,80916],[204,-47],[257,123],[176,-258],[153,-138]],[[50920,80916],[143,162],[244,869],[380,248],[231,-17]],[[47490,75324],[101,150],[113,86],[70,-289],[164,0],[47,75],[162,-21],[78,-296],[-129,-160],[-3,-461],[-45,-86],[-11,-280],[-120,-48],[111,-355],[-77,-388],[96,-175],[-38,-161],[-103,-222],[23,-195]],[[47929,72498],[-112,-153],[-146,83],[-143,-65],[42,462],[-26,363],[-124,55],[-67,224],[22,386],[111,215],[20,239],[58,355],[-6,250],[-56,212],[-12,200]],[[47490,75324],[14,420],[-114,257],[393,426],[340,-106],[373,3],[296,-101],[230,31],[449,-19]],[[50829,75674],[15,-344],[-263,-393],[-356,-125],[-25,-199],[-171,-327],[-107,-481],[108,-338],[-160,-263],[-60,-384],[-210,-118],[-197,-454],[-352,-9],[-265,11],[-174,-209],[-106,-223],[-136,49],[-103,199],[-79,340],[-259,92]],[[48278,82406],[46,-422],[-210,-528],[-493,-349],[-393,89],[225,617],[-145,601],[378,463],[210,276]],[[47896,83153],[57,-317],[-57,-317],[172,9],[210,-122]],[[96049,38125],[228,-366],[144,-272],[-105,-142],[-153,160],[-199,266],[-179,313],[-184,416],[-38,201],[119,-9],[156,-201],[122,-200],[89,-166]],[[95032,44386],[78,-203],[-194,4],[-106,363],[166,-142],[56,-22]],[[94910,44908],[-42,-109],[-206,512],[-57,353],[94,0],[100,-473],[111,-283]],[[94680,44747],[-108,-14],[-170,60],[-58,91],[17,235],[183,-93],[91,-124],[45,-155]],[[94344,45841],[65,-187],[12,-119],[-218,251],[-152,212],[-104,197],[41,60],[128,-142],[228,-272]],[[93649,46431],[111,-193],[-56,-33],[-121,134],[-114,243],[14,99],[166,-250]],[[99134,26908],[-105,-319],[-138,-404],[-214,-236],[-48,155],[-116,85],[160,486],[-91,326],[-299,236],[8,214],[201,206],[47,455],[-13,382],[-113,396],[8,104],[-133,244],[-218,523],[-117,418],[104,46],[151,-328],[216,-153],[78,-526],[202,-622],[5,403],[126,-161],[41,-447],[224,-192],[188,-48],[158,226],[141,-69],[-67,-524],[-85,-345],[-212,12],[-74,-179],[26,-254],[-41,-110]],[[97129,24846],[238,310],[167,306],[123,441],[106,149],[41,330],[195,273],[61,-251],[63,-244],[198,239],[80,-249],[0,-249],[-103,-274],[-182,-435],[-142,-238],[103,-284],[-214,-7],[-238,-223],[-75,-387],[-157,-597],[-219,-264],[-138,-169],[-256,13],[-180,194],[-302,42],[-46,217],[149,438],[349,583],[179,111],[200,225]],[[91024,26469],[166,-39],[20,-702],[-95,-203],[-29,-476],[-97,162],[-193,-412],[-57,32],[-171,19],[-171,505],[-38,390],[-160,515],[7,271],[181,-52],[269,-204],[151,81],[217,113]],[[85040,31546],[-294,-303],[-241,-137],[-53,-309],[-103,-240],[-236,-15],[-174,-52],[-246,107],[-199,-64],[-191,-27],[-165,-315],[-81,26],[-140,-167],[-133,-187],[-203,23],[-186,0],[-295,377],[-149,113],[6,338],[138,81],[47,134],[-10,212],[34,411],[-31,350],[-147,598],[-45,337],[12,336],[-111,385],[-7,174],[-123,235],[-35,463],[-158,467],[-39,252],[122,-255],[-93,548],[137,-171],[83,-229],[-5,303],[-138,465],[-26,186],[-65,177],[31,341],[56,146],[38,295],[-29,346],[114,425],[21,-450],[118,406],[225,198],[136,252],[212,217],[126,46],[77,-73],[219,220],[168,66],[42,129],[74,54],[153,-14],[292,173],[151,262],[71,316],[163,300],[13,236],[7,321],[194,502],[117,-510],[119,118],[-99,279],[87,287],[122,-128],[34,449],[152,291],[67,233],[140,101],[4,165],[122,-69],[5,148],[122,85],[134,80],[205,-271],[155,-350],[173,-4],[177,-56],[-59,325],[133,473],[126,155],[-44,147],[121,338],[168,208],[142,-70],[234,111],[-5,302],[-204,195],[148,86],[184,-147],[148,-242],[234,-151],[79,60],[172,-182],[162,169],[105,-51],[65,113],[127,-292],[-74,-316],[-105,-239],[-96,-20],[32,-236],[-81,-295],[-99,-291],[20,-166],[221,-327],[214,-189],[143,-204],[201,-350],[78,1],[145,-151],[43,-183],[265,-200],[183,202],[55,317],[56,262],[34,324],[85,470],[-39,286],[20,171],[-32,339],[37,445],[53,120],[-43,197],[67,313],[52,325],[7,168],[104,222],[78,-289],[19,-371],[70,-71],[11,-249],[101,-300],[21,-335],[-10,-214],[100,-464],[179,223],[92,-250],[133,-231],[-29,-262],[60,-506],[42,-295],[70,-72],[75,-505],[-27,-307],[90,-400],[301,-309],[197,-281],[186,-257],[-37,-143],[159,-371],[108,-639],[111,130],[113,-256],[68,91],[48,-626],[197,-363],[129,-226],[217,-478],[78,-475],[7,-337],[-19,-365],[132,-502],[-16,-523],[-48,-274],[-75,-527],[6,-339],[-55,-423],[-123,-538],[-205,-290],[-102,-458],[-93,-292],[-82,-510],[-107,-294],[-70,-442],[-36,-407],[14,-187],[-159,-205],[-311,-22],[-257,-242],[-127,-229],[-168,-254],[-230,262],[-170,104],[43,308],[-152,-112],[-243,-428],[-240,160],[-158,94],[-159,42],[-269,171],[-179,364],[-52,449],[-64,298],[-137,240],[-267,71],[91,287],[-67,438],[-136,-408],[-247,-109],[146,327],[42,341],[107,289],[-22,438],[-226,-504],[-174,-202],[-106,-470],[-217,243],[9,313],[-174,429],[-147,221],[52,137],[-356,358],[-195,17],[-267,287],[-498,-56],[-359,-211],[-317,-197],[-265,39]],[[72718,55024],[-42,-615],[-116,-168],[-242,-135],[-132,470],[-49,849],[126,959],[192,-328],[129,-416],[134,-616]],[[80409,61331],[-228,183],[-8,509],[137,267],[304,166],[159,-14],[62,-226],[-122,-260],[-64,-341],[-240,-284]],[[84517,74170],[-388,-171],[-204,-277],[-300,-161],[148,274],[-58,230],[220,397],[-147,310],[-242,-209],[-314,-411],[-171,-381],[-272,-29],[-142,-275],[147,-400],[227,-97],[9,-265],[220,-173],[311,422],[247,-230],[179,-15],[45,-310],[-393,-165],[-130,-319],[-270,-296],[-142,-414],[299,-325],[109,-581],[169,-541],[189,-454],[-5,-439],[-174,-161],[66,-315],[164,-184],[-43,-481],[-71,-468],[-155,-53],[-203,-640],[-225,-775],[-258,-705],[-382,-545],[-386,-498],[-313,-68],[-170,-262],[-96,192],[-157,-294],[-388,-296],[-294,-90],[-95,-624],[-154,-35],[-73,429],[66,228],[-373,189],[-131,-96]],[[83826,64992],[-167,-947],[-119,-485],[-146,499],[-32,438],[163,581],[223,447],[127,-176],[-49,-357]],[[53835,78058],[-31,-291],[67,-251]],[[53871,77516],[-221,86],[-226,-210],[15,-293],[-34,-168],[91,-301],[261,-298],[140,-488],[309,-476],[217,3],[68,-130],[-78,-118],[249,-214],[204,-178],[238,-308],[29,-111],[-52,-211],[-154,276],[-242,97],[-116,-382],[200,-219],[-33,-309],[-116,-35],[-148,-506],[-116,-46],[1,181],[57,317],[60,126],[-108,342],[-85,298],[-115,74],[-82,255],[-179,107],[-120,238],[-206,38],[-217,267],[-254,384],[-189,340],[-86,585],[-138,68],[-226,195],[-128,-80],[-161,-274],[-115,-43]],[[54100,73116],[211,51],[-100,-465],[41,-183],[-58,-303],[-213,222],[-141,64],[-387,300],[38,304],[325,-54],[284,64]],[[52419,74744],[139,183],[166,-419],[-39,-782],[-126,38],[-113,-197],[-105,156],[-11,713],[-64,338],[153,-30]],[[52368,83053],[-113,328],[-8,604],[46,159],[80,177],[244,37],[98,163],[223,167],[-9,-304],[-82,-192],[33,-166],[151,-89],[-68,-223],[-83,64],[-200,-425],[76,-288]],[[53436,83731],[88,-296],[-166,-478],[-291,333],[-39,246],[408,195]],[[47896,83153],[233,24],[298,-365],[-149,-406]],[[49140,82132],[1,0],[40,343],[-186,364],[-4,8],[-337,104],[-66,160],[101,264],[-92,163],[-149,-279],[-17,569],[-140,301],[101,611],[216,480],[222,-47],[335,49],[-297,-639],[283,81],[304,-3],[-72,-481],[-250,-530],[287,-38],[22,-62],[248,-697],[190,-95],[171,-673],[79,-233],[337,-113],[-34,-378],[-142,-173],[111,-305],[-250,-310],[-371,6],[-473,-163],[-130,116],[-183,-276],[-257,67],[-195,-226],[-148,118],[407,621],[249,127],[-2,1],[-434,98],[-79,235],[291,183],[-152,319],[52,387],[413,-54]],[[45969,89843],[-64,-382],[314,-403],[-361,-451],[-801,-405],[-240,-107],[-365,87],[-775,187],[273,261],[-605,289],[492,114],[-12,174],[-583,137],[188,385],[421,87],[433,-400],[422,321],[349,-167],[453,315],[461,-42]],[[63495,75281],[146,-311],[141,-419],[130,-28],[85,-159],[-228,-47],[-49,-459],[-48,-207],[-101,-138],[7,-293]],[[62492,74950],[68,96],[207,-169],[149,-36],[38,70],[-136,319],[72,82]],[[61542,75120],[42,252],[-70,403],[-160,218],[-154,68],[-102,181]],[[83564,58086],[-142,450],[238,-22],[97,-213],[-74,-510],[-119,295]],[[84051,56477],[70,165],[30,367],[153,35],[-44,-398],[205,570],[-26,-563],[-100,-195],[-87,-373],[-87,-175],[-171,409],[57,158]],[[85104,55551],[28,-392],[16,-332],[-94,-540],[-102,602],[-130,-300],[89,-435],[-79,-277],[-327,343],[-78,428],[84,280],[-176,280],[-87,-245],[-131,23],[-205,-330],[-46,173],[109,498],[175,166],[151,223],[98,-268],[212,162],[45,264],[196,15],[-16,457],[225,-280],[23,-297],[20,-218]],[[82917,56084],[-369,-561],[136,414],[200,364],[167,409],[146,587],[49,-482],[-183,-325],[-146,-406]],[[83982,61347],[-46,-245],[95,-423],[-73,-491],[-164,-196],[-43,-476],[62,-471],[147,-65],[123,70],[347,-328],[-27,-321],[91,-142],[-29,-272],[-216,290],[-103,310],[-71,-217],[-177,354],[-253,-87],[-138,130],[14,244],[87,151],[-83,136],[-36,-213],[-137,340],[-41,257],[-11,566],[112,-195],[29,925],[90,535],[169,-1],[171,-168],[85,153],[26,-150]],[[83899,57324],[-43,282],[166,-183],[177,1],[-5,-247],[-129,-251],[-176,-178],[-10,275],[20,301]],[[84861,57766],[78,-660],[-214,157],[5,-199],[68,-364],[-132,-133],[-11,416],[-84,31],[-43,357],[163,-47],[-4,224],[-169,451],[266,-13],[77,-220]],[[78372,54256],[64,-56],[164,-356],[116,-396],[16,-398],[-29,-269],[27,-203],[20,-349],[98,-163],[109,-523],[-5,-199],[-197,-40],[-263,438],[-329,469],[-32,301],[-161,395],[-38,489],[-100,322],[30,431],[-61,250]],[[80461,51765],[204,-202],[214,110],[56,500],[119,112],[333,128],[199,467],[137,374]],[[81723,53254],[126,-307],[58,202],[133,-19],[16,377],[13,291]],[[82069,53798],[214,411],[140,462],[112,2],[143,-299],[13,-257],[183,-165],[231,-177],[-20,-232],[-186,-29],[50,-289],[-205,-201]],[[81723,53254],[110,221],[236,323]],[[53809,77462],[62,54]],[[57797,86326],[-504,-47],[-489,-216],[-452,-125],[-161,323],[-269,193],[62,582],[-135,533],[133,345],[252,371],[635,640],[185,124],[-28,250],[-387,279]],[[54711,79292],[39,130],[123,-10],[95,61],[7,55],[54,28],[18,134],[64,26],[43,106],[82,1]],[[60669,61213],[161,-684],[77,-542],[152,-288],[379,-558],[154,-336],[151,-341],[87,-203],[136,-178]],[[61966,58083],[-83,-144],[-119,51]],[[61764,57990],[-95,191],[-114,346],[-124,190],[-71,204],[-242,237],[-191,7],[-67,124],[-163,-139],[-168,268],[-87,-441],[-323,124]],[[89411,73729],[-256,-595],[4,-610],[-104,-472],[48,-296],[-145,-416],[-355,-278],[-488,-36],[-396,-675],[-186,227],[-12,442],[-483,-130],[-329,-279],[-325,-11],[282,-435],[-186,-1004],[-179,-248],[-135,229],[69,533],[-176,172],[-113,405],[263,182],[145,371],[280,306],[203,403],[553,177],[297,-121],[291,1050],[185,-282],[408,591],[158,229],[174,723],[-47,664],[117,374],[295,108],[152,-819],[-9,-479]],[[90169,76553],[197,250],[62,-663],[-412,-162],[-244,-587],[-436,404],[-152,-646],[-308,-9],[-39,587],[138,455],[296,33],[81,817],[83,460],[326,-615],[213,-198],[195,-126]],[[86769,70351],[154,352],[158,-68],[114,248],[204,-127],[35,-203],[-156,-357],[-114,189],[-143,-137],[-73,-346],[-181,168],[2,281]],[[64752,60417],[-201,-158],[-54,-263],[-6,-201],[-277,-249],[-444,-276],[-249,-417],[-122,-33],[-83,35],[-163,-245],[-177,-114],[-233,-30],[-70,-34],[-61,-156],[-73,-43],[-43,-150],[-137,13],[-89,-80],[-192,30],[-72,345],[8,323],[-46,174],[-54,437],[-80,243],[56,29],[-29,270],[34,114],[-12,257]],[[61883,60238],[121,189],[-28,249],[74,290],[114,-153],[75,53],[321,14],[50,-59],[269,-60],[106,30],[70,-197],[130,99],[199,620],[259,266],[801,226]],[[63448,67449],[109,-510],[137,-135],[47,-207],[190,-249],[16,-243],[-27,-197],[35,-199],[80,-165],[37,-194],[41,-145]],[[64274,65130],[53,-226]],[[61883,60238],[-37,252],[-83,178],[-22,236],[-143,212],[-148,495],[-79,482],[-192,406],[-124,97],[-184,563],[-32,411],[12,350],[-159,655],[-130,231],[-150,122],[-92,339],[15,133],[-77,306],[-81,132],[-108,440],[-170,476],[-141,406],[-139,-3],[44,325],[12,206],[34,236]],[[36483,4468],[141,0],[414,127],[419,-127],[342,-255],[120,-359],[33,-254],[11,-301],[-430,-186],[-452,-150],[-522,-139],[-582,-116],[-658,35],[-365,197],[49,243],[593,162],[239,197],[174,254],[126,220],[168,209],[180,243]],[[31586,3163],[625,-23],[599,-58],[207,243],[147,208],[288,-243],[-82,-301],[-81,-266],[-582,81],[-621,-35],[-348,197],[0,23],[-152,174]],[[29468,8472],[190,70],[321,-23],[82,301],[16,219],[-6,475],[158,278],[256,93],[147,-220],[65,-220],[120,-267],[92,-254],[76,-267],[33,-266],[-49,-231],[-76,-220],[-326,-81],[-311,-116],[-364,11],[136,232],[-327,-81],[-310,-81],[-212,174],[-16,243],[305,231]],[[21575,8103],[174,104],[353,-81],[403,-46],[305,-81],[304,69],[163,-335],[-217,46],[-337,-23],[-343,23],[-376,-35],[-283,116],[-146,243]],[[15938,7061],[60,197],[332,-104],[359,-93],[332,104],[-158,-208],[-261,-151],[-386,47],[-278,208]],[[14643,7177],[202,127],[277,-139],[425,-231],[-164,23],[-359,58],[-381,162]],[[4524,4144],[169,220],[517,-93],[277,-185],[212,-209],[76,-266],[-533,-81],[-364,208],[-163,209],[-11,35],[-180,162]],[[0,529],[16,-5],[245,344],[501,-185],[32,21],[294,188],[38,-7],[32,-4],[402,-246],[352,246],[63,34],[816,104],[265,-138],[130,-71],[419,-196],[789,-151],[625,-185],[1072,-139],[800,162],[1181,-116],[669,-185],[734,174],[773,162],[60,278],[-1094,23],[-898,139],[-234,231],[-745,128],[49,266],[103,243],[104,220],[-55,243],[-462,162],[-212,209],[-430,185],[675,-35],[642,93],[402,-197],[495,173],[457,220],[223,197],[-98,243],[-359,162],[-408,174],[-571,35],[-500,81],[-539,58],[-180,220],[-359,185],[-217,208],[-87,672],[136,-58],[250,-185],[457,58],[441,81],[228,-255],[441,58],[370,127],[348,162],[315,197],[419,58],[-11,220],[-97,220],[81,208],[359,104],[163,-196],[425,115],[321,151],[397,12],[375,57],[376,139],[299,128],[337,127],[218,-35],[190,-46],[414,81],[370,-104],[381,11],[364,81],[375,-57],[414,-58],[386,23],[403,-12],[413,-11],[381,23],[283,174],[337,92],[349,-127],[331,104],[300,208],[179,-185],[98,-208],[180,-197],[288,174],[332,-220],[375,-70],[321,-162],[392,35],[354,104],[418,-23],[376,-81],[381,-104],[147,254],[-180,197],[-136,209],[-359,46],[-158,220],[-60,220],[-98,440],[213,-81],[364,-35],[359,35],[327,-93],[283,-174],[119,-208],[376,-35],[359,81],[381,116],[342,70],[283,-139],[370,46],[239,451],[224,-266],[321,-104],[348,58],[228,-232],[365,-23],[337,-69],[332,-128],[218,220],[108,209],[278,-232],[381,58],[283,-127],[190,-197],[370,58],[288,127],[283,151],[337,81],[392,69],[354,81],[272,127],[163,186],[65,254],[-32,244],[-87,231],[-98,232],[-87,231],[-71,209],[-16,231],[27,232],[130,220],[109,243],[44,231],[-55,255],[-32,232],[136,266],[152,173],[180,220],[190,186],[223,173],[109,255],[152,162],[174,151],[267,34],[174,186],[196,115],[228,70],[202,150],[157,186],[218,69],[163,-151],[-103,-196],[-283,-174],[-120,-127],[-206,92],[-229,-58],[-190,-139],[-202,-150],[-136,-174],[-38,-231],[17,-220],[130,-197],[-190,-139],[-261,-46],[-153,-197],[-163,-185],[-174,-255],[-44,-220],[98,-243],[147,-185],[229,-139],[212,-185],[114,-232],[60,-220],[82,-232],[130,-196],[82,-220],[38,-544],[81,-220],[22,-232],[87,-231],[-38,-313],[-152,-243],[-163,-197],[-370,-81],[-125,-208],[-169,-197],[-419,-220],[-370,-93],[-348,-127],[-376,-128],[-223,-243],[-446,-23],[-489,23],[-441,-46],[-468,0],[87,-232],[424,-104],[311,-162],[174,-208],[-310,-185],[-479,58],[-397,-151],[-17,-243],[-11,-232],[327,-196],[60,-220],[353,-220],[588,-93],[500,-162],[398,-185],[506,-186],[690,-92],[681,-162],[473,-174],[517,-197],[272,-278],[136,-220],[337,209],[457,173],[484,186],[577,150],[495,162],[691,12],[680,-81],[560,-139],[180,255],[386,173],[702,12],[550,127],[522,128],[577,81],[614,104],[430,150],[-196,209],[-119,208],[0,220],[-539,-23],[-571,-93],[-544,0],[-77,220],[39,440],[125,128],[397,138],[468,139],[337,174],[337,174],[251,231],[380,104],[376,81],[190,47],[430,23],[408,81],[343,116],[337,139],[305,139],[386,185],[245,197],[261,173],[82,232],[-294,139],[98,243],[185,185],[288,116],[305,139],[283,185],[217,232],[136,277],[202,163],[331,-35],[136,-197],[332,-23],[11,220],[142,231],[299,-58],[71,-220],[331,-34],[360,104],[348,69],[315,-34],[120,-243],[305,196],[283,105],[315,81],[310,81],[283,139],[310,92],[240,128],[168,208],[207,-151],[288,81],[202,-277],[157,-209],[316,116],[125,232],[283,162],[365,-35],[108,-220],[229,220],[299,69],[326,23],[294,-11],[310,-70],[300,-34],[130,-197],[180,-174],[304,104],[327,24],[315,0],[310,11],[278,81],[294,70],[245,162],[261,104],[283,58],[212,162],[152,324],[158,197],[288,-93],[109,-208],[239,-139],[289,46],[196,-208],[206,-151],[283,139],[98,255],[250,104],[289,197],[272,81],[326,116],[218,127],[228,139],[218,127],[261,-69],[250,208],[180,162],[261,-11],[229,139],[54,208],[234,162],[228,116],[278,93],[256,46],[244,-35],[262,-58],[223,-162],[27,-254],[245,-197],[168,-162],[332,-70],[185,-162],[229,-162],[266,-35],[223,116],[240,243],[261,-127],[272,-70],[261,-69],[272,-46],[277,0],[229,-614],[-11,-150],[-33,-267],[-266,-150],[-218,-220],[38,-232],[310,12],[-38,-232],[-141,-220],[-131,-243],[212,-185],[321,-58],[321,104],[153,232],[92,220],[153,185],[174,174],[70,208],[147,289],[174,58],[316,24],[277,69],[283,93],[136,231],[82,220],[190,220],[272,151],[234,115],[153,197],[157,104],[202,93],[277,-58],[250,58],[272,69],[305,-34],[201,162],[142,393],[103,-162],[131,-278],[234,-115],[266,-47],[267,70],[283,-46],[261,-12],[174,58],[234,-35],[212,-127],[250,81],[300,0],[255,81],[289,-81],[185,197],[141,196],[191,163],[348,439],[179,-81],[212,-162],[185,-208],[354,-359],[272,-12],[256,0],[299,70],[299,81],[229,162],[190,174],[310,23],[207,127],[218,-116],[141,-185],[196,-185],[305,23],[190,-150],[332,-151],[348,-58],[288,47],[218,185],[185,185],[250,46],[251,-81],[288,-58],[261,93],[250,0],[245,-58],[256,-58],[250,104],[299,93],[283,23],[316,0],[255,58],[251,46],[76,290],[11,243],[174,-162],[49,-266],[92,-244],[115,-196],[234,-105],[315,35],[365,12],[250,35],[364,0],[262,11],[364,-23],[310,-46],[196,-186],[-54,-220],[179,-173],[299,-139],[310,-151],[360,-104],[375,-92],[283,-93],[315,-12],[180,197],[245,-162],[212,-185],[245,-139],[337,-58],[321,-69],[136,-232],[316,-139],[212,-208],[310,-93],[321,12],[299,-35],[332,12],[332,-47],[310,-81],[288,-139],[289,-116],[195,-173],[-32,-232],[-147,-208],[-125,-266],[-98,-209],[-131,-243],[-364,-93],[-163,-208],[-360,-127],[-125,-232],[-190,-220],[-201,-185],[-115,-243],[-70,-220],[-28,-266],[6,-220],[158,-232],[60,-220],[130,-208],[517,-81],[109,-255],[-501,-93],[-424,-127],[-528,-23],[-234,-336],[-49,-278],[-119,-220],[-147,-220],[370,-196],[141,-244],[239,-219],[338,-197],[386,-186],[419,-185],[636,-185],[142,-289],[800,-128],[53,-45],[208,-175],[767,151],[636,-186],[479,-142],[-99999,0]],[[59092,71341],[19,3],[40,143],[200,-8],[253,176],[-188,-251],[21,-111]],[[59437,71293],[-30,21],[-53,-45],[-42,12],[-14,-22],[-5,59],[-20,37],[-54,6],[-75,-51],[-52,31]],[[59437,71293],[8,-48],[-285,-240],[-136,77],[-64,237],[132,22]],[[45272,63236],[13,274],[106,161],[91,308],[-18,200],[96,417],[155,376],[93,95],[74,344],[6,315],[100,365],[185,216],[177,603],[5,8],[139,227],[259,65],[218,404],[140,158],[232,493],[-70,735],[106,508],[37,312],[179,399],[278,270],[206,244],[186,612],[87,362],[205,-2],[167,-251],[264,41],[288,-131],[121,-6]],[[56944,63578],[0,2175],[0,2101],[-83,476],[71,365],[-43,253],[101,283]],[[56990,69231],[369,10],[268,-156],[275,-175],[129,-92],[214,188],[114,169],[245,49],[198,-75],[75,-293],[65,193],[222,-140],[217,-33],[137,149]],[[59700,68010],[-78,-238],[-60,-446],[-75,-308],[-65,-103],[-93,191],[-125,263],[-198,847],[-29,-53],[115,-624],[171,-594],[210,-920],[102,-321],[90,-334],[249,-654],[-55,-103],[9,-384],[323,-530],[49,-121]],[[53191,70158],[326,-204],[117,51],[232,-98],[368,-264],[130,-526],[250,-114],[391,-248],[296,-293],[136,153],[133,272],[-65,452],[87,288],[200,277],[192,80],[375,-121],[95,-264],[104,-2],[88,-101],[276,-70],[68,-195]],[[59804,53833],[-164,643],[-127,137],[-48,236],[-141,288],[-171,42],[95,337],[147,14],[42,181]],[[61764,57990],[-98,-261],[-94,-277],[22,-163],[4,-180],[155,-10],[67,42],[62,-106]],[[61882,57035],[-61,-209],[103,-325],[102,-285],[106,-210],[909,-702],[233,4]],[[61966,58083],[66,-183],[-9,-245],[-158,-142],[119,-161]],[[61984,57352],[-102,-317]],[[61984,57352],[91,-109],[54,-245],[125,-247],[138,-2],[262,151],[302,70],[245,184],[138,39],[99,108],[158,20]],[[58449,49909],[-166,-182],[-67,60]],[[58564,52653],[115,161],[176,-132],[224,138],[195,-1],[171,272]],[[55279,77084],[100,2],[-69,-260],[134,-227],[-41,-278],[-65,-27]],[[55338,76294],[-52,-53],[-90,-138],[-41,-325]],[[55719,75309],[35,-5],[13,121],[164,91],[62,23]],[[55993,75539],[95,35],[128,9]],[[55993,75539],[-9,44],[33,71],[31,144],[-39,-4],[-54,110],[-46,28],[-36,94],[-52,36],[-40,84],[-50,-33],[-38,-196],[-66,-43]],[[55627,75874],[22,51],[-106,123],[-91,63],[-40,82],[-74,101]],[[55380,75322],[-58,46],[-78,192],[-120,118]],[[55627,75874],[-52,-132]],[[32866,56937],[160,77],[58,-21],[-11,-440],[-232,-65],[-50,53],[81,163],[-6,233]]],"bbox":[-180,-85.60903777459771,180,83.64513000000001],"transform":{"scale":[0.0036000360003600037,0.0016925586033320105],"translate":[-180,-85.60903777459771]}}
;

  Promise.resolve(__WORLD_TOPO__).then(world=>{
    const countries=topojson.feature(world,world.objects.countries);

    // Fallback de centroides: si falta alguno, se calcula desde la geometría real del mapa
    countries.features.forEach(feature=>{
      const code = ISO_MAP[String(feature.id).padStart(3,'0')];
      if(!code || COUNTRY_CENTROIDS[code]) return;
      try{
        const c = d3.geoCentroid(feature);
        if(Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])){
          COUNTRY_CENTROIDS[code] = [Number(c[0].toFixed(2)), Number(c[1].toFixed(2))];
        }
      }catch(_){}
    });

    // Grupo zoomable — TODO el contenido del mapa va aquí dentro
    // D3 zoom aplica transform a este grupo, los arcos se recalculan
    const mapG = svg.append('g').attr('id','map-zoom-g');

    // Graticule
    mapG.append('path')
      .datum(d3.geoGraticule()())
      .attr('d',path)
      .style('fill','none')
      .style('stroke','rgba(0,255,200,0.06)')
      .style('stroke-width','0.3');

    // Países
    mapG.append('g').attr('id','map-countries')
      .selectAll('path')
      .data(countries.features)
      .enter().append('path')
      .attr('d',path)
      .attr('class','map-country')
      .attr('data-id',d=>d.id)
      .style('fill',d=>{
        const key=ISO_MAP[String(d.id).padStart(3,'0')];
        return scoreToColor(getMapScore(key));
      })
      .style('stroke','#0B1420').style('stroke-width','0.4')
      .on('mousemove',function(event,d){
        const key=ISO_MAP[String(d.id).padStart(3,'0')];
        const s=getMapScore(key);
        const name=key?(DATA[key]?.name||key):'Sin datos';
        const rect=wrap.getBoundingClientRect();
        tip.style.display='block';
        tip.style.left=(event.clientX-rect.left+14)+'px';
        tip.style.top=(event.clientY-rect.top-34)+'px';
        tip.innerHTML='';
          const _tn=document.createElement('span');
          _tn.style.color='var(--cyan)'; _tn.textContent=name; tip.appendChild(_tn);
          tip.appendChild(document.createElement('br'));
          if(s!==null){
            const _ts=document.createElement('strong');
            _ts.style.color=scoreToColor(s); _ts.textContent=s+'/100';
            tip.appendChild(document.createTextNode('Riesgo: '));
            tip.appendChild(_ts);
          } else { tip.appendChild(document.createTextNode('Sin datos')); }
      })
      .on('mouseleave',()=>{ tip.style.display='none'; })
      .on('click',function(event,d){
        const key=ISO_MAP[String(d.id).padStart(3,'0')];
        const targetKey = (key && DATA[key]) ? key : ((COUNTRY_ALIAS[key] || []).find(alias => DATA[alias]) || null);
        if(targetKey){
          document.getElementById('region-sel').value=targetKey;
          loadRegion();
          // Zoom al país clicado
          zoomToCountry(d, path, W, H);
          if(typeof window._drawGlobeArcs==='function'&&arcsVisible) setTimeout(window._drawGlobeArcs,80);
        }
      });

    // arcGroup encima de los países, DENTRO del grupo zoomable
    arcGroup=mapG.append('g').attr('id','globe-arcs');

    // ── D3 ZOOM BEHAVIOR ──────────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([1, 12])          // zoom mínimo=1 (global), máximo=12
      .translateExtent([[0,0],[W,H]]) // no salirse del mapa
      .on('zoom', function(event){
        const {transform} = event;
        mapG.attr('transform', transform);

        // Escalar stroke de fronteras para que sigan finas al hacer zoom
        const k = transform.k;
        mapG.selectAll('.map-country')
          .style('stroke-width', (0.4/k)+'px');
        mapG.select('path:first-child') // graticule
          .style('stroke-width', (0.3/k)+'px');

        // Redibujar arcos con la misma proyección pero recalcular posiciones
        if(typeof window._drawGlobeArcs==='function'&&arcsVisible)
          window._redrawArcsOnZoom(transform);

        // Mostrar/ocultar botón reset
        const resetBtn=document.getElementById('map-zoom-reset');
        if(resetBtn) resetBtn.style.display = k>1.05?'block':'none';
      });

    svg.call(zoom);

    // ── FUNCIÓN: zoom a un país concreto ──────────────────────────────────
    function zoomToCountry(feature, pathFn, W, H){
      const [[x0,y0],[x1,y1]] = pathFn.bounds(feature);
      const fw=x1-x0, fh=y1-y0;
      if(fw<1||fh<1) return; // país sin geometría válida
      const padding=60;
      const scale=Math.min(12, 0.9/Math.max(fw/W, fh/H));
      const tx=W/2-(x0+x1)/2*scale;
      const ty=H/2-(y0+y1)/2*scale;
      svg.transition().duration(700).ease(d3.easeCubicInOut)
        .call(zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
    window._zoomToCountry = zoomToCountry;

    // ── CONTROLES DE ZOOM ─────────────────────────────────────────────────
    // T12: antes se colgaban de window (mapZoomIn, mapZoomOut, mapZoomReset)
    // porque se crean aqui dentro, al inicializar el mapa, y los botones los
    // buscaban por nombre. Ahora se registran en `mapControls`, que el modulo
    // exporta vacio y esta funcion rellena.
    mapControls.zoomIn  = ()=> svg.transition().duration(350)
      .call(zoom.scaleBy, 1.6);
    mapControls.zoomOut = ()=> svg.transition().duration(350)
      .call(zoom.scaleBy, 0.65);
    mapControls.reset   = ()=> svg.transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity);
    const mapZoomReset = mapControls.reset;
    window._mapZoom = zoom;
    window._mapSvgRef = svg;
    // Exponer zoomToCountry por código ISO para llamarla desde loadRegion
    window._zoomToCountryByCode = function(code){
      if(!code||code==='WLD'){
        mapZoomReset();
        return;
      }
      const feat = countries.features.find(f=>{
        const k=ISO_MAP[String(f.id).padStart(3,'0')];
        return k===code;
      });
      if(feat) zoomToCountry(feat, path, W, H);
    };

    // ── REDIBUJO DE ARCOS BAJO ZOOM ───────────────────────────────────────
    // Los arcos usan proj() que devuelve coordenadas en espacio original.
    // Al hacer zoom, el <g> recibe un transform — los arcos se transforman
    // automáticamente junto con mapG. Solo necesitamos escalar el stroke.
    window._redrawArcsOnZoom = function(transform){
      const k = transform.k;
      // Ajustar grosores de arcos para que sean legibles a cualquier zoom
      arcGroup.selectAll('path.arc-stroke')
        .style('stroke-width', function(){
          const base = +d3.select(this).attr('data-base-width')||1;
          return Math.max(0.3, base/k)+'px';
        });
      // Escalar los puntos de origen/destino
      arcGroup.selectAll('circle.arc-node')
        .attr('r', function(){
          const base=+d3.select(this).attr('data-base-r')||3;
          return Math.max(1, base/k);
        });
      // Escalar las flechas
      arcGroup.selectAll('polygon.arc-arrow')
        .attr('transform', function(){
          const ox=+d3.select(this).attr('data-ox');
          const oy=+d3.select(this).attr('data-oy');
          const ang=+d3.select(this).attr('data-angle');
          const base=+d3.select(this).attr('data-base-sz')||7;
          const sz=Math.max(2, base/k);
          return `translate(${ox},${oy}) rotate(${ang}) scale(${sz/base})`;
        });
    };

    // ════════════════════════════════════════════════
    //  ARCOS GEODÉSICOS — SISTEMA DE INTELIGENCIA
    // ════════════════════════════════════════════════

    function drawGlobeArcs(){
      if(!arcGroup||!arcsVisible) return;

      // Limpiar timers y elementos anteriores
      arcGroup.selectAll('[data-timer]').each(function(){
        const tid=+d3.select(this).attr('data-timer');
        if(tid) clearInterval(tid);
      });
      arcGroup.selectAll('*').remove();

      // FIX CRÍTICO: Los <defs> de gradientes deben ir en el <defs> RAÍZ del SVG
      // (arcGroup.selectAll('*').remove() borraba los gradientes cada frame)
      mapSvg.select('#arc-defs').remove();
      const arcDefs = mapSvg.select('defs').append('g').attr('id','arc-defs');

      const activeCode = document.getElementById('region-sel')?.value||'WLD';
      const activeCodes = getRelatedArcCodes(activeCode);
      const hasActive  = activeCode && activeCode!=='WLD' && activeCodes.size > 0;

      // Filtro activo por tipo (de la leyenda interactiva)
      const typeFilter = window.arcTypeFilter || null;

      // Filtrado: activo → país + alias/región | sin selección → según severidad y filtro
      const SEVERITY = {INFLUENCE:0,SANCTION:1,TENSION:2,PROXY:3,NUKE:4,CRISIS:5,WAR:6};
      const ALWAYS_SHOW = new Set(['WAR','CRISIS','NUKE','PROXY']);

      let toRender = GLOBE_CONNECTIONS.filter(([from,to,type,intensity])=>{
        if(typeFilter && type !== typeFilter) return false;
        if(hasActive) return arcTouchesSelection(from, to, activeCodes);
        if(typeFilter) return true; // con filtro activo mostrar todos de ese tipo
        return ALWAYS_SHOW.has(type) || intensity >= 0.82;
      });

      // Deduplicado quirúrgico para evitar arcos repetidos por alias o cargas sucesivas
      const seenArcs = new Set();
      toRender = toRender.filter(conn=>{
        const k = normalizeArcKey(conn);
        if(seenArcs.has(k)) return false;
        seenArcs.add(k);
        return true;
      });

      // Ordenar: menos grave primero → más grave dibujado encima
      toRender.sort((a,b)=>(SEVERITY[a[2]]||0)-(SEVERITY[b[2]]||0));

      // Actualizar contador de conflictos activos
      const warCount    = GLOBE_CONNECTIONS.filter(c=>c[2]==='WAR').length;
      const crisisCount = GLOBE_CONNECTIONS.filter(c=>c[2]==='CRISIS').length;
      const nukeCount   = GLOBE_CONNECTIONS.filter(c=>c[2]==='NUKE').length;
      const counter = document.getElementById('arc-conflict-counter');
      if(counter) counter.innerHTML =
        `<div class="cfl-badge">🔴 ${warCount} GUERRAS</div>`+
        `<div class="cfl-badge" style="color:rgba(255,102,0,.8);border-color:rgba(255,102,0,.3);background:rgba(255,102,0,.1)">`+
          `⚠ ${crisisCount} CRISIS</div>`+
        `<div class="cfl-badge" style="color:rgba(0,255,255,.8);border-color:rgba(0,255,255,.3);background:rgba(0,255,255,.07)">`+
          `☢ ${nukeCount} NUCLEAR</div>`;

      let gradIdx = 0;
      const pulsePaths = [];

      toRender.forEach((conn, i)=>{
        const [fromCode,toCode,type,intensity,label] = conn;
        const info   = CONFLICT_INFO[`${fromCode}-${toCode}`] || CONFLICT_INFO[`${toCode}-${fromCode}`] || {};
        const fromLL = COUNTRY_CENTROIDS[fromCode];
        const toLL   = COUNTRY_CENTROIDS[toCode];
        if(!fromLL||!toLL) return;

        const p1 = proj(fromLL);
        const p2 = proj(toLL);
        if(!p1||!p2) return;

        const dx=p2[0]-p1[0], dy=p2[1]-p1[1];
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist<6) return;

        const cfg = ARC_TYPES[type]||ARC_TYPES.TENSION;
        const isActive = hasActive ? arcTouchesSelection(fromCode, toCode, activeCodes) : false;

        // Opacidad por contexto
        const baseAlpha = hasActive
          ? (isActive ? Math.min(intensity*0.85+0.15, 0.95) : 0.04)
          : Math.min(intensity*0.7+0.1, 0.88);

        const strokeW = (hasActive&&isActive) ? cfg.width*2.4 : cfg.width*(hasActive?0.5:1);

        // Punto de control — perpendicular elevado
        const mx=(p1[0]+p2[0])/2, my=(p1[1]+p2[1])/2;
        const lift = Math.min(dist*0.28, 72);
        const len  = Math.sqrt(dy*dy+dx*dx);
        const cpx  = mx + (-dy/len)*lift;
        const cpy  = my + ( dx/len)*lift - lift*0.35;
        const arcD = `M${p1[0]},${p1[1]} Q${cpx},${cpy} ${p2[0]},${p2[1]}`;
        const arcLen = dist*1.5;

        // Gradiente en <defs> raíz (no en arcGroup)
        const gid = `ag${gradIdx++}`;
        const grad = arcDefs.append('linearGradient')
          .attr('id',gid).attr('gradientUnits','userSpaceOnUse')
          .attr('x1',p1[0]).attr('y1',p1[1])
          .attr('x2',p2[0]).attr('y2',p2[1]);
        grad.append('stop').attr('offset','0%')
          .attr('stop-color',cfg.color).attr('stop-opacity',baseAlpha*0.55);
        grad.append('stop').attr('offset','50%')
          .attr('stop-color',cfg.color).attr('stop-opacity',baseAlpha);
        grad.append('stop').attr('offset','100%')
          .attr('stop-color',cfg.color).attr('stop-opacity',baseAlpha*0.45);

        // Sombra 3D
        arcGroup.append('path').attr('d',arcD)
          .style('stroke','rgba(0,0,0,0.55)')
          .style('stroke-width', strokeW+2.5)
          .style('fill','none').style('stroke-linecap','round')
          .style('opacity', baseAlpha*0.4)
          .attr('transform','translate(0,2.5)');

        // Halo exterior
        arcGroup.append('path').attr('d',arcD)
          .style('stroke', cfg.color)
          .style('stroke-width', strokeW*3.5)
          .style('fill','none').style('stroke-linecap','round')
          .style('opacity', baseAlpha*0.05);

        // Arco principal con gradiente
        const arcMain = arcGroup.append('path').attr('d',arcD)
          .attr('class','arc-stroke')
          .attr('data-base-width', strokeW)
          .style('stroke',`url(#${gid})`)
          .style('stroke-width', strokeW)
          .style('fill','none').style('stroke-linecap','round')
          .attr('filter','url(#arc-glow-filter)')
          .attr('stroke-dasharray', arcLen)
          .attr('stroke-dashoffset', arcLen)
          .style('cursor','pointer');

        // Animación de dibujado desde origen
        arcMain.transition().duration(280+i*18).ease(d3.easeQuadOut)
          .attr('stroke-dashoffset',0);

        if(cfg.pulse && (isActive||!hasActive)) pulsePaths.push({el:arcMain, base:baseAlpha});

        // ─── HOVER en arco: muestra panel de detalle ───
        const arcHitArea = arcGroup.append('path').attr('d',arcD)
          .style('stroke','transparent').style('stroke-width',14)
          .style('fill','none').style('cursor','pointer');

        arcHitArea
          .on('mouseenter', function(){
            arcMain.style('stroke-width', strokeW*1.7);
            showArcDetail(conn, info, cfg);
          })
          .on('mouseleave', function(){
            arcMain.style('stroke-width', strokeW);
            hideArcDetail();
          })
          .on('click', function(){
            // Click en arco → seleccionar el país origen en el selector
            const targetCode = fromCode==='WLD'?toCode:fromCode;
            const sel = document.getElementById('region-sel');
            if(sel && DATA[targetCode]){
              sel.value = targetCode;
              loadRegion();
            }
          });

        // ORIGEN — punto + anillo
        arcGroup.append('circle')
          .attr('cx',p1[0]).attr('cy',p1[1]).attr('r',isActive?9:5)
          .attr('class','arc-node').attr('data-base-r',isActive?9:5)
          .style('fill','none').style('stroke',cfg.color)
          .style('stroke-width',isActive?1.3:0.7)
          .style('opacity',baseAlpha*0.28).style('pointer-events','none');
        arcGroup.append('circle')
          .attr('cx',p1[0]).attr('cy',p1[1]).attr('r',isActive?4.5:2.5)
          .attr('class','arc-node').attr('data-base-r',isActive?4.5:2.5)
          .style('fill',cfg.color)
          .style('opacity',Math.min(baseAlpha*1.25,0.95))
          .attr('filter','url(#arc-glow-filter)')
          .style('pointer-events','none');

        // DESTINO — flecha orientada con la tangente del arco
        const t=0.97;
        const tangX=2*(1-t)*(cpx-p1[0])+2*t*(p2[0]-cpx);
        const tangY=2*(1-t)*(cpy-p1[1])+2*t*(p2[1]-cpy);
        const angle=Math.atan2(tangY,tangX)*180/Math.PI;
        const asz=isActive?10:6;
        arcGroup.append('polygon')
          .attr('points',`0,${-asz*0.42} ${asz},0 0,${asz*0.42}`)
          .attr('class','arc-arrow')
          .attr('data-ox',p2[0]).attr('data-oy',p2[1])
          .attr('data-angle',angle).attr('data-base-sz',asz)
          .attr('transform',`translate(${p2[0]},${p2[1]}) rotate(${angle})`)
          .style('fill',cfg.color).style('opacity',Math.min(baseAlpha*1.1,0.95))
          .attr('filter','url(#arc-glow-filter)').style('pointer-events','none');

        // ETIQUETA — visible siempre en conflictos activos del país seleccionado
        if(label && (isActive||type==='WAR'||type==='NUKE')){
          const mt=0.45;
          const lx=(1-mt)*(1-mt)*p1[0]+2*(1-mt)*mt*cpx+mt*mt*p2[0];
          const ly=(1-mt)*(1-mt)*p1[1]+2*(1-mt)*mt*cpy+mt*mt*p2[1]-9;
          const lw=label.length*5.2+12;
          arcGroup.append('rect')
            .attr('x',lx-lw/2).attr('y',ly-8).attr('width',lw).attr('height',13)
            .attr('rx',3)
            .style('fill','rgba(0,0,0,0.78)')
            .style('stroke',cfg.color).style('stroke-width',0.5)
            .style('opacity', Math.min(baseAlpha*1.3,0.92))
            .style('pointer-events','none');
          arcGroup.append('text')
            .attr('x',lx).attr('y',ly-1)
            .attr('text-anchor','middle').attr('dominant-baseline','central')
            .style('fill',cfg.color)
            .style('font-family',"'Share Tech Mono',monospace")
            .style('font-size','8px').style('letter-spacing','1px').style('font-weight','700')
            .style('pointer-events','none')
            .text(label);
        }

        // Partícula de flujo — guerras y crisis activas
        if(isActive && (type==='WAR'||type==='CRISIS'||type==='PROXY'||type==='NUKE')){
          const particle=arcGroup.append('circle')
            .attr('r',2.5).style('fill','#FFFFFF').style('opacity',0)
            .attr('filter','url(#arc-glow-filter)').style('pointer-events','none');
          let step=Math.random()*100;
          const tid=setInterval(()=>{
            step=(step+1.8)%100;
            const t=step/100;
            const bx=(1-t)*(1-t)*p1[0]+2*(1-t)*t*cpx+t*t*p2[0];
            const by=(1-t)*(1-t)*p1[1]+2*(1-t)*t*cpy+t*t*p2[1];
            particle.attr('cx',bx).attr('cy',by)
              .style('opacity',Math.sin(Math.PI*t)*0.88);
          },22);
          particle.attr('data-timer',tid);
        }
      });

      // Pulsar arcos de conflicto activo
      pulsePaths.forEach(({el,base},i)=>{
        let dir=1,alpha=base;
        const tid=setInterval(()=>{
          alpha+=dir*0.035;
          if(alpha>=base){alpha=base;dir=-1;}
          if(alpha<=base*0.35){alpha=base*0.35;dir=1;}
          el.style('opacity',alpha);
        },38+i%6*7);
        el.attr('data-timer',tid);
      });
    }

    window._drawGlobeArcs=drawGlobeArcs;

  }).catch(e=>{
    console.error('Map error:',e);
    wrap.innerHTML='<div style="color:var(--dim);text-align:center;padding:40px;font-family:Share Tech Mono,monospace;font-size:12px">Error al inicializar el mapa</div>';
  });
}

function updateMapColors(){
  if(!mapSvg) return;
  mapSvg.selectAll('.map-country')
    .style('fill',function(){
      const id=d3.select(this).attr('data-id');
      const key=ISO_MAP[String(id).padStart(3,'0')];
      return scoreToColor(getMapScore(key));
    });
}

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
  setTimeout(()=>{
    initWorldMap();
    setTimeout(initNetworkGraph, 400);
  }, 3200);
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

  let codes=Object.keys(DATA).filter(k=>k!=='WLD'&&k!=='EUU');
  if(regionSel!=='all') codes=codes.filter(k=>REGION_GROUPS[regionSel]?.includes(k));

  const ranked=codes.map(code=>{
    const d=DATA[code];
    if(!d) return null;
    let score;
    if(catSel==='global'){
      const keys=['eco','geo','health','climate','social','tech','food','mental','energy','demo','urban','science','justice','finance','ocean','bio'];
      let sum=0,cnt=0;
      keys.forEach(k=>{const c=d[k];if(c&&typeof c.score==='number'){sum+=c.score;cnt++;}});
      score=cnt>0?Math.round(sum/cnt):50;
    } else {
      score=d[catSel]?.score||50;
    }
    return{code,name:d.name||code,score,flag:COUNTRY_FLAGS[code]||'🌐'};
  }).filter(Boolean).sort((a,b)=>order==='desc'?b.score-a.score:a.score-b.score).slice(0,topN);

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
      <div class="rank-flag">${r.flag}</div>
      <div class="rank-name" style="font-size:${r.name.length>14?'10px':'12px'}">${r.name}</div>
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

function loadRegion(){
  const code=document.getElementById('region-sel').value;
  const d=DATA[code]||DATA.WLD;

  // ── 1. Cards: gauges + scores + indicadores ──
  CATS_CFG.forEach(({k,g,n,c,i,color})=>{
    const cat=d[k];
    if(!cat) return;
    // Enhanced score: base + velocidad + correlaciones
    const eScore=typeof enhancedScore==='function'
      ? enhancedScore(cat.score,k,code)
      : cat.score;
    const gaugeColor=eScore>=75?'#FF3355':eScore>=55?'#FF8C00':eScore>=35?'#FFD700':'#00CC66';
    drawGauge(g,eScore,gaugeColor);
    const nEl=document.getElementById(n);
    if(nEl){
      nEl.textContent=eScore;
      nEl.style.color=eScore>=75?'#FF3355':eScore>=55?'#FF8C00':eScore>=35?'#FFD700':'#00CC66';
      if(typeof VELOCITY!=='undefined'){
        const vel=(VELOCITY[code]||VELOCITY.WLD)[k]||0;
        nEl.title='Base:'+cat.score+' Vel:'+(vel>0?'+':'')+(vel*100).toFixed(0)+'% Compuesto:'+eScore;
      }
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
  const scores=CAT_KEYS.map(k=>{
    const cat=d[k];
    if(!cat) return 50;
    return typeof enhancedScore==='function' ? enhancedScore(cat.score,k,code) : cat.score;
  });
  const global=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  const[lbl,col]=riskLabel(global);
  document.getElementById('gnum').textContent=global;
  document.getElementById('gnum').style.color=col;
  document.getElementById('gstatus').textContent=lbl;
  document.getElementById('gstatus').style.color=col;
  for(let i=0;i<16;i++){
    const el=document.getElementById('gs'+i);
    if(el){
      el.textContent=scores[i];
      const s=scores[i];
      el.style.color=s>=75?'#FF3355':s>=55?'#FF8C00':s>=35?'#FFD700':'#00CC66';
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
  renderEvents(d);
  if(typeof updateAlgoBanner==='function') updateAlgoBanner(code);
  if(typeof renderChains==='function')     renderChains(code);
  if(typeof updateMapColors==='function')  updateMapColors();
  if(typeof initThermo==='function')       initThermo(code);
  if(typeof renderRanking==='function')    renderRanking();
  if(typeof d3!=='undefined' && typeof initNetworkGraph==='function')
    setTimeout(initNetworkGraph,120);
  if(typeof updateCascadeModule==='function') setTimeout(()=>updateCascadeModule(code),300);
  // Redibujar arcos resaltando el país activo
  if(typeof window._drawGlobeArcs==='function' && arcsVisible) setTimeout(window._drawGlobeArcs, 100);
  // Zoom al país seleccionado en el mapa (si tiene geometría válida)
  if(typeof window._zoomToCountryByCode==='function') setTimeout(()=>window._zoomToCountryByCode(code), 150);
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
const RESILIENCE_WEIGHTS = {
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
    resilience += strength * (RESILIENCE_WEIGHTS[k] || 0.05);
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
function simulateCascade(code, horizonWeeks, shockOverrides = {}) {
  const d = DATA[code] || DATA.WLD;
  const vel = VELOCITY[code] || VELOCITY.WLD;
  const resilience = computeResilienceIndex(code);

  // Estado inicial: scores actuales
  const state = {};
  CAT_KEYS.forEach(k => { state[k] = d[k]?.score ?? 50; });
  Object.assign(state, shockOverrides);

  // Historial de scores por semana
  const history = [{ ...state, week: 0 }];

  // Queue de shocks pendientes: {target, delta, arrivalWeek, decay}
  const pendingShocks = [];

  // Generar shocks iniciales desde velocidades actuales
  CAT_KEYS.forEach(srcKey => {
    const props = PROP_MATRIX[srcKey];
    if (!props) return;
    const srcVel = vel[srcKey] || 0;
    const srcScore = state[srcKey];
    if (Math.abs(srcVel) < 0.05) return;

    Object.entries(props).forEach(([tgtKey, {s, l, d: dec}]) => {
      const shockMagnitude = srcScore * srcVel * s * (1 - resilience * 0.6);
      if (Math.abs(shockMagnitude) < 0.3) return;
      pendingShocks.push({
        target: tgtKey,
        delta: shockMagnitude,
        arrivalWeek: Math.round(l),
        decay: dec,
        source: srcKey,
      });
    });
  });

  // Simular semana a semana
  for (let week = 1; week <= horizonWeeks; week++) {
    const newState = { ...state };

    // Aplicar velocidades base (tendencia secular)
    CAT_KEYS.forEach(k => {
      const drift = (vel[k] || 0) * 0.4 * (1 - resilience * 0.5);
      newState[k] = Math.max(0, Math.min(100, newState[k] + drift));
    });

    // Aplicar shocks que llegan esta semana
    pendingShocks.forEach(shock => {
      if (shock.arrivalWeek !== week) return;
      const dampened = shock.delta * (1 - resilience * 0.4);
      newState[shock.target] = Math.max(0, Math.min(100,
        newState[shock.target] + dampened
      ));

      // Propagar en cascada de segundo orden
      const secondProps = PROP_MATRIX[shock.target];
      if (secondProps && Math.abs(dampened) > 1.5) {
        Object.entries(secondProps).forEach(([tgt2, {s, l, d: dec}]) => {
          if (tgt2 === shock.source) return; // evitar ciclos
          pendingShocks.push({
            target: tgt2,
            delta: dampened * s * 0.5,
            arrivalWeek: week + Math.round(l * 0.7),
            decay: dec,
            source: shock.target,
          });
        });
      }
    });

    // Actualizar estado
    CAT_KEYS.forEach(k => { state[k] = newState[k]; });
    history.push({ ...state, week });
  }

  return history;
}

// ══════════════════════════════════════════════════
//  MONTE CARLO — 500 simulaciones con ruido
// ══════════════════════════════════════════════════
function runMonteCarlo(code, horizonWeeks, nSims = 400) {
  const d = DATA[code] || DATA.WLD;

  // Convertir horizonte a semanas
  const results = [];

  for (let sim = 0; sim < nSims; sim++) {
    // Perturbación gaussiana de velocidades y scores iniciales
    const shockOverrides = {};
    CAT_KEYS.forEach(k => {
      const base = d[k]?.score ?? 50;
      const noise = gaussianRandom(0, base * 0.06);
      shockOverrides[k] = Math.max(0, Math.min(100, base + noise));
    });

    // Perturbar también las velocidades en VELOCITY
    const perturbedVel = {};
    const vel = VELOCITY[code] || VELOCITY.WLD;
    CAT_KEYS.forEach(k => {
      perturbedVel[k] = (vel[k] || 0) + gaussianRandom(0, 0.05);
    });

    const history = simulateCascade(code, horizonWeeks, shockOverrides);
    // Solo guardar semanas clave
    const keyFrames = [0, Math.floor(horizonWeeks*0.25),
                       Math.floor(horizonWeeks*0.5),
                       Math.floor(horizonWeeks*0.75), horizonWeeks];
    const simResult = {};
    keyFrames.forEach(w => {
      const frame = history[Math.min(w, history.length-1)];
      let global = 0;
      CAT_KEYS.forEach(k => { global += (frame[k] || 50); });
      simResult[w] = global / CAT_KEYS.length;
    });
    results.push(simResult);
  }

  // Calcular percentiles para cada semana clave
  const keyFrames = [0, Math.floor(horizonWeeks*0.25),
                     Math.floor(horizonWeeks*0.5),
                     Math.floor(horizonWeeks*0.75), horizonWeeks];
  const bands = {};
  keyFrames.forEach(w => {
    const vals = results.map(r => r[w]).sort((a,b) => a-b);
    bands[w] = {
      p10: vals[Math.floor(nSims*0.10)],
      p25: vals[Math.floor(nSims*0.25)],
      p50: vals[Math.floor(nSims*0.50)],
      p75: vals[Math.floor(nSims*0.75)],
      p90: vals[Math.floor(nSims*0.90)],
    };
  });

  return { bands, keyFrames };
}

// ── Box-Muller transform para ruido gaussiano ──
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
  const { bands, keyFrames } = runMonteCarlo(code, Math.round(horizonWeeks));

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
  enhancedScore, riskLabel, scoreToColor, velLabel,
  simulateCascade, runMonteCarlo, gaussianRandom,
  computeResilienceIndex, detectInflections,
  initAetherApp, initAetherApp2, loadRegion, onRegionChange,
  updateBanner, renderInds, renderEvents, renderRanking, renderChains,
  initThermo, updateThermo, renderThermo,
  initWorldMap, updateMapColors, setMapCat, getMapScore,
  initNetworkGraph, showArcDetail, hideArcDetail, filterArcType, toggleGlobeArcs,
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
  EVENT_POOL, RESILIENCE_WEIGHTS, ShockSim,
  enhancedScore, riskLabel, simulateCascade, runMonteCarlo,
  computeResilienceIndex, detectInflections,
});
