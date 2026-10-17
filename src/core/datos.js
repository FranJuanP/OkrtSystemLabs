/**
 * Acceso al fichero de datos (T22).
 *
 * Una sola función, y una sola petición por carga de página: las cuatro
 * páginas y la de metodología leen el MISMO `data/latest.json`, que es lo que
 * garantiza que no puedan discrepar. Antes el panel y el globo tenían cada
 * uno su tabla escrita a mano, y daban niveles de riesgo distintos para el
 * mismo país.
 *
 * El resultado se memoriza en un promesa compartida, así que varios módulos
 * de la misma página pueden pedirlo sin que se descargue dos veces.
 *
 * El service worker media esta petición (NetworkFirst con caída a su copia),
 * de modo que offline sigue habiendo datos. Si el worker sirve su copia, lo
 * marca con la cabecera X-AETHER-Cache y aquí se recoge, para poder decirlo
 * en la interfaz en vez de presentar datos viejos como recién traídos.
 */
import { calcular } from './scoring.js';

/** Ruta relativa a la página: respeta el subdirectorio de GitHub Pages. */
const RUTA = 'data/latest.json';

let promesa = null;

/**
 * @returns {Promise<{datos: object, calculo: object, deCache: boolean, guardadoEn: Date|null}>}
 */
export function cargarDatos() {
  if (promesa) return promesa;

  promesa = (async () => {
    const url = new URL(RUTA, document.baseURI).href;
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`no se pudo leer ${RUTA}: HTTP ${res.status}`);

    const deCache = res.headers.get('X-AETHER-Cache') === 'hit';
    const marca = res.headers.get('X-AETHER-Cached-At');
    const guardadoEn = marca && !isNaN(new Date(marca).getTime()) ? new Date(marca) : null;

    const datos = await res.json();
    if (!datos || datos.esquema !== 1) {
      throw new Error('el fichero de datos no tiene el esquema esperado');
    }

    return { datos, calculo: calcular(datos), deCache, guardadoEn };
  })();

  // Un fallo no debe quedar memorizado: si la red falla una vez, la siguiente
  // llamada tiene que poder volver a intentarlo.
  promesa.catch(() => { promesa = null; });

  return promesa;
}

/** Fecha de generación del fichero, en formato corto para la interfaz. */
export function fechaDatos(datos) {
  const d = new Date(datos.generado);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/** Formatea un valor con los decimales que declare su indicador. */
export function formatearValor(valor, decimales = 1) {
  if (valor == null || !Number.isFinite(valor)) return '—';
  const n = Number(valor);
  // Los números grandes se leen mejor con separador de miles y sin decimales.
  if (Math.abs(n) >= 10000) return n.toLocaleString('es-ES', { maximumFractionDigits: 0 });
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}
