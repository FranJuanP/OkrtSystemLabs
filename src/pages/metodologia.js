/**
 * Entrada de metodologia.html (T22).
 *
 * Toda la página se construye a partir de `data/latest.json`. Es deliberado:
 * una página de metodología escrita a mano se queda desfasada en cuanto se
 * añade un indicador, y entonces documenta algo que ya no es lo que se
 * calcula. Aquí la tabla de indicadores, los pesos, la cobertura y el rango
 * observado salen del mismo fichero y del mismo módulo de cálculo que usa el
 * panel, así que no pueden discrepar.
 */
import { cargarDatos, fechaDatos } from '../core/datos.js';
import { PESOS_CATEGORIA, PESOS_INDICADOR, UMBRALES_UCDP } from '../core/scoring.js';
import { esc, safeHref } from '../core/escape.js';

/** Pone contenido en una tabla por id, si existe. */
function pintarTabla(id, cabeceras, filas) {
  const tabla = document.getElementById(id);
  if (!tabla) return;
  const cab = cabeceras.map((c) => `<th>${esc(c)}</th>`).join('');
  tabla.innerHTML = `<thead><tr>${cab}</tr></thead><tbody>${filas.join('')}</tbody>`;
}

function pintarCifras(datos, calculo) {
  const contenedor = document.getElementById('met-cifras');
  if (!contenedor) return;

  const nIndicadores = Object.keys(datos.indicadores).length;
  const nPaises = Object.keys(datos.paises).length;
  const nDatos = Object.values(datos.paises)
    .reduce((a, p) => a + Object.keys(p.indicadores || {}).length, 0);
  const posibles = nPaises * nIndicadores;

  const cifras = [
    [nDatos.toLocaleString('es-ES'), 'DATOS CON FUENTE'],
    [nIndicadores, 'INDICADORES'],
    [nPaises, 'PAÍSES'],
    [Math.round((nDatos / posibles) * 100) + ' %', 'COBERTURA'],
    [fechaDatos(datos), 'ÚLTIMA DESCARGA'],
  ];
  contenedor.innerHTML = cifras
    .map(([v, l]) => `<div class="met-cifra"><div class="v">${esc(String(v))}</div><div class="l">${esc(l)}</div></div>`)
    .join('');

  const estado = document.getElementById('met-estado');
  if (estado) {
    estado.textContent =
      `Datos de ${Object.keys(datos.fuentes).length} catálogos · ` +
      `año más frecuente ${calculo.anioDatos} · generado el ${fechaDatos(datos)}`;
  }

  // El rango real de la puntuación compuesta, calculado, no escrito a mano.
  const scores = Object.values(calculo.paises).map((p) => p.score).filter((s) => s != null);
  const rango = document.getElementById('met-rango');
  if (rango && scores.length) {
    rango.textContent = `${Math.min(...scores)} a ${Math.max(...scores)}`;
  }
}

function pintarFuentes(datos) {
  // Cuántos indicadores aporta cada fuente, contados del propio registro.
  const porFuente = new Map();
  for (const ind of Object.values(datos.indicadores)) {
    porFuente.set(ind.fuente, (porFuente.get(ind.fuente) || 0) + 1);
  }

  const filas = Object.entries(datos.fuentes).map(([clave, f]) => {
    const n = porFuente.get(clave) || 0;
    const version = datos.versiones && datos.versiones[clave];
    let detalle = n ? `${n} indicador${n === 1 ? '' : 'es'}` : 'agregados globales';
    if (version && version.nombre) detalle += ` · ${version.nombre}`;
    else if (version && version.actualizado) detalle += ` · actualizado ${version.actualizado}`;
    return `<tr>
      <td><a href="${safeHref(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.nombre)}</a></td>
      <td class="dim">${esc(detalle)}</td>
      <td class="dim">${esc(f.licencia)}</td>
    </tr>`;
  });
  pintarTabla('tabla-fuentes', ['Fuente', 'Qué aporta', 'Licencia'], filas);
}

function pintarPesos(datos) {
  const nombres = new Map(datos.categorias.map((c) => [c.key, c.nombre]));
  const porCat = new Map();
  for (const [id, ind] of Object.entries(datos.indicadores)) {
    if (!porCat.has(ind.categoria)) porCat.set(ind.categoria, []);
    porCat.get(ind.categoria).push([id, ind]);
  }

  const filas = datos.categorias.map((c) => {
    const lista = porCat.get(c.key) || [];
    const puntuan = lista.filter(([, i]) => i.direccion !== 'ambiguo');
    const dobles = puntuan.filter(([id]) => (PESOS_INDICADOR[id] || 1) > 1);
    const peso = PESOS_CATEGORIA[c.key] != null ? PESOS_CATEGORIA[c.key] : 1;
    const detalle = dobles.length
      ? `peso doble: ${dobles.map(([, i]) => i.etiqueta).join(', ')}`
      : 'todos pesan igual';
    return `<tr>
      <td>${esc(nombres.get(c.key) || c.key)}</td>
      <td class="num">${esc(String(peso))}</td>
      <td class="num">${esc(String(puntuan.length))} / ${esc(String(lista.length))}</td>
      <td class="dim">${esc(detalle)}</td>
    </tr>`;
  });
  pintarTabla('tabla-pesos', ['Categoría', 'Peso', 'Puntúan / total', 'Pesos dentro'], filas);
}

/**
 * Los tramos de nivel, con cuántos países caen en cada uno y a partir de qué
 * índice. Se lee del cálculo, no se escribe aquí: si mañana cambia el
 * reparto, la página lo refleja sola.
 */
function pintarNiveles(calculo) {
  const cuenta = {};
  for (const p of Object.values(calculo.paises)) {
    if (p.score == null || !p.nivel) continue;
    cuenta[p.nivel.clave] = (cuenta[p.nivel.clave] || 0) + 1;
  }
  const filas = (calculo.niveles || []).map((n) => {
    const corte = calculo.cortes ? calculo.cortes[n.clave] : null;
    return `<tr>
      <td>${esc(n.etiqueta)}</td>
      <td class="dim">${esc(n.descripcion)}</td>
      <td class="num">${esc(String(cuenta[n.clave] || 0))} países</td>
      <td class="num">${corte != null ? '≥ ' + esc(String(corte)) : '—'}</td>
    </tr>`;
  });
  pintarTabla('tabla-niveles', ['Nivel', 'Qué significa', 'Cuántos', 'Índice'], filas);
}

/**
 * Las reglas del UCDP y a cuantos paises eleva cada una hoy.
 *
 * La cuenta es por REGLA, no por nivel: antes se contaban los elevados
 * agrupados por el nivel resultante y las tres reglas que dan ALTO
 * ensenaban todas el mismo numero, como si cada una elevase a 14 paises.
 */
function pintarConflicto(calculo) {
  const porRegla = {};
  for (const p of Object.values(calculo.paises)) {
    if (!p.elevadoPorConflicto) continue;
    const id = p.elevadoPorConflicto.regla;
    porRegla[id] = (porRegla[id] || 0) + 1;
  }

  const filas = (UMBRALES_UCDP || []).map((u) => `<tr>
    <td class="num">${u.desde === 1000 ? '≥ 1.000' : '25 – 999'}</td>
    <td class="dim">${esc(u.tipo)}</td>
    <td class="dim">${u.ambito === 'parte' ? 'en cualquier parte' : 'en el territorio'}</td>
    <td>${esc(u.nivel === 'CRITICAL' ? 'CRÍTICO' : 'ALTO')}</td>
    <td class="num">${esc(String(porRegla[u.id] || 0))} ${(porRegla[u.id] || 0) === 1 ? 'país' : 'países'}</td>
  </tr>`);
  pintarTabla('tabla-conflicto',
    ['Muertos en 12 meses', 'Qué se cuenta', 'Dónde', 'Nivel mínimo', 'Eleva hoy a'], filas);
}

function pintarConfianza(calculo) {
  const cuenta = { alta: 0, media: 0, baja: 0, ninguna: 0 };
  for (const p of Object.values(calculo.paises)) {
    if (p.score == null) continue;
    cuenta[p.confianza.nivel] = (cuenta[p.confianza.nivel] || 0) + 1;
  }
  const reglas = [
    ['alta', '80 % o más de los indicadores y datos de los últimos 4 años'],
    ['media', '50 % o más y datos de los últimos 8 años'],
    ['baja', 'por debajo de eso'],
  ];
  const filas = reglas.map(([nivel, regla]) => `<tr>
    <td>${esc(nivel.toUpperCase())}</td>
    <td class="dim">${esc(regla)}</td>
    <td class="num">${esc(String(cuenta[nivel] || 0))} países</td>
  </tr>`);

  // Los niveles tienen su propia tabla desde que son tramos de la
  // distribución: mezclarlos aquí daba a entender que eran lo mismo.
  pintarTabla('tabla-confianza', ['Nivel', 'Regla', 'Reparto'], filas);
}

function pintarIndicadores(datos, calculo) {
  const nombres = new Map(datos.categorias.map((c) => [c.key, c.nombre]));
  const orden = datos.categorias.map((c) => c.key);

  const entradas = Object.entries(datos.indicadores).sort((a, b) => {
    const d = orden.indexOf(a[1].categoria) - orden.indexOf(b[1].categoria);
    return d !== 0 ? d : a[1].etiqueta.localeCompare(b[1].etiqueta, 'es');
  });

  const filas = entradas.map(([id, ind]) => {
    const n = (calculo.indicadores[id] || {}).observaciones || 0;
    let badge;
    if (ind.direccion === 'ambiguo') badge = '<span class="met-badge ambiguo">NO PUNTÚA</span>';
    else if (ind.direccion === 'mas_riesgo') badge = '<span class="met-badge sube">+ = MÁS RIESGO</span>';
    else badge = '<span class="met-badge baja">+ = MENOS RIESGO</span>';
    const peso = PESOS_INDICADOR[id] || 1;
    return `<tr>
      <td class="dim">${esc(nombres.get(ind.categoria) || ind.categoria)}</td>
      <td><a href="${safeHref(ind.url)}" target="_blank" rel="noopener noreferrer">${esc(ind.etiqueta)}</a></td>
      <td class="dim">${esc(ind.unidad)}</td>
      <td>${badge}${peso > 1 ? ' <span class="met-badge">PESO ' + esc(String(peso)) + '</span>' : ''}</td>
      <td class="dim">${esc(ind.source || (datos.fuentes[ind.fuente] || {}).corto || ind.fuente)}</td>
      <td class="num">${esc(String(n))}</td>
    </tr>`;
  });

  pintarTabla(
    'tabla-indicadores',
    ['Categoría', 'Indicador', 'Unidad', 'Dirección', 'Fuente', 'Países'],
    filas,
  );
}

function pintarLimites(datos) {
  const filas = Object.entries(datos.indicadores)
    .filter(([, ind]) => ind.nota)
    .map(([, ind]) => `<tr>
      <td><a href="${safeHref(ind.url)}" target="_blank" rel="noopener noreferrer">${esc(ind.etiqueta)}</a></td>
      <td class="dim">${esc(ind.nota)}</td>
    </tr>`);

  if (!filas.length) {
    filas.push('<tr><td class="dim" colspan="2">Ningún indicador lleva advertencia de comparabilidad.</td></tr>');
  }
  pintarTabla('tabla-limites', ['Indicador', 'Advertencia'], filas);
}

async function arrancar() {
  const estado = document.getElementById('met-estado');
  try {
    const { datos, calculo } = await cargarDatos();
    pintarCifras(datos, calculo);
    pintarFuentes(datos);
    pintarPesos(datos);
    pintarNiveles(calculo);
    pintarConflicto(calculo);
    pintarConfianza(calculo);
    pintarIndicadores(datos, calculo);
    pintarLimites(datos);
  } catch (err) {
    // Sin datos, la página explica el método igualmente: lo único que falta
    // son las cifras. Decirlo es mejor que dejar «Cargando…» para siempre.
    if (estado) {
      estado.textContent =
        'No se han podido cargar los datos (' + (err && err.message ? err.message : 'error') +
        '). El método que describe esta página no cambia.';
    }
  }
}

arrancar();
