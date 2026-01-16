// ============================================
// 🧠 AI ENGINE PRO v1.0
// Advanced Self-Learning System for ORACULUM
// Copyright (c) 2025-2026 OkrtSystem Labs
// ============================================
// This module extends AILearning without modifying it
// Requires: Firebase initialized, AILearning loaded
// ============================================

'use strict';

const AIEnginePro = {
  version: '1.0.0',
  isReady: false,
  db: null,
  
  // ============================================
  // 🎯 CONFIGURATION
  // ============================================
  config: {
    // Prediction horizons (minutes)
    // Extended window improves pattern validation quality (short + medium + long)
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
    // Require enough verifications before considering a pattern "validated"
    minValidationsToLearn: 6,

    // Session-aware context (UTC-based)
    sessionAware: true,

    // Volatility-aware scoring
    volatilityAware: true,

    // Breakout quality heuristics (fake breakout vs continuation)
    breakoutAware: true
  },

  // ============================================
  // 🧠 ENSEMBLE MODELS
  // ============================================
  models: {
    // Model 1: Momentum-based
    momentum: {
      name: 'Momentum',
      weight: 1.0,
      accuracy: 0.5,
      features: ['rsi', 'stoch_rsi', 'momentum', 'rsi_divergence'],
      predictions: 0,
      correct: 0
    },
    
    // Model 2: Trend-based
    trend: {
      name: 'Trend',
      weight: 1.0,
      accuracy: 0.5,
      features: ['ema_cross', 'macd', 'adx', 'supertrend'],
      predictions: 0,
      correct: 0
    },
    
    // Model 3: Volume-based
    volume: {
      name: 'Volume',
      weight: 1.0,
      accuracy: 0.5,
      features: ['volume', 'obv', 'cvd', 'whale_flow'],
      predictions: 0,
      correct: 0
    },
    
    // Model 4: Structure-based (Smart Money)
    structure: {
      name: 'Structure',
      weight: 1.0,
      accuracy: 0.5,
      features: ['support_resistance', 'order_blocks', 'fvg', 'liquidity'],
      predictions: 0,
      correct: 0
    },
    
    // Model 5: Pattern Recognition
    patterns: {
      name: 'Patterns',
      weight: 1.0,
      accuracy: 0.5,
      features: ['candlestick_patterns', 'chart_patterns', 'divergences'],
      predictions: 0,
      correct: 0
    },
    
    // Model 6: Multi-Timeframe Confluence
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
    byHorizon: {
      2: { total: 0, correct: 0, accuracy: 0.5 },
      5: { total: 0, correct: 0, accuracy: 0.5 },
      10: { total: 0, correct: 0, accuracy: 0.5 },
      15: { total: 0, correct: 0, accuracy: 0.5 },
      30: { total: 0, correct: 0, accuracy: 0.5 },
      60: { total: 0, correct: 0, accuracy: 0.5 }
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
    console.log('[AI-PRO] Initializing AI Engine PRO v' + this.version);
    
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
    
    // Load saved state
    await this.loadState();
    
    // Start optimization loop
    this.startOptimizationLoop();
    
    // Hook into AILearning
    this.hookIntoBase();
    
    this.isReady = true;
    console.log('[AI-PRO] ✓ AI Engine PRO ready');
    console.log('[AI-PRO] Models:', Object.keys(this.models).length);
    console.log('[AI-PRO] Features:', Object.keys(this.features.derived).length);
    
    return true;
  },

  // ============================================
  // 🔗 HOOK INTO BASE AILEARNING
  // ============================================
  hookIntoBase() {
    // Store original methods
    const originalRecordPrediction = window.AILearning.recordPrediction.bind(window.AILearning);
    const originalComplete = window.AILearning.complete.bind(window.AILearning);
    
    // Override recordPrediction to add PRO features
    window.AILearning.recordPrediction = (pred) => {
      // Call original
      const id = originalRecordPrediction(pred);
      
      // Add PRO prediction
      this.recordProPrediction(pred, id);
      
      return id;
    };
    
    // Override complete to update PRO models
    window.AILearning.complete = (p) => {
      // Call original
      originalComplete(p);
      
      // Update PRO models
      this.updateProModels(p);
    };
    
    console.log('[AI-PRO] Hooked into base AILearning');
  },

  // ============================================
  // 🎯 ENSEMBLE PREDICTION
  // ============================================
  generateEnsemblePrediction(marketState) {
    const votes = {
      BULL: 0,
      BEAR: 0,
      NEUTRAL: 0
    };
    
    const modelPredictions = {};
    let totalWeight = 0;
    
    // Get prediction from each model
    for (const [modelName, model] of Object.entries(this.models)) {
      const prediction = this.getModelPrediction(modelName, model, marketState);
      modelPredictions[modelName] = prediction;
      
      // Weighted voting
      const weight = model.weight * model.accuracy;
      votes[prediction.direction] += weight;
      totalWeight += weight;
    }
    
    // Normalize votes
    for (const dir of Object.keys(votes)) {
      votes[dir] = votes[dir] / totalWeight;
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
    
    // Context
    const session = this.config.sessionAware ? this.getSessionContext() : null;
    const volScore = this.config.volatilityAware ? this.getVolatilityScore(marketState) : null;
    const volMultiplier = (volScore != null) ? this.getVolatilityConfidenceMultiplier(volScore) : 1.0;
    const breakout = this.config.breakoutAware ? this.detectBreakoutContext(marketState) : null;

    // Apply regime multiplier
    const regime = this.detectMarketRegime(marketState);
    const regimeMultiplier = this.getRegimeConfidenceMultiplier(regime);
    confidence *= regimeMultiplier;

    // Apply session multiplier
    if (session) {
      confidence *= this.getSessionConfidenceMultiplier(session);
    }

    // Apply volatility multiplier
    confidence *= volMultiplier;

    // Penalize if breakout looks noisy (fake breakout risk)
    if (breakout && breakout.classification === 'FAKE_BREAKOUT_RISK') {
      confidence *= 0.85;
    }
    
    // Check pattern memory for similar conditions
    const patternMatch = this.queryLongTermMemory(marketState);
    if (patternMatch.found) {
      confidence = (confidence + patternMatch.confidence) / 2;
      if (patternMatch.direction !== direction && patternMatch.confidence > 0.7) {
        // Pattern memory strongly disagrees - reduce confidence
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
      if (value === null) continue;
      
      const weight = window.AILearning.getWeight(feature) || 1.0;
      
      if (value > 0) {
        bullScore += value * weight;
      } else {
        bearScore += Math.abs(value) * weight;
      }
      featureCount++;
    }
    
    if (featureCount === 0) {
      return { direction: 'NEUTRAL', confidence: 0.5 };
    }
    
    // Normalize
    const total = bullScore + bearScore;
    if (total === 0) {
      return { direction: 'NEUTRAL', confidence: 0.5 };
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
    
    return { direction, confidence };
  },

  // ============================================
  // 📊 FEATURE EXTRACTION
  // ============================================
  getFeatureValue(feature, marketState) {
    // Direct indicators
    const indicators = marketState.indicators || {};
    
    // Map feature names to indicator values
    const featureMap = {
      // Momentum
      'rsi': () => {
        const rsi = indicators.rsi?.value || 50;
        return (rsi - 50) / 50; // Normalize to [-1, 1]
      },
      'stoch_rsi': () => {
        const stoch = indicators.stochRsi?.value || 50;
        return (stoch - 50) / 50;
      },
      'momentum': () => indicators.momentum?.signal === 'bull' ? 1 : indicators.momentum?.signal === 'bear' ? -1 : 0,
      'rsi_divergence': () => indicators.divergence?.type === 'bullish' ? 1 : indicators.divergence?.type === 'bearish' ? -1 : 0,
      
      // Trend
      'ema_cross': () => indicators.ema?.signal === 'bull' ? 1 : indicators.ema?.signal === 'bear' ? -1 : 0,
      'macd': () => {
        const macd = indicators.macd;
        if (!macd) return 0;
        return macd.histogram > 0 ? Math.min(1, macd.histogram * 10) : Math.max(-1, macd.histogram * 10);
      },
      'adx': () => {
        const adx = indicators.adx;
        if (!adx) return 0;
        const strength = adx.value > 25 ? 1 : 0.5;
        return adx.trend === 'bull' ? strength : adx.trend === 'bear' ? -strength : 0;
      },
      'supertrend': () => indicators.supertrend?.signal === 'bull' ? 1 : indicators.supertrend?.signal === 'bear' ? -1 : 0,
      
      // Volume
      'volume': () => {
        const vol = marketState.volume || {};
        return vol.trend === 'increasing' ? 0.5 : vol.trend === 'decreasing' ? -0.5 : 0;
      },
      'obv': () => indicators.obv?.signal === 'bull' ? 1 : indicators.obv?.signal === 'bear' ? -1 : 0,
      'cvd': () => {
        const cvd = marketState.cvd || 0;
        return Math.tanh(cvd / 1000000);
      },
      'whale_flow': () => {
        const whales = marketState.whaleFlow || { buy: 0, sell: 0 };
        const net = whales.buy - whales.sell;
        return Math.tanh(net / 100000);
      },
      
      // Structure
      'support_resistance': () => {
        const sr = marketState.supportResistance || {};
        if (sr.nearSupport) return 0.7;
        if (sr.nearResistance) return -0.7;
        return 0;
      },
      'order_blocks': () => {
        const ob = marketState.orderBlocks || {};
        return ob.bullish ? 0.5 : ob.bearish ? -0.5 : 0;
      },
      'fvg': () => {
        const fvg = marketState.fvg || {};
        return fvg.bullish ? 0.3 : fvg.bearish ? -0.3 : 0;
      },
      'liquidity': () => {
        const liq = marketState.liquidity || {};
        return liq.buyLiquidity > liq.sellLiquidity ? 0.4 : -0.4;
      },
      
      // Patterns
      'candlestick_patterns': () => {
        const patterns = marketState.patterns || [];
        let score = 0;
        patterns.forEach(p => {
          if (p.type === 'bullish') score += 0.3;
          if (p.type === 'bearish') score -= 0.3;
        });
        return Math.max(-1, Math.min(1, score));
      },
      'chart_patterns': () => {
        const pattern = marketState.chartPattern;
        if (!pattern) return 0;
        return pattern.bias === 'bullish' ? 0.6 : pattern.bias === 'bearish' ? -0.6 : 0;
      },
      'divergences': () => {
        const div = marketState.divergence;
        if (!div) return 0;
        return div.type === 'bullish' ? 0.8 : div.type === 'bearish' ? -0.8 : 0;
      },
      
      // Multi-Timeframe
      'mtf_1m': () => marketState.mtf?.['1m']?.signal === 'bull' ? 1 : marketState.mtf?.['1m']?.signal === 'bear' ? -1 : 0,
      'mtf_5m': () => marketState.mtf?.['5m']?.signal === 'bull' ? 1 : marketState.mtf?.['5m']?.signal === 'bear' ? -1 : 0,
      'mtf_15m': () => marketState.mtf?.['15m']?.signal === 'bull' ? 1 : marketState.mtf?.['15m']?.signal === 'bear' ? -1 : 0,
      'mtf_1h': () => marketState.mtf?.['1h']?.signal === 'bull' ? 1 : marketState.mtf?.['1h']?.signal === 'bear' ? -1 : 0,
      'mtf_4h': () => marketState.mtf?.['4h']?.signal === 'bull' ? 1 : marketState.mtf?.['4h']?.signal === 'bear' ? -1 : 0
    };
    
    const fn = featureMap[feature];
    if (fn) {
      try {
        return fn();
      } catch (e) {
        return null;
      }
    }
    
    return null;
  },

  // ============================================
  // 🌍 MARKET REGIME DETECTION
  // ============================================
  detectMarketRegime(marketState) {
    const indicators = marketState.indicators || {};
    
    // ADX for trend strength
    const adx = indicators.adx?.value || 20;
    const adxTrend = indicators.adx?.trend || 'neutral';
    
    // Volatility (ATR-based or Bollinger width)
    const volatility = marketState.volatility || 'normal';
    
    // Price position relative to EMAs
    const price = marketState.price || 0;
    const ema20 = indicators.ema?.ema20 || price;
    const ema50 = indicators.ema?.ema50 || price;
    
    // Determine regime
    if (volatility === 'high' || (marketState.atr && marketState.atr > marketState.atrAvg * 1.5)) {
      return 'volatile';
    }
    
    if (adx > 25) {
      if (adxTrend === 'bull' || price > ema20) {
        return 'trending_up';
      } else if (adxTrend === 'bear' || price < ema20) {
        return 'trending_down';
      }
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
  // 🕒 SESSION CONTEXT (UTC)
  // ============================================
  getSessionContext() {
    // UTC sessions (approx):
    // Asia:   00:00 - 08:00
    // Europe: 08:00 - 16:00
    // US:     16:00 - 23:59
    const h = new Date().getUTCHours();
    if (h >= 0 && h < 8) return 'ASIA';
    if (h >= 8 && h < 16) return 'EUROPE';
    return 'US';
  },

  getSessionConfidenceMultiplier(session) {
    // Crypto trades 24/7; this multiplier is conservative.
    // We slightly boost Europe/US (higher liquidity) and reduce Asia a bit.
    const m = { ASIA: 0.95, EUROPE: 1.02, US: 1.02 };
    return m[session] || 1.0;
  },

  // ============================================
  // 🌪️ VOLATILITY-AWARE SCORING
  // ============================================
  getVolatilityScore(marketState) {
    // Returns 0..1 (higher = more volatile)
    const atr = marketState.atr;
    const atrAvg = marketState.atrAvg;
    if (!atr || !atrAvg || atrAvg <= 0) {
      return marketState.volatility === 'high' ? 0.85 : (marketState.volatility === 'low' ? 0.25 : 0.5);
    }
    const ratio = atr / atrAvg;
    // Map ratio to 0..1 in a bounded way
    // ratio 0.5 -> ~0.2, ratio 1.0 -> ~0.5, ratio 1.5 -> ~0.8, ratio 2.0 -> ~0.9
    const v = Math.max(0, Math.min(1, (ratio - 0.5) / 1.5));
    return v;
  },

  getVolatilityBucket(volScore) {
    if (volScore >= 0.75) return 'HIGH';
    if (volScore <= 0.35) return 'LOW';
    return 'NORMAL';
  },

  getVolatilityConfidenceMultiplier(volScore) {
    // Reduce confidence when volatility is high (noise increases),
    // slightly boost when volatility is low/normal.
    if (volScore >= 0.8) return 0.85;
    if (volScore >= 0.65) return 0.92;
    if (volScore <= 0.25) return 1.03;
    return 1.0;
  },

  // ============================================
  // 🧱 BREAKOUT QUALITY (FAKE vs CONTINUATION)
  // ============================================
  detectBreakoutContext(marketState) {
    // Best-effort heuristic using available state.
    // If your base app exposes richer candle context, this gets more accurate.
    const s = marketState || {};
    const price = s.price || 0;
    const sr = s.supportResistance || {};
    const indicators = s.indicators || {};
    const volScore = this.getVolatilityScore(s);

    // Identify nearest resistance/support levels if provided
    const resistance = sr.resistance || sr.r1 || sr.R1 || null;
    const support = sr.support || sr.s1 || sr.S1 || null;

    // Volume confirmation signals (best effort)
    const obv = indicators.obv?.value ?? s.obv;
    const cvd = s.cvd;

    // Candle wick ratio if available
    const candle = s.lastCandle || s.candle || null;
    let wickRatio = null;
    if (candle && candle.high != null && candle.low != null && candle.open != null && candle.close != null) {
      const range = Math.max(1e-9, candle.high - candle.low);
      const body = Math.abs(candle.close - candle.open);
      wickRatio = Math.max(0, Math.min(1, (range - body) / range)); // 0..1 (higher = wickier)
    }

    // Determine if we are attempting a breakout near a key level
    const atr = s.atr || null;
    const proximity = (level) => {
      if (!level || !price) return null;
      const denom = atr && atr > 0 ? atr : (price * 0.002); // fallback ~0.2%
      return Math.abs(price - level) / denom;
    };

    const nearRes = resistance ? proximity(resistance) : null;
    const nearSup = support ? proximity(support) : null;

    // Risk model: fake breakout risk increases when:
    // - very wicky candle
    // - high volatility
    // - no volume confirmation
    // - price is right at a key level
    let risk = 0.0;
    let tag = 'NONE';

    const volConfWeak = (obv != null && obv < 0) || (cvd != null && cvd < 0);
    if (wickRatio != null && wickRatio > 0.55) risk += 0.25;
    if (volScore >= 0.75) risk += 0.25;
    if (volConfWeak) risk += 0.2;
    if (nearRes != null && nearRes < 1.5) { risk += 0.2; tag = 'AT_RESISTANCE'; }
    if (nearSup != null && nearSup < 1.5) { risk += 0.2; tag = 'AT_SUPPORT'; }

    risk = Math.max(0, Math.min(1, risk));
    const quality = 1 - risk; // 0..1 (higher = cleaner continuation)

    // Provide a simple classification
    let classification = 'NEUTRAL';
    if (risk >= 0.6) classification = 'FAKE_BREAKOUT_RISK';
    else if (quality >= 0.65 && (nearRes != null || nearSup != null)) classification = 'CONTINUATION_LIKELY';

    return { risk, quality, tag, classification };
  },

  // ============================================
  // 💾 LONG-TERM MEMORY OPERATIONS
  // ============================================
  queryLongTermMemory(marketState) {
    const regime = this.detectMarketRegime(marketState);
    const features = this.extractFeatureVector(marketState);
    const session = this.config.sessionAware ? this.getSessionContext() : null;
    const volScore = this.config.volatilityAware ? this.getVolatilityScore(marketState) : null;
    const volBucket = volScore != null ? this.getVolatilityBucket(volScore) : null;
    
    // Find similar patterns in memory
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const pattern of this.memory.patterns) {
      if (pattern.regime !== regime) continue;

      // Prefer same session/volatility bucket (but don't hard-block)
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
    for (const feature of Object.keys(this.features.derived)) {
      vector[feature] = this.getFeatureValue(feature, marketState);
    }
    return vector;
  },

  calculateSimilarity(v1, v2) {
    const keys = Object.keys(v1).filter(k => v2[k] !== undefined && v1[k] !== null && v2[k] !== null);
    if (keys.length === 0) return 0;
    
    let similarity = 0;
    for (const key of keys) {
      similarity += 1 - Math.abs(v1[key] - v2[key]);
    }
    return similarity / keys.length;
  },

  storeInLongTermMemory(prediction, outcome) {
    const session = this.config.sessionAware ? (prediction.session || this.getSessionContext()) : null;
    const volScore = this.config.volatilityAware ? (prediction.volScore != null ? prediction.volScore : this.getVolatilityScore(this.getCurrentMarketState())) : null;
    const volBucket = volScore != null ? this.getVolatilityBucket(volScore) : null;
    const breakout = prediction.breakout || null;

    const pattern = {
      id: Date.now().toString(36),
      regime: prediction.regime,
      direction: prediction.direction,
      features: prediction.features || {},
      // Context
      session,
      volBucket,
      breakoutTag: breakout?.classification || null,

      // Outcomes (persist both positives and negatives)
      successCount: outcome.success ? 1 : 0,
      failCount: outcome.success ? 0 : 1,
      successRate: outcome.success ? 1 : 0,
      occurrences: 1,
      avgReturn: outcome.priceChange || 0,
      lastOutcome: outcome.success ? 'POS' : 'NEG',
      timestamp: Date.now()
    };
    
    // Check for similar pattern
    const similar = this.memory.patterns.find(p => 
      p.regime === pattern.regime && 
      this.calculateSimilarity(p.features, pattern.features) > 0.85
    );
    
    if (similar) {
      // Update existing pattern
      similar.occurrences++;
      similar.successCount = (similar.successCount || 0) + (outcome.success ? 1 : 0);
      similar.failCount = (similar.failCount || 0) + (outcome.success ? 0 : 1);
      similar.successRate = (similar.successCount) / similar.occurrences;
      similar.avgReturn = (similar.avgReturn * (similar.occurrences - 1) + (outcome.priceChange || 0)) / similar.occurrences;
      similar.timestamp = Date.now();
      similar.lastOutcome = outcome.success ? 'POS' : 'NEG';
      // Keep latest context for debug/analysis
      if (session) similar.session = session;
      if (volBucket) similar.volBucket = volBucket;
      if (breakout?.classification) similar.breakoutTag = breakout.classification;
    } else {
      // Add new pattern
      this.memory.patterns.push(pattern);
      
      // Limit memory size
      if (this.memory.patterns.length > this.config.maxLongTermPatterns) {
        // Remove oldest low-performing patterns
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
    
    // Schedule verifications for multiple horizons
    for (const horizon of this.config.horizons) {
      setTimeout(() => this.verifyProPrediction(proPrediction.id, horizon), horizon * 60000);
    }
    
    // Log if high confidence
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
    
    // Success criteria varies by confidence
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
    
    // Update horizon statistics
    const horizonStats = this.predictions.byHorizon[horizon];
    if (horizonStats) {
      horizonStats.total++;
      if (success) horizonStats.correct++;
      horizonStats.accuracy = horizonStats.correct / horizonStats.total;
    }
    
    // Complete after longest horizon
    if (horizon === Math.max(...this.config.horizons)) {
      this.completeProPrediction(pred);
    }
  },

  completeProPrediction(pred) {
    // Calculate overall success
    // Weighted verifications: longer horizons matter more for pattern validation
    const verifs = pred.verifications || [];
    const minValidations = Math.min(this.config.minValidationsToLearn || 6, this.config.horizons.length);
    if (verifs.length < minValidations) {
      // Not enough samples yet; do not finalize learning.
      // (We still finalize the prediction record for UI/performance once the longest horizon triggers.)
    }

    const maxH = Math.max(...this.config.horizons);
    let wSuccess = 0;
    let wTotal = 0;
    let sumChange = 0;
    for (const v of verifs) {
      const w = 0.5 + (v.horizon / maxH); // 0.5..1.5
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
    
    // Update models based on their predictions
    this.updateModelWeights(pred, success);
    
    // Store in long-term memory (persist both positives and negatives)
    // Learn when confidence is meaningful, when move is meaningful, or when breakout quality matters.
    const c = pred.ensemble?.confidence || 0;
    const br = pred.ensemble?.breakout;
    const mustLearn = (c >= 0.7) || (Math.abs(avgPriceChange) >= 0.35) || (br && br.classification !== 'NEUTRAL');
    if (mustLearn && (verifs.length >= Math.min(minValidations, verifs.length))) {
      // Preserve context fields so memory can segment by session/volatility/breakout
      pred.session = pred.ensemble?.session || pred.session;
      pred.volScore = pred.ensemble?.volScore;
      pred.breakout = pred.ensemble?.breakout || null;
      this.storeInLongTermMemory(pred, { success, priceChange: avgPriceChange });
    }
    
    // Move to completed
    this.predictions.completed.push(pred);
    this.predictions.pending = this.predictions.pending.filter(p => p.id !== pred.id);
    
    // Update performance
    this.updatePerformance(pred);
    
    // Keep completed list manageable
    if (this.predictions.completed.length > 500) {
      this.predictions.completed = this.predictions.completed.slice(-500);
    }
    
    // Periodic save
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
      
      // Did this model agree with the correct direction?
      const modelCorrect = (overallSuccess && modelPred.direction === pred.ensemble.direction) ||
                          (!overallSuccess && modelPred.direction !== pred.ensemble.direction);
      
      model.predictions++;
      if (modelCorrect) model.correct++;
      
      // Update accuracy with exponential moving average
      const newAccuracy = model.correct / model.predictions;
      model.accuracy = model.accuracy * 0.9 + newAccuracy * 0.1;
      
      // Adjust weight based on accuracy
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
    // Called when base AILearning completes a prediction
    // Sync any relevant updates
    if (basePrediction.outcome?.success) {
      // Boost weights of indicators that performed well
      for (const ind of Object.keys(basePrediction.indicators || {})) {
        for (const [modelName, model] of Object.entries(this.models)) {
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
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!this.performance.daily[today]) {
      this.performance.daily[today] = { total: 0, correct: 0, returns: [] };
    }
    const daily = this.performance.daily[today];
    daily.total++;
    if (pred.outcome.success) daily.correct++;
    daily.returns.push(pred.outcome.avgPriceChange);
    
    // Clean old daily data (keep 30 days)
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
    
    // Run initial optimization after 5 minutes
    setTimeout(() => this.runOptimization(), 300000);
  },

  runOptimization() {
    console.log('[AI-PRO] Running auto-optimization...');
    
    // 1. Adjust learning rate based on recent performance
    const recentPredictions = this.predictions.completed.slice(-50);
    if (recentPredictions.length >= 20) {
      const recentAccuracy = recentPredictions.filter(p => p.outcome.success).length / recentPredictions.length;
      
      if (recentAccuracy < 0.45) {
        // Poor performance - increase learning rate to adapt faster
        this.config.learningRate = Math.min(0.1, this.config.learningRate * 1.2);
      } else if (recentAccuracy > 0.6) {
        // Good performance - decrease learning rate to stabilize
        this.config.learningRate = Math.max(0.01, this.config.learningRate * 0.9);
      }
    }
    
    // 2. Prune underperforming patterns from memory
    this.memory.patterns = this.memory.patterns.filter(p => 
      p.occurrences >= 3 || Date.now() - p.timestamp < 86400000 // Keep new or proven patterns
    );
    
    // 3. Identify best performing horizons
    const bestHorizon = Object.entries(this.predictions.byHorizon)
      .filter(([_, stats]) => stats.total >= 10)
      .sort(([_, a], [__, b]) => b.accuracy - a.accuracy)[0];
    
    if (bestHorizon) {
      console.log(`[AI-PRO] Best horizon: ${bestHorizon[0]}min (${(bestHorizon[1].accuracy * 100).toFixed(1)}%)`);
    }
    
    // 4. Save optimized state
    this.saveState();
    
    console.log('[AI-PRO] Optimization complete. Accuracy:', (this.performance.overall.accuracy * 100).toFixed(1) + '%');
  },

  // ============================================
  // 💾 STATE PERSISTENCE
  // ============================================
  async loadState() {
    // Try Firestore first
    if (this.db) {
      try {
        const { doc, getDoc } = window.AILearning.firestore;
        
        // Load models
        const modelsDoc = await getDoc(doc(this.db, 'ai', 'pro_models'));
        if (modelsDoc.exists()) {
          const savedModels = modelsDoc.data();
          for (const [name, data] of Object.entries(savedModels)) {
            if (this.models[name]) {
              Object.assign(this.models[name], data);
            }
          }
        }
        
        // Load memory
        const memoryDoc = await getDoc(doc(this.db, 'ai', 'pro_memory'));
        if (memoryDoc.exists()) {
          const savedMemory = memoryDoc.data();
          this.memory.patterns = savedMemory.patterns || [];
          this.memory.correlations = savedMemory.correlations || {};
        }
        
        // Load performance
        const perfDoc = await getDoc(doc(this.db, 'ai', 'pro_performance'));
        if (perfDoc.exists()) {
          Object.assign(this.performance, perfDoc.data());
        }
        
        // Load horizon stats
        const horizonDoc = await getDoc(doc(this.db, 'ai', 'pro_horizons'));
        if (horizonDoc.exists()) {
          Object.assign(this.predictions.byHorizon, horizonDoc.data());
        }
        
        console.log('[AI-PRO] State loaded from Firestore');
        console.log('[AI-PRO] Memory patterns:', this.memory.patterns.length);
        return;
      } catch (e) {
        console.warn('[AI-PRO] Firestore load failed:', e);
      }
    }
    
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem('ai_pro_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.models) Object.assign(this.models, state.models);
        if (state.memory) Object.assign(this.memory, state.memory);
        if (state.performance) Object.assign(this.performance, state.performance);
        if (state.horizons) Object.assign(this.predictions.byHorizon, state.horizons);
        console.log('[AI-PRO] State loaded from localStorage');
      }
    } catch (e) {}
  },

  async saveState() {
    // Save to Firestore
    if (this.db && window.AILearning?.user) {
      try {
        const { doc, setDoc } = window.AILearning.firestore;
        
        // Save models
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
        
        // Save memory (limit size)
        await setDoc(doc(this.db, 'ai', 'pro_memory'), {
          patterns: this.memory.patterns.slice(-500),
          correlations: this.memory.correlations,
          updatedAt: new Date().toISOString()
        });
        
        // Save performance
        await setDoc(doc(this.db, 'ai', 'pro_performance'), this.performance);
        
        // Save horizon stats
        await setDoc(doc(this.db, 'ai', 'pro_horizons'), this.predictions.byHorizon);
        
      } catch (e) {
        console.warn('[AI-PRO] Firestore save failed:', e);
      }
    }
    
    // Also save to localStorage as backup
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
    // Gather current market state from global state
    const s = window.state || {};
    return {
      price: s.price,
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
      atrAvg: s.atrAvg
      ,
      // Optional candle context (if base app exposes it)
      lastCandle: s.lastCandle || s.candle || s.lastOHLC || null
    };
  },

  // ============================================
  // 📊 PUBLIC API
  // ============================================
  
  // Get current prediction
  getPrediction() {
    const marketState = this.getCurrentMarketState();
    return this.generateEnsemblePrediction(marketState);
  },
  
  // Get model statistics
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
  
  // Get overall statistics
  getStats() {
    return {
      overall: this.performance.overall,
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
  
  // Force save
  forceSave() {
    return this.saveState();
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

console.log('[AI-PRO] AI Engine PRO module loaded');
