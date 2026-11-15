/**
 * Exportar datos del panel a CSV y GeoJSON (fase datos de OSIRIS).
 *
 * Todo ocurre en el navegador: se arma el fichero y se descarga con un
 * enlace temporal. No sale nada hacia ningún servidor, y nunca se exporta
 * nada de la configuración de IA.
 */

/** Un valor como celda CSV: entre comillas si hace falta y sin fórmulas. */
export function celda(v) {
  let s = v == null ? '' : String(v);
  // Una celda que empieza por = + - @ la ejecuta Excel como fórmula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * @param {object[]} filas
 * @param {{clave:string, titulo:string}[]} columnas
 */
export function aCSV(filas, columnas) {
  const cab = columnas.map((c) => celda(c.titulo)).join(',');
  const cuerpo = filas.map((f) => columnas.map((c) => celda(typeof c.clave === 'function' ? c.clave(f) : f[c.clave])).join(','));
  // BOM para que Excel abra bien las tildes.
  return '﻿' + [cab, ...cuerpo].join('\r\n') + '\r\n';
}

export const COLUMNAS_EVENTOS = [
  { clave: 'time', titulo: 'fecha' },
  { clave: (e) => (e.paises || []).join(' '), titulo: 'paises' },
  { clave: 'source', titulo: 'fuente' },
  { clave: 'severity', titulo: 'severidad' },
  { clave: 'title', titulo: 'titulo' },
  { clave: 'location', titulo: 'lugar' },
  { clave: 'lat', titulo: 'lat' },
  { clave: 'lng', titulo: 'lng' },
  { clave: 'url', titulo: 'url' },
];

/** Eventos con coordenadas como FeatureCollection; los demás se omiten. */
export function eventosAGeoJSON(eventos) {
  return {
    type: 'FeatureCollection',
    features: (eventos || [])
      .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng))
      .map((e) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        properties: {
          fecha: e.time, paises: e.paises || [], fuente: e.source || e.fuente,
          severidad: e.severity, titulo: e.title, lugar: e.location, url: e.url || '',
        },
      })),
  };
}

/** Descarga un texto como fichero. */
export function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** «aether-eventos-SDN-2026-11-15». */
export function nombreFichero(base, codigo) {
  const d = new Date().toISOString().slice(0, 10);
  return `aether-${base}${codigo ? '-' + String(codigo).replace(/[^A-Za-z0-9]/g, '') : ''}-${d}`;
}
