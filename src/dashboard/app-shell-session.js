/**
 * AETHER · sesión del shell.
 *
 * T12: módulo ES. Antes era un IIFE que se comunicaba con el resto por
 * variables globales; ahora las dependencias son imports explícitos.
 */
import { AETHER_RUNTIME_STATE } from './shell-state.js';
const KEY = 'aether.shell.session.v1';
const state = AETHER_RUNTIME_STATE;

function safeRead(){
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function safeWrite(payload){
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

function snapshot(){
  const payload = {
    title: document.title,
    hash: location.hash || '',
    lastPage: document.getElementById('page-aether')?.classList.contains('active') ? 'aether' : 'landing',
    updatedAt: new Date().toISOString()
  };
  state.session = payload;
  safeWrite(payload);
  return payload;
}

function bind(){
  window.addEventListener('beforeunload', snapshot);
  window.addEventListener('hashchange', snapshot);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') snapshot();
  });
}

function init(){
  state.sessionRestored = safeRead();
  bind();
  snapshot();
  window.AetherShellSession = Object.freeze({ key: KEY, read: safeRead, write: safeWrite, snapshot });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
