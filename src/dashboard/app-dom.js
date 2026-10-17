(function(){
  const byId = (id) => document.getElementById(id);
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const shellSelectors = () => (window.AETHER_SHELL_CONFIG && window.AETHER_SHELL_CONFIG.selectors) || {};
  const shellLabels = () => (window.AETHER_SHELL_CONFIG && window.AETHER_SHELL_CONFIG.labels) || {};
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
})();
