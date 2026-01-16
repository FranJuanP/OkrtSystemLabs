// ============================================
// 🧠 AI ENGINE PRO v1.1.0
// Advanced Self-Learning System for ORACULUM
// Copyright (c) 2025-2026 OkrtSystem Labs
// ============================================
// This module extends AILearning without modifying it
// Requires: Firebase initialized, AILearning loaded
// ============================================
// v1.1.0 - Firebase optimizations:
// - Single document storage (4 docs → 1)
// - Debounced saves (3s delay)
// - Retry with exponential backoff
// - Local cache to minimize reads
// - Rate limiting protection
// ============================================

'use strict';

const AIEnginePro = {
  version: '1.1.0',
  isReady: false,
  db: null,
  
  // ============================================
  // 🔧 FIREBASE OPTIMIZATION
  // ============================================
  _firebaseState: {
    lastSave: 0,
    saveTimeout: null,
    pendingSave: false,
    retryCount: 0,
    maxRetries: 3,
    baseDelay: 1000,
    saveDebounceMs: 3000,  // Wait 3s between saves
    minSaveInterval: 10000, // Minimum 10s between actual writes
    lastLoadHash: null,
    isOnline: true
  },

  // ============================================
  // 🎯 CONFIGURATION
  // ============================================
  config: {
    // Prediction horizons (minutes)
    horizons: [2, 5, 10, 15, 30, 60],
    
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
    featureThreshold: 0.1
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
    
    // Setup online/offline detection
    this._setupConnectivityListener();
    
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
  // 🌐 CONNECTIVITY MANAGEMENT
  // ============================================
  _setupConnectivityListener() {
    window.addEventListener('online', () => {
      this._firebaseState.isOnline = true;
      console.log('[AI-PRO] Connection restored');
      // Try to sync pending changes
      if (this._firebaseState.pendingSave) {
        this.saveState();
      }
    });
    
    window.addEventListener('offline', () => {
      this._firebaseState.isOnline = false;
      console.log('[AI-PRO] Connection lost, using local mode');
    });
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
    
    // Apply regime multiplier
    const regime = this.detectMarketRegime(marketState);
    const regimeMultiplier = this.getRegimeConfidenceMultiplier(regime);
    confidence *= regimeMultiplier;
    
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
  // 💾 LONG-TERM MEMORY OPERATIONS
  // ============================================
  queryLongTermMemory(marketState) {
    const regime = this.detectMarketRegime(marketState);
    const features = this.extractFeatureVector(marketState);
    
    // Find similar patterns in memory
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const pattern of this.memory.patterns) {
      if (pattern.regime !== regime) continue;
      
      const similarity = this.calculateSimilarity(features, pattern.features);
      if (similarity > bestSimilarity && similarity > 0.75) {
        bestSimilarity = similarity;
        bestMatch = pattern;
      }
    }
    
    if (bestMatch) {
      return {
        found: true,
        confidence: bestSimilarity * bestMatch.successRate,
        direction: bestMatch.direction,
        occurrences: bestMatch.occurrences,
        avgReturn: bestMatch.avgReturn
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
    const pattern = {
      id: Date.now().toString(36),
      regime: prediction.regime,
      direction: prediction.direction,
      features: prediction.features || {},
      successRate: outcome.success ? 1 : 0,
      occurrences: 1,
      avgReturn: outcome.priceChange || 0,
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
      similar.successRate = (similar.successRate * (similar.occurrences - 1) + (outcome.success ? 1 : 0)) / similar.occurrences;
      similar.avgReturn = (similar.avgReturn * (similar.occurrences - 1) + (outcome.priceChange || 0)) / similar.occurrences;
      similar.timestamp = Date.now();
    } else {
      // Add new pattern
      this.memory.patterns.push(pattern);
      
      // Limit memory size
      if (this.memory.patterns.length > this.config.maxLongTermPatterns) {
        // Remove oldest patterns with low occurrence
        this.memory.patterns.sort((a, b) => (b.occurrences * 0.7 + b.timestamp * 0.3) - (a.occurrences * 0.7 + a.timestamp * 0.3));
        this.memory.patterns = this.memory.patterns.slice(0, this.config.maxLongTermPatterns);
      }
    }
    
    // Trigger debounced save
    this.scheduleSave();
  },

  // ============================================
  // 🎓 PRO PREDICTION RECORDING
  // ============================================
  recordProPrediction(pred, id) {
    const marketState = this.getCurrentMarketState();
    const ensemble = this.generateEnsemblePrediction(marketState);
    
    // Store enhanced prediction
    this.predictions.pending.push({
      id,
      timestamp: Date.now(),
      baseDirection: pred.direction,
      ensembleDirection: ensemble.direction,
      ensembleConfidence: ensemble.confidence,
      regime: ensemble.regime,
      modelVotes: ensemble.votes,
      features: this.extractFeatureVector(marketState),
      horizons: this.config.horizons.map(h => ({
        minutes: h,
        targetTime: Date.now() + h * 60000,
        verified: false
      }))
    });
    
    // Update model predictions count
    for (const model of Object.values(this.models)) {
      model.predictions++;
    }
    
    // Schedule verification
    this.scheduleVerification(id);
    
    // Trigger debounced save
    this.scheduleSave();
  },

  scheduleVerification(id) {
    // Verify at each horizon
    for (const horizon of this.config.horizons) {
      setTimeout(() => this.verifyPrediction(id, horizon), horizon * 60000);
    }
  },

  verifyPrediction(id, horizon) {
    const pred = this.predictions.pending.find(p => p.id === id);
    if (!pred) return;
    
    const horizonData = pred.horizons.find(h => h.minutes === horizon);
    if (!horizonData || horizonData.verified) return;
    
    const currentPrice = window.state?.price;
    const startPrice = pred.startPrice || window.state?.price;
    
    if (!currentPrice || !startPrice) return;
    
    const priceChange = (currentPrice - startPrice) / startPrice;
    const success = (pred.ensembleDirection === 'BULL' && priceChange > 0) ||
                    (pred.ensembleDirection === 'BEAR' && priceChange < 0);
    
    horizonData.verified = true;
    horizonData.success = success;
    horizonData.priceChange = priceChange;
    
    // Update horizon stats
    const hStats = this.predictions.byHorizon[horizon];
    if (hStats) {
      hStats.total++;
      if (success) hStats.correct++;
      hStats.accuracy = hStats.correct / hStats.total;
    }
    
    // Trigger debounced save
    this.scheduleSave();
  },

  // ============================================
  // 📊 PRO MODEL UPDATES
  // ============================================
  updateProModels(completedPred) {
    // Find matching pending prediction
    const pred = this.predictions.pending.find(p => p.id === completedPred.id);
    if (!pred) return;
    
    // Move to completed
    pred.outcome = completedPred.outcome;
    this.predictions.completed.push(pred);
    this.predictions.pending = this.predictions.pending.filter(p => p.id !== completedPred.id);
    
    // Update each model based on their contribution
    const success = completedPred.outcome?.success || false;
    
    for (const [modelName, model] of Object.entries(this.models)) {
      const modelPred = pred.modelVotes?.[modelName];
      if (!modelPred) continue;
      
      const modelCorrect = (modelPred > 0.5 && success && pred.ensembleDirection === 'BULL') ||
                          (modelPred < 0.5 && success && pred.ensembleDirection === 'BEAR');
      
      if (modelCorrect) {
        model.correct++;
        model.weight = Math.min(2.0, model.weight * 1.02);
      } else {
        model.weight = Math.max(0.5, model.weight * 0.98);
      }
      
      model.accuracy = model.correct / model.predictions;
    }
    
    // Store in long-term memory
    this.storeInLongTermMemory(pred, completedPred.outcome || {});
    
    // Update performance
    this.updatePerformance(pred);
    
    // Limit completed predictions
    if (this.predictions.completed.length > 1000) {
      this.predictions.completed = this.predictions.completed.slice(-500);
    }
    
    // Trigger debounced save
    this.scheduleSave();
  },

  updatePerformance(pred) {
    const perf = this.performance.overall;
    perf.totalPredictions++;
    if (pred.outcome?.success) perf.correctPredictions++;
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
  // 💾 OPTIMIZED STATE PERSISTENCE
  // ============================================
  
  // Schedule a debounced save
  scheduleSave() {
    this._firebaseState.pendingSave = true;
    
    // Clear existing timeout
    if (this._firebaseState.saveTimeout) {
      clearTimeout(this._firebaseState.saveTimeout);
    }
    
    // Schedule new save with debounce
    this._firebaseState.saveTimeout = setTimeout(() => {
      this.saveState();
    }, this._firebaseState.saveDebounceMs);
  },

  // Generate hash to detect changes
  _generateStateHash() {
    const key = JSON.stringify({
      m: Object.values(this.models).map(m => m.predictions + m.correct),
      p: this.memory.patterns.length,
      t: this.performance.overall.totalPredictions
    });
    return btoa(key).slice(0, 16);
  },

  // Retry with exponential backoff
  async _retryWithBackoff(operation, operationName) {
    const fs = this._firebaseState;
    
    for (let attempt = 0; attempt <= fs.maxRetries; attempt++) {
      try {
        await operation();
        fs.retryCount = 0;
        return true;
      } catch (error) {
        const delay = fs.baseDelay * Math.pow(2, attempt);
        
        if (attempt < fs.maxRetries) {
          console.warn(`[AI-PRO] ${operationName} failed, retry ${attempt + 1}/${fs.maxRetries} in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          console.error(`[AI-PRO] ${operationName} failed after ${fs.maxRetries} retries:`, error.message);
          return false;
        }
      }
    }
    return false;
  },

  async loadState() {
    // Try Firestore first
    if (this.db && this._firebaseState.isOnline) {
      const loaded = await this._retryWithBackoff(async () => {
        const { doc, getDoc } = window.AILearning.firestore;
        
        // ✅ OPTIMIZED: Single document read instead of 4
        const stateDoc = await getDoc(doc(this.db, 'ai', 'pro_state_v2'));
        
        if (stateDoc.exists()) {
          const state = stateDoc.data();
          
          // Restore models
          if (state.models) {
            for (const [name, data] of Object.entries(state.models)) {
              if (this.models[name]) {
                Object.assign(this.models[name], data);
              }
            }
          }
          
          // Restore memory
          if (state.memory) {
            this.memory.patterns = state.memory.patterns || [];
            this.memory.correlations = state.memory.correlations || {};
          }
          
          // Restore performance
          if (state.performance) {
            Object.assign(this.performance, state.performance);
          }
          
          // Restore horizon stats
          if (state.horizons) {
            Object.assign(this.predictions.byHorizon, state.horizons);
          }
          
          // Store hash for change detection
          this._firebaseState.lastLoadHash = this._generateStateHash();
          
          console.log('[AI-PRO] State loaded from Firestore');
          console.log('[AI-PRO] Memory patterns:', this.memory.patterns.length);
        }
      }, 'Load state');
      
      if (loaded) return;
    }
    
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem('ai_pro_state_v2');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.models) {
          for (const [name, data] of Object.entries(state.models)) {
            if (this.models[name]) Object.assign(this.models[name], data);
          }
        }
        if (state.memory) Object.assign(this.memory, state.memory);
        if (state.performance) Object.assign(this.performance, state.performance);
        if (state.horizons) Object.assign(this.predictions.byHorizon, state.horizons);
        console.log('[AI-PRO] State loaded from localStorage');
      }
    } catch (e) {
      console.warn('[AI-PRO] localStorage load failed:', e);
    }
  },

  async saveState() {
    const fs = this._firebaseState;
    fs.pendingSave = false;
    
    // Check minimum interval between saves
    const now = Date.now();
    if (now - fs.lastSave < fs.minSaveInterval) {
      // Reschedule for later
      this.scheduleSave();
      return;
    }
    
    // Check if state actually changed
    const currentHash = this._generateStateHash();
    if (currentHash === fs.lastLoadHash) {
      return; // No changes to save
    }
    
    // Prepare consolidated state
    const stateData = {
      version: this.version,
      updatedAt: new Date().toISOString(),
      
      // Models (lightweight)
      models: {},
      
      // Memory (limited)
      memory: {
        patterns: this.memory.patterns.slice(-500),
        correlations: this.memory.correlations
      },
      
      // Performance
      performance: this.performance,
      
      // Horizons
      horizons: this.predictions.byHorizon
    };
    
    // Extract model data
    for (const [name, model] of Object.entries(this.models)) {
      stateData.models[name] = {
        weight: model.weight,
        accuracy: model.accuracy,
        predictions: model.predictions,
        correct: model.correct
      };
    }
    
    // Save to Firestore
    if (this.db && window.AILearning?.user && fs.isOnline) {
      const saved = await this._retryWithBackoff(async () => {
        const { doc, setDoc } = window.AILearning.firestore;
        
        // ✅ OPTIMIZED: Single document write instead of 4
        await setDoc(doc(this.db, 'ai', 'pro_state_v2'), stateData);
        
        fs.lastSave = now;
        fs.lastLoadHash = currentHash;
      }, 'Save state');
      
      if (!saved) {
        // Firestore failed, ensure localStorage backup
        this._saveToLocalStorage(stateData);
      }
    } else {
      // Offline mode - save to localStorage
      this._saveToLocalStorage(stateData);
    }
  },

  _saveToLocalStorage(stateData) {
    try {
      // Compress for localStorage (limit patterns)
      const localData = {
        ...stateData,
        memory: {
          patterns: this.memory.patterns.slice(-100),
          correlations: this.memory.correlations
        }
      };
      localStorage.setItem('ai_pro_state_v2', JSON.stringify(localData));
    } catch (e) {
      console.warn('[AI-PRO] localStorage save failed:', e);
    }
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
      },
      firebase: {
        lastSave: this._firebaseState.lastSave ? new Date(this._firebaseState.lastSave).toISOString() : 'never',
        pendingSave: this._firebaseState.pendingSave,
        isOnline: this._firebaseState.isOnline
      }
    };
  },
  
  // Force save
  forceSave() {
    this._firebaseState.lastSave = 0; // Reset interval check
    return this.saveState();
  },
  
  // Get Firebase status
  getFirebaseStatus() {
    return {
      isOnline: this._firebaseState.isOnline,
      lastSave: this._firebaseState.lastSave,
      pendingSave: this._firebaseState.pendingSave,
      retryCount: this._firebaseState.retryCount
    };
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
