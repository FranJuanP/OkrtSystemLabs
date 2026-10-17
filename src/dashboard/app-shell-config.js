/**
 * AETHER · configuración del dashboard.
 *
 * T14: aquí se ha fusionado app-config.js, que era una vista reducida de
 * este mismo objeto con `||` por defecto para cada campo. Dos ficheros, dos
 * globales (AETHER_SHELL_CONFIG y AETHER_CONFIG) y una relación de copia
 * entre ellos, para una configuración que nunca cambia en tiempo de
 * ejecución. Ahora hay un solo objeto.
 *
 * T12: módulo ES. Antes era un IIFE que se comunicaba con el resto por
 * variables globales; ahora las dependencias son imports explícitos.
 */
const cfg = Object.freeze({
  branding: Object.freeze({
    brand: 'AETHER',
    version: '1.0',
    lab: 'OkrtSystem Labs',
    productTitle: 'AETHER — Global Intelligence System · OkrtSystem Labs',
    shortTitle: 'AETHER — Global Intelligence System',
    htmlComment: '© OkrtSystem Labs · AETHER Global Intelligence System · franjuanp.github.io/OkrtSystemLabs'
  }),
  pages: Object.freeze({
    landing: 'page-landing',
    aether: 'page-aether'
  }),
  stylesheets: Object.freeze({
    landing: 'css-landing',
    aether: 'css-aether',
    router: 'css-router'
  }),
  selectors: Object.freeze({
    cursor: '#cur',
    cursorRing: '#cur2',
    landingCanvas: '#tc',
    systemTime: '#s-time',
    loadingBar: '#lf',
    loadingMessage: '#lm',
    loadingOverlay: '#loader',
    landingButton: '[data-launch-aether]'
  }),
  labels: Object.freeze({
    launchCta: 'Launch AETHER',
    systemActive: 'SISTEMA ACTIVO',
    booting: 'INICIANDO SISTEMA...',
    bootingModules: 'CARGANDO MÓDULOS...',
    analyzingVector: 'ANALIZANDO VECTOR GLOBAL...'
  }),
  timings: Object.freeze({
    loaderFadeDelayMs: 350,
    routerKickoffDelayMs: 700,
    initialBootDelayMs: 300
  }),
  runtime: Object.freeze({
    cardsEngine: 'src/dashboard/engine.js',
    routerLegacy: 'src/dashboard/app-router-legacy.js',
    guard: 'src/dashboard/runtime-guard.js'
  })
});

export const AETHER_SHELL_CONFIG = cfg;
window.AETHER_SHELL_CONFIG = cfg;
