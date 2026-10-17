/**
 * AETHER · animación de fondo de la portada (matriz y trazas).
 *
 * BASELINE LEGIBLE. Este fichero contenía, además de una copia del bloqueo
 * de dominio que T6 retiró, un bloque ofuscado con esta animación. La fuente
 * sin ofuscar se ha recuperado del monolito del 26/03/2026 (primer bloque
 * <script> inline) y verificado por AST contra el publicado desofuscado con
 * webcrack: 4 funciones, mismo juego y mismo orden, 0 diferencias reales.
 *
 * T12: módulo ES. No exporta nada: solo efectos sobre el canvas de fondo.
 */
import { AETHER_COVERAGE } from '../core/coverage.js';

// ── CUSTOM CURSOR ──
const cur = document.getElementById('cur');
const cur2 = document.getElementById('cur2');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{
  mx=e.clientX; my=e.clientY;
  cur.style.left=mx+'px'; cur.style.top=my+'px';
});
function animCursor(){
  rx += (mx-rx)*.12; ry += (my-ry)*.12;
  cur2.style.left=Math.round(rx)+'px'; cur2.style.top=Math.round(ry)+'px';
  requestAnimationFrame(animCursor);
}
animCursor();
document.querySelectorAll('a,button').forEach(el=>{
  el.addEventListener('mouseenter',()=>{cur.style.transform='translate(-50%,-50%) scale(2)';cur2.style.transform='translate(-50%,-50%) scale(1.4)'});
  el.addEventListener('mouseleave',()=>{cur.style.transform='translate(-50%,-50%) scale(1)';cur2.style.transform='translate(-50%,-50%) scale(1)'});
});

// ── LIGHT TRACES CANVAS ──
const canvas = document.getElementById('tc');
const ctx = canvas.getContext('2d');
let W,H;
function resizeCanvas(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
resizeCanvas();
window.addEventListener('resize',resizeCanvas);

const traces = Array.from({length:18},(_,i)=>({
  x: Math.random()*2000-200,
  y: Math.random()*window.innerHeight,
  len: 80+Math.random()*180,
  speed: 0.4+Math.random()*1.2,
  opacity: 0.03+Math.random()*0.07,
  col: Math.random()>.7 ? [10,239,255] : [0,255,200],
  dir: Math.random()>.5 ? 1 : -1,
  vertical: Math.random()>.65,
}));

function drawTraces(){
  ctx.clearRect(0,0,W,H);
  traces.forEach(t=>{
    const g = t.vertical
      ? ctx.createLinearGradient(t.x,t.y,t.x,t.y+t.len*t.dir)
      : ctx.createLinearGradient(t.x,t.y,t.x+t.len,t.y);
    g.addColorStop(0,`rgba(${t.col},0)`);
    g.addColorStop(0.4,`rgba(${t.col},${t.opacity})`);
    g.addColorStop(1,`rgba(${t.col},0)`);
    ctx.strokeStyle=g; ctx.lineWidth=1;
    ctx.beginPath();
    if(t.vertical){ctx.moveTo(t.x,t.y);ctx.lineTo(t.x,t.y+t.len*t.dir);}
    else{ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+t.len,t.y);}
    ctx.stroke();
    if(t.vertical) t.y+=t.speed*t.dir; else t.x+=t.speed;
    if(t.x>W+200) t.x=-200;
    if(t.y>H+200) t.y=-200;
    if(t.y<-200) t.y=H+200;
  });
  requestAnimationFrame(drawTraces);
}
drawTraces();

// ── HERO COUNTER ──
function animCount(el,target,dur=1600){
  const start=Date.now();
  const tick=()=>{
    const p=Math.min(1,(Date.now()-start)/dur);
    const ease=1-Math.pow(1-p,4);
    el.textContent=Math.round(ease*target);
    if(p<1) requestAnimationFrame(tick);
  };
  tick();
}
/* T9/T12: aqui se animaba un contador hasta 202 sobre el elemento #cnum.
   Dos problemas que la desofuscacion ha destapado: #cnum no existe en
   index.html, asi que la funcion lanzaba una excepcion en cada carga; y la
   cifra 202 es la antigua, que T9 no pudo corregir porque este fichero
   estaba ofuscado. Se usa la cobertura real y se comprueba que el elemento
   exista. */
const heroCounter = document.getElementById('cnum');
if (heroCounter) setTimeout(() => animCount(heroCounter, AETHER_COVERAGE.countries), 800);

// ── INTERSECTION OBSERVER ──
const observer = new IntersectionObserver(entries=>{
  entries.forEach((e,idx)=>{
    if(e.isIntersecting){
      setTimeout(()=>e.target.classList.add('vis'),e.target.dataset.delay||0);
    }
  });
},{threshold:.12});

document.querySelectorAll('.layer,.feat-card,.eco-card,.cat-item').forEach((el,i)=>{
  el.dataset.delay = (i%4)*80;
  observer.observe(el);
});
