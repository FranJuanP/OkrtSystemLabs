// ============================================
// 🧠 AI ENGINE PRO v1.6.0
// Advanced Self-Learning System for ORACULUM
// Copyright (c) 2025-2026 OkrtSystem Labs
// ============================================
// CHANGELOG v1.6.0:
// - FIX: Added price_momentum fallback feature for data-poor conditions
// - FIX: Ensemble now always generates direction (not stuck on NEUTRAL)
// - FIX: Auto-prediction every 1min with 5s startup
// - FIX: Detailed diagnostic logging
// - FIX: Lowered confidence threshold to 15% minimum
// CHANGELOG v1.5.0:
// - FIX: Lowered minConfidence to 0.30 for more predictions
// CHANGELOG v1.1.0:
// - FIX: byHorizon ahora incluye todos los horizontes (120, 240)
// - FIX: Feature extraction completo con mapeos para features derivados
// - FIX: Improved pattern similarity calculation
// - ADD: Debug logging mejorado
// - ADD: Feature validation on init
// ============================================

'use strict';

// BUILD: STEP3CALIB_FIX1_20260122

const AIEnginePro = {
  version: '1.6.9',
  isReady: false,
  db: null,
  
  // ============================================
  // 🎯 CONFIGURATION
  // ============================================
  config: {
    // Prediction horizons (minutes)
    horizons: [2, 5, 10, 15, 30, 60, 120, 240],
    
    // Minimum confidence to generate signal
    minConfidence: 0.30,
    
    // Ensemble voting threshold
    ensembleThreshold: 0.40,
    
    minHealthScore: 60, // Minimum feed health score (0-100) required for auto-prediction
    // Learning rates
    learningRate: 0.03,
    decayRate: 0.995,
    
    // Memory limits
    maxLongTermPatterns: 2000,
    maxMarketCycles: 100,
    
    // Auto-optimization interval (ms)
    optimizationInterval: 3600000, // 1 hour
    
    // Feature importance threshold
    featureThreshold: 0.1,

    // --- PRO enhancements ---
    minValidationsToLearn: 6,
    // Auto-prediction tuning: keep the engine real-time + stable
    // (avoid hours-long pending queues and a large number of long timers).
    autoMaxHorizon: 15,          

    // --- STEP3: Confidence calibration (safe, lightweight) ---
    calibration: {
      enabled: true,            // master switch
      applyToThreshold: false,  // keep decision thresholds on raw confidence (safer). Set true to use calibrated confidence for gating.
      minSamples: 30,           // do not calibrate until we have enough outcomes
      updateEvery: 10,          // refit temperature every N new outcomes per horizon
      maxSamples: 200,          // rolling buffer size per horizon
      tMin: 0.50,
      tMax: 3.00,
      tSteps: 26                // grid search steps between tMin..tMax
    },
// validate auto-predictions up to 15m
    minValidationsToLearnAuto: 4, // store learning after short horizons (2/5/10/15)
    maxPending: 25,              // guardrail for pending queue size
    sessionAware: true,
    volatilityAware: true,
    breakoutAware: true,
    
    // Debug mode
    debugMode: true
  },

  // ============================================
  // 🧠 ENSEMBLE MODELS
  // ============================================
  models: {
    momentum: {
      name: 'Momentum',
      weight: 1.0,
      accuracy: 0.5,
      features: ['rsi', 'stoch_rsi', 'momentum', 'rsi_divergence', 'price_momentum'],
      predictions: 0,
      correct: 0
    },
    trend: {
      name: 'Trend',
      weight: 1.0,
      accuracy: 0.5,
      features: ['ema_cross', 'macd', 'adx', 'supertrend', 'price_momentum'],
      predictions: 0,
      correct: 0
    },
    volume: {
      name: 'Volume',
      weight: 1.0,
      accuracy: 0.5,
      features: ['volume', 'obv', 'cvd', 'whale_flow'],
      predictions: 0,
      correct: 0
    },
    structure: {
      name: 'Structure',
      weight: 1.0,
      accuracy: 0.5,
      features: ['support_resistance', 'order_blocks', 'fvg', 'liquidity'],
      predictions: 0,
      correct: 0
    },
    patterns: {
      name: 'Patterns',
      weight: 1.0,
      accuracy: 0.5,
      features: ['candlestick_patterns', 'chart_patterns', 'divergences', 'price_momentum'],
      predictions: 0,
      correct: 0
    },
    mtf: {
      name: 'MTF',
      weight: 1.2,
      accuracy: 0.5,
      features: ['mtf_1m', 'mtf_5m', 'mtf_15m', 'mtf_1h', 'mtf_4h'],
      predictions: 0,
      correct: 0
    }
  },

  // ============================================
  // 📊 FEATURE ENGINEERING
  // ============================================
  features: {
    // Derived features with importance weights
    derived: {
      rsi_momentum: { weight: 1.0, formula: 'rsi_change_rate' },
      macd_acceleration: { weight: 1.0, formula: 'macd_histogram_change' },
      volume_trend: { weight: 1.0, formula: 'volume_ma_ratio' },
      volatility_regime: { weight: 1.0, formula: 'atr_percentile' },
      whale_pressure: { weight: 1.2, formula: 'whale_buy_sell_ratio' },
      order_imbalance: { weight: 1.1, formula: 'bid_ask_imbalance' },
      mtf_alignment: { weight: 1.3, formula: 'timeframe_confluence' },
      trend_strength: { weight: 1.0, formula: 'adx_slope' },
      momentum_divergence: { weight: 1.2, formula: 'price_rsi_divergence' },
      liquidity_zones: { weight: 1.1, formula: 'nearby_liquidity' }
    },
    
    // Feature statistics for normalization
    stats: {}
  },

  // ============================================
  // 🔮 PREDICTION SYSTEM
  // ============================================
  predictions: {
    pending: [],
    completed: [],
    // FIX: Ahora incluye TODOS los horizontes configurados
    byHorizon: {
      2: { total: 0, correct: 0, accuracy: 0.5 },
      5: { total: 0, correct: 0, accuracy: 0.5 },
      10: { total: 0, correct: 0, accuracy: 0.5 },
      15: { total: 0, correct: 0, accuracy: 0.5 },
      30: { total: 0, correct: 0, accuracy: 0.5 },
      60: { total: 0, correct: 0, accuracy: 0.5 },
      120: { total: 0, correct: 0, accuracy: 0.5 },  // FIX: Añadido
      240: { total: 0, correct: 0, accuracy: 0.5 }   // FIX: Añadido
    }
  },

  // ============================================
  // 💾 LONG-TERM MEMORY
  // ============================================
  memory: {
    patterns: [],
    marketCycles: [],
    correlations: {},
    regimeHistory: [],
    significantEvents: []
  },

  // ============================================
  // 📈 PERFORMANCE TRACKING
  // ============================================
  performance: {
    daily: {},
    weekly: {},
    overall: {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      profitFactor: 1.0,
      sharpeRatio: 0,
      maxDrawdown: 0
    },
    // STEP2: Outcome scoreboard (rolling, lightweight)
    scoreboard: {
      overall: { n: 0, win: 0, brier: 0, confAvg: 0 },
      byHorizon: {}
    },
    // STEP3: Calibration state (temperature scaling per horizon)
    calibration: {
      byHorizon: {},
      // reliability bins: 10 bins [0-0.1),...,[0.9-1.0]
      bins: {}
    }
  },

  // ============================================
  // 🚀 INITIALIZATION
  // ============================================
  async init() {
    console.log('[AI-PRO] Initializing AI Engine PRO v' + this.version + ' with Auto-Prediction');
    
    // Wait for base AILearning to be ready
    let attempts = 0;
    while (!window.AILearning?.isInitialized && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    
    if (!window.AILearning?.isInitialized) {
      console.error('[AI-PRO] Base AILearning not ready');
      return false;
    }
    
    // Get Firestore reference from AILearning
    this.db = window.AILearning.db;
    
    if (!this.db) {
      console.warn('[AI-PRO] Firestore not available, using local mode');
    }
    
    // Initialize byHorizon for all configured horizons
    this.initializeHorizons();
    
    // Validate feature mappings
    this.validateFeatures();
    
    // Load saved state
    await this.loadState();

    // STEP2: ensure scoreboard structures exist (safe after load)
    this._ensureScoreboard();
    
    // Start optimization loop
    this.startOptimizationLoop();
    
    // Hook into AILearning
    this.hookIntoBase();
    
    // Start auto-prediction loop
    this.startAutoPrediction();
    
    // Initialize session tracking
    this._sessionStart = Date.now();
    this._sessionPredictions = 0;
    this._lastPredictionTime = null;
    this._lastVerification = null;
    
    this.isReady = true;
    console.log('[AI-PRO] ✓ AI Engine PRO ready');
    console.log('[AI-PRO] Models:', Object.keys(this.models).length);
    console.log('[AI-PRO] Features:', Object.keys(this.features.derived).length);
    console.log('[AI-PRO] Horizons:', this.config.horizons.join(', ') + ' min');
    console.log('[AI-PRO] Min confidence:', (this.config.minConfidence * 100) + '%');
    console.log('[AI-PRO] Ensemble threshold:', (this.config.ensembleThreshold * 100) + '%');
    
    // Check available state data
    setTimeout(() => {
      const s = window.state || {};
      console.log('[AI-PRO] 📊 State check:', {
        price: s.price,
        hasIndicators: !!s.indicators,
        indicatorCount: Object.keys(s.indicators || {}).length,
        indicatorSample: Object.keys(s.indicators || {}).slice(0, 8)
      });
    }, 3000);
    
    return true;
  },

  // ============================================
  // 🔧 INITIALIZE HORIZONS (NEW)
  // ============================================
  initializeHorizons() {
    // Ensure all configured horizons have stats objects
    for (const h of this.config.horizons) {
      if (!this.predictions.byHorizon[h]) {
        this.predictions.byHorizon[h] = { total: 0, correct: 0, accuracy: 0.5 };
        console.log(`[AI-PRO] Initialized horizon: ${h}min`);
      }
    }
  },

  // ============================================
  // 🧾 STEP2: SCOREBOARD INIT
  // ============================================
  _ensureScoreboard() {
    if (!this.performance) this.performance = {};
    if (!this.performance.scoreboard) {
      this.performance.scoreboard = { overall: { n: 0, win: 0, brier: 0, confAvg: 0 },

  // ============================================
  // 🎛️ STEP3: CONFIDENCE CALIBRATION (Temperature scaling)
  // ============================================
  _ensureCalibration() {
    if (!this.performance) this.performance = {};
    if (!this.performance.calibration) this.performance.calibration = { byHorizon: {}, bins: {} };
    if (!this.performance.calibration.byHorizon) this.performance.calibration.byHorizon = {};
    if (!this.performance.calibration.bins) this.performance.calibration.bins = {};
    for (const h of (this.config?.horizons || [15])) {
      if (!this.performance.calibration.byHorizon[h]) {
        this.performance.calibration.byHorizon[h] = { T: 1.0, n: 0, newSinceFit: 0, samples: [] };
      }
      if (!this.performance.calibration.bins[h]) {
        this.performance.calibration.bins[h] = Array.from({length: 10}, () => ({ n: 0, win: 0, confSum: 0 }));
      }
    }
  },

  _logit(p) {
    const eps = 1e-6;
    const x = Math.min(1 - eps, Math.max(eps, Number(p)));
    return Math.log(x / (1 - x));
  },

  _sigmoid(z) {
    // numerically stable sigmoid
    if (z >= 0) {
      const ez = Math.exp(-z);
      return 1 / (1 + ez);
    } else {
      const ez = Math.exp(z);
      return ez / (1 + ez);
    }
  },

  _calibrateProb(pRaw, horizon) {
    const cfg = this.config?.calibration || {};
    if (!cfg.enabled) return pRaw;
    this._ensureCalibration();
    const h = Number(horizon);
    const cal = this.performance.calibration.byHorizon[h];
    if (!cal || !Number.isFinite(cal.T) || cal.T <= 0) return pRaw;
    if (cal.n < (cfg.minSamples || 30)) return pRaw;
    const z = this._logit(pRaw) / cal.T;
    return this._sigmoid(z);
  },

  _fitTemperature(samples, cfg) {
    // samples: array of {p,y}, with p in [0,1] and y in {0,1}
    const tMin = cfg.tMin ?? 0.5;
    const tMax = cfg.tMax ?? 3.0;
    const steps = Math.max(6, cfg.tSteps ?? 26);
    const eps = 1e-6;

    let bestT = 1.0;
    let bestNLL = Infinity;

    for (let i = 0; i < steps; i++) {
      const T = tMin + (tMax - tMin) * (i / (steps - 1));
      let nll = 0;
      for (const s of samples) {
        const p = Math.min(1 - eps, Math.max(eps, Number(s.p)));
        const y = s.y ? 1 : 0;
        const pCal = this._sigmoid(this._logit(p) / T);
        nll += -(y * Math.log(pCal) + (1 - y) * Math.log(1 - pCal));
      }
      if (nll < bestNLL) { bestNLL = nll; bestT = T; }
    }
    return { T: bestT, nll: bestNLL };
  },

  _updateCalibrationWithOutcome(horizon, pRaw, y) {
    const cfg = this.config?.calibration || {};
    if (!cfg.enabled) return;

    this._ensureCalibration();
    const h = Number(horizon);
    const cal = this.performance.calibration.byHorizon[h];
    if (!cal) return;

    const p = Number.isFinite(pRaw) ? Math.max(0, Math.min(1, pRaw)) : 0.5;
    const yy = y ? 1 : 0;

    // rolling samples
    cal.samples.push({ p, y: yy });
    if (cal.samples.length > (cfg.maxSamples || 200)) cal.samples.shift();
    cal.n += 1;
    cal.newSinceFit = (cal.newSinceFit || 0) + 1;

    // bins for reliability snapshot
    const bi = Math.min(9, Math.max(0, Math.floor(p * 10)));
    const bin = this.performance.calibration.bins[h][bi];
    bin.n += 1;
    bin.win += yy;
    bin.confSum += p;

    if (cal.samples.length >= (cfg.minSamples || 30) && cal.newSinceFit >= (cfg.updateEvery || 10)) {
      const fit = this._fitTemperature(cal.samples, cfg);
      const prev = cal.T;
      cal.T = fit.T;
      cal.newSinceFit = 0;

      // Light log (no spam)
      try {
        console.log(`[AI-PRO][CAL] Horizon ${h}m: T=${prev.toFixed(2)}→${cal.T.toFixed(2)} | n=${cal.samples.length}`);
      } catch(e){}
    }
  },
 byHorizon: {} };
    }
    if (!this.performance.scoreboard.overall) {
      this.performance.scoreboard.overall = { n: 0, win: 0, brier: 0, confAvg: 0 };
    }
    if (!this.performance.scoreboard.byHorizon) {
      this.performance.scoreboard.byHorizon = {};
    }
    for (const h of (this.config?.horizons || [])) {
      if (!this.performance.scoreboard.byHorizon[h]) {
        this.performance.scoreboard.byHorizon[h] = { n: 0, win: 0, brier: 0, confAvg: 0 };
      }
    }
  },


  // ============================================
  // ✅ VALIDATE FEATURES (NEW)
  // ============================================
  validateFeatures() {
    const allFeatures = new Set();
    
    // Collect all features from models
    for (const model of Object.values(this.models)) {
      model.features.forEach(f => allFeatures.add(f));
    }
    
    // Collect derived features
    Object.keys(this.features.derived).forEach(f => allFeatures.add(f));
    
    // Check which features have mappings
    const mapped = [];
    const unmapped = [];
    
    for (const feature of allFeatures) {
      if (this.hasFeatureMapping(feature)) {
        mapped.push(feature);
      } else {
        unmapped.push(feature);
      }
    }
    
    if (this.config.debugMode) {
      console.log(`[AI-PRO] Features mapped: ${mapped.length}/${allFeatures.size}`);
      if (unmapped.length > 0) {
        console.warn('[AI-PRO] Unmapped features:', unmapped.join(', '));
      }
    }
  },

  hasFeatureMapping(feature) {
    const mappedFeatures = [
      'rsi', 'stoch_rsi', 'momentum', 'rsi_divergence',
      'price_momentum',
      'ema_cross', 'macd', 'adx', 'supertrend',
      'volume', 'obv', 'cvd', 'whale_flow',
      'support_resistance', 'order_blocks', 'fvg', 'liquidity',
      'candlestick_patterns', 'chart_patterns', 'divergences',
      'mtf_1m', 'mtf_5m', 'mtf_15m', 'mtf_1h', 'mtf_4h',
      // Derived features (NEW mappings)
      'rsi_momentum', 'macd_acceleration', 'volume_trend',
      'volatility_regime', 'whale_pressure', 'order_imbalance',
      'mtf_alignment', 'trend_strength', 'momentum_divergence', 'liquidity_zones'
    ];
    return mappedFeatures.includes(feature);
  },

  // ============================================
  // 🔗 HOOK INTO BASE AILEARNING
  // ============================================
  hookIntoBase() {
    const originalRecordPrediction = window.AILearning.recordPrediction.bind(window.AILearning);
    const originalComplete = window.AILearning.complete.bind(window.AILearning);
    
    window.AILearning.recordPrediction = (pred) => {
      const id = originalRecordPrediction(pred);
      this.recordProPrediction(pred, id);
      return id;
    };
    
    window.AILearning.complete = (p) => {
      originalComplete(p);
      this.updateProModels(p);
    };
    
    console.log('[AI-PRO] Hooked into base AILearning');
  },

  // ============================================
  // 🎯 ENSEMBLE PREDICTION
  // ============================================
  generateEnsemblePrediction(marketState) {
    const votes = { BULL: 0, BEAR: 0, NEUTRAL: 0 };
    const modelPredictions = {};
    let totalWeight = 0;
    
    for (const [modelName, model] of Object.entries(this.models)) {
      const prediction = this.getModelPrediction(modelName, model, marketState);
      modelPredictions[modelName] = prediction;
      
      const weight = model.weight * model.accuracy;
      votes[prediction.direction] += weight * prediction.confidence;
      totalWeight += weight;
    }
    
    // Normalize votes
    for (const dir of Object.keys(votes)) {
      votes[dir] = totalWeight > 0 ? votes[dir] / totalWeight : 0.33;
    }
    
    // Determine consensus - siempre elegir una dirección
    let direction = 'NEUTRAL';
    let confidence = 0.35; // Base confidence
    
    // Encontrar la dirección con más votos
    const maxVote = Math.max(votes.BULL, votes.BEAR, votes.NEUTRAL);
    
    if (votes.BULL >= votes.BEAR && votes.BULL >= votes.NEUTRAL * 0.8) {
      direction = 'BULL';
      confidence = 0.35 + votes.BULL * 0.6;
    } else if (votes.BEAR >= votes.BULL && votes.BEAR >= votes.NEUTRAL * 0.8) {
      direction = 'BEAR';
      confidence = 0.35 + votes.BEAR * 0.6;
    } else {
      // Neutral pero con algo de confianza
      confidence = 0.30 + maxVote * 0.3;
    }
    
    // Context multipliers
    const session = this.config.sessionAware ? this.getSessionContext() : null;
    const volScore = this.config.volatilityAware ? this.getVolatilityScore(marketState) : null;
    const volMultiplier = (volScore != null) ? this.getVolatilityConfidenceMultiplier(volScore) : 1.0;
    const breakout = this.config.breakoutAware ? this.detectBreakoutContext(marketState) : null;
    const regime = this.detectMarketRegime(marketState);
    const regimeMultiplier = this.getRegimeConfidenceMultiplier(regime);
    
    confidence *= regimeMultiplier;
    if (session) confidence *= this.getSessionConfidenceMultiplier(session);
    confidence *= volMultiplier;
    if (breakout && breakout.classification === 'FAKE_BREAKOUT_RISK') confidence *= 0.92;
    
    // Check pattern memory
    const patternMatch = this.queryLongTermMemory(marketState);
    if (patternMatch.found) {
      confidence = (confidence + patternMatch.confidence) / 2;
      if (patternMatch.direction !== direction && patternMatch.confidence > 0.7) {
        confidence *= 0.85;
      }
    }
    
    // Garantizar mínimo de confianza para que pase el threshold
    confidence = Math.max(0.20, Math.min(0.95, confidence));
    

    // STEP3: confidence calibration (display-only by default)
    const _hForCal = Number(this.config?.autoMaxHorizon || 15);
    const _confRaw = Number.isFinite(confidence) ? confidence : 0.5;
    const _confCal = this._calibrateProb(_confRaw, _hForCal);

    // expose both; keep raw for thresholds unless configured otherwise
    const _applyCal = !!(this.config?.calibration?.applyToThreshold);
    const _confFinal = _applyCal ? _confCal : _confRaw;
    confidence = _confFinal;

    // ============================================
    // STEP 4 (MICRO + OBV DIVERGENCE) — NEUTRAL TIEBREAKER
    // - No UI changes
    // - Lightweight, guarded
    // ============================================
    try {
      const _thr = (typeof threshold === 'number') ? threshold : (this.config?.minConfidence ?? 0.30);
      const _confWindow = (confidence >= _thr && confidence <= 0.55);

      // Market microstructure (already supported by feature map)
      const _imb = this.getFeatureValue('order_imbalance', marketState) || 0; // [-1..1]
      if (!this._micro) this._micro = { lastImb: _imb, lastTs: 0 };
      const _dImb = (_imb - (this._micro.lastImb ?? _imb));
      this._micro.lastImb = _imb;

      // OBV divergence (computed from candles, independent from discrete obv.signal)
      const _candles = this._candlesFromState(marketState) || [];
      let _div = 0; // [-1..1]
      if (_candles.length >= 25) {
        const closes = _candles.map(c => this._getCandleClose(c)).filter(Number.isFinite);
        const vols = _candles.map(c => this._getCandleVol(c)).filter(Number.isFinite);
        const n = Math.min(closes.length, vols.length, 60);
        const w = 14;

        if (n >= w + 2) {
          const cSlice = closes.slice(-n);
          const vSlice = vols.slice(-n);

          let obv = 0;
          const obvSeries = [];
          for (let i = 1; i < cSlice.length; i++) {
            const dc = cSlice[i] - cSlice[i - 1];
            const v = vSlice[i] || 0;
            if (dc > 0) obv += v;
            else if (dc < 0) obv -= v;
            obvSeries.push(obv);
          }

          // simple slope via last-first / w
          const priceSlope = (cSlice[cSlice.length - 1] - cSlice[cSlice.length - 1 - w]) / (Math.abs(cSlice[cSlice.length - 1 - w]) || 1);
          const obvSlope = (obvSeries[obvSeries.length - 1] - obvSeries[obvSeries.length - 1 - w]) / (Math.abs(obvSeries[obvSeries.length - 1 - w]) || 1);

          // divergence: price down & obv up => bullish; price up & obv down => bearish
          if (priceSlope < -0.001 && obvSlope > 0.001) _div = Math.min(1, (Math.abs(priceSlope) + Math.abs(obvSlope)) * 2);
          else if (priceSlope > 0.001 && obvSlope < -0.001) _div = -Math.min(1, (Math.abs(priceSlope) + Math.abs(obvSlope)) * 2);
        }
      }

      // Combined score (prioritize micro imbalance; divergence adds confirmation)
      const _microScore = (0.65 * _imb) + (0.35 * _div);

      // Apply only when confidence is in mid band or NEUTRAL (avoid destabilizing strong signals)
      if (direction === 'NEUTRAL' && ((confidence >= 0.22 && confidence <= 0.65) || _confWindow)) {
        const _gate = 0.14;
        const _boostBase = 0.10;
        const _boostVar = 0.18;
        if (_microScore >= _gate) {
          direction = 'BULL';
          confidence = Math.min(0.95, confidence + _boostBase + Math.min(0.12, _microScore * _boostVar) + Math.max(0, _dImb) * 0.05);
        } else if (_microScore <= -_gate) {
          direction = 'BEAR';
          confidence = Math.min(0.95, confidence + _boostBase + Math.min(0.12, Math.abs(_microScore) * _boostVar) + Math.max(0, -_dImb) * 0.05);
        }
      } else if (direction === 'BULL' && _microScore < -0.30) {
        // Contradiction damping (do not flip aggressively)
        confidence = Math.max(0.05, confidence - 0.08);
      } else if (direction === 'BEAR' && _microScore > 0.30) {
        confidence = Math.max(0.05, confidence - 0.08);
      }
    } catch (e) {
      // Never break core engine
    }

    return {
      direction,
      confidence,
      confidenceRaw: _confRaw,
      confidenceCal: _confCal,
      votes,
      modelPredictions,
      regime,
      patternMatch,
      session,
      volScore,
      breakout,
      timestamp: Date.now()
    };
  },

  // ============================================
  // 🧠 INDIVIDUAL MODEL PREDICTION
  // ============================================
  getModelPrediction(modelName, model, marketState) {
    let bullScore = 0;
    let bearScore = 0;
    let featureCount = 0;
    
    for (const feature of model.features) {
      const value = this.getFeatureValue(feature, marketState);
      if (value === null || value === undefined) continue;
      
      const weight = window.AILearning?.getWeight?.(feature) || 1.0;
      
      if (value > 0) {
        bullScore += value * weight;
      } else if (value < 0) {
        bearScore += Math.abs(value) * weight;
      }
      featureCount++;
    }
    
    // Si no hay features, usar price_momentum como fallback
    if (featureCount === 0) {
      const priceMom = this.getFeatureValue('price_momentum', marketState) || 0;
      if (priceMom > 0.01) {
        return { direction: 'BULL', confidence: 0.4 + priceMom * 0.3, featureCount: 1 };
      } else if (priceMom < -0.01) {
        return { direction: 'BEAR', confidence: 0.4 + Math.abs(priceMom) * 0.3, featureCount: 1 };
      }
      return { direction: 'NEUTRAL', confidence: 0.35, featureCount: 0 };
    }
    
    const total = bullScore + bearScore;
    if (total === 0) {
      return { direction: 'NEUTRAL', confidence: 0.4, featureCount };
    }
    
    const bullProb = bullScore / total;
    const bearProb = bearScore / total;
    
    let direction = 'NEUTRAL';
    let confidence = 0.4;
    
    if (bullProb > 0.52) {
      direction = 'BULL';
      confidence = 0.4 + (bullProb - 0.5) * 1.2;
    } else if (bearProb > 0.52) {
      direction = 'BEAR';
      confidence = 0.4 + (bearProb - 0.5) * 1.2;
    }
    
    return { direction, confidence: Math.min(0.95, confidence), featureCount };
  },

  // ============================================
  // 📊 FEATURE EXTRACTION (FIXED & EXTENDED)
  // ============================================
  getFeatureValue(feature, marketState) {
    const indicators = marketState.indicators || {};
    const s = marketState;
    
    const featureMap = {
      // ============ MOMENTUM ============
      'rsi': () => {
        const rsi = indicators.rsi?.value ?? indicators.rsi ?? 50;
        return (rsi - 50) / 50;
      },
      'stoch_rsi': () => {
        const stoch = indicators.stochRsi?.value ?? indicators.stochRsi ?? 50;
        return (stoch - 50) / 50;
      },
      'momentum': () => {
        const m = indicators.momentum;
        if (!m) return 0;
        return m.signal === 'bull' ? 1 : m.signal === 'bear' ? -1 : 0;
      },
      'rsi_divergence': () => {
        const div = indicators.divergence || s.divergence;
        if (!div) return 0;
        return div.type === 'bullish' ? 1 : div.type === 'bearish' ? -1 : 0;
      },
      
      // ============ TREND ============
      'ema_cross': () => {
        const ema = indicators.ema;
        if (!ema) return 0;
        return ema.signal === 'bull' ? 1 : ema.signal === 'bear' ? -1 : 0;
      },
      'macd': () => {
        const macd = indicators.macd;
        if (!macd) return 0;
        const hist = macd.histogram ?? macd.hist ?? 0;
        return hist > 0 ? Math.min(1, hist * 10) : Math.max(-1, hist * 10);
      },
      'adx': () => {
        const adx = indicators.adx;
        if (!adx) return 0;
        const value = adx.value ?? adx.adx ?? 20;
        const strength = value > 25 ? 1 : 0.5;
        return adx.trend === 'bull' ? strength : adx.trend === 'bear' ? -strength : 0;
      },
      'supertrend': () => {
        const st = indicators.supertrend;
        if (!st) return 0;
        return st.signal === 'bull' ? 1 : st.signal === 'bear' ? -1 : 0;
      },
      
      // ============ VOLUME ============
      'volume': () => {
        const vol = s.volume || {};
        if (vol.trend === 'increasing') return 0.5;
        if (vol.trend === 'decreasing') return -0.5;
        return 0;
      },
      'obv': () => {
        const obv = indicators.obv;
        if (!obv) return 0;
        return obv.signal === 'bull' ? 1 : obv.signal === 'bear' ? -1 : 0;
      },
      'cvd': () => {
        const cvd = s.cvd ?? 0;
        return Math.tanh(cvd / 1000000);
      },
      'whale_flow': () => {
        const whales = s.whaleFlow || { buy: 0, sell: 0 };
        const net = (whales.buy || 0) - (whales.sell || 0);
        return Math.tanh(net / 100000);
      },
      
      // ============ STRUCTURE ============
      'support_resistance': () => {
        const sr = s.supportResistance || {};
        if (sr.nearSupport) return 0.7;
        if (sr.nearResistance) return -0.7;
        return 0;
      },
      'order_blocks': () => {
        const ob = s.orderBlocks || {};
        return ob.bullish ? 0.5 : ob.bearish ? -0.5 : 0;
      },
      'fvg': () => {
        const fvg = s.fvg || {};
        return fvg.bullish ? 0.3 : fvg.bearish ? -0.3 : 0;
      },
      'liquidity': () => {
        const liq = s.liquidity || {};
        const buy = liq.buyLiquidity || liq.buy || 0;
        const sell = liq.sellLiquidity || liq.sell || 0;
        if (buy === 0 && sell === 0) return 0;
        return buy > sell ? 0.4 : -0.4;
      },
      
      // ============ PATTERNS ============
      'candlestick_patterns': () => {
        const patterns = s.patterns || [];
        let score = 0;
        patterns.forEach(p => {
          if (p.type === 'bullish' || p.bias === 'bullish') score += 0.3;
          if (p.type === 'bearish' || p.bias === 'bearish') score -= 0.3;
        });
        return Math.max(-1, Math.min(1, score));
      },
      'chart_patterns': () => {
        const pattern = s.chartPattern;
        if (!pattern) return 0;
        return pattern.bias === 'bullish' ? 0.6 : pattern.bias === 'bearish' ? -0.6 : 0;
      },
      'divergences': () => {
        const div = s.divergence || indicators.divergence;
        if (!div) return 0;
        return div.type === 'bullish' ? 0.8 : div.type === 'bearish' ? -0.8 : 0;
      },
      
      // ============ MULTI-TIMEFRAME ============
      'mtf_1m': () => this.getMTFValue(s, '1m'),
      'mtf_5m': () => this.getMTFValue(s, '5m'),
      'mtf_15m': () => this.getMTFValue(s, '15m'),
      'mtf_1h': () => this.getMTFValue(s, '1h'),
      'mtf_4h': () => this.getMTFValue(s, '4h'),
      
      // ============ DERIVED FEATURES (NEW) ============
      'rsi_momentum': () => {
        // Rate of change in RSI
        const rsi = indicators.rsi?.value ?? 50;
        const prevRsi = indicators.rsi?.prev ?? rsi;
        return Math.tanh((rsi - prevRsi) / 10);
      },
      'macd_acceleration': () => {
        // Change in MACD histogram
        const macd = indicators.macd;
        if (!macd) return 0;
        const hist = macd.histogram ?? 0;
        const prevHist = macd.prevHistogram ?? hist;
        return Math.tanh((hist - prevHist) * 20);
      },
      'volume_trend': () => {
        // Volume relative to MA
        const vol = s.volume || {};
        const ratio = vol.ratio ?? vol.volumeRatio ?? 1;
        return Math.tanh((ratio - 1) * 2);
      },
      'volatility_regime': () => {
        // ATR percentile
        const atr = s.atr ?? 0;
        const atrAvg = s.atrAvg ?? atr;
        if (atrAvg === 0) return 0;
        return Math.tanh((atr / atrAvg - 1) * 2);
      },
      'whale_pressure': () => {
        // Net whale flow normalized
        const whales = s.whaleFlow || { buy: 0, sell: 0 };
        const net = (whales.buy || 0) - (whales.sell || 0);
        const total = (whales.buy || 0) + (whales.sell || 0);
        if (total === 0) return 0;
        return net / total;
      },
      'order_imbalance': () => {
        // Bid/ask imbalance from orderbook
        const ob = s.orderbook || s.depth || {};
        const bidVol = ob.bidVolume ?? ob.bids ?? 0;
        const askVol = ob.askVolume ?? ob.asks ?? 0;
        const total = bidVol + askVol;
        if (total === 0) return 0;
        return (bidVol - askVol) / total;
      },
      'mtf_alignment': () => {
        // Confluence across timeframes
        const mtf = s.mtf || {};
        let bullCount = 0, bearCount = 0, total = 0;
        for (const tf of ['1m', '5m', '15m', '1h', '4h']) {
          const signal = mtf[tf]?.signal;
          if (signal === 'bull') { bullCount++; total++; }
          else if (signal === 'bear') { bearCount++; total++; }
          else if (signal) { total++; }
        }
        if (total === 0) return 0;
        return (bullCount - bearCount) / total;
      },
      'trend_strength': () => {
        // ADX slope/momentum
        const adx = indicators.adx;
        if (!adx) return 0;
        const value = adx.value ?? 20;
        const prevValue = adx.prev ?? value;
        const slope = (value - prevValue) / 10;
        const dir = adx.trend === 'bull' ? 1 : adx.trend === 'bear' ? -1 : 0;
        return dir * Math.min(1, (value / 40)) * (1 + slope);
      },
      'momentum_divergence': () => {
        // Price vs RSI divergence detection
        const div = s.divergence || indicators.divergence;
        if (div) {
          return div.type === 'bullish' ? 0.9 : div.type === 'bearish' ? -0.9 : 0;
        }
        // Fallback: simple check
        const rsi = indicators.rsi?.value ?? 50;
        const price = s.price ?? 0;
        const prevPrice = s.prevPrice ?? price;
        if (price > prevPrice && rsi < 40) return 0.5; // Hidden bullish
        if (price < prevPrice && rsi > 60) return -0.5; // Hidden bearish
        return 0;
      },
      'liquidity_zones': () => {
        // Distance to nearby liquidity
        const liq = s.liquidity || {};
        const nearBuy = liq.nearBuyZone ?? false;
        const nearSell = liq.nearSellZone ?? false;
        if (nearBuy && !nearSell) return 0.6;
        if (nearSell && !nearBuy) return -0.6;
        return 0;
      }
    };
    
    // EMERGENCY FEATURE: Always generates something based on price movement
    if (feature === 'price_momentum') {
      const price = s.price || 0;
      const prevPrice = s.prevPrice || price;
      if (price > 0 && prevPrice > 0) {
        const change = (price - prevPrice) / prevPrice;
        return Math.tanh(change * 100); // Scale to -1 to 1
      }
      return 0;
    }
    
    const fn = featureMap[feature];
    if (fn) {
      try {
        const value = fn();
        return value;
      } catch (e) {
        if (this.config.debugMode) {
          console.warn(`[AI-PRO] Feature error: ${feature}`, e.message);
        }
        return null;
      }
    }
    
    return null;
  },

  // Helper for MTF values
  getMTFValue(state, timeframe) {
    const mtf = state.mtf || {};
    const tf = mtf[timeframe];
    if (!tf) return 0;
    return tf.signal === 'bull' ? 1 : tf.signal === 'bear' ? -1 : 0;
  },

  // ============================================
  // 🌍 MARKET REGIME DETECTION
  // ============================================
  detectMarketRegime(marketState) {
    const indicators = marketState.indicators || {};
    const adx = indicators.adx?.value ?? 20;
    const adxTrend = indicators.adx?.trend ?? 'neutral';
    const volatility = marketState.volatility ?? 'normal';
    const price = marketState.price ?? 0;
    const ema20 = indicators.ema?.ema20 ?? price;
    
    if (volatility === 'high' || (marketState.atr && marketState.atrAvg && marketState.atr > marketState.atrAvg * 1.5)) {
      return 'volatile';
    }
    
    if (adx > 25) {
      if (adxTrend === 'bull' || price > ema20) return 'trending_up';
      if (adxTrend === 'bear' || price < ema20) return 'trending_down';
    }
    
    return 'ranging';
  },

  getRegimeConfidenceMultiplier(regime) {
    const multipliers = {
      'trending_up': 1.10,
      'trending_down': 1.10,
      'ranging': 0.95,
      'volatile': 0.90
    };
    return multipliers[regime] || 1.0;
  },

  // ============================================
  // 🕒 SESSION CONTEXT
  // ============================================
  getSessionContext() {
    const h = new Date().getUTCHours();
    if (h >= 0 && h < 8) return 'ASIA';
    if (h >= 8 && h < 16) return 'EUROPE';
    return 'US';
  },

  getSessionConfidenceMultiplier(session) {
    const m = { ASIA: 0.95, EUROPE: 1.02, US: 1.02 };
    return m[session] || 1.0;
  },

  // ============================================
  // 🌪️ VOLATILITY SCORING
  // ============================================
  getVolatilityScore(marketState) {
    const atr = marketState.atr;
    const atrAvg = marketState.atrAvg;
    if (!atr || !atrAvg || atrAvg <= 0) {
      return marketState.volatility === 'high' ? 0.85 : (marketState.volatility === 'low' ? 0.25 : 0.5);
    }
    const ratio = atr / atrAvg;
    return Math.max(0, Math.min(1, (ratio - 0.5) / 1.5));
  },

  getVolatilityBucket(volScore) {
    if (volScore >= 0.75) return 'HIGH';
    if (volScore <= 0.35) return 'LOW';
    return 'NORMAL';
  },

  getVolatilityConfidenceMultiplier(volScore) {
    if (volScore >= 0.8) return 0.92;
    if (volScore >= 0.65) return 0.96;
    if (volScore <= 0.25) return 1.02;
    return 1.0;
  },

  // ============================================
  // 🧱 BREAKOUT DETECTION
  // ============================================
  detectBreakoutContext(marketState) {
    const s = marketState || {};
    const price = s.price || 0;
    const sr = s.supportResistance || {};
    const indicators = s.indicators || {};
    const volScore = this.getVolatilityScore(s);

    const resistance = sr.resistance || sr.r1 || sr.R1 || null;
    const support = sr.support || sr.s1 || sr.S1 || null;

    const obv = indicators.obv?.value ?? s.obv;
    const cvd = s.cvd;

    const candle = s.lastCandle || s.candle || null;
    let wickRatio = null;
    if (candle && candle.high != null && candle.low != null) {
      const range = Math.max(1e-9, candle.high - candle.low);
      const body = Math.abs((candle.close || 0) - (candle.open || 0));
      wickRatio = (range - body) / range;
    }

    const atr = s.atr || null;
    const proximity = (level) => {
      if (!level || !price) return null;
      const denom = atr && atr > 0 ? atr : (price * 0.002);
      return Math.abs(price - level) / denom;
    };

    const nearRes = resistance ? proximity(resistance) : null;
    const nearSup = support ? proximity(support) : null;

    let risk = 0.0;
    let tag = 'NONE';

    const volConfWeak = (obv != null && obv < 0) || (cvd != null && cvd < 0);
    if (wickRatio != null && wickRatio > 0.55) risk += 0.25;
    if (volScore >= 0.75) risk += 0.25;
    if (volConfWeak) risk += 0.2;
    if (nearRes != null && nearRes < 1.5) { risk += 0.2; tag = 'AT_RESISTANCE'; }
    if (nearSup != null && nearSup < 1.5) { risk += 0.2; tag = 'AT_SUPPORT'; }

    risk = Math.max(0, Math.min(1, risk));
    const quality = 1 - risk;

    let classification = 'NEUTRAL';
    if (risk >= 0.6) classification = 'FAKE_BREAKOUT_RISK';
    else if (quality >= 0.65 && (nearRes != null || nearSup != null)) classification = 'CONTINUATION_LIKELY';

    return { risk, quality, tag, classification };
  },

  // ============================================
  // 💾 LONG-TERM MEMORY
  // ============================================
  queryLongTermMemory(marketState) {
    const regime = this.detectMarketRegime(marketState);
    const features = this.extractFeatureVector(marketState);
    const session = this.config.sessionAware ? this.getSessionContext() : null;
    const volScore = this.config.volatilityAware ? this.getVolatilityScore(marketState) : null;
    const volBucket = volScore != null ? this.getVolatilityBucket(volScore) : null;
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const pattern of this.memory.patterns) {
      if (pattern.regime !== regime) continue;

      let contextPenalty = 1.0;
      if (session && pattern.session && pattern.session !== session) contextPenalty *= 0.9;
      if (volBucket && pattern.volBucket && pattern.volBucket !== volBucket) contextPenalty *= 0.9;
      
      const similarity = this.calculateSimilarity(features, pattern.features);
      const scoredSimilarity = similarity * contextPenalty;

      if (scoredSimilarity > bestSimilarity && scoredSimilarity > 0.72) {
        bestSimilarity = scoredSimilarity;
        bestMatch = pattern;
      }
    }
    
    if (bestMatch) {
      return {
        found: true,
        confidence: bestSimilarity * bestMatch.successRate,
        direction: bestMatch.direction,
        occurrences: bestMatch.occurrences,
        avgReturn: bestMatch.avgReturn,
        session: bestMatch.session || null,
        volBucket: bestMatch.volBucket || null,
        lastOutcome: bestMatch.lastOutcome || null
      };
    }
    
    return { found: false };
  },

  extractFeatureVector(marketState) {
    const vector = {};
    // Extract ALL features (model + derived)
    const allFeatures = new Set();
    
    // Model features
    for (const model of Object.values(this.models)) {
      model.features.forEach(f => allFeatures.add(f));
    }
    
    // Derived features
    Object.keys(this.features.derived).forEach(f => allFeatures.add(f));
    
    for (const feature of allFeatures) {
      const value = this.getFeatureValue(feature, marketState);
      if (value !== null && value !== undefined && !isNaN(value)) {
        vector[feature] = value;
      }
    }
    
    if (this.config.debugMode && Object.keys(vector).length === 0) {
      console.warn('[AI-PRO] Empty feature vector - check market state');
    }
    
    return vector;
  },

  calculateSimilarity(v1, v2) {
    const keys = Object.keys(v1).filter(k => 
      v2[k] !== undefined && 
      v1[k] !== null && 
      v2[k] !== null &&
      !isNaN(v1[k]) && 
      !isNaN(v2[k])
    );
    
    if (keys.length === 0) return 0;
    
    let similarity = 0;
    for (const key of keys) {
      similarity += 1 - Math.abs(v1[key] - v2[key]);
    }
    return similarity / keys.length;
  },

  storeInLongTermMemory(prediction, outcome) {
    const session = this.config.sessionAware ? (prediction.session || this.getSessionContext()) : null;
    const volScore = this.config.volatilityAware ? (prediction.volScore ?? this.getVolatilityScore(this.getCurrentMarketState())) : null;
    const volBucket = volScore != null ? this.getVolatilityBucket(volScore) : null;
    const breakout = prediction.breakout || null;

    const pattern = {
      id: Date.now().toString(36),
      regime: prediction.regime,
      direction: prediction.direction,
      features: prediction.features || {},
      session,
      volBucket,
      breakoutTag: breakout?.classification || null,
      successCount: outcome.success ? 1 : 0,
      failCount: outcome.success ? 0 : 1,
      successRate: outcome.success ? 1 : 0,
      occurrences: 1,
      avgReturn: outcome.priceChange || 0,
      lastOutcome: outcome.success ? 'POS' : 'NEG',
      timestamp: Date.now()
    };
    
    const similar = this.memory.patterns.find(p => 
      p.regime === pattern.regime && 
      this.calculateSimilarity(p.features, pattern.features) > 0.85
    );
    
    if (similar) {
      similar.occurrences++;
      similar.successCount = (similar.successCount || 0) + (outcome.success ? 1 : 0);
      similar.failCount = (similar.failCount || 0) + (outcome.success ? 0 : 1);
      similar.successRate = similar.successCount / similar.occurrences;
      similar.avgReturn = (similar.avgReturn * (similar.occurrences - 1) + (outcome.priceChange || 0)) / similar.occurrences;
      similar.timestamp = Date.now();
      similar.lastOutcome = outcome.success ? 'POS' : 'NEG';
      if (session) similar.session = session;
      if (volBucket) similar.volBucket = volBucket;
      
      if (this.config.debugMode) {
        console.log(`[AI-PRO] Pattern updated: ${similar.id} (${similar.occurrences} occ, ${(similar.successRate*100).toFixed(1)}% win)`);
      }
    } else {
      this.memory.patterns.push(pattern);
      
      if (this.config.debugMode) {
        console.log(`[AI-PRO] New pattern stored: ${pattern.id} (${pattern.direction})`);
      }
      
      if (this.memory.patterns.length > this.config.maxLongTermPatterns) {
        this.memory.patterns.sort((a, b) => {
          const scoreA = a.successRate * Math.log(a.occurrences + 1);
          const scoreB = b.successRate * Math.log(b.occurrences + 1);
          return scoreB - scoreA;
        });
        this.memory.patterns = this.memory.patterns.slice(0, this.config.maxLongTermPatterns);
      }
    }
  },

  // ============================================
  // 📊 PRO PREDICTION RECORDING
  // ============================================
  recordProPrediction(pred, baseId) {
    const marketState = this.getCurrentMarketState();
    const ensemble = this.generateEnsemblePrediction(marketState);
    
    const proPrediction = {
      id: 'pro_' + baseId,
      baseId: baseId,
      timestamp: Date.now(),
      price: window.state?.price || 0,
      ensemble: ensemble,
      features: this.extractFeatureVector(marketState),
      regime: ensemble.regime,
      verifications: [],
      outcome: null
    };
    
    this.predictions.pending.push(proPrediction);
    
    // Schedule verifications
    for (const horizon of this.config.horizons) {
      setTimeout(() => this.verifyProPrediction(proPrediction.id, horizon), horizon * 60000);
    }
    
    if (ensemble.confidence > 0.75) {
      console.log(`[AI-PRO] High confidence ${ensemble.direction}: ${(ensemble.confidence * 100).toFixed(1)}%`);
    }
    
    return proPrediction.id;
  },

  verifyProPrediction(id, horizon) {
    const pred = this.predictions.pending.find(p => p.id === id);
    if (!pred || !window.state?.price || !pred.price) return;
    
    const priceChange = ((window.state.price - pred.price) / pred.price) * 100;
    const direction = pred.ensemble.direction;
    
    const threshold = direction === 'NEUTRAL' ? 0.05 : 0.1;
    const success = (direction === 'BULL' && priceChange > threshold) ||
                   (direction === 'BEAR' && priceChange < -threshold) ||
                   (direction === 'NEUTRAL' && Math.abs(priceChange) < 0.15);
    
    pred.verifications.push({
      horizon,
      priceChange,
      success,
      timestamp: Date.now()
    });
    
    // Update session tracking
    this._lastVerification = {
      horizon,
      priceChange: priceChange.toFixed(3),
      success,
      timestamp: Date.now()
    };
    
    // Update horizon statistics (with safe check)
    if (this.predictions.byHorizon[horizon]) {
      this.predictions.byHorizon[horizon].total++;
      if (success) this.predictions.byHorizon[horizon].correct++;
      this.predictions.byHorizon[horizon].accuracy = 
        this.predictions.byHorizon[horizon].correct / this.predictions.byHorizon[horizon].total;
    }
    
    // Complete prediction
    // - Auto mode: complete after the short-horizon cycle (default: 15m)
    // - Non-auto mode: complete after the full configured horizon cycle
    const autoMax = this.config.autoMaxHorizon || 15;
    const fullMax = Math.max(...this.config.horizons);
    if ((pred.isAuto && horizon === autoMax) || (!pred.isAuto && horizon === fullMax)) {
      this.completeProPrediction(pred);
    }
  },

  // Reschedule verifications for restored predictions
  rescheduleVerifications(pred) {
    if (!pred || !pred.id || !pred.timestamp) return;
    
    const now = Date.now();
    const elapsed = now - pred.timestamp;
    const verified = pred.verifications ? pred.verifications.map(v => v.horizon) : [];
    
    const horizonsToVerify = pred.isAuto
      ? this.config.horizons.filter(h => h <= (this.config.autoMaxHorizon || 15))
      : this.config.horizons;

    for (const horizon of horizonsToVerify) {
      // Skip already verified horizons
      if (verified.includes(horizon)) continue;
      
      const targetTime = pred.timestamp + (horizon * 60000);
      const delay = targetTime - now;
      
      if (delay > 0) {
        // Schedule future verification
        setTimeout(() => this.verifyProPrediction(pred.id, horizon), delay);
      } else if (delay > -300000) {
        // Verify immediately if within 5 min grace period
        setTimeout(() => this.verifyProPrediction(pred.id, horizon), 1000);
      }
      // Skip if too old (more than 5 min past)
    }
  },

  completeProPrediction(pred) {
    const verifs = pred.verifications || [];
    // Auto-predictions validate only short horizons (default: 2/5/10/15m) to stay real-time.
    // Allow learning with fewer validations in auto mode.
    const baseMinValidations = Math.min(this.config.minValidationsToLearn, this.config.horizons.length);
    const autoMinValidations = Math.min((this.config.minValidationsToLearnAuto || 4), this.config.horizons.length);
    const minValidations = pred && pred.isAuto ? autoMinValidations : baseMinValidations;

    const maxH = Math.max(...this.config.horizons);
    let wSuccess = 0;
    let wTotal = 0;
    let sumChange = 0;
    
    for (const v of verifs) {
      const w = 0.5 + (v.horizon / maxH);
      wTotal += w;
      if (v.success) wSuccess += w;
      sumChange += v.priceChange;
    }
    
    const successRateW = wTotal > 0 ? (wSuccess / wTotal) : 0;
    const success = successRateW >= 0.55;
    const avgPriceChange = verifs.length ? (sumChange / verifs.length) : 0;
    const successCount = verifs.filter(v => v.success).length;

    pred.outcome = {
      success,
      avgPriceChange,
      successRate: verifs.length ? (successCount / verifs.length) : 0,
      successRateWeighted: successRateW,
      completedAt: Date.now()
    };
    
    this.updateModelWeights(pred, success);
    
    // Store in memory
    const c = pred.ensemble?.confidence || 0;
    const br = pred.ensemble?.breakout;
    const passes = !!pred.ensemble?.passes;
    const absAvg = Math.abs(avgPriceChange);
    const mustLearn = (br && br.classification !== 'NEUTRAL') || (absAvg >= 0.08) || (passes && c >= 0.40 && absAvg >= 0.03);
    
    if (mustLearn && verifs.length >= minValidations) {
      pred.session = pred.ensemble?.session;
      pred.volScore = pred.ensemble?.volScore;
      pred.breakout = pred.ensemble?.breakout;
      this.storeInLongTermMemory(pred, { success, priceChange: avgPriceChange });
    }
    
    this.predictions.completed.push(pred);
    this.predictions.pending = this.predictions.pending.filter(p => p.id !== pred.id);
    
    this.updatePerformance(pred);
    // STEP2: outcome scoreboard (safe, lightweight)
    this.updateScoreboard(pred);
    
    if (this.predictions.completed.length > 500) {
      this.predictions.completed = this.predictions.completed.slice(-500);
    }
    
    if (this.performance.overall.totalPredictions % 10 === 0) {
      this.saveState();
    }
  },

  // ============================================
  // ⚖️ MODEL WEIGHT ADJUSTMENT
  // ============================================
  updateModelWeights(pred, overallSuccess) {
    const lr = this.config.learningRate;
    
    for (const [modelName, modelPred] of Object.entries(pred.ensemble.modelPredictions)) {
      const model = this.models[modelName];
      if (!model) continue;
      
      const modelCorrect = (overallSuccess && modelPred.direction === pred.ensemble.direction) ||
                          (!overallSuccess && modelPred.direction !== pred.ensemble.direction);
      
      model.predictions++;
      if (modelCorrect) model.correct++;
      
      const newAccuracy = model.correct / model.predictions;
      model.accuracy = model.accuracy * 0.9 + newAccuracy * 0.1;
      
      if (model.predictions >= 20) {
        if (model.accuracy > 0.55) {
          model.weight = Math.min(2.0, model.weight + lr);
        } else if (model.accuracy < 0.45) {
          model.weight = Math.max(0.3, model.weight - lr);
        }
      }
    }
  },

  updateProModels(basePrediction) {
    if (basePrediction.outcome?.success) {
      for (const ind of Object.keys(basePrediction.indicators || {})) {
        for (const model of Object.values(this.models)) {
          if (model.features.includes(ind)) {
            model.accuracy = model.accuracy * 0.98 + 0.02;
          }
        }
      }
    }
  },

  // ============================================
  // 📈 PERFORMANCE TRACKING
  // ============================================
  updatePerformance(pred) {
    const perf = this.performance.overall;
    
    perf.totalPredictions++;
    if (pred.outcome.success) perf.correctPredictions++;
    perf.accuracy = perf.correctPredictions / perf.totalPredictions;
    
    // Daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!this.performance.daily[today]) {
      this.performance.daily[today] = { total: 0, correct: 0, returns: [] };
    }
    const daily = this.performance.daily[today];
    daily.total++;
    if (pred.outcome.success) daily.correct++;
    daily.returns.push(pred.outcome.avgPriceChange);
    
    // Clean old data
    const keys = Object.keys(this.performance.daily).sort();
    while (keys.length > 30) {
      delete this.performance.daily[keys.shift()];
    }
  },

  // ============================================
  // 🧾 STEP2: OUTCOME SCOREBOARD (rolling aggregates)
  // ============================================
  updateScoreboard(pred) {
    try {
      this._ensureScoreboard();
      const sb = this.performance.scoreboard;

      const y = pred?.outcome?.success ? 1 : 0;
      // STEP3: use raw confidence for scoring (do not depend on calibrated display)
      const p0 = Number((pred?.ensemble?.confidenceRaw ?? pred?.ensemble?.confidence));
      const p = Number.isFinite(p0) ? Math.max(0, Math.min(1, p0)) : 0.5;
      const brier = (p - y) * (p - y);

      // Overall
      sb.overall.n += 1;
      sb.overall.win += y;
      sb.overall.brier += brier;
      sb.overall.confAvg += p;

      // Horizon-specific: use configured "autoMaxHorizon" for auto-preds; otherwise max horizon.
      const h = (pred?.isAuto ? (this.config?.autoMaxHorizon || 15) : Math.max(...(this.config?.horizons || [15])));
      if (!sb.byHorizon[h]) sb.byHorizon[h] = { n: 0, win: 0, brier: 0, confAvg: 0 };
      sb.byHorizon[h].n += 1;
      sb.byHorizon[h].win += y;
      sb.byHorizon[h].brier += brier;
      sb.byHorizon[h].confAvg += p;

      // STEP3: update calibration buffers
      try { this._updateCalibrationWithOutcome(h, p, y); } catch(e) {}

      // Keep numbers bounded (avoid unbounded growth if running for days)
      const cap = 5000;
      if (sb.overall.n > cap) {
        // decay all aggregates to keep scale stable
        const k = cap / sb.overall.n;
        sb.overall.n = Math.round(sb.overall.n * k);
        sb.overall.win = sb.overall.win * k;
        sb.overall.brier = sb.overall.brier * k;
        sb.overall.confAvg = sb.overall.confAvg * k;
        for (const key of Object.keys(sb.byHorizon || {})) {
          const bh = sb.byHorizon[key];
          if (!bh || !bh.n) continue;
          const kh = cap / bh.n;
          bh.n = Math.round(bh.n * kh);
          bh.win = bh.win * kh;
          bh.brier = bh.brier * kh;
          bh.confAvg = bh.confAvg * kh;
        }
      }

      // Occasional log (low noise)
      if ((sb.overall.n % 10) === 0) {
        const winRate = sb.overall.n ? (sb.overall.win / sb.overall.n) : 0;
        const b = sb.overall.n ? (sb.overall.brier / sb.overall.n) : 0;
        const c = sb.overall.n ? (sb.overall.confAvg / sb.overall.n) : 0;
        console.log(`[AI-PRO][STEP2] Scoreboard overall: win=${(winRate*100).toFixed(1)}% brier=${b.toFixed(3)} confAvg=${(c*100).toFixed(1)}% n=${sb.overall.n}`);
      }
    } catch (_) { /* no-op */ }
  },


  // ============================================
  // 🔄 AUTO-OPTIMIZATION
  // ============================================
  startOptimizationLoop() {
    setInterval(() => this.runOptimization(), this.config.optimizationInterval);
    setTimeout(() => this.runOptimization(), 300000);
  },

  runOptimization() {
    console.log('[AI-PRO] Running auto-optimization...');
    
    const recentPredictions = this.predictions.completed.slice(-50);
    if (recentPredictions.length >= 20) {
      const recentAccuracy = recentPredictions.filter(p => p.outcome.success).length / recentPredictions.length;
      
      if (recentAccuracy < 0.45) {
        this.config.learningRate = Math.min(0.1, this.config.learningRate * 1.2);
      } else if (recentAccuracy > 0.6) {
        this.config.learningRate = Math.max(0.01, this.config.learningRate * 0.9);
      }
    }
    
    this.memory.patterns = this.memory.patterns.filter(p => 
      p.occurrences >= 3 || Date.now() - p.timestamp < 86400000
    );
    
    const bestHorizon = Object.entries(this.predictions.byHorizon)
      .filter(([_, stats]) => stats.total >= 10)
      .sort(([_, a], [__, b]) => b.accuracy - a.accuracy)[0];
    
    if (bestHorizon) {
      console.log(`[AI-PRO] Best horizon: ${bestHorizon[0]}min (${(bestHorizon[1].accuracy * 100).toFixed(1)}%)`);
    }
    
    this.saveState();
    
    console.log('[AI-PRO] Optimization complete. Accuracy:', (this.performance.overall.accuracy * 100).toFixed(1) + '%');
    console.log('[AI-PRO] Memory patterns:', this.memory.patterns.length);
    console.log('[AI-PRO] Pending predictions:', this.predictions.pending.length);
  },

  // ============================================
  // 🤖 AUTO-PREDICTION SYSTEM
  // ============================================
  startAutoPrediction() {
    // Generate predictions automatically every 60 seconds (más frecuente)
    const AUTO_PREDICT_INTERVAL = 60000; // 1 minute
    
    setInterval(() => {
      this.generateAutoPrediction();
    }, AUTO_PREDICT_INTERVAL);
    
    // First prediction after 5 seconds (immediate startup)
    setTimeout(() => {
      console.log('[AI-PRO] 🚀 Generating FIRST auto-prediction...');
      this.generateAutoPrediction();
    }, 5000);
    
    // Second prediction after 15 seconds
    setTimeout(() => {
      console.log('[AI-PRO] 🚀 Generating SECOND auto-prediction...');
      this.generateAutoPrediction();
    }, 15000);
    
    console.log('[AI-PRO] Auto-prediction started (every 1 min, first in 5s)');
  },

  generateAutoPrediction() {
    // Feed health gate: skip auto-prediction if market data stream is degraded
    try {
      const fh = (window.state && window.state.feedHealth) ? window.state.feedHealth : null;
      const score = (fh && typeof fh.score === 'number') ? fh.score : null;
      const minH = this.config.minHealthScore ?? 60;
      if (score !== null && score < minH) {
        console.warn(`[AI-PRO] ⛔ Auto-prediction skipped: feed health ${score}% < ${minH}% (ws=${fh.ws || 'n/a'})`);
        return;
      }
    } catch (_) { /* no-op */ }

    console.log('[AI-PRO] === Auto-prediction attempt ===');
    
    if (!this.isReady) {
      console.log('[AI-PRO] ❌ Skipping: not ready');
      return;
    }
    
    const price = window.state?.price;
    if (!price) {
      console.log('[AI-PRO] ❌ Skipping: no price data (window.state.price =', price, ')');
      return;
    }
    
    console.log('[AI-PRO] ✓ Price available:', price);
    
    // Don't generate if we have too many pending
    const maxPending = this.config.maxPending || 25;
    if (this.predictions.pending.length >= maxPending) {
      console.log('[AI-PRO] ⏸ Skipping: too many pending (' + this.predictions.pending.length + '/' + maxPending + ')');
      return;
    }
    
    const marketState = this.getCurrentMarketState();
    console.log('[AI-PRO] Market state:', {
      price: marketState.price,
      hasIndicators: !!marketState.indicators && Object.keys(marketState.indicators || {}).length > 0,
      indicatorKeys: Object.keys(marketState.indicators || {}).slice(0, 5)
    });
    
    const ensemble = this.generateEnsemblePrediction(marketState);
    
    console.log('[AI-PRO] Ensemble result:', {
      direction: ensemble.direction,
      confidence: (ensemble.confidence * 100).toFixed(1) + '%',
      threshold: (this.config.minConfidence * 100) + '%',
      passes: ensemble.confidence >= this.config.minConfidence
    });
    
    // SIEMPRE registrar predicción si hay datos, aunque sea baja confianza
    // Solo skip si la confianza es extremadamente baja (<15%)
    if (ensemble.confidence < 0.15) {
      console.log('[AI-PRO] ❌ Skipping: extremely low confidence');
      return;
    }
    
    // Create prediction record
    const predId = 'auto_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    const proPrediction = {
      id: predId,
      baseId: null,
      timestamp: Date.now(),
      price: window.state.price,
      ensemble: ensemble,
      features: this.extractFeatureVector(marketState),
      regime: ensemble.regime,
      verifications: [],
      outcome: null,
      isAuto: true
    };
    
    this.predictions.pending.push(proPrediction);
    
    // Update session tracking
    this._sessionPredictions = (this._sessionPredictions || 0) + 1;
    this._lastPredictionTime = Date.now();
    
    // Schedule verifications (auto mode: only short horizons to stay real-time)
    const horizonsToVerify = this.config.horizons.filter(h => h <= (this.config.autoMaxHorizon || 15));
    for (const horizon of horizonsToVerify) {
      setTimeout(() => this.verifyProPrediction(predId, horizon), horizon * 60000);
    }
    
    console.log(`[AI-PRO] 🎯 Auto-prediction #${this._sessionPredictions}: ${ensemble.direction} @ ${(ensemble.confidence * 100).toFixed(1)}% | Price: ${window.state.price.toFixed(4)} | Pending: ${this.predictions.pending.length}`);
  },

  // ============================================
  // 💾 STATE PERSISTENCE
  // ============================================
 
  async loadState() {
    if (this.db) {
      try {
        const { doc, getDoc } = window.AILearning.firestore;
        const uid = window.AILearning?.user?.uid || null;

        // Prefer per-user scoped storage; fall back to legacy /ai for backwards compatibility (read-only).
        const engineDoc = (id) => uid ? doc(this.db, 'aiUsers', uid, 'engine', id) : doc(this.db, 'ai', id);
        const legacyDoc = (id) => doc(this.db, 'ai', id);

        const loadWithFallback = async (id) => {
          const primary = await getDoc(engineDoc(id));
          if (primary.exists()) return { snap: primary, source: uid ? 'scoped' : 'legacy' };
          if (uid) {
            const legacy = await getDoc(legacyDoc(id));
            if (legacy.exists()) return { snap: legacy, source: 'legacy' };
          }
          return { snap: primary, source: null };
        };

        let migrateFromLegacy = false;

        const { snap: modelsDoc, source: modelsSrc } = await loadWithFallback('pro_models');
        if (modelsDoc.exists()) {
          const savedModels = modelsDoc.data();
          for (const [name, data] of Object.entries(savedModels)) {
            if (this.models[name]) {
              Object.assign(this.models[name], data);
            }
          }
          if (uid && modelsSrc == 'legacy') migrateFromLegacy = true
        }

        const { snap: memoryDoc, source: memorySrc } = await loadWithFallback('pro_memory');
        if (memoryDoc.exists()) {
          const savedMemory = memoryDoc.data();
          this.memory.patterns = savedMemory.patterns || [];
          this.memory.correlations = savedMemory.correlations || {};
          if (uid && memorySrc == 'legacy') migrateFromLegacy = true
        }

        const { snap: perfDoc, source: perfSrc } = await loadWithFallback('pro_performance');
        if (perfDoc.exists()) {
          Object.assign(this.performance, perfDoc.data());
          if (uid && perfSrc == 'legacy') migrateFromLegacy = true
        }

        const { snap: horizonDoc, source: horizonSrc } = await loadWithFallback('pro_horizons');
        if (horizonDoc.exists()) {
          const savedHorizons = horizonDoc.data();
          for (const [h, data] of Object.entries(savedHorizons)) {
            if (this.predictions.byHorizon[h]) {
              Object.assign(this.predictions.byHorizon[h], data);
            }
          }
          if (uid && horizonSrc == 'legacy') migrateFromLegacy = true
        }

        // Load pending predictions and reschedule verifications
        const { snap: pendingDoc, source: pendingSrc } = await loadWithFallback('pro_pending');
        if (pendingDoc.exists()) {
          const savedPending = pendingDoc.data();
          if (savedPending.pending && Array.isArray(savedPending.pending)) {
            const now = Date.now();
            const MAX_PENDING = this.config.maxPending || 25;
            // Restore only recent predictions, keep newest MAX_PENDING to avoid timer storms / freezes
            const recent = savedPending.pending
              .filter(p => p && typeof p === 'object' && p.timestamp && (now - p.timestamp) < 18000000)
              .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
              .slice(-MAX_PENDING);

            let restored = 0;
            for (const pred of recent) {
              if (!pred.id) pred.id = `restored_${pred.timestamp || now}_${Math.random().toString(36).slice(2, 9)}`;
              // Default restored predictions to auto-mode unless explicitly specified
              if (typeof pred.isAuto !== 'boolean') pred.isAuto = true;
              this.predictions.pending.push(pred);
              this.rescheduleVerifications(pred);
              restored++;
            }

            if (savedPending.pending.length > MAX_PENDING) {
              console.log(`[AI-PRO] Pending trimmed on load: ${savedPending.pending.length} -> ${restored}`);
            }
            if (restored > 0) {
              console.log(`[AI-PRO] Restored ${restored} pending predictions`);
            }
          }
          if (uid && pendingSrc == 'legacy') migrateFromLegacy = true
        }

        console.log(`[AI-PRO] State loaded from Firestore${uid ? ' (scoped)' : ''}`);
        console.log('[AI-PRO] Memory patterns:', this.memory.patterns.length);

        // Best-effort migration: if we loaded legacy docs, persist them into the user-scoped location.
        if (uid && migrateFromLegacy) {
          setTimeout(() => { try { this.saveState(); } catch(e){} }, 1500);
        }

        return;
      } catch (e) {
        console.warn('[AI-PRO] Firestore load failed:', e);
      }
    }

    try {
      const saved = localStorage.getItem('ai_pro_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.models) Object.assign(this.models, state.models);
        if (state.memory) Object.assign(this.memory, state.memory);
        if (state.performance) Object.assign(this.performance, state.performance);
        if (state.horizons) {
          for (const [h, data] of Object.entries(state.horizons)) {
            if (this.predictions.byHorizon[h]) {
              Object.assign(this.predictions.byHorizon[h], data);
            }
          }
        }
        console.log('[AI-PRO] State loaded from localStorage');
      }
    } catch (e) {}
  },  async saveState() {
    const uid = window.AILearning?.user?.uid;

    if (this.db && uid) {
      try {
        const { doc, setDoc } = window.AILearning.firestore;
        const ref = (id) => doc(this.db, 'aiUsers', uid, 'engine', id);

        // Firestore does not accept `undefined` anywhere in the payload.
        // Clean objects deeply to prevent "Unsupported field value: undefined".
        const cleanFS = (value) => {
          const seen = new WeakSet();
          const _clean = (v) => {
            if (v === undefined) return null;
            if (v === null) return null;
            const t = typeof v;
            if (t === 'number') return Number.isFinite(v) ? v : null;
            if (t === 'string' || t === 'boolean') return v;
            if (t === 'function' || t === 'symbol') return null;
            if (v instanceof Date) return v.toISOString();
            if (Array.isArray(v)) return v.map(_clean);
            if (t === 'object') {
              if (seen.has(v)) return null;
              seen.add(v);
              const out = {};
              for (const [k, val] of Object.entries(v)) {
                if (val === undefined) continue; // omit undefined keys
                out[k] = _clean(val);
              }
              return out;
            }
            return null;
          };
          return _clean(value);
        };

        const modelsData = {};
        for (const [name, model] of Object.entries(this.models)) {
          modelsData[name] = {
            weight: model.weight,
            accuracy: model.accuracy,
            predictions: model.predictions,
            correct: model.correct
          };
        }
        await setDoc(ref('pro_models'), cleanFS(modelsData));

        await setDoc(ref('pro_memory'), cleanFS({
          patterns: this.memory.patterns.slice(-500),
          correlations: this.memory.correlations,
          updatedAt: new Date().toISOString()
        }));

        await setDoc(ref('pro_performance'), cleanFS(this.performance));
        await setDoc(ref('pro_horizons'), cleanFS(this.predictions.byHorizon));

        // Save pending predictions
        const persistMax = this.config.maxPending || 25;
        await setDoc(ref('pro_pending'), cleanFS({
          pending: this.predictions.pending.slice(-persistMax),
          updatedAt: Date.now()
        }));

      } catch (e) {
        console.warn('[AI-PRO] Firestore save failed:', e);
      }
    }

    try {
      localStorage.setItem('ai_pro_state', JSON.stringify({
        models: this.models,
        memory: { patterns: this.memory.patterns.slice(-100), correlations: this.memory.correlations },
        performance: this.performance,
        horizons: this.predictions.byHorizon
      }));
    } catch (e) {}
  },


  // ============================================
  // 🔧 UTILITY METHODS
  // ============================================

  // ============================================
  // 🧮 INDICATOR DERIVATION (fallback from candles)
  // ============================================
  deriveIndicatorsFromState(s, price, prevPrice) {
    try {
      const candles = this._getCandlesFromState(s);
      const lastCandle = candles.length ? candles[candles.length - 1] : (s.lastCandle || s.candle || s.lastOHLC || null);

      // If we have no candle history, return existing state as-is
      if (!candles.length) {
        return {
          indicators: s.indicators || {},
          volume: s.volume,
          atr: s.atr,
          atrAvg: s.atrAvg,
          volatility: s.volatility,
          lastCandle
        };
      }

      const closes = candles.map(c => this._getCandleClose(c)).filter(v => Number.isFinite(v));
      const highs  = candles.map(c => this._getCandleHigh(c)).filter(v => Number.isFinite(v));
      const lows   = candles.map(c => this._getCandleLow(c)).filter(v => Number.isFinite(v));
      const vols   = candles.map(c => this._getCandleVol(c)).filter(v => Number.isFinite(v));

      // Minimal guards
      if (closes.length < 20) {
        return {
          indicators: s.indicators || {},
          volume: s.volume,
          atr: s.atr,
          atrAvg: s.atrAvg,
          volatility: s.volatility,
          lastCandle
        };
      }

      // --- Core indicators
      const rsi = this._calcRSI(closes, 14);
      const stochRsi = this._calcStochRSI(closes, 14, 14);
      const emaFast = this._calcEMA(closes, 9);
      const emaSlow = this._calcEMA(closes, 21);
      const ema20 = this._calcEMA(closes, 20);
      const macd = this._calcMACD(closes, 12, 26, 9);
      const atr = this._calcATR(candles, 14);
      const atrAvg = this._calcATR(candles, 50);

      const priceRef = Number.isFinite(price) ? price : closes[closes.length - 1];
      const volRatio = (Number.isFinite(atr) && priceRef > 0) ? (atr / priceRef) : 0;
      const volatility = volRatio > 0.012 ? 'high' : (volRatio > 0.006 ? 'normal' : 'low');

      // Momentum (ROC)
      const lookback = Math.min(10, closes.length - 1);
      const base = closes[closes.length - 1 - lookback] || closes[0];
      const momentum = (base && base !== 0) ? ((closes[closes.length - 1] - base) / base) * 100 : 0;

      // OBV (signal via slope)
      const obvObj = this._calcOBV(candles);

      const emaTrend =
        (emaFast > emaSlow * 1.0005) ? 'bull' :
        (emaFast < emaSlow * 0.9995) ? 'bear' : 'neutral';

      // ADX approximation (trend strength proxy)
      const trendStrength = (priceRef > 0) ? Math.abs(emaFast - emaSlow) / priceRef : 0;
      const adx = Math.max(8, Math.min(55, 18 + trendStrength * 800)); // bounded 8..55

      // Supertrend proxy
      const supertrendSignal =
        (emaTrend === 'neutral')
          ? ((priceRef > ema20) ? 'bull' : 'bear')
          : emaTrend;

      // Divergence proxy (price slope vs RSI slope)
      let divergence = null;
      if (closes.length >= 25) {
        const p0 = closes[closes.length - 1];
        const p1 = closes[closes.length - 11];
        const r0 = this._calcRSI(closes.slice(0, closes.length), 14);
        const r1 = this._calcRSI(closes.slice(0, closes.length - 10), 14);
        if (Number.isFinite(p0) && Number.isFinite(p1) && Number.isFinite(r0) && Number.isFinite(r1)) {
          if (p0 < p1 && r0 > r1) divergence = { type: 'bullish' };
          else if (p0 > p1 && r0 < r1) divergence = { type: 'bearish' };
        }
      }

      // Volume snapshot
      const lastVol = vols.length ? vols[vols.length - 1] : (this._getCandleVol(lastCandle) || 0);
      const avgVolWindow = vols.slice(-20);
      const avgVol = avgVolWindow.length ? (avgVolWindow.reduce((a, b) => a + b, 0) / avgVolWindow.length) : lastVol;
      const volObj = {
        ratio: avgVol > 0 ? (lastVol / avgVol) : 1,
        trend: (lastVol > avgVol * 1.1) ? 'increasing' : (lastVol < avgVol * 0.9 ? 'decreasing' : 'stable')
      };

      // Build indicators in the format expected by AI Engine PRO (feature map)
      const indicators = Object.assign({}, (s.indicators || {}));

      if (indicators.rsi == null) indicators.rsi = { value: rsi };
      if (typeof indicators.rsi === 'number') indicators.rsi = { value: indicators.rsi };

      if (indicators.stochRsi == null) indicators.stochRsi = { value: stochRsi };
      if (typeof indicators.stochRsi === 'number') indicators.stochRsi = { value: indicators.stochRsi };

      if (indicators.macd == null) indicators.macd = { histogram: macd.histogram, signal: macd.histogram >= 0 ? 'bull' : 'bear' };
      if (typeof indicators.macd === 'number') indicators.macd = { histogram: indicators.macd, signal: indicators.macd >= 0 ? 'bull' : 'bear' };

      if (indicators.ema == null) indicators.ema = { emaFast, emaSlow, ema20, signal: emaTrend };

      if (indicators.adx == null) indicators.adx = { value: adx, trend: emaTrend };

      if (indicators.supertrend == null) indicators.supertrend = { signal: supertrendSignal };

      if (indicators.obv == null) indicators.obv = obvObj;

      if (indicators.momentum == null) indicators.momentum = { value: momentum, signal: momentum >= 0 ? 'bull' : 'bear' };

      // Optional divergence hook for feature map
      if (divergence && indicators.divergence == null) indicators.divergence = divergence;

      // Ensure basic prices exist for price_momentum feature
      if (typeof s.prevPrice !== 'number' && Number.isFinite(prevPrice)) {
        // keep it local: do not mutate global state aggressively
      }

      return {
        indicators,
        volume: s.volume || volObj,
        atr: Number.isFinite(s.atr) ? s.atr : atr,
        atrAvg: Number.isFinite(s.atrAvg) ? s.atrAvg : atrAvg,
        volatility: s.volatility || volatility,
        lastCandle
      };
    } catch (e) {
      // Fail-safe: never break app flow due to indicator derivation
      return {
        indicators: s.indicators || {},
        volume: s.volume,
        atr: s.atr,
        atrAvg: s.atrAvg,
        volatility: s.volatility,
        lastCandle: s.lastCandle || s.candle || s.lastOHLC || null
      };
    }
  },

  _getCandlesFromState(s) {
    if (Array.isArray(s.candles) && s.candles.length) return s.candles;
    if (Array.isArray(s.ohlc) && s.ohlc.length) return s.ohlc;
    if (Array.isArray(s.ohlcHistory) && s.ohlcHistory.length) return s.ohlcHistory;
    return [];
  },

  _getCandleClose(c) {
    if (!c) return NaN;
    return this._num(c.close ?? c.c ?? c.C ?? c[4], NaN);
  },
  _getCandleHigh(c) {
    if (!c) return NaN;
    return this._num(c.high ?? c.h ?? c.H ?? c[2], NaN);
  },
  _getCandleLow(c) {
    if (!c) return NaN;
    return this._num(c.low ?? c.l ?? c.L ?? c[3], NaN);
  },
  _getCandleVol(c) {
    if (!c) return NaN;
    return this._num(c.volume ?? c.v ?? c.V ?? c[5], NaN);
  },

  _num(v, fallback = 0) {
    const n = (typeof v === 'string') ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : fallback;
  },

  _calcEMA(values, period) {
    if (!Array.isArray(values) || values.length === 0) return NaN;
    const p = Math.max(2, period | 0);
    const k = 2 / (p + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      if (!Number.isFinite(v)) continue;
      ema = (v * k) + (ema * (1 - k));
    }
    return ema;
  },

  _calcRSI(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length < period + 2) return 50;
    const p = Math.max(2, period | 0);
    let gain = 0, loss = 0;

    // last p changes
    for (let i = closes.length - p; i < closes.length; i++) {
      const prev = closes[i - 1];
      const cur = closes[i];
      if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
      const ch = cur - prev;
      if (ch >= 0) gain += ch;
      else loss -= ch;
    }

    const avgGain = gain / p;
    const avgLoss = loss / p;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return Math.max(0, Math.min(100, rsi));
  },

  _calcMACD(closes, fast = 12, slow = 26, signal = 9) {
    if (!Array.isArray(closes) || closes.length < slow + signal) {
      return { histogram: 0 };
    }
    const emaFast = this._calcEMA(closes, fast);
    const emaSlow = this._calcEMA(closes, slow);
    const macdLine = emaFast - emaSlow;

    // Build a short series for signal EMA: approximate by re-running EMA on macdLine samples
    const sampleN = Math.min(60, closes.length);
    const macdSeries = [];
    for (let i = closes.length - sampleN; i < closes.length; i++) {
      const slice = closes.slice(0, i + 1);
      macdSeries.push(this._calcEMA(slice, fast) - this._calcEMA(slice, slow));
    }
    const signalLine = this._calcEMA(macdSeries, signal);
    const histogram = macdLine - signalLine;
    return { histogram };
  },

  _calcATR(candles, period = 14) {
    if (!Array.isArray(candles) || candles.length < 3) return NaN;
    const p = Math.max(2, period | 0);
    const start = Math.max(1, candles.length - p);
    let sumTR = 0;
    let count = 0;

    for (let i = start; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];
      const high = this._getCandleHigh(c);
      const low = this._getCandleLow(c);
      const prevClose = this._getCandleClose(prev);
      if (![high, low, prevClose].every(Number.isFinite)) continue;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      sumTR += tr;
      count++;
    }

    return count ? (sumTR / count) : NaN;
  },

  _calcStochRSI(closes, rsiPeriod = 14, stochPeriod = 14) {
    if (!Array.isArray(closes) || closes.length < (rsiPeriod + stochPeriod + 2)) return 50;
    const rsiSeries = [];
    for (let i = rsiPeriod + 1; i < closes.length; i++) {
      rsiSeries.push(this._calcRSI(closes.slice(0, i + 1), rsiPeriod));
    }
    const window = rsiSeries.slice(-stochPeriod);
    const rsiLast = window[window.length - 1];
    const minRsi = Math.min(...window);
    const maxRsi = Math.max(...window);
    if (maxRsi === minRsi) return 50;
    const stoch = ((rsiLast - minRsi) / (maxRsi - minRsi)) * 100;
    return Math.max(0, Math.min(100, stoch));
  },

  _calcOBV(candles) {
    if (!Array.isArray(candles) || candles.length < 3) return { value: 0, signal: 'neutral', slope: 0 };
    let obv = 0;
    for (let i = 1; i < candles.length; i++) {
      const prevClose = this._getCandleClose(candles[i - 1]);
      const close = this._getCandleClose(candles[i]);
      const vol = this._getCandleVol(candles[i]);
      if (![prevClose, close, vol].every(Number.isFinite)) continue;
      if (close > prevClose) obv += vol;
      else if (close < prevClose) obv -= vol;
    }

    // slope over last 10 points (proxy)
    const n = Math.min(10, candles.length - 2);
    let obv2 = 0;
    for (let i = candles.length - n; i < candles.length; i++) {
      const prevClose = this._getCandleClose(candles[i - 1]);
      const close = this._getCandleClose(candles[i]);
      const vol = this._getCandleVol(candles[i]);
      if (![prevClose, close, vol].every(Number.isFinite)) continue;
      if (close > prevClose) obv2 += vol;
      else if (close < prevClose) obv2 -= vol;
    }

    const slope = obv2;
    const signal = slope > 0 ? 'bull' : (slope < 0 ? 'bear' : 'neutral');
    return { value: obv, signal, slope };
  },

  
getCurrentMarketState() {
    const s = window.state || {};

    // Price & prevPrice (fallback: internal tracking)
    const price = (typeof s.price === 'number')
      ? s.price
      : (typeof s.currentPrice === 'number')
        ? s.currentPrice
        : (typeof s.lastPrice === 'number')
          ? s.lastPrice
          : 0;

    const prevPrice = (typeof s.prevPrice === 'number')
      ? s.prevPrice
      : (typeof this._lastPriceSeen === 'number')
        ? this._lastPriceSeen
        : price;

    // Keep internal last price for momentum features
    if (Number.isFinite(price)) this._lastPriceSeen = price;

    // Derive missing indicators from candle history (safe + cached)
    const now = Date.now();
    if (!this._derivedCache || (now - this._derivedCache.ts > 750)) {
      const derived = this.deriveIndicatorsFromState(s, price, prevPrice);
      this._derivedCache = Object.assign({ ts: now }, derived);
    }

    const d = this._derivedCache || {};

    return {
      price,
      prevPrice,

      indicators: d.indicators || s.indicators || {},
      indicatorKeys: Object.keys((d.indicators || s.indicators || {})),

      volume: d.volume || s.volume,
      cvd: s.cvd,
      whaleFlow: s.whaleFlow,

      supportResistance: s.supportResistance,
      orderBlocks: s.orderBlocks,
      fvg: s.fvg,
      liquidity: s.liquidity,

      patterns: s.patterns,
      chartPattern: s.chartPattern,
      divergence: s.divergence || (d.indicators && d.indicators.divergence) || null,

      mtf: s.mtf,

      volatility: d.volatility || s.volatility,
      atr: d.atr ?? s.atr,
      atrAvg: d.atrAvg ?? s.atrAvg,

      lastCandle: d.lastCandle || s.lastCandle || s.candle || s.lastOHLC || null,
      orderbook: s.orderbook || s.depth || null
    };
  },

  // ============================================
  // 📊 PUBLIC API
  // ============================================
  getPrediction() {
    const marketState = this.getCurrentMarketState();
    return this.generateEnsemblePrediction(marketState);
  },
  
  getModelStats() {
    const stats = {};
    for (const [name, model] of Object.entries(this.models)) {
      stats[name] = {
        weight: model.weight.toFixed(2),
        accuracy: (model.accuracy * 100).toFixed(1) + '%',
        predictions: model.predictions
      };
    }
    return stats;
  },
  
  getStats() {
    const baseOverall = this.performance?.overall || { accuracy: 0, totalPredictions: 0, correctPredictions: 0 };
    const daily = this.performance?.daily || {};

    // Horizon stats snapshot (UI contract)
    const byH = this.predictions?.byHorizon || {};
    const horizons = {};
    for (const [h, hs] of Object.entries(byH)) {
      horizons[h] = {
        accuracy: typeof hs?.accuracy === 'number' ? hs.accuracy : 0,
        total: typeof hs?.total === 'number' ? hs.total : 0,
        correct: typeof hs?.correct === 'number' ? hs.correct : 0,
      };
    }

    // Use short-horizon stats as the primary "real-time" truth when available
    const shortHs = Array.isArray(this.config.shortHorizons) ? this.config.shortHorizons : [2, 5, 10, 15];
    let shortTotal = 0;
    let shortCorrect = 0;
    for (const h of shortHs) {
      const hs = byH?.[h];
      if (!hs) continue;
      shortTotal += (typeof hs.total === 'number') ? hs.total : 0;
      shortCorrect += (typeof hs.correct === 'number') ? hs.correct : 0;
    }

    const overall = { ...baseOverall };
    if ((overall.totalPredictions || 0) === 0 && shortTotal > 0) {
      overall.totalPredictions = shortTotal;
      overall.correctPredictions = shortCorrect;
      overall.accuracy = shortCorrect / shortTotal;
    }

    // Completed should reflect verified workload (not only 240m outcomes)
    const completedLong = this.predictions?.completed?.length || 0;
    const completedPerf = this.performance?.overall?.totalPredictions || 0;
    const completedShort = shortTotal;
    const completed = Math.max(completedLong, completedPerf, completedShort);

    // Session snapshot (UI contract)
    const startedAt = this._sessionStart || Date.now();
    const uptimeMin = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
    const session = {
      predictions: this._sessionPredictions || 0,
      uptime: uptimeMin,
      lastVerification: this._lastVerification || null,
    };

    return {
      overall,
      daily,
      session,
      horizons,
      memory: {
        patterns: this.memory?.patterns?.length || 0,
        pending: this.predictions?.pending?.length || 0,
        completed,
      },
      models: (typeof this.getModelStats === 'function') ? this.getModelStats() : {},
    };
  },
  
  forceSave() {
    return this.saveState();
  },

  // Debug method
  debugFeatures() {
    const state = this.getCurrentMarketState();
    const vector = this.extractFeatureVector(state);
    console.log('[AI-PRO] Feature vector:', vector);
    console.log('[AI-PRO] Features extracted:', Object.keys(vector).length);
    return vector;
  }
};

// ============================================
// 🚀 AUTO-INITIALIZE
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => AIEnginePro.init(), 2000);
  });
} else {
  setTimeout(() => AIEnginePro.init(), 2000);
}

// Export for global access
window.AIEnginePro = AIEnginePro;

console.log('[AI-PRO] AI Engine PRO v1.6.9 loaded (always-active mode)');


// --- Safety shim (non-invasive) ---
try {
  if (typeof AIEnginePro !== 'undefined') {
    if (typeof AIEnginePro._calibrateProb !== 'function') {
      AIEnginePro._calibrateProb = function(pRaw){ return pRaw; };
    }
    if (typeof AIEnginePro._ensureCalibration !== 'function') {
      AIEnginePro._ensureCalibration = function(){};
    }
  }
} catch(e) {}
