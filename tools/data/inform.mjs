/**
 * Descarga del INFORM Risk Index del JRC de la Comisión Europea (T21).
 *
 * INFORM aporta algo que no tiene el Banco Mundial: dimensiones ya
 * normalizadas de 0 a 10 y comparables entre países (amenaza humana,
 * desarraigo, inseguridad alimentaria, amenaza vectorial, carencia de
 * infraestructuras). Cubre 191 países.
 *
 * La API no tiene «la última versión»: hay que elegir un «workflow». Cada
 * publicación es uno, y conviven decenas, incluidas las reconstrucciones
 * retrospectivas («INFORM Risk 2026 - 2017»), que NO son la versión vigente.
 * Se coge el workflow publicado más reciente cuyo nombre sea exactamente
 * «INFORM Risk AAAA» o «INFORM Risk Mid AAAA», y se guarda su nombre y su
 * fecha para poder citarlos.
 */
import { pedir } from './http.mjs';

const BASE = 'https://drmkc.jrc.ec.europa.eu/inform-index/API/InformAPI';

/** Solo la versión vigente y la revisión de mitad de año, no los retrospectivos. */
const NOMBRE_VIGENTE = /^INFORM Risk (Mid )?20\d\d$/;

/** Devuelve el workflow publicado más reciente. */
export async function versionVigente() {
  const todos = await pedir(`${BASE}/workflows/`, { timeoutMs: 45000 });
  const candidatos = (todos || [])
    .filter((w) => NOMBRE_VIGENTE.test(String(w.Name || '').trim()))
    .filter((w) => w.FlagGnaPublished || w.FlagDataSaved)
    .sort((a, b) => new Date(b.WorkflowDate) - new Date(a.WorkflowDate));
  if (!candidatos.length) throw new Error('INFORM: ninguna versión publicada reconocible');
  const w = candidatos[0];
  return {
    id: w.WorkflowId,
    nombre: String(w.Name).trim(),
    fecha: String(w.WorkflowDate).slice(0, 10),
    publicado: String(w.FlagGnaPublished || w.FlagDataSaved).slice(0, 10),
  };
}

/**
 * Todas las puntuaciones de una versión, indexadas por indicador y país.
 *
 * Es una sola petición de unos 8 MB para los 287 indicadores de los 191
 * países; sale más barato que pedir indicador a indicador.
 *
 * @returns {Promise<{version:object, porIndicador: Map<string, Map<string,{valor:number,anio:number}>>}>}
 */
export async function descargar() {
  const version = await versionVigente();
  const filas = await pedir(`${BASE}/countries/Scores/?WorkflowId=${version.id}`, {
    timeoutMs: 120000,
  });

  const porIndicador = new Map();
  for (const f of filas || []) {
    const id = f.IndicatorId;
    const iso = f.Iso3;
    // La API mezcla países con subdivisiones administrativas ('GR-24'); solo
    // interesan los ISO3 de tres letras.
    if (!id || !iso || !/^[A-Z]{3}$/.test(iso)) continue;
    if (f.IndicatorScore == null) continue;
    if (!porIndicador.has(id)) porIndicador.set(id, new Map());
    porIndicador.get(id).set(iso, {
      valor: Number(f.IndicatorScore),
      // ValidityYear viene a 0 en las dimensiones agregadas; en ese caso el
      // año del dato es el de la publicación.
      anio: Number(f.ValidityYear) || Number(version.fecha.slice(0, 4)),
    });
  }
  return { version, porIndicador };
}
