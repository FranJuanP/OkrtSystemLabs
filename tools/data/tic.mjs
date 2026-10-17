/**
 * Descarga de TIC: los grandes tenedores extranjeros de deuda del Tesoro de
 * EEUU (T21).
 *
 * Es la base del diagrama de Vector: quién tiene la deuda de EEUU y por
 * cuánto. Dato oficial, dominio público, serie mensual desde 2000.
 *
 * Dos cosas que conviene saber y que están en METHODOLOGY.md:
 *
 *  - El fichero legible por máquina es `mfhhis01.txt`, tabulado, con un
 *    bloque de doce columnas por año. `mfh.txt`, que es el nombre que uno
 *    probaría primero, se quedó congelado en enero de 2023 y sigue
 *    devolviendo 200: un pipeline que lo use no falla, simplemente publica
 *    datos de hace tres años como si fueran de hoy.
 *
 *  - `mfhhis01.txt` va por detrás de la nota de prensa mensual: suele llegar
 *    hasta el último diciembre cerrado. Se toma el mes más reciente que haya
 *    EN EL FICHERO y se publica ese período junto al dato, para que se vea de
 *    cuándo es en lugar de dar a entender que es del mes pasado.
 */
import { pedir } from './http.mjs';

const URL_DATOS =
  'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/mfhhis01.txt';

const MESES = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** Filas que no son países pero sí interesan como totales. */
const TOTALES = new Set(['Grand Total', 'All Other', 'For. Official', 'Treasury Bills', 'T-Bonds & Notes']);

const celdas = (linea) => linea.split('\t').map((c) => c.trim().replace(/^"|"$/g, ''));

/**
 * @returns {Promise<{
 *   periodo: string, unidad: string,
 *   tenedores: Array<{nombre:string, valor:number}>,
 *   totales: Record<string, number>
 * }>}
 */
export async function descargar() {
  const texto = await pedir(URL_DATOS, { como: 'text', timeoutMs: 90000 });
  const lineas = texto.split(/\r?\n/);

  // Los bloques van del año más reciente al más antiguo, pero no se da por
  // supuesto: se buscan todas las cabeceras y se elige el mes mayor.
  let mejor = null;
  for (let i = 1; i < lineas.length; i++) {
    const anios = celdas(lineas[i]);
    if (anios[0] !== 'Country') continue;
    const meses = celdas(lineas[i - 1]);
    for (let col = 1; col < anios.length; col++) {
      const anio = Number(anios[col]);
      const mes = MESES[meses[col]];
      if (!Number.isFinite(anio) || !mes) continue;
      const clave = anio * 12 + mes;
      if (!mejor || clave > mejor.clave) {
        mejor = { clave, anio, mes, col, filaCabecera: i };
      }
    }
  }
  if (!mejor) throw new Error('TIC: no se encontró ninguna cabecera de año en mfhhis01.txt');

  const tenedores = [];
  const totales = {};
  for (let i = mejor.filaCabecera + 1; i < lineas.length; i++) {
    const f = celdas(lineas[i]);
    const nombre = f[0];
    if (!nombre) continue;
    // El bloque termina donde empieza la cabecera del año siguiente.
    if (nombre === 'Country') break;
    const valor = Number(String(f[mejor.col] || '').replace(/,/g, ''));
    if (!Number.isFinite(valor)) continue;
    if (TOTALES.has(nombre)) { totales[nombre] = valor; continue; }
    tenedores.push({ nombre, valor });
  }
  if (!tenedores.length) throw new Error('TIC: el bloque más reciente no traía ningún país');

  // Coherencia: los países listados más «All Other» deben dar el total.
  if (totales['Grand Total']) {
    const suma = tenedores.reduce((a, t) => a + t.valor, 0) + (totales['All Other'] || 0);
    const desvio = Math.abs(suma - totales['Grand Total']) / totales['Grand Total'];
    if (desvio > 0.01) {
      throw new Error(
        `TIC: los tenedores suman ${suma.toFixed(1)} y el total dice ` +
        `${totales['Grand Total'].toFixed(1)}; desvío del ${(desvio * 100).toFixed(2)} %`,
      );
    }
  }

  return {
    periodo: `${mejor.anio}-${String(mejor.mes).padStart(2, '0')}`,
    unidad: 'miles de millones de USD',
    tenedores: tenedores.sort((a, b) => b.valor - a.valor),
    totales,
  };
}
