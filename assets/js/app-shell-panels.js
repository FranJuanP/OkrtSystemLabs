(function(){
  const state = window.AETHER_RUNTIME_STATE || (window.AETHER_RUNTIME_STATE = {
    phase: 'VII', startedAt: new Date().toISOString(), errors: [], warnings: [], checks: {}, events: []
  });

  function textOf(node){
    return ((node && (node.getAttribute('data-title') || node.getAttribute('aria-label') || node.textContent)) || '')
      .replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function scan(){
    const groups = {
      cards: Array.from(document.querySelectorAll('.card, .feat-card, [class*="card"]')).slice(0, 120),
      panels: Array.from(document.querySelectorAll('.panel, [class*="panel"]')).slice(0, 120),
      sections: Array.from(document.querySelectorAll('section')).slice(0, 120)
    };

    const registry = {
      cards: groups.cards.length,
      panels: groups.panels.length,
      sections: groups.sections.length,
      sampleCards: groups.cards.slice(0, 8).map(textOf).filter(Boolean),
      samplePanels: groups.panels.slice(0, 8).map(textOf).filter(Boolean),
      sampleSections: groups.sections.slice(0, 8).map(textOf).filter(Boolean),
      at: new Date().toISOString()
    };

    state.panels = registry;
    document.body.dataset.aetherPanels = String(registry.panels);
    document.body.dataset.aetherCards = String(registry.cards);
    return registry;
  }

  function init(){
    const registry = scan();
    window.AetherPanelRegistry = Object.freeze({ scan, registry });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();