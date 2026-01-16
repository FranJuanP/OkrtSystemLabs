// ============================================
// 🧠 AI ENGINE PRO v1.2.0
// Advanced Self-Learning System for ORACULUM
// Copyright (c) 2025-2026 OkrtSystem Labs
// ============================================
// CHANGELOG v1.2.0:
// - ADD: Auto-prediction system (every 2 min)
// CHANGELOG v1.1.0:
// - FIX: byHorizon ahora incluye todos los horizontes (120, 240)
// - FIX: Feature extraction completo con mapeos para features derivados
// - FIX: Improved pattern similarity calculation
// - ADD: Debug logging mejorado
// - ADD: Feature validation on init
// ============================================

'use strict';

const AIEnginePro = {
  version: '1.2.0',
  isReady: false,
  db: null,
  
  // ============================================
  // 🎯 CONFIGURATION
  // ============================================
  config: {
    // Prediction horizons (minutes)
    horizons: [2, 5, 10, 15, 30, 60, 120, 240],
    
    // Minimum confidence to generate signal
    minConfidence: 0.65,
    
    // Ensemble voting threshold
    ensembleThreshold: 0.6,
    
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
      features: ['rsi', 'stoch_rsi', 'momentum', 'rsi_divergence'],
      predictions: 0,
      correct: 0
    },
    trend: {
      name: 'Trend',
      weight: 1.0,
      accuracy: 0.5,
      features: ['ema_cross', 'macd', 'adx', 'supertrend'],
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
      features: ['candlestick_patterns', 'chart_patterns', 'divergences'],
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
    
    // Start optimization loop
    this.startOptimizationLoop();
    
    // Hook into AILearning
    this.hookIntoBase();
    
    // Start auto-prediction loop
    this.startAutoPrediction();
    
    this.isReady = true;
    console.log('[AI-PRO] ✓ AI Engine PRO ready');
    console.log('[AI-PRO] Models:', Object.keys(this.models).length);
    console.log('[AI-PRO] Features:', Object.keys(this.features.derived).length);
    console.log('[AI-PRO] Horizons:', this.config.horizons.join(', ') + ' min');
    
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
      votes[prediction.direction] += weight;
      totalWeight += weight;
    }
    
    // Normalize votes
    for (const dir of Object.keys(votes)) {
      votes[dir] = totalWeight > 0 ? votes[dir] / totalWeight : 0.33;
    }
    
    // Determine consensus
    let direction = 'NEUTRAL';
    let confidence = 0;
    
    if (votes.BULL > this.config.ensembleThreshold) {
      direction = 'BULL';
      confidence = votes.BULL;
    } else if (votes.BEAR > this.config.ensembleThreshold) {
      direction = 'BEAR';
      confidence = votes.BEAR;
    } else {
      confidence = Math.max(votes.BULL, votes.BEAR, votes.NEUTRAL);
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
    if (breakout && breakout.classification === 'FAKE_BREAKOUT_RISK') confidence *= 0.85;
    
    // Check pattern memory
    const patternMatch = this.queryLongTermMemory(marketState);
    if (patternMatch.found) {
      confidence = (confidence + patternMatch.confidence) / 2;
      if (patternMatch.direction !== direction && patternMatch.confidence > 0.7) {
        confidence *= 0.7;
      }
    }
    
    return {
      direction,
      confidence: Math.min(0.95, confidence),
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
      } else {
        bearScore += Math.abs(value) * weight;
      }
      featureCount++;
    }
    
    if (featureCount === 0) {
      return { direction: 'NEUTRAL', confidence: 0.5, featureCount: 0 };
    }
    
    const total = bullScore + bearScore;
    if (total === 0) {
      return { direction: 'NEUTRAL', confidence: 0.5, featureCount };
    }
    
    const bullProb = bullScore / total;
    const bearProb = bearScore / total;
    
    let direction = 'NEUTRAL';
    let confidence = 0.5;
    
    if (bullProb > 0.55) {
      direction = 'BULL';
      confidence = bullProb;
    } else if (bearProb > 0.55) {
      direction = 'BEAR';
      confidence = bearProb;
    }
    
    return { direction, confidence, featureCount };
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
      'trending_up': 1.15,
      'trending_down': 1.15,
      'ranging': 0.85,
      'volatile': 0.7
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
    if (volScore >= 0.8) return 0.85;
    if (volScore >= 0.65) return 0.92;
    if (volScore <= 0.25) return 1.03;
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
    
    // Update horizon statistics (with safe check)
    if (this.predictions.byHorizon[horizon]) {
      this.predictions.byHorizon[horizon].total++;
      if (success) this.predictions.byHorizon[horizon].correct++;
      this.predictions.byHorizon[horizon].accuracy = 
        this.predictions.byHorizon[horizon].correct / this.predictions.byHorizon[horizon].total;
    }
    
    // Complete after longest horizon
    if (horizon === Math.max(...this.config.horizons)) {
      this.completeProPrediction(pred);
    }
  },

  completeProPrediction(pred) {
    const verifs = pred.verifications || [];
    const minValidations = Math.min(this.config.minValidationsToLearn, this.config.horizons.length);

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
    const mustLearn = (c >= 0.7) || (Math.abs(avgPriceChange) >= 0.35) || (br && br.classification !== 'NEUTRAL');
    
    if (mustLearn && verifs.length >= minValidations) {
      pred.session = pred.ensemble?.session;
      pred.volScore = pred.ensemble?.volScore;
      pred.breakout = pred.ensemble?.breakout;
      this.storeInLongTermMemory(pred, { success, priceChange: avgPriceChange });
    }
    
    this.predictions.completed.push(pred);
    this.predictions.pending = this.predictions.pending.filter(p => p.id !== pred.id);
    
    this.updatePerformance(pred);
    
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
  },

  // ============================================
  // 🤖 AUTO-PREDICTION SYSTEM
  // ============================================
  startAutoPrediction() {
    // Generate predictions automatically every 2 minutes
    const AUTO_PREDICT_INTERVAL = 120000; // 2 minutes
    
    setInterval(() => {
      this.generateAutoPrediction();
    }, AUTO_PREDICT_INTERVAL);
    
    // First prediction after 30 seconds
    setTimeout(() => {
      this.generateAutoPrediction();
    }, 30000);
    
    console.log('[AI-PRO] Auto-prediction started (every 2 min)');
  },

  generateAutoPrediction() {
    if (!this.isReady || !window.state?.price) {
      return;
    }
    
    // Don't generate if we have too many pending
    if (this.predictions.pending.length >= 10) {
      console.log('[AI-PRO] Skipping auto-prediction: too many pending');
      return;
    }
    
    const marketState = this.getCurrentMarketState();
    const ensemble = this.generateEnsemblePrediction(marketState);
    
    // Only record if confidence is meaningful
    if (ensemble.confidence < this.config.minConfidence) {
      console.log('[AI-PRO] Skipping: low confidence', (ensemble.confidence * 100).toFixed(1) + '%');
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
    
    // Schedule verifications
    for (const horizon of this.config.horizons) {
      setTimeout(() => this.verifyProPrediction(predId, horizon), horizon * 60000);
    }
    
    console.log(`[AI-PRO] 🎯 Auto-prediction: ${ensemble.direction} @ ${(ensemble.confidence * 100).toFixed(1)}% | Price: ${window.state.price.toFixed(4)} | Pending: ${this.predictions.pending.length}`);
  },

  // ============================================
  // 💾 STATE PERSISTENCE
  // ============================================
  async loadState() {
    if (this.db) {
      try {
        const { doc, getDoc } = window.AILearning.firestore;
        
        const modelsDoc = await getDoc(doc(this.db, 'ai', 'pro_models'));
        if (modelsDoc.exists()) {
          const savedModels = modelsDoc.data();
          for (const [name, data] of Object.entries(savedModels)) {
            if (this.models[name]) {
              Object.assign(this.models[name], data);
            }
          }
        }
        
        const memoryDoc = await getDoc(doc(this.db, 'ai', 'pro_memory'));
        if (memoryDoc.exists()) {
          const savedMemory = memoryDoc.data();
          this.memory.patterns = savedMemory.patterns || [];
          this.memory.correlations = savedMemory.correlations || {};
        }
        
        const perfDoc = await getDoc(doc(this.db, 'ai', 'pro_performance'));
        if (perfDoc.exists()) {
          Object.assign(this.performance, perfDoc.data());
        }
        
        const horizonDoc = await getDoc(doc(this.db, 'ai', 'pro_horizons'));
        if (horizonDoc.exists()) {
          const savedHorizons = horizonDoc.data();
          for (const [h, data] of Object.entries(savedHorizons)) {
            if (this.predictions.byHorizon[h]) {
              Object.assign(this.predictions.byHorizon[h], data);
            }
          }
        }
        
        console.log('[AI-PRO] State loaded from Firestore');
        console.log('[AI-PRO] Memory patterns:', this.memory.patterns.length);
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
  },

  async saveState() {
    if (this.db && window.AILearning?.user) {
      try {
        const { doc, setDoc } = window.AILearning.firestore;
        
        const modelsData = {};
        for (const [name, model] of Object.entries(this.models)) {
          modelsData[name] = {
            weight: model.weight,
            accuracy: model.accuracy,
            predictions: model.predictions,
            correct: model.correct
          };
        }
        await setDoc(doc(this.db, 'ai', 'pro_models'), modelsData);
        
        await setDoc(doc(this.db, 'ai', 'pro_memory'), {
          patterns: this.memory.patterns.slice(-500),
          correlations: this.memory.correlations,
          updatedAt: new Date().toISOString()
        });
        
        await setDoc(doc(this.db, 'ai', 'pro_performance'), this.performance);
        await setDoc(doc(this.db, 'ai', 'pro_horizons'), this.predictions.byHorizon);
        
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
  getCurrentMarketState() {
    const s = window.state || {};
    return {
      price: s.price,
      prevPrice: s.prevPrice,
      indicators: s.indicators || {},
      volume: s.volume,
      cvd: s.cvd,
      whaleFlow: s.whaleFlow,
      supportResistance: s.supportResistance,
      orderBlocks: s.orderBlocks,
      fvg: s.fvg,
      liquidity: s.liquidity,
      patterns: s.patterns,
      chartPattern: s.chartPattern,
      divergence: s.divergence,
      mtf: s.mtf,
      volatility: s.volatility,
      atr: s.atr,
      atrAvg: s.atrAvg,
      lastCandle: s.lastCandle || s.candle || s.lastOHLC || null,
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

  // ============================================
  // 📌 LIVE ACCURACY (EARLY FEEDBACK)
  // ============================================
  computeLiveAccuracy() {
    try {
      const byH = this.predictions && this.predictions.byHorizon ? this.predictions.byHorizon : {};
      const preferred = [2, 5, 10, 15, 30, 60];
      let wSum = 0.0;
      let aSum = 0.0;

      for (const h of preferred) {
        const s = byH[h];
        if (!s || !s.total || s.total < 3) continue;

        // More weight to shorter horizons for early reliability
        const weight = (1.0 / (1.0 + (h / 10))) * Math.min(1.0, s.total / 20);
        wSum += weight;
        aSum += weight * (s.accuracy || 0);
      }

      if (wSum <= 0) return 0;
      const live = aSum / wSum;
      // Clamp to sane range
      return Math.max(0, Math.min(1, live));
    } catch (_) {
      return 0;
    }
  },

  getStats() {
    const liveAcc = this.computeLiveAccuracy();
    const completedAcc = this.performance.overall.accuracy || 0;

    // Clone to avoid mutating internal perf object from the UI layer
    const overall = Object.assign({}, this.performance.overall);

    // If no completed predictions yet, expose live accuracy from short-horizon verifications
    if (!overall.totalPredictions || overall.totalPredictions < 1) {
      overall.accuracy = liveAcc;
    }

    overall.liveAccuracy = liveAcc;
    overall.completedAccuracy = completedAcc;

    return {
      overall: overall,
      horizons: this.predictions.byHorizon,
      models: this.getModelStats(),
      memory: {
        patterns: this.memory.patterns.length,
        pending: this.predictions.pending.length
      },
      config: {
        learningRate: this.config.learningRate,
        minConfidence: this.config.minConfidence
      }
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

console.log('[AI-PRO] AI Engine PRO v1.2.0 module loaded (with Auto-Prediction)');
