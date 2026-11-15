/**
 * AETHER Globe · capa de eventos (fase eventos en el globo).
 *
 * Pinta sobre el globo los eventos de las últimas 72 h de data/events.json
 * como rombos, con el color de su tipo (sismo, volcán, fuego, tormenta…) y
 * el tamaño de su severidad. Al pulsar uno se abre su ficha.
 *
 * Dónde va cada evento:
 *   con coordenadas (USGS, EONET, GDACS)   en su punto exacto, también en
 *                                           mitad del océano: es justo lo
 *                                           que la lista por país no enseña
 *   sin coordenadas pero con país (OMS)    junto a la capital del país
 *   ni lo uno ni lo otro (GDELT)           no se pinta
 *
 * Es una sola InstancedMesh para los rombos y otra para su halo, igual que
 * los marcadores de los países (T30): dos llamadas de dibujado en total, sea
 * cual sea el número de eventos.
 */
import * as THREE from 'three';
import {
  globeGroup, ll2v, COUNTRIES_DEDUP, showPanel, registerPickLayer,
} from './engine.js';
import { safeUrl } from '../core/escape.js';
import { TIPOS, ESCALA, SEV_ES, tipoDe, situarEventos } from './eventos-situar.js';
import {
  cargarEventos, haceCuanto, etiquetaFuente, HORAS_POR_DEFECTO,
} from '../core/eventos-pais.js';

/* ── Estado de la capa ──────────────────────────────────────────────── */
let puntos = [];          // [{ev, lat, lng, aproximado}]
let rombos = null;        // InstancedMesh pulsable
let halos = null;
let visible = true;
const RADIO = 1.032;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _ARRIBA = new THREE.Vector3(0, 1, 0);

function construir() {
  const n = puntos.length;
  if (!n) return;
  const geo = new THREE.OctahedronGeometry(0.016, 0);
  geo.scale(1, 1.6, 1); // rombo alargado hacia fuera: no se confunde con los puntos de país
  rombos = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({}), n);
  halos = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.03, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
    n,
  );
  const color = new THREE.Color();
  puntos.forEach((p, i) => {
    const pos = ll2v(p.lat, p.lng, RADIO);
    _q.setFromUnitVectors(_ARRIBA, pos.clone().normalize());
    const k = ESCALA[p.ev.severity] || 1;
    _s.set(k, k, k);
    _m.compose(pos, _q, _s);
    rombos.setMatrixAt(i, _m);
    halos.setMatrixAt(i, _m);
    color.set(TIPOS[tipoDe(p.ev)].color);
    rombos.setColorAt(i, color);
    halos.setColorAt(i, color);
  });
  for (const im of [rombos, halos]) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.matrixAutoUpdate = false;
    im.visible = visible;
    globeGroup.add(im);
  }
}

/* ── Ficha del evento ───────────────────────────────────────────────── */
function ficha() {
  let el = document.getElementById('ev-ficha');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ev-ficha';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Detalle del evento');
    document.body.appendChild(el);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') el.classList.remove('open'); });
  }
  return el;
}

function abrirFicha(p, evento) {
  const ev = p.ev;
  const el = ficha();
  el.replaceChildren();
  const tipo = TIPOS[tipoDe(ev)];

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'evf-cerrar';
  cerrar.textContent = '✕';
  cerrar.setAttribute('aria-label', 'Cerrar');
  cerrar.addEventListener('click', () => el.classList.remove('open'));

  const cab = document.createElement('div');
  cab.className = 'evf-cab';
  const chip = document.createElement('span');
  chip.className = 'evf-tipo';
  chip.style.color = tipo.color;
  chip.style.borderColor = tipo.color;
  chip.textContent = '◆ ' + tipo.nombre;
  const sev = document.createElement('span');
  sev.className = 'evf-sev evf-sev-' + String(ev.severity || '').toLowerCase();
  sev.textContent = SEV_ES[ev.severity] || '—';
  cab.append(chip, sev);

  const titulo = document.createElement('div');
  titulo.className = 'evf-titulo';
  titulo.textContent = ev.title || '—';

  const meta = document.createElement('div');
  meta.className = 'evf-meta';
  meta.textContent = etiquetaFuente(ev) + ' · ' + haceCuanto(ev.time)
    + (p.aproximado ? ' · situado en la capital del país' : '');

  el.append(cerrar, cab, titulo, meta);

  // Las cifras que da la fuente (magnitud, PAGER, profundidad…).
  if (ev.impacts && typeof ev.impacts === 'object') {
    const datos = document.createElement('div');
    datos.className = 'evf-datos';
    for (const [k, v] of Object.entries(ev.impacts).slice(0, 4)) {
      const d = document.createElement('div');
      const kk = document.createElement('span'); kk.textContent = k;
      const vv = document.createElement('b'); vv.textContent = String(v);
      d.append(kk, vv);
      datos.appendChild(d);
    }
    el.appendChild(datos);
  }

  const acciones = document.createElement('div');
  acciones.className = 'evf-acciones';
  const iso = Array.isArray(ev.paises) ? ev.paises[0] : null;
  const pais = iso ? COUNTRIES_DEDUP.find((c) => c.iso === iso) : null;
  if (pais) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'evf-btn';
    b.textContent = 'VER ' + pais.name.toUpperCase();
    b.addEventListener('click', () => { el.classList.remove('open'); showPanel(pais); });
    acciones.appendChild(b);
  }
  const url = safeUrl(ev.url);
  if (url) {
    const a = document.createElement('a');
    a.className = 'evf-btn';
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = 'FUENTE ↗';
    acciones.appendChild(a);
  }
  if (acciones.children.length) el.appendChild(acciones);

  // Cerca del punto pulsado, sin salirse de la pantalla.
  const x = evento && Number.isFinite(evento.clientX) ? evento.clientX : innerWidth / 2;
  const y = evento && Number.isFinite(evento.clientY) ? evento.clientY : innerHeight / 2;
  el.classList.add('open');
  const w = el.offsetWidth || 300, h = el.offsetHeight || 180;
  // A la derecha del punto; si no cabe, a la izquierda, para no taparlo.
  const izq = x + 16 + w > innerWidth - 12 ? x - w - 16 : x + 16;
  el.style.left = Math.max(12, Math.min(innerWidth - w - 12, izq)) + 'px';
  el.style.top = Math.max(12, Math.min(innerHeight - h - 12, y - h / 2)) + 'px';
}

/* ── Botón de capa en los controles ─────────────────────────────────── */
function montarBoton() {
  const host = document.getElementById('arc-controls');
  if (!host || document.getElementById('btn-capa-eventos')) return;
  const b = document.createElement('button');
  b.id = 'btn-capa-eventos';
  b.type = 'button';
  b.className = 'arc-fbtn active';
  b.title = 'Mostrar u ocultar los eventos de las últimas ' + HORAS_POR_DEFECTO + ' h';
  const pintar = () => {
    b.classList.toggle('active', visible);
    b.textContent = '◆ EVENTOS · ' + puntos.length;
  };
  b.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    visible = !visible;
    if (rombos) rombos.visible = visible;
    if (halos) halos.visible = visible;
    if (!visible) document.getElementById('ev-ficha')?.classList.remove('open');
    pintar();
  });
  // En la misma fila que GLOBAL y TODOS: una fila más empujaba los filtros
  // encima del bloque PRIORITARIOS.
  const modo = host.querySelector('.arc-mode-row');
  (modo || host).appendChild(b);
  pintar();
}

/** Leyenda de tipos, debajo de la de riesgo. */
function montarLeyenda() {
  const leg = document.getElementById('leg');
  if (!leg || document.getElementById('leg-eventos')) return;
  const usados = new Set(puntos.map((p) => tipoDe(p.ev)));
  if (!usados.size) return;
  const box = document.createElement('div');
  box.id = 'leg-eventos';
  const t = document.createElement('div');
  t.className = 'lt';
  t.textContent = '// EVENTOS';
  box.appendChild(t);
  const fila = document.createElement('div');
  fila.className = 'leg-ev-fila';
  for (const k of Object.keys(TIPOS)) {
    if (!usados.has(k)) continue;
    const s = document.createElement('span');
    s.className = 'leg-ev';
    s.style.color = TIPOS[k].color;
    s.textContent = '◆ ' + TIPOS[k].nombre;
    fila.appendChild(s);
  }
  box.appendChild(fila);
  // Al lado de la leyenda de riesgo, no dentro: #leg crece hacia arriba y
  // pisaba el bloque PRIORITARIOS.
  leg.parentNode.insertBefore(box, leg.nextSibling);
}

async function iniciar() {
  const lectura = await cargarEventos();
  if (!lectura.ok) return;
  const ahora = Date.now();
  const limite = ahora - HORAS_POR_DEFECTO * 3600000;
  const recientes = lectura.eventos.filter((ev) => {
    const t = new Date(ev.time).getTime();
    return Number.isFinite(t) && t >= limite && t <= ahora + 3600000;
  });
  const capitales = new Map(COUNTRIES_DEDUP.map((c) => [c.iso, { lat: c.lat, lng: c.lng }]));
  puntos = situarEventos(recientes, capitales);
  construir();
  montarBoton();
  montarLeyenda();

  registerPickLayer({
    tocar(raycaster) {
      if (!rombos || !visible) return null;
      // Los halos son más grandes y más fáciles de acertar con el dedo.
      // Solo la cara visible: el rayo también atraviesa el globo y tocaría
      // los eventos del otro lado. Un punto está de cara a la cámara si su
      // producto con el origen del rayo supera su radio al cuadrado.
      const o = raycaster.ray.origin;
      const hit = raycaster.intersectObject(halos).find((h) => h.point.dot(o) > h.point.lengthSq());
      if (!hit) return null;
      const id = hit.instanceId;
      return typeof id === 'number' ? puntos[id] : null;
    },
    abrir: abrirFicha,
  });
}

iniciar();
