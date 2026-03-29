(function(){
  function isVectorMobile(){
    return document.body && document.body.classList.contains('vector-mobile') && window.innerWidth <= 900;
  }

  function revealDetail(){
    if (!isVectorMobile()) return;
    const panel = document.getElementById('detail-panel');
    const placeholder = document.getElementById('dp-placeholder');
    const content = document.getElementById('dp-content');
    if (!panel || !content) return;

    const visible = getComputedStyle(content).display !== 'none' && content.textContent.trim().length > 0;
    if (!visible) return;

    if (placeholder) placeholder.style.display = 'none';
    panel.style.display = 'block';
    panel.hidden = false;

    requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  function installHooks(){
    const chart = document.getElementById('chart-wrap') || document.getElementById('sankey-svg');
    if (chart && !chart.__vectorMobileFix){
      chart.__vectorMobileFix = true;
      chart.addEventListener('click', function(ev){
        const target = ev.target.closest('.link-path, .node-rect, .top-row, .top-flow-item, .vector-rank');
        if (!target) return;
        setTimeout(revealDetail, 120);
        setTimeout(revealDetail, 280);
      }, true);
    }

    const controls = document.getElementById('controls');
    if (controls && !controls.__vectorMobileFix){
      controls.__vectorMobileFix = true;
      controls.addEventListener('click', function(ev){
        if (!ev.target.closest('.flow-btn, .reg-btn')) return;
        setTimeout(revealDetail, 80);
      }, true);
      document.getElementById('threshold')?.addEventListener('input', function(){ setTimeout(revealDetail, 80); }, { passive:true });
    }

    const detail = document.getElementById('dp-content');
    if (detail && !detail.__vectorMobileObserver){
      const mo = new MutationObserver(() => { revealDetail(); });
      mo.observe(detail, { childList:true, subtree:true, attributes:true, characterData:true });
      detail.__vectorMobileObserver = mo;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    installHooks();
    window.addEventListener('resize', revealDetail, { passive:true });
  });
})();
