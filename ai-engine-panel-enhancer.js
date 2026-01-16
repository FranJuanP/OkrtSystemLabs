// ============================================
// AI ENGINE PRO - PANEL ENHANCER v1.0
// OkrtSystem Labs
// 
// Este script mejora automáticamente el panel
// AI ENGINE PRO con información más detallada
// 
// USO: Simplemente incluye este archivo después
// de cargar index.html
// ============================================

(function() {
  'use strict';
  
  const PANEL_ID = 'aiEnginePanel';
  let initialized = false;
  let updateCount = 0;
  
  // Nuevo HTML del panel mejorado
  const enhancedPanelHTML = `
    <div class="panel-head" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px;">
      <span>🧠 AI ENGINE PRO</span>
      <span id="aiVersion" style="font-size:8px; color:var(--text-dim);">v--</span>
    </div>
    <div style="padding:8px; font-family:var(--font-data); font-size:10px;">
      <!-- Status Row -->
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:var(--text-dim);">Status:</span>
        <span id="aiStatus" class="c-yellow">INIT...</span>
      </div>
      
      <!-- Current Prediction -->
      <div id="aiCurrentPrediction" style="background:rgba(0,212,255,0.1); border-radius:4px; padding:6px; margin:6px 0; border-left:3px solid var(--text-dim);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span id="aiDirection" style="font-weight:bold; font-size:12px; color:var(--text-dim);">⏳ ANALYZING</span>
          <span id="aiConfidence" style="font-size:11px; color:var(--text-dim);">--</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:9px; color:var(--text-dim);">
          <span>Regime: <span id="aiRegime">--</span></span>
          <span>Session: <span id="aiSession">--</span></span>
        </div>
      </div>
      
      <!-- Accuracy Bar -->
      <div style="margin:6px 0;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span style="color:var(--text-dim);">Accuracy:</span>
          <span id="aiAccuracy" class="c-cyan">0.0%</span>
        </div>
        <div style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
          <div id="aiAccuracyBar" style="height:100%; width:0%; background:linear-gradient(90deg, #ff4466, #f4b942, #00ff88); transition:width 0.5s;"></div>
        </div>
      </div>
      
      <!-- Stats Grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin:6px 0;">
        <div style="background:rgba(168,85,247,0.15); padding:4px 6px; border-radius:3px;">
          <div style="font-size:8px; color:var(--text-dim);">Patterns</div>
          <div id="aiPatterns" style="font-size:12px; font-weight:bold; color:#a855f7;">0</div>
        </div>
        <div style="background:rgba(0,212,255,0.1); padding:4px 6px; border-radius:3px;">
          <div style="font-size:8px; color:var(--text-dim);">Pending</div>
          <div id="aiPending" style="font-size:12px; font-weight:bold; color:#00d4ff;">0</div>
        </div>
        <div style="background:rgba(0,255,136,0.1); padding:4px 6px; border-radius:3px;">
          <div style="font-size:8px; color:var(--text-dim);">Total Preds</div>
          <div id="aiTotalPreds" style="font-size:12px; font-weight:bold; color:#00ff88;">0</div>
        </div>
        <div style="background:rgba(255,149,0,0.1); padding:4px 6px; border-radius:3px;">
          <div style="font-size:8px; color:var(--text-dim);">Win Rate</div>
          <div id="aiWinRate" style="font-size:12px; font-weight:bold; color:#ff9500;">--</div>
        </div>
      </div>
      
      <!-- Best Horizons -->
      <div style="margin-top:6px;">
        <div style="font-size:8px; color:var(--text-dim); margin-bottom:3px;">Best Horizons:</div>
        <div id="aiHorizonsGrid" style="display:flex; flex-wrap:wrap; gap:3px;">
          <span style="color:var(--text-dim); font-size:8px;">Collecting data...</span>
        </div>
      </div>
      
      <!-- Model Performance (collapsible) -->
      <details style="margin-top:6px;">
        <summary style="font-size:9px; color:var(--text-dim); cursor:pointer; user-select:none;">📊 Model Performance</summary>
        <div id="aiModelsGrid" style="margin-top:4px; display:grid; grid-template-columns:1fr 1fr; gap:2px; font-size:8px;">
        </div>
      </details>
      
      <!-- Last Completed Prediction -->
      <div id="aiLastCompleted" style="margin-top:6px; padding:4px; background:rgba(255,255,255,0.03); border-radius:3px; font-size:8px; display:none;">
        <span style="color:var(--text-dim);">Last:</span>
        <span id="aiLastResult">--</span>
      </div>
      
      <!-- Last Update -->
      <div style="margin-top:6px; display:flex; justify-content:space-between; font-size:8px; color:var(--text-dim);">
        <span>Updated: <span id="aiLastUpdate">--</span></span>
        <span id="aiUpdateCounter" style="opacity:0.5;">#0</span>
      </div>
    </div>
  `;
  
  // Encuentra y reemplaza el panel existente
  function upgradePanel() {
    // Buscar el panel existente por su contenido
    const panels = document.querySelectorAll('.panel');
    let targetPanel = null;
    
    for (const panel of panels) {
      const head = panel.querySelector('.panel-head');
      if (head && head.textContent.includes('AI ENGINE PRO')) {
        targetPanel = panel;
        break;
      }
    }
    
    if (targetPanel) {
      targetPanel.id = PANEL_ID;
      targetPanel.innerHTML = enhancedPanelHTML;
      console.log('[AI-PANEL] Panel upgraded successfully');
      return true;
    }
    
    return false;
  }
  
  // Función principal de actualización
  function updateAIEnginePanel() {
    updateCount++;
    
    // Intentar upgrade si no se ha hecho
    if (!initialized) {
      if (upgradePanel()) {
        initialized = true;
      } else {
        return; // Panel no encontrado aún
      }
    }
    
    // Check if AIEnginePro is ready
    if (!window.AIEnginePro || !window.AIEnginePro.isReady) {
      const statusEl = document.getElementById('aiStatus');
      if (statusEl) {
        statusEl.textContent = 'LOADING...';
        statusEl.style.color = '#f4b942';
      }
      return;
    }
    
    try {
      const stats = window.AIEnginePro.getStats();
      let currentPred = null;
      
      try {
        currentPred = window.AIEnginePro.getPrediction ? window.AIEnginePro.getPrediction() : null;
      } catch (e) {
        // getPrediction puede fallar si no hay datos
      }
      
      // Version
      const versionEl = document.getElementById('aiVersion');
      if (versionEl && window.AIEnginePro.version) {
        versionEl.textContent = 'v' + window.AIEnginePro.version;
      }
      
      // Status
      const statusEl = document.getElementById('aiStatus');
      if (statusEl) {
        const pending = stats.memory?.pending || 0;
        const patterns = stats.memory?.patterns || 0;
        if (pending > 0) {
          statusEl.textContent = `LEARNING (${pending})`;
          statusEl.style.color = '#00d4ff';
        } else if (patterns > 0) {
          statusEl.textContent = 'ACTIVE';
          statusEl.style.color = '#00ff88';
        } else {
          statusEl.textContent = 'READY';
          statusEl.style.color = '#00ff88';
        }
      }
      
      // Current Prediction Box
      const predBox = document.getElementById('aiCurrentPrediction');
      if (predBox && currentPred) {
        const dirEl = document.getElementById('aiDirection');
        const confEl = document.getElementById('aiConfidence');
        const regimeEl = document.getElementById('aiRegime');
        const sessionEl = document.getElementById('aiSession');
        
        if (dirEl) {
          const dir = currentPred.direction || 'NEUTRAL';
          dirEl.textContent = dir === 'BULL' ? '🟢 BULLISH' : dir === 'BEAR' ? '🔴 BEARISH' : '⚪ NEUTRAL';
          dirEl.style.color = dir === 'BULL' ? '#00ff88' : dir === 'BEAR' ? '#ff4466' : '#94a3b8';
        }
        
        if (confEl) {
          const conf = (currentPred.confidence || 0) * 100;
          confEl.textContent = conf.toFixed(1) + '%';
          confEl.style.color = conf >= 70 ? '#00ff88' : conf >= 55 ? '#00d4ff' : '#94a3b8';
        }
        
        if (regimeEl) {
          const regime = currentPred.regime || 'unknown';
          const regimeDisplay = {
            'trending_up': '📈 Trend↑',
            'trending_down': '📉 Trend↓',
            'ranging': '↔️ Range',
            'volatile': '⚡ Volatile'
          };
          regimeEl.textContent = regimeDisplay[regime] || regime;
        }
        
        if (sessionEl) {
          const session = currentPred.session || '--';
          const sessionDisplay = { 'ASIA': '🌏 Asia', 'EUROPE': '🌍 EU', 'US': '🌎 US' };
          sessionEl.textContent = sessionDisplay[session] || session;
        }
        
        // Update prediction box style based on direction
        const dir = currentPred.direction || 'NEUTRAL';
        if (dir === 'BULL') {
          predBox.style.background = 'rgba(0,255,136,0.1)';
          predBox.style.borderLeftColor = '#00ff88';
        } else if (dir === 'BEAR') {
          predBox.style.background = 'rgba(255,68,102,0.1)';
          predBox.style.borderLeftColor = '#ff4466';
        } else {
          predBox.style.background = 'rgba(0,212,255,0.1)';
          predBox.style.borderLeftColor = '#94a3b8';
        }
      }
      
      // Accuracy with bar
      const accEl = document.getElementById('aiAccuracy');
      const accBar = document.getElementById('aiAccuracyBar');
      if (accEl && stats.overall) {
        const acc = stats.overall.accuracy || 0;
        const accPct = (acc * 100).toFixed(1);
        accEl.textContent = accPct + '%';
        accEl.style.color = acc >= 0.55 ? '#00ff88' : acc >= 0.45 ? '#00d4ff' : '#ff4466';
        
        if (accBar) {
          accBar.style.width = Math.min(100, acc * 100) + '%';
        }
      }
      
      // Patterns
      const patEl = document.getElementById('aiPatterns');
      if (patEl && stats.memory) {
        patEl.textContent = stats.memory.patterns || 0;
      }
      
      // Pending
      const pendEl = document.getElementById('aiPending');
      if (pendEl && stats.memory) {
        const pending = stats.memory.pending || 0;
        pendEl.textContent = pending;
        pendEl.style.color = pending > 30 ? '#ff9500' : pending > 0 ? '#00d4ff' : '#94a3b8';
      }
      
      // Total Predictions
      const totalEl = document.getElementById('aiTotalPreds');
      if (totalEl && stats.overall) {
        totalEl.textContent = stats.overall.totalPredictions || 0;
      }
      
      // Win Rate
      const winEl = document.getElementById('aiWinRate');
      if (winEl && stats.overall) {
        const total = stats.overall.totalPredictions || 0;
        const correct = stats.overall.correctPredictions || 0;
        if (total > 0) {
          const rate = (correct / total * 100).toFixed(0);
          winEl.textContent = `${correct}/${total}`;
          winEl.style.color = rate >= 55 ? '#00ff88' : rate >= 45 ? '#f4b942' : '#ff4466';
        } else {
          winEl.textContent = '--';
        }
      }
      
      // Horizons Grid
      const horizonsGrid = document.getElementById('aiHorizonsGrid');
      if (horizonsGrid && stats.horizons) {
        let html = '';
        const sortedHorizons = Object.entries(stats.horizons)
          .filter(([h, d]) => d.total >= 2)
          .sort((a, b) => b[1].accuracy - a[1].accuracy);
        
        if (sortedHorizons.length === 0) {
          html = '<span style="color:#94a3b8; font-size:8px;">Collecting data...</span>';
        } else {
          sortedHorizons.slice(0, 4).forEach(([h, data]) => {
            const acc = (data.accuracy * 100).toFixed(0);
            const color = data.accuracy >= 0.55 ? '#00ff88' : 
                         data.accuracy >= 0.45 ? '#00d4ff' : '#ff4466';
            html += `<div style="background:rgba(255,255,255,0.05); padding:2px 5px; border-radius:3px; font-size:8px;">
              <span style="color:#94a3b8;">${h}m:</span>
              <span style="color:${color}; font-weight:bold;">${acc}%</span>
              <span style="color:#64748b; font-size:7px;">(${data.total})</span>
            </div>`;
          });
        }
        horizonsGrid.innerHTML = html;
      }
      
      // Models Grid
      const modelsGrid = document.getElementById('aiModelsGrid');
      if (modelsGrid && stats.models) {
        let html = '';
        for (const [name, data] of Object.entries(stats.models)) {
          const accStr = data.accuracy || '50.0%';
          const accNum = parseFloat(accStr);
          const color = accNum >= 55 ? '#00ff88' : accNum >= 45 ? '#94a3b8' : '#ff4466';
          const preds = data.predictions || 0;
          html += `<div style="display:flex; justify-content:space-between; padding:2px 4px; background:rgba(255,255,255,0.03); border-radius:2px;">
            <span style="color:#94a3b8; text-transform:capitalize;">${name}</span>
            <span style="color:${color};">${accStr}</span>
          </div>`;
        }
        modelsGrid.innerHTML = html;
      }
      
      // Last Completed
      const lastBox = document.getElementById('aiLastCompleted');
      const lastResult = document.getElementById('aiLastResult');
      if (lastBox && lastResult && window.AIEnginePro.predictions?.completed?.length > 0) {
        const last = window.AIEnginePro.predictions.completed[window.AIEnginePro.predictions.completed.length - 1];
        if (last && last.outcome) {
          lastBox.style.display = 'block';
          const success = last.outcome.success;
          const change = (last.outcome.avgPriceChange || 0).toFixed(3);
          lastResult.innerHTML = `<span style="color:${success ? '#00ff88' : '#ff4466'};">${success ? '✓' : '✗'}</span> ${change}%`;
        }
      }
      
      // Last Update
      const updateEl = document.getElementById('aiLastUpdate');
      if (updateEl) {
        const now = new Date();
        updateEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      
      // Update Counter
      const counterEl = document.getElementById('aiUpdateCounter');
      if (counterEl) {
        counterEl.textContent = '#' + updateCount;
      }
      
    } catch (e) {
      console.warn('[AI-PANEL] Update error:', e);
    }
  }
  
  // Iniciar cuando el DOM esté listo
  function init() {
    console.log('[AI-PANEL] Initializing enhanced panel...');
    
    // Intentar upgrade inmediatamente
    setTimeout(() => {
      upgradePanel();
      updateAIEnginePanel();
    }, 1000);
    
    // Actualizar cada 3 segundos
    setInterval(updateAIEnginePanel, 3000);
  }
  
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Exportar para debug
  window.AIEnginePanelEnhancer = {
    update: updateAIEnginePanel,
    upgrade: upgradePanel,
    getUpdateCount: () => updateCount
  };
  
  console.log('[AI-PANEL] AI Engine Panel Enhancer loaded');
})();
