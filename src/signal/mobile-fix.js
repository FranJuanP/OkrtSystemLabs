(function(){
  function isSignalMobile(){
    return document.body && document.body.classList.contains('signal-mobile') && window.innerWidth <= 900;
  }

  function revealDetail(){
    if (!isSignalMobile()) return;
    const detail = document.getElementById('detail');
    const placeholder = document.getElementById('detail-placeholder');
    const content = document.getElementById('detail-content');
    if (!detail || !content) return;

    const visible = getComputedStyle(content).display !== 'none' && content.innerHTML.trim().length > 0;
    if (!visible) return;

    if (placeholder) placeholder.style.display = 'none';
    detail.style.display = 'block';
    detail.hidden = false;

    requestAnimationFrame(() => {
      detail.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  function installHooks(){
    const feed = document.getElementById('feed');
    if (feed && !feed.__signalMobileFix){
      feed.__signalMobileFix = true;
      feed.addEventListener('click', function(ev){
        const card = ev.target.closest('.signal-card');
        if (!card) return;
        setTimeout(revealDetail, 140);
        setTimeout(revealDetail, 320);
      }, true);
    }

    if (typeof window.selectSignal === 'function' && !window.selectSignal.__signalMobileWrapped){
      const original = window.selectSignal;
      const wrapped = function(){
        const result = original.apply(this, arguments);
        setTimeout(revealDetail, 80);
        setTimeout(revealDetail, 240);
        return result;
      };
      wrapped.__signalMobileWrapped = true;
      window.selectSignal = wrapped;
    }

    const detail = document.getElementById('detail-content');
    if (detail && !detail.__signalMobileObserver){
      const mo = new MutationObserver(() => {
        revealDetail();
      });
      mo.observe(detail, { childList:true, subtree:true, attributes:true });
      detail.__signalMobileObserver = mo;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    installHooks();
    window.addEventListener('resize', revealDetail, { passive:true });
  });
})();
