(function(){
  const WATCHLIST_KEY = 'aether_watchlist_v3';
  const HISTORY_KEY = 'aether_brief_history_v3';
  const SNAPSHOT_KEY = 'aether_region_snapshots_v3';
  let initialized = false;
  let lastRegion = null;
  let lastOverall = null;

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function round(v){ return Math.round(Number(v) || 0); }
  function safeJSONParse(v, fallback){ try { return JSON.parse(v); } catch { return fallback; } }
  function safeStorageGet(key, fallback){
    try {
      const parsed = safeJSONParse(localStorage.getItem(key), fallback);
      return parsed == null ? fallback : parsed;
    } catch { return fallback; }
  }
  function loadWatchlist(){
    const parsed = safeStorageGet(WATCHLIST_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }
  function saveWatchlist(items){ try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(Array.isArray(items) ? items : [])); } catch {} }
  function loadSnapshots(){
    const parsed = safeStorageGet(SNAPSHOT_KEY, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }
  function saveSnapshots(obj){ try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(obj && typeof obj === 'object' ? obj : {})); } catch {} }
  function saveHistory(item){
    try {
      const hist = safeStorageGet(HISTORY_KEY, []);
      const arr = Array.isArray(hist) ? hist : [];
      arr.unshift(item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 18)));
    } catch {}
  }
  function $(id){ return document.getElementById(id); }

  function getRegionCode(){
    return $('region-sel')?.value || 'WLD';
  }
  function getRegionName(code){
    try {
      const opt = $('region-sel')?.querySelector(`option[value="${code}"]`);
      if (opt) {
        const txt = opt.textContent || '';
        return txt.replace(/^[^\s]+\s/, '').trim() || code;
      }
    } catch {}
    if (window.DATA && window.DATA[code] && window.DATA[code].name) return window.DATA[code].name;
    return code;
  }
  function getCategoryKeys(){
    if (Array.isArray(window.CAT_KEYS) && window.CAT_KEYS.length) return window.CAT_KEYS;
    return ['eco','geo','health','climate','social','tech','food','mental','energy','demo','urban','science','justice','finance','ocean','bio'];
  }
  function getCategoryLabel(key, idx){
    if (Array.isArray(window.CAT_LABELS) && window.CAT_LABELS[idx]) return window.CAT_LABELS[idx];
    const node = document.getElementById(`n-${key}`);
    return node?.textContent?.trim() || key.toUpperCase();
  }
  function getScoreColor(score){
    if (typeof window.scoreToColor === 'function') return window.scoreToColor(score);
    if (score >= 75) return '#FF3355';
    if (score >= 60) return '#FFA500';
    if (score >= 45) return '#FFD166';
    return '#00FFC8';
  }
  function bandLabel(score){
    if (score >= 75) return 'Crítico';
    if (score >= 60) return 'Alto';
    if (score >= 45) return 'Moderado';
    return 'Contenido';
  }
  function bandText(score){
    if (score >= 75) return 'muy alta';
    if (score >= 60) return 'alta';
    if (score >= 45) return 'moderada';
    if (score >= 30) return 'controlada';
    return 'baja';
  }
  function intensityWord(value){
    if (value >= 75) return 'alta';
    if (value >= 50) return 'media';
    if (value >= 25) return 'baja';
    return 'mínima';
  }
  function confidenceWord(value){
    if (value >= 85) return 'alta';
    if (value >= 68) return 'sólida';
    if (value >= 50) return 'media';
    return 'reducida';
  }
  function shockWord(value){
    if (value >= 70) return 'activo';
    if (value >= 35) return 'moderado';
    if (value > 0) return 'leve';
    return 'inactivo';
  }
  function readDataset(code){
    return (window.DATA && window.DATA[code]) || (window.DATA && window.DATA.WLD) || null;
  }
  function readGaugeScore(key){
    const raw = $(`n-${key}`)?.textContent || '';
    const m = raw.match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }
  function getShockStats(){
    const shocks = window.ShockSim?.shocks || {};
    const values = Object.values(shocks).map(v => Number(v) || 0);
    const abs = values.map(v => Math.abs(v));
    const activeCount = abs.filter(v => v >= 1).length;
    const max = abs.length ? Math.max(...abs) : 0;
    const avg = abs.length ? abs.reduce((a,b)=>a+b,0) / abs.length : 0;
    const intensity = activeCount ? clamp(round(max * 3.1 + avg * 1.2 + activeCount * 4), 8, 100) : 0;
    return { activeCount, max: round(max), avg: round(avg), intensity };
  }
  function computeRegionProfile(code){
    const data = readDataset(code);
    const keys = getCategoryKeys();
    const cats = keys.map((k, idx) => {
      const domScore = readGaugeScore(k);
      const dataScore = Number(data?.[k]?.score);
      const score = Number.isFinite(domScore) ? domScore : (Number.isFinite(dataScore) ? dataScore : 50);
      return { key:k, label:getCategoryLabel(k, idx), score:round(score), color:getScoreColor(score), band: bandLabel(score) };
    });

    const overall = round(cats.reduce((a,c)=>a+c.score,0) / Math.max(cats.length,1));
    const sorted = [...cats].sort((a,b)=>b.score-a.score);
    const top = sorted.slice(0,3);
    const highCount = cats.filter(c => c.score >= 60).length;
    const mediumCount = cats.filter(c => c.score >= 45 && c.score < 60).length;
    const lowCount = cats.filter(c => c.score < 45).length;
    const max = sorted[0]?.score ?? overall;
    const min = sorted[sorted.length-1]?.score ?? overall;
    const top1 = sorted[0]?.score ?? overall;
    const top2 = sorted[1]?.score ?? overall;
    const top3 = sorted[2]?.score ?? overall;
    const topAvg = round((top1 + top2 + top3) / Math.max(top.length,1));

    const structural = clamp(round(((highCount * 100 / cats.length) * 0.55) + ((mediumCount * 100 / cats.length) * 0.20) + (overall * 0.25)), 6, 100);
    const concentration = clamp(round(((top1 - overall) * 2.2) + ((top1 - top3) * 1.4) + ((topAvg - overall) * 1.8)), 4, 100);

    const snapshots = loadSnapshots();
    const snap = snapshots && typeof snapshots === 'object' ? (snapshots[code] || null) : null;
    const prev = snap?.prev || null;
    const last = snap?.last || null;
    const baseline = last || prev || null;
    const delta = baseline ? overall - Number(baseline.overall || 0) : 0;
    const dominantChanged = !!(baseline && baseline.dominant && baseline.dominant !== (top[0]?.label || ''));

    const shockStats = getShockStats();
    const volatility = clamp(round(Math.abs(delta) * 10 + (max - min) * 0.55 + (dominantChanged ? 14 : 0) + shockStats.intensity * 0.30), 3, 100);

    const resilienceNode = $('resilience-val');
    const resiliencePct = (() => {
      const raw = resilienceNode ? Number((resilienceNode.textContent || '').replace(/[^\d.-]/g,'')) : NaN;
      if (Number.isFinite(raw) && raw > 0) return clamp(round(raw), 8, 95);
      return clamp(round(100 - overall - highCount * 1.2 + lowCount * 0.4), 12, 88);
    })();

    const confidence = clamp(round((100 - Math.min(volatility, 88)) * 0.34 + resiliencePct * 0.38 + (100 - Math.min(shockStats.intensity, 75)) * 0.18 + (100 - concentration) * 0.10), 28, 96);

    const topRiskShare = clamp(round((top1 + top2 + top3) / Math.max(cats.reduce((a,c)=>a+c.score,0),1) * 100), 0, 100);

    return {
      code,
      name:getRegionName(code),
      data,
      cats,
      overall,
      top,
      highCount,
      mediumCount,
      lowCount,
      max,
      min,
      topAvg,
      topRiskShare,
      structural,
      concentration,
      volatility,
      activeShock: shockStats.intensity,
      shockStats,
      resiliencePct,
      confidence,
      snapshot: snap,
      baseline,
      prev,
      last,
      delta,
      dominantChanged,
      pressureSpread: Math.max(0, max - min)
    };
  }

  function trendDescriptor(delta){
    if (delta >= 6) return 'reconfiguración alcista';
    if (delta >= 3) return 'presión al alza';
    if (delta <= -6) return 'descompresión clara';
    if (delta <= -3) return 'alivio parcial';
    return 'trayectoria estable';
  }
  function deltaTone(delta){
    if (delta >= 3) return 'up';
    if (delta <= -3) return 'down';
    return 'flat';
  }
  function buildBrief(profile){
    const dominant = profile.top[0];
    const secondary = profile.top[1];
    const trend = profile.baseline
      ? `${trendDescriptor(profile.delta)} frente a la última referencia útil (${profile.baseline.overall}/100).`
      : 'sin histórico suficiente todavía; la comparativa se activará automáticamente tras una segunda lectura útil.';
    const dominantShift = profile.dominantChanged
      ? ` La dominante rota desde <strong>${profile.baseline.dominant}</strong> hacia <strong>${dominant.label}</strong>.`
      : '';
    return `Lectura actual de <strong>${profile.name}</strong>: riesgo <strong>${bandLabel(profile.overall).toLowerCase()}</strong> (${profile.overall}/100), con presión dominante en <strong>${dominant.label}</strong>${secondary ? ` y refuerzo en <strong>${secondary.label}</strong>` : ''}. <strong>${profile.highCount}</strong> categorías están en zona alta y la señal general muestra <strong>${trend}</strong>${dominantShift}`;
  }
  function setHTML(id, html){ const el = $(id); if (el) el.innerHTML = html; }

  function metricRow(label, val, tone, display){
    return `<div class="aether-ex-row ${tone ? `tone-${tone}`:''}">
      <div class="aether-ex-label">${label}</div>
      <div class="aether-ex-bar"><div class="aether-ex-fill" style="width:${clamp(val,0,100)}%"></div></div>
      <div class="aether-ex-val">${display ?? val}</div>
    </div>`;
  }

  function renderExplainability(profile){
    const base = round(profile.overall);
    const structural = round(profile.structural);
    const concentration = round(profile.concentration);
    const volatility = round(profile.volatility);
    const shock = round(profile.activeShock);
    const confidence = round(profile.confidence);

    setHTML('aether-explain-list', [
      metricRow('Base', base, base >= 60 ? 'up' : 'flat', `${base}`),
      metricRow('Estructural', structural, structural >= 55 ? 'up' : structural <= 30 ? 'down' : 'flat', `${structural}`),
      metricRow('Concentración', concentration, concentration >= 60 ? 'up' : concentration <= 25 ? 'down' : 'flat', `${concentration}`),
      metricRow('Volatilidad', volatility, volatility >= 55 ? 'up' : volatility <= 25 ? 'down' : 'flat', `${volatility}`),
      metricRow('Shock activo', shock, shock > 0 ? 'up' : 'down', shock > 0 ? `${shock}` : 'NO'),
      metricRow('Confianza', confidence, confidence >= 70 ? 'down' : confidence < 50 ? 'up' : 'flat', `${confidence}`)
    ].join(''));

    setHTML('aether-top-drivers', [
      ...profile.top.map((cat, idx)=>`<span class="aether-driver ${idx===0?'is-primary':''}" style="--driver:${cat.color}">${cat.label} · ${cat.score}</span>`),
      `<span class="aether-driver aether-driver-soft">Concentración ${intensityWord(profile.concentration)}</span>`,
      `<span class="aether-driver aether-driver-soft">Shock ${shockWord(profile.activeShock)}</span>`,
      `<span class="aether-driver aether-driver-soft">Confianza ${confidenceWord(profile.confidence)}</span>`
    ].join(''));

    const shockLine = profile.activeShock > 0
      ? `Shock <strong>${shockWord(profile.activeShock)}</strong> (${profile.shockStats.activeCount} vectores activos, intensidad ${profile.activeShock}).`
      : `Shock <strong>inactivo</strong>; no se detecta presión exógena relevante en el simulador.`;
    setHTML('aether-explain-note',
      `La lectura combina <strong>intensidad base</strong>, densidad estructural y <strong>presión concentrada</strong>. Volatilidad <strong>${intensityWord(profile.volatility)}</strong>, resiliencia estimada del <strong>${profile.resiliencePct}%</strong> y confianza operativa <strong>${confidenceWord(profile.confidence)}</strong> (${confidence}%). ${shockLine}`
    );
  }

  function renderBrief(profile){
    const delta = profile.baseline ? profile.delta : 0;
    const tone = deltaTone(delta);
    const deltaText = profile.baseline ? `${delta > 0 ? '+' : ''}${delta}` : 'N/A';
    setHTML('aether-brief-text', buildBrief(profile));
    setHTML('aether-brief-meta', [
      `<span class="aether-pill">REGIÓN · ${profile.code}</span>`,
      `<span class="aether-pill">DOMINANTE · ${profile.top[0].label}</span>`,
      `<span class="aether-pill ${profile.highCount ? 'is-hot':''}">ALTAS · ${profile.highCount}/${profile.cats.length}</span>`,
      `<span class="aether-pill ${tone === 'up' ? 'is-hot' : tone === 'down' ? 'is-cool' : ''}">DELTA · ${deltaText}</span>`
    ].join(''));

    setHTML('aether-brief-kpis', `
      <div class="aether-kpi-box">
        <div class="aether-kpi-label">Score global</div>
        <div class="aether-kpi-value">${profile.overall}<span>/100</span></div>
      </div>
      <div class="aether-kpi-box">
        <div class="aether-kpi-label">Presión principal</div>
        <div class="aether-kpi-value is-small">${profile.top[0].label}</div>
      </div>
      <div class="aether-kpi-box">
        <div class="aether-kpi-label">Confianza</div>
        <div class="aether-kpi-value">${profile.confidence}<span>%</span></div>
      </div>
      <div class="aether-kpi-box">
        <div class="aether-kpi-label">Resiliencia</div>
        <div class="aether-kpi-value">${profile.resiliencePct}<span>%</span></div>
      </div>
    `);

    const spreadLabel = profile.pressureSpread >= 28 ? 'dispersión alta' : profile.pressureSpread >= 18 ? 'dispersión media' : 'dispersión contenida';
    setHTML('aether-brief-status', `
      <div class="aether-status-row">
        <span class="aether-status-pill ${tone === 'up' ? 'is-up' : tone === 'down' ? 'is-down' : 'is-flat'}">${trendDescriptor(delta)}</span>
        <span class="aether-status-pill">${bandText(profile.overall)} · ${spreadLabel}</span>
        <span class="aether-status-text">Rango interno ${profile.min}-${profile.max} · ${profile.mediumCount} categorías en vigilancia media · concentración ${profile.concentration}/100 · cuota top-3 ${profile.topRiskShare}%.</span>
      </div>
    `);
  }

  function syncWatchlistMetrics(items){
    return items.map(item => {
      const profile = computeRegionProfile(item.code);
      const delta = profile.baseline ? profile.delta : 0;
      return {
        code:item.code,
        name:profile.name,
        score:profile.overall,
        dominant:profile.top[0]?.label || '',
        dominantColor: profile.top[0]?.color || '#00FFC8',
        delta,
        confidence: profile.confidence,
        band: bandLabel(profile.overall)
      };
    });
  }
  function addCurrentRegion(){
    const code = getRegionCode();
    const items = syncWatchlistMetrics(loadWatchlist());
    if (!items.find(x => x.code === code)) {
      const profile = computeRegionProfile(code);
      items.unshift({
        code,
        name: profile.name,
        score: profile.overall,
        dominant: profile.top[0]?.label || '',
        dominantColor: profile.top[0]?.color || '#00FFC8',
        delta: profile.baseline ? profile.delta : 0,
        confidence: profile.confidence,
        band: bandLabel(profile.overall)
      });
      saveWatchlist(items.slice(0,10));
      renderWatchlist();
    }
  }
  function removeRegion(code){
    saveWatchlist(loadWatchlist().filter(x => x.code !== code));
    renderWatchlist();
  }
  function applyRegion(code){
    const sel = $('region-sel');
    if (!sel) return;
    sel.value = code;
    if (typeof window.onRegionChange === 'function') window.onRegionChange();
    updateEnhancements(true);
  }
  function renderWatchlist(){
    const items = syncWatchlistMetrics(loadWatchlist());
    const box = $('aether-watchlist');
    const summary = $('aether-watch-summary');
    if (!box) return;
    if (summary) {
      const avg = items.length ? round(items.reduce((a,i)=>a+i.score,0)/items.length) : 0;
      summary.textContent = items.length ? `${items.length} regiones fijadas · score medio ${avg}/100 · seguimiento persistente local` : 'Ancla regiones clave y vuelve a ellas en un clic.';
    }
    if (!items.length) {
      box.innerHTML = `<div class="aether-watch-empty">Añade regiones clave para volver a ellas en un clic, seguir su score, dominante y confianza, y detectar cambios de presión.</div>`;
      return;
    }
    box.innerHTML = items.map(item => {
      const tone = deltaTone(item.delta);
      return `
      <div class="aether-watch-item">
        <div class="aether-watch-main">
          <div class="aether-watch-name-row">
            <div class="aether-watch-name">${item.name}</div>
            <span class="aether-watch-band">${item.band}</span>
          </div>
          <div class="aether-watch-sub">
            <span>${item.code}</span>
            <span>SCORE ${item.score}</span>
            <span class="aether-watch-delta ${tone}">${item.delta > 0 ? '+' : ''}${item.delta || 0}</span>
          </div>
          <div class="aether-watch-dominant"><span style="color:${item.dominantColor}">●</span> ${item.dominant || 'Sin dominante'}</div>
        </div>
        <div class="aether-watch-side">
          <div class="aether-watch-confidence">${item.confidence}%</div>
          <div class="aether-watch-actions">
            <button class="aether-watch-icon" data-open="${item.code}" title="Cargar">↗</button>
            <button class="aether-watch-icon" data-del="${item.code}" title="Eliminar">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-open]').forEach(btn => btn.onclick = () => applyRegion(btn.getAttribute('data-open')));
    box.querySelectorAll('[data-del]').forEach(btn => btn.onclick = () => removeRegion(btn.getAttribute('data-del')));
    saveWatchlist(items);
  }

  function injectPanel(){
    if ($('aether-enhancements')) return;
    const controls = document.querySelector('.cbar');
    if (!controls || !controls.parentNode) return;
    const card = document.createElement('div');
    card.className = 'card aether-enh-card';
    card.id = 'aether-enhancements';
    card.innerHTML = `
      <div class="ctitle">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12M2 8h12M2 13h8" stroke="#00FFC8" stroke-width="1.2"/><circle cx="11.5" cy="13" r="1.5" fill="#00FFC8"/></svg>
        CAPA OPERATIVA
        <span style="margin-left:auto;font-size:9px;color:var(--dim);font-family:'Share Tech Mono',monospace">BRIEF · EXPLICABILIDAD · WATCHLIST</span>
      </div>
      <div class="aether-enh-grid">
        <div class="aether-enh-block aether-brief-block">
          <div class="aether-enh-kicker">Executive brief</div>
          <div class="aether-enh-brief" id="aether-brief-text">Inicializando lectura operativa...</div>
          <div class="aether-enh-meta" id="aether-brief-meta"></div>
          <div class="aether-brief-kpis" id="aether-brief-kpis"></div>
          <div class="aether-brief-status" id="aether-brief-status"></div>
        </div>
        <div class="aether-enh-block aether-explain-block">
          <div class="aether-enh-kicker">Explicabilidad interpretativa</div>
          <div class="aether-explain-list" id="aether-explain-list"></div>
          <div class="aether-drivers" id="aether-top-drivers"></div>
          <div class="aether-note" id="aether-explain-note"></div>
        </div>
        <div class="aether-enh-block aether-watch-block">
          <div class="aether-watch-top">
            <div>
              <div class="aether-enh-kicker" style="margin-bottom:2px">Watchlist persistente</div>
              <div id="aether-watch-summary" style="font-size:11px;color:var(--dim)">Ancla regiones clave y vuelve a ellas en un clic.</div>
            </div>
            <button class="aether-mini-btn" id="aether-watch-add">+ Añadir actual</button>
          </div>
          <div class="aether-watchlist" id="aether-watchlist"></div>
        </div>
      </div>`;
    controls.insertAdjacentElement('afterend', card);
    $('aether-watch-add')?.addEventListener('click', addCurrentRegion);
  }

  function persistSnapshot(profile){
    const snapshots = loadSnapshots();
    const existing = snapshots[profile.code] || {};
    const current = {
      ts: Date.now(),
      overall: profile.overall,
      dominant: profile.top[0]?.label || '',
      highCount: profile.highCount,
      confidence: profile.confidence,
      concentration: profile.concentration,
      structural: profile.structural,
      volatility: profile.volatility
    };
    const last = existing.last || null;
    const changed = !last ||
      last.overall !== current.overall ||
      last.dominant !== current.dominant ||
      last.highCount !== current.highCount ||
      last.confidence !== current.confidence;
    snapshots[profile.code] = changed
      ? { prev: last || existing.prev || null, last: current }
      : existing.last
        ? existing
        : { prev: null, last: current };
    saveSnapshots(snapshots);
  }

  function updateEnhancements(force){
    if (!$('page-aether')) return;
    injectPanel();
    const code = getRegionCode();
    const profile = computeRegionProfile(code);
    if (!force && code === lastRegion && profile.overall === lastOverall) return;
    renderBrief(profile);
    renderExplainability(profile);
    renderWatchlist();
    if (code !== lastRegion || force) {
      saveHistory({ ts: Date.now(), code, name: profile.name, score: profile.overall, dominant: profile.top[0]?.label || '', confidence: profile.confidence });
    }
    persistSnapshot(profile);
    lastRegion = code;
    lastOverall = profile.overall;
  }

  function boot(){
    if (initialized) return;
    initialized = true;
    injectPanel();
    updateEnhancements(true);
    $('region-sel')?.addEventListener('change', () => setTimeout(() => updateEnhancements(true), 80));
    $('shock-sim-btn')?.addEventListener('click', () => setTimeout(() => updateEnhancements(true), 140));
    ['analyze-btn','scenario-btn'].forEach(id => $(id)?.addEventListener('click', () => setTimeout(updateEnhancements, 220, true)));
    setInterval(() => updateEnhancements(false), 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.AetherEnhancements = { update:updateEnhancements, addCurrentRegion, renderWatchlist };
})();
