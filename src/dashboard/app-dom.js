/**
 * AETHER · utilidades de DOM del dashboard.
 *
 * T12: módulo ES. Antes era un IIFE que se comunicaba con el resto por
 * variables globales; ahora las dependencias son imports explícitos.
 */
import { AETHER_SHELL_CONFIG } from './app-shell-config.js';
const byId = (id) => document.getElementById(id);
const q = (sel, root=document) => root.querySelector(sel);
const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const shellSelectors = () => (AETHER_SHELL_CONFIG && AETHER_SHELL_CONFIG.selectors) || {};
const shellLabels = () => (AETHER_SHELL_CONFIG && AETHER_SHELL_CONFIG.labels) || {};
const setDisabled = (id, value) => {
  const node = byId(id);
  if (node) node.disabled = !!value;
  return node;
};
const toggleClass = (node, className, force) => {
  if (!node) return node;
  node.classList.toggle(className, force);
  return node;
};
window.AetherDOM = Object.freeze({ byId, q, qa, shellSelectors, shellLabels, setDisabled, toggleClass });
