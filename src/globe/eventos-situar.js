/**
 * Partes puras de la capa de eventos del globo (sin three ni DOM), para
 * poder probarlas en las unitarias. Ver src/globe/eventos-capa.js.
 */

/** Color y nombre por tipo de evento. */
export const TIPOS = {
  sismo:      { color: '#FF3DCB', nombre: 'SISMO' },
  volcan:     { color: '#FF4A1C', nombre: 'VOLCÁN' },
  incendio:   { color: '#FF9A1F', nombre: 'INCENDIO' },
  tormenta:   { color: '#3DA9FF', nombre: 'TORMENTA' },
  inundacion: { color: '#2EE6FF', nombre: 'INUNDACIÓN' },
  sequia:     { color: '#E6C35C', nombre: 'SEQUÍA' },
  salud:      { color: '#B8FF3D', nombre: 'SALUD' },
  otro:       { color: '#C9D3E0', nombre: 'EVENTO' },
};

/** Tamaño del rombo por severidad. */
export const ESCALA = { LOW: 0.75, MEDIUM: 1, HIGH: 1.35, CRITICAL: 1.8 };
export const SEV_ES = { CRITICAL: 'CRÍTICO', HIGH: 'ALTO', MEDIUM: 'MEDIO', LOW: 'BAJO' };

/** El tipo de un evento normalizado. */
export function tipoDe(ev) {
  if (ev.familia && TIPOS[ev.familia]) return ev.familia;
  if (ev.cat === 'health') return 'salud';
  if (ev.cat === 'seismic') return 'sismo';
  return 'otro';
}

/**
 * Dónde se pinta cada evento, o null si no se puede situar. Los que van a
 * la capital de su país se separan un poco en espiral para no taparse.
 *
 * @param {object[]} eventos  ya filtrados por ventana
 * @param {Map<string, {lat:number,lng:number}>} capitales  ISO3 → coordenadas
 */
export function situarEventos(eventos, capitales) {
  const porCapital = new Map();
  const salida = [];
  for (const ev of eventos) {
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lng)) {
      salida.push({ ev, lat: ev.lat, lng: ev.lng, aproximado: false });
      continue;
    }
    const iso = Array.isArray(ev.paises) ? ev.paises[0] : null;
    const cap = iso && capitales.get(iso);
    if (!cap) continue;
    const n = porCapital.get(iso) || 0;
    porCapital.set(iso, n + 1);
    const ang = n * 2.4, r = n ? 1.1 + n * 0.45 : 0;
    salida.push({ ev, lat: cap.lat + r * Math.sin(ang), lng: cap.lng + r * Math.cos(ang), aproximado: true });
  }
  return salida;
}

