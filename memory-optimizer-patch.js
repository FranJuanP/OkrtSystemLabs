/**
 * ORACULUM Memory Optimizer Patch v1.0
 * OkrtSystem Labs
 * 
 * PROPÓSITO: Solucionar congelamiento después de 1 hora de uso
 * SIN CAMBIAR la funcionalidad - solo optimización de recursos
 * 
 * INSTALACIÓN: Incluir este archivo DESPUÉS de index.html
 * O copiar el contenido dentro de un <script> al final del body
 */

(function() {
  'use strict';
  
  // Evitar doble inicialización
  if (window.__ORACULUM_MEMORY_OPTIMIZER__) return;
  window.__ORACULUM_MEMORY_OPTIMIZER__ = true;
  
  const TAG = '[MemOpt]';
  const CONFIG = {
    // Límites de arrays (más estrictos para larga duración)
    maxCandles: 150,           // Suficiente para análisis, no más
    maxPriceHistory: 100,
    maxRsiHistory: 100,
    maxPredictions: 50,
    maxPredictionHistory: 100,
    maxSignalHistory: 30,
    maxAlerts: 25,             // Alertas visibles en DOM
    maxWhaleTransactions: 50,
    maxCompletedPredictions: 100,
    maxPendingPredictions: 30,
    maxPatterns: 500,
    
    // Intervalos de limpieza
    cleanupIntervalMs: 60000,  // Cada 60 segundos
    deepCleanupIntervalMs: 300000, // Cada 5 minutos
    gcHintIntervalMs: 120000,  // Sugerir GC cada 2 minutos
    
    // Umbrales de memoria (MB)
    heapWarnMB: 150,
    heapCriticalMB: 250,
    
    // Throttling de updates DOM
    domUpdateThrottleMs: 100
  };
  
  // ============================================
  // 1. LIMPIEZA DE ARRAYS DEL STATE PRINCIPAL
  // ============================================
  function cleanStateArrays() {
    const state = window.state;
    if (!state) return;
    
    let cleaned = 0;
    
    // Candles
    if (state.candles && state.candles.length > CONFIG.maxCandles) {
      const excess = state.candles.length - CONFIG.maxCandles;
      state.candles.splice(0, excess);
      cleaned += excess;
    }
    
    // Price History
    if (state.priceHistory && state.priceHistory.length > CONFIG.maxPriceHistory) {
      const excess = state.priceHistory.length - CONFIG.maxPriceHistory;
      state.priceHistory.splice(0, excess);
      cleaned += excess;
    }
    
    // RSI History
    if (state.rsiHistory && state.rsiHistory.length > CONFIG.maxRsiHistory) {
      const excess = state.rsiHistory.length - CONFIG.maxRsiHistory;
      state.rsiHistory.splice(0, excess);
      cleaned += excess;
    }
    
    // Predictions
    if (state.predictions && state.predictions.length > CONFIG.maxPredictions) {
      const excess = state.predictions.length - CONFIG.maxPredictions;
      state.predictions.splice(0, excess);
      cleaned += excess;
    }
    
    // Prediction History
    if (state.predictionHistory && state.predictionHistory.length > CONFIG.maxPredictionHistory) {
      state.predictionHistory = state.predictionHistory.slice(-CONFIG.maxPredictionHistory);
      cleaned++;
    }
    
    // Export Data (puede crecer mucho)
    if (state.exportData && state.exportData.length > 500) {
      state.exportData = state.exportData.slice(-200);
      cleaned++;
    }
    
    // OBV History
    if (state.obvHistory && state.obvHistory.length > 50) {
      state.obvHistory = state.obvHistory.slice(-30);
      cleaned++;
    }
    
    // Whale Transactions (si existe)
    if (state.whaleTransactions && state.whaleTransactions.length > CONFIG.maxWhaleTransactions) {
      state.whaleTransactions = state.whaleTransactions.slice(-CONFIG.maxWhaleTransactions);
      cleaned++;
    }
    
    // Last Order Book (limpiar arrays internos muy grandes)
    if (state.lastOrderBook) {
      if (state.lastOrderBook.bids && state.lastOrderBook.bids.length > 25) {
        state.lastOrderBook.bids = state.lastOrderBook.bids.slice(0, 20);
      }
      if (state.lastOrderBook.asks && state.lastOrderBook.asks.length > 25) {
        state.lastOrderBook.asks = state.lastOrderBook.asks.slice(0, 20);
      }
    }
    
    return cleaned;
  }
  
  // ============================================
  // 2. LIMPIEZA DEL AI ENGINE PRO
  // ============================================
  function cleanAIEngine() {
    const AI = window.AIEnginePro || window.AIEngine;
    if (!AI) return 0;
    
    let cleaned = 0;
    
    try {
      // Completed predictions
      if (AI.predictions && AI.predictions.completed) {
        if (AI.predictions.completed.length > CONFIG.maxCompletedPredictions) {
          AI.predictions.completed = AI.predictions.completed.slice(-CONFIG.maxCompletedPredictions);
          cleaned++;
        }
      }
      
      // Pending predictions (importante: no eliminar demasiados)
      if (AI.predictions && AI.predictions.pending) {
        if (AI.predictions.pending.length > CONFIG.maxPendingPredictions) {
          // Mantener solo las más recientes
          AI.predictions.pending = AI.predictions.pending.slice(-CONFIG.maxPendingPredictions);
          cleaned++;
        }
      }
      
      // Patrones almacenados
      if (AI.patterns && AI.patterns.length > CONFIG.maxPatterns) {
        AI.patterns = AI.patterns.slice(-CONFIG.maxPatterns);
        cleaned++;
      }
      
      // Limpiar estructuras internas conocidas
      const keysToCheck = ['longTermPatterns', 'marketCycles', 'featureStats', 'calibrationSamples'];
      for (const key of keysToCheck) {
        if (AI[key] && Array.isArray(AI[key]) && AI[key].length > 200) {
          AI[key] = AI[key].slice(-150);
          cleaned++;
        }
      }
      
      // State interno
      if (AI.state) {
        for (const key of Object.keys(AI.state)) {
          if (Array.isArray(AI.state[key]) && AI.state[key].length > 300) {
            AI.state[key] = AI.state[key].slice(-200);
            cleaned++;
          }
        }
      }
    } catch (e) {
      // Ignorar errores - el código está ofuscado
    }
    
    return cleaned;
  }
  
  // ============================================
  // 3. LIMPIEZA DEL AI LEARNING SYSTEM
  // ============================================
  function cleanAILearning() {
    const AIL = window.AILearning;
    if (!AIL) return 0;
    
    let cleaned = 0;
    
    try {
      if (AIL.patterns && AIL.patterns.length > CONFIG.maxPatterns) {
        AIL.patterns = AIL.patterns.slice(-CONFIG.maxPatterns);
        cleaned++;
      }
      
      if (AIL.pendingPredictions && AIL.pendingPredictions.length > 30) {
        AIL.pendingPredictions = AIL.pendingPredictions.slice(-25);
        cleaned++;
      }
      
      if (AIL.completedPredictions && AIL.completedPredictions.length > 100) {
        AIL.completedPredictions = AIL.completedPredictions.slice(-80);
        cleaned++;
      }
    } catch (e) {}
    
    return cleaned;
  }
  
  // ============================================
  // 4. LIMPIEZA DE DOM (alertas, señales, etc)
  // ============================================
  function cleanDOM() {
    let cleaned = 0;
    
    // Limpiar contenedor de alertas
    const alertsContainer = document.getElementById('alertsContainer');
    if (alertsContainer && alertsContainer.children.length > CONFIG.maxAlerts) {
      while (alertsContainer.children.length > CONFIG.maxAlerts) {
        alertsContainer.lastChild.remove();
        cleaned++;
      }
    }
    
    // Limpiar historial de señales
    const signalList = document.getElementById('signalHistoryList');
    if (signalList && signalList.children.length > CONFIG.maxSignalHistory) {
      while (signalList.children.length > CONFIG.maxSignalHistory) {
        signalList.lastChild.remove();
        cleaned++;
      }
    }
    
    // Limpiar lista de whales
    const whaleList = document.getElementById('whaleList');
    if (whaleList && whaleList.children.length > 15) {
      while (whaleList.children.length > 10) {
        whaleList.lastChild.remove();
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  // ============================================
  // 5. LIMPIEZA DE GRÁFICOS (LightweightCharts)
  // ============================================
  function cleanCharts() {
    // LightweightCharts mantiene datos internos que pueden crecer
    // Intentar limpiar si el API lo permite
    try {
      if (window.chart && typeof window.chart.timeScale === 'function') {
        // Forzar recálculo de escala de tiempo
        const ts = window.chart.timeScale();
        if (ts && typeof ts.fitContent === 'function') {
          // Esto ayuda a liberar datos fuera de vista
          ts.fitContent();
        }
      }
    } catch (e) {}
  }
  
  // ============================================
  // 6. GESTIÓN DE MEMORIA
  // ============================================
  function getHeapMB() {
    try {
      if (performance && performance.memory) {
        return performance.memory.usedJSHeapSize / (1024 * 1024);
      }
    } catch (e) {}
    return null;
  }
  
  function suggestGC() {
    // Crear y destruir objetos grandes puede ayudar a triggear GC
    try {
      const temp = new Array(1000000);
      temp.fill(null);
      temp.length = 0;
    } catch (e) {}
  }
  
  // ============================================
  // 7. THROTTLING DE FUNCIONES FRECUENTES
  // ============================================
  const throttledFunctions = new Map();
  
  function throttle(fn, key, delay) {
    const lastCall = throttledFunctions.get(key) || 0;
    const now = Date.now();
    if (now - lastCall < delay) return false;
    throttledFunctions.set(key, now);
    return true;
  }
  
  // Patch de funciones que se llaman muy frecuentemente
  function patchFrequentFunctions() {
    // Patch updateOrderBook si existe
    if (typeof window.updateOrderBook === 'function' && !window.__updateOrderBook_patched) {
      const original = window.updateOrderBook;
      window.updateOrderBook = function(...args) {
        if (throttle(original, 'updateOrderBook', 200)) {
          return original.apply(this, args);
        }
      };
      window.__updateOrderBook_patched = true;
    }
    
    // Patch runPredictionEngine para que no corra en cada tick
    if (typeof window.runPredictionEngine === 'function' && !window.__runPredictionEngine_patched) {
      const original = window.runPredictionEngine;
      window.runPredictionEngine = function(...args) {
        if (throttle(original, 'runPredictionEngine', 1000)) {
          return original.apply(this, args);
        }
      };
      window.__runPredictionEngine_patched = true;
    }
  }
  
  // ============================================
  // 8. MONITOR DE INTERVALS
  // ============================================
  function countActiveIntervals() {
    if (typeof window._getActiveIntervals === 'function') {
      return window._getActiveIntervals().count;
    }
    return 'N/A';
  }
  
  // ============================================
  // 9. LIMPIEZA PRINCIPAL
  // ============================================
  function runCleanup(deep = false) {
    const startTime = Date.now();
    let totalCleaned = 0;
    
    totalCleaned += cleanStateArrays();
    totalCleaned += cleanAIEngine();
    totalCleaned += cleanAILearning();
    totalCleaned += cleanDOM();
    
    if (deep) {
      cleanCharts();
      suggestGC();
    }
    
    const heapMB = getHeapMB();
    const elapsed = Date.now() - startTime;
    
    // Solo loguear si se limpió algo significativo o hay problemas de memoria
    if (totalCleaned > 10 || (heapMB && heapMB > CONFIG.heapWarnMB)) {
      console.log(TAG, deep ? 'Deep cleanup:' : 'Cleanup:', 
        totalCleaned, 'items,',
        elapsed + 'ms,',
        'Heap:', heapMB ? heapMB.toFixed(1) + 'MB' : 'N/A',
        'Intervals:', countActiveIntervals()
      );
    }
    
    // Alerta crítica de memoria
    if (heapMB && heapMB > CONFIG.heapCriticalMB) {
      console.warn(TAG, '⚠️ MEMORIA CRÍTICA:', heapMB.toFixed(1), 'MB - Ejecutando limpieza de emergencia');
      runEmergencyCleanup();
    }
  }
  
  function runEmergencyCleanup() {
    // Reducir todos los límites temporalmente
    const state = window.state;
    if (state) {
      if (state.candles) state.candles = state.candles.slice(-100);
      if (state.predictions) state.predictions = state.predictions.slice(-30);
      if (state.priceHistory) state.priceHistory = state.priceHistory.slice(-50);
      if (state.rsiHistory) state.rsiHistory = state.rsiHistory.slice(-50);
    }
    
    const AI = window.AIEnginePro || window.AIEngine;
    if (AI && AI.predictions) {
      if (AI.predictions.completed) AI.predictions.completed = AI.predictions.completed.slice(-50);
    }
    
    // Limpiar DOM agresivamente
    const alertsContainer = document.getElementById('alertsContainer');
    if (alertsContainer) {
      while (alertsContainer.children.length > 10) {
        alertsContainer.lastChild.remove();
      }
    }
    
    // Forzar sugerencia de GC
    suggestGC();
    
    console.log(TAG, '🧹 Limpieza de emergencia completada');
  }
  
  // ============================================
  // 10. LIMPIEZA AL IR A BACKGROUND
  // ============================================
  function handleVisibilityChange() {
    if (document.hidden) {
      // Cuando la pestaña va a background, limpiar
      runCleanup(true);
    }
  }
  
  // ============================================
  // 11. INICIALIZACIÓN
  // ============================================
  function init() {
    console.log(TAG, 'Inicializando optimizador de memoria...');
    
    // Esperar a que el app cargue
    setTimeout(() => {
      // Patch de funciones frecuentes
      patchFrequentFunctions();
      
      // Cleanup regular (cada minuto)
      setInterval(() => runCleanup(false), CONFIG.cleanupIntervalMs);
      
      // Deep cleanup (cada 5 minutos)
      setInterval(() => runCleanup(true), CONFIG.deepCleanupIntervalMs);
      
      // Sugerencia de GC (cada 2 minutos)
      setInterval(suggestGC, CONFIG.gcHintIntervalMs);
      
      // Cleanup cuando va a background
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Primera limpieza después de 30 segundos
      setTimeout(() => runCleanup(false), 30000);
      
      console.log(TAG, '✅ Optimizador activo');
      console.log(TAG, 'Límites: candles=' + CONFIG.maxCandles + 
        ', predictions=' + CONFIG.maxPredictions +
        ', alerts=' + CONFIG.maxAlerts);
    }, 5000);
  }
  
  // Exponer para debug
  window.MemoryOptimizer = {
    runCleanup,
    runEmergencyCleanup,
    getHeapMB,
    getConfig: () => CONFIG,
    getStats: () => ({
      heap: getHeapMB(),
      intervals: countActiveIntervals(),
      candles: window.state?.candles?.length || 0,
      predictions: window.state?.predictions?.length || 0,
      aiPatterns: (window.AIEnginePro?.patterns || window.AILearning?.patterns || []).length
    })
  };
  
  // Iniciar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  console.log(TAG, 'Memory Optimizer Patch cargado');
})();
