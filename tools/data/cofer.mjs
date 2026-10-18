/**
 * Descarga de COFER, la composición por monedas de las reservas oficiales
 * del FMI (T21).
 *
 * Esto entra en el pipeline por una razón concreta: el dato ya se quedó
 * desfasado una vez. Vector mostraba una categoría «EMG 890» sin fuente, y
 * al corregirla a mano hubo que volver a corregirla cuando el FMI publicó el
 * trimestre siguiente. Un dato trimestral escrito a mano en el código
 * caduca; este se vuelve a descargar cada semana.
 *
 * La API devuelve SDMX-ML, no JSON, aunque se pida `format=json`. Son 140
 * series con una observación por trimestre, así que se extraen con expresiones
 * regulares en vez de montar un analizador de XML completo: el formato es
 * plano (Series con atributos, Obs con atributos) y no hay texto mezclado.
 *
 * Dos avisos sobre las cifras:
 *  - El porcentaje de «otras monedas» se toma de la serie SHRO_PT (6,0576 %),
 *    no de la nota de prensa, que redondea a «por encima del 6 %». Con el
 *    redondeo salen 805 B USD y con la serie 801 B: 4.000 millones de
 *    diferencia por citar la nota en vez de la tabla.
 *  - SCALE=6 no significa que los valores vengan en millones: vienen en
 *    unidades (13.216.790.400.307,2 USD). SCALE es una indicación de
 *    presentación, no un multiplicador que haya que aplicar.
 */
import { pedir } from './http.mjs';

const URL_DATOS =
  'https://api.imf.org/external/sdmx/2.1/data/IMF.STA,COFER,+/all?lastNObservations=1';

/** Las series que usa Vector: total, principales monedas y «otras». */
export const MONEDAS = {
  CI_T: 'Total',
  CI_USD: 'Dólar de EEUU',
  CI_EUR: 'Euro',
  CI_JPY: 'Yen japonés',
  CI_GBP: 'Libra esterlina',
  CI_CNY: 'Renminbi chino',
  CI_CAD: 'Dólar canadiense',
  CI_AUD: 'Dólar australiano',
  CI_CHF: 'Franco suizo',
  CI_OTHC: 'Otras monedas',
};

/** Atributos de una etiqueta XML, como objeto. */
function atributos(texto) {
  const out = {};
  for (const m of texto.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

/** El trimestre más reciente de los que vengan, en formato 'AAAA-Qn'. */
function trimestreMasReciente(periodos) {
  const q = periodos.filter((p) => /^\d{4}-Q[1-4]$/.test(p));
  return q.sort().pop() || null;
}

/**
 * @returns {Promise<{
 *   periodo: string, publicado: string,
 *   monedas: Record<string, {valorUsd:number, porcentaje:number, nombre:string}>
 * }>}
 */
export async function descargar() {
  const xml = await pedir(URL_DATOS, {
    como: 'text',
    timeoutMs: 90000,
    headers: { accept: 'application/vnd.sdmx.structurespecificdata+xml' },
  });

  // Fecha de publicación del conjunto, que es lo que se muestra en la etiqueta.
  const cabecera = xml.match(/<message:DataSet\b([^>]*)>/);
  const attrsDataSet = cabecera ? atributos(cabecera[1]) : {};
  const publicado = String(attrsDataSet.PUBLICATION_DATE || attrsDataSet.UPDATE_DATE || '').slice(0, 10);

  // Todas las observaciones, con la moneda y el tipo de magnitud de su serie.
  const obs = [];
  for (const m of xml.matchAll(/<Series\b([^>]*)>([\s\S]*?)<\/Series>/g)) {
    const s = atributos(m[1]);
    // AFXRA = reservas de divisas asignadas, que es el universo de COFER del
    // que se conoce la moneda. TFXRA (total) y UFXRA (no asignadas) no
    // desglosan por divisa.
    if (s.INDICATOR !== 'AFXRA') continue;
    for (const o of m[2].matchAll(/<Obs\b([^>]*)\/>/g)) {
      const a = atributos(o[1]);
      const valor = Number(a.OBS_VALUE);
      if (!Number.isFinite(valor)) continue;
      obs.push({
        moneda: s.FXR_CURRENCY,
        tipo: s.TYPE_OF_TRANSFORMATION,
        periodo: a.TIME_PERIOD,
        valor,
      });
    }
  }
  if (!obs.length) throw new Error('COFER: la respuesta no traía observaciones');

  const periodo = trimestreMasReciente(obs.map((o) => o.periodo));
  if (!periodo) throw new Error('COFER: no hay ningún trimestre en la respuesta');

  const monedas = {};
  for (const [codigo, nombre] of Object.entries(MONEDAS)) {
    const delPeriodo = obs.filter((o) => o.periodo === periodo && o.moneda === codigo);
    const usd = delPeriodo.find((o) => o.tipo === 'NV_USD');
    const pct = delPeriodo.find((o) => o.tipo === 'SHRO_PT');
    if (!usd && !pct) continue;
    monedas[codigo] = {
      nombre,
      valorUsd: usd ? usd.valor : null,
      porcentaje: pct ? pct.valor : null,
    };
  }

  // Comprobación de coherencia: las partes deben sumar el total. Si el FMI
  // cambia el desglose (como hizo al separar el renminbi en 2017), esto salta
  // en vez de publicar un diagrama que no cuadra.
  const total = monedas.CI_T && monedas.CI_T.valorUsd;
  if (total) {
    const partes = Object.entries(monedas)
      .filter(([c]) => c !== 'CI_T')
      .reduce((a, [, v]) => a + (v.valorUsd || 0), 0);
    const desvio = Math.abs(partes - total) / total;
    if (desvio > 0.005) {
      throw new Error(
        `COFER: las monedas suman ${(partes / 1e12).toFixed(3)} billones y el total dice ` +
        `${(total / 1e12).toFixed(3)}; desvío del ${(desvio * 100).toFixed(2)} %`,
      );
    }
  }

  return { periodo, publicado, monedas };
}
