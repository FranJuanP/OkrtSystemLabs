/**
 * Descarga con tiempo límite y reintentos (T21).
 *
 * El pipeline toca cinco servidores públicos, y dos de ellos (JRC y
 * Treasury) fallan de vez en cuando con un 5xx o se quedan colgados. Como el
 * trabajo corre sin nadie delante, cada petición tiene su propio límite de
 * tiempo y se reintenta con espera creciente; si al final no hay dato, el
 * indicador se queda sin valor y eso se refleja en el informe de la
 * ejecución en vez de romper el fichero entero.
 */

export const UA =
  'AETHER-data-pipeline/1.0 (+https://github.com/FranJuanP/OkrtSystemLabs)';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=30000]
 * @param {number} [opts.intentos=3]
 * @param {'json'|'text'|'buffer'} [opts.como='json']
 * @param {Record<string,string>} [opts.headers]
 */
export async function pedir(url, opts = {}) {
  const { timeoutMs = 30000, intentos = 3, como = 'json', headers = {} } = opts;
  let ultimoError;
  for (let i = 1; i <= intentos; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { 'user-agent': UA, ...headers },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      if (como === 'json') return await res.json();
      if (como === 'text') return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      ultimoError = err;
      // Espera creciente: 1 s, 4 s. No más, el trabajo semanal no tiene prisa
      // pero tampoco debe quedarse una hora reintentando un servidor caído.
      if (i < intentos) await espera(1000 * i * i);
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error(`${url} :: ${ultimoError && ultimoError.message}`);
}

/** Parte una lista en trozos de n elementos. */
export function trozos(lista, n) {
  const out = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}
