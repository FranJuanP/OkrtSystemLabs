/**
 * AETHER · escapado y validación de URL (T3)
 *
 * Todo campo que venga de una API externa, del modelo de IA o de
 * localStorage pasa por aquí antes de llegar a innerHTML. Este fichero se
 * carga el primero en las cuatro páginas, antes que cualquier motor.
 *
 * La Fase 2 lo convierte en un módulo ES con imports explícitos.
 */
(function (global) {
  'use strict';

  var HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
  };

  /**
   * Escapa para interpolar en HTML. Cubre también comillas y backtick, de
   * modo que el valor es seguro dentro de un atributo entrecomillado.
   * @param {*} value
   * @returns {string}
   */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`]/g, function (ch) {
      return HTML_ENTITIES[ch];
    });
  }

  /**
   * Valida una URL de origen externo. Solo se acepta https:.
   * Se descarta cualquier otro esquema, en particular javascript:, data:
   * y vbscript:, y también http:, que en una página servida por HTTPS
   * seria contenido mixto.
   *
   * @param {*} value  la URL tal cual viene de la API
   * @returns {string} la URL normalizada, o '' si no es utilizable
   */
  function safeUrl(value) {
    if (!value) return '';
    try {
      var parsed = new URL(String(value), global.location ? global.location.href : undefined);
      if (parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  /**
   * Atributo href listo para interpolar: devuelve '' cuando la URL no pasa
   * la validación, para que el enlace se renderice sin destino.
   * @param {*} value
   * @returns {string}
   */
  function safeHref(value) {
    return esc(safeUrl(value));
  }

  /**
   * Aplica el formato de negritas **texto** sobre un texto YA escapado y
   * convierte los saltos de línea. Nunca debe recibir HTML sin escapar.
   * @param {*} rawText  texto sin escapar, tal cual lo devolvió el modelo
   * @returns {string} HTML seguro
   */
  function formatBold(rawText, strongStyle) {
    var style = strongStyle || 'color:var(--bright)';
    return esc(rawText)
      .replace(/\*\*(.*?)\*\*/g, '<strong style="' + style + '">$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  global.esc = esc;
  global.safeUrl = safeUrl;
  global.safeHref = safeHref;
  global.formatBold = formatBold;
  global.AETHER_ESCAPE = { esc: esc, safeUrl: safeUrl, safeHref: safeHref, formatBold: formatBold };
})(window);
