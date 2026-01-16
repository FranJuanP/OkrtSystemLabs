// ============================================
// Market Feed Manager (Failover) — ORACULUM
// Clean & stable build (fixes SyntaxError)
// Copyright (c) 2025–2026 OkrtSystem Labs
// ============================================

'use strict';

/**
 * Candle shape delivered to callback:
 * {
 *   ts: number,            // candle open timestamp (ms)
 *   tf: "1m",
 *   symbol: "XRPUSDT",
 *   open: number,
 *   high: number,
 *   low: number,
 *   close: number,
 *   volume: number,
 *   closed: boolean,
 *   source: "BINANCE" | "COINBASE" | "KRAKEN"
 * }
 */

(function (global) {
  // Avoid redefining
  if (global.MarketFeedManager) return;

  const TF = '1m';

  // ---- Utilities ----
  function now() { return Date.now(); }
  function safeNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function lower(s) { return String(s || '').toLowerCase(); }

  // Small backoff helper
  function backoff(attempt) {
    const base = 800;
    const cap = 15000;
    const t = Math.min(cap, base * Math.pow(1.6, attempt));
    return Math.floor(t + Math.random() * 250);
  }

  class MarketFeedManager {
    constructor(symbol, onCandle) {
      this.symbol = String(symbol || 'XRPUSDT').toUpperCase();
      this.onCandle = typeof onCandle === 'function' ? onCandle : null;

      this._ws = null;
      this._running = false;

      // Failover chain
      this._providers = [
        { name: 'BINANCE', connect: () => this._connectBinance() },
        { name: 'COINBASE', connect: () => this._connectCoinbase() },
        { name: 'KRAKEN', connect: () => this._connectKraken() }
      ];

      this._providerIndex = 0;
      this._reconnectAttempt = 0;

      this._lastClose = 0;
      this._lastTickTs = 0;

      console.log('[FEED] Manager initialized');
    }

    start() {
      if (this._running) return;
      this._running = true;
      console.log('[FEED] Starting feed manager...');
      this._providerIndex = 0;
      this._reconnectAttempt = 0;
      this._connectCurrentProvider();
    }

    stop() {
      this._running = false;
      this._reconnectAttempt = 0;
      this._closeWs();
      console.log('[FEED] Stopped');
    }

    // ---- Core failover ----
    _connectCurrentProvider() {
      if (!this._running) return;

      const p = this._providers[this._providerIndex];
      if (!p) {
        // Reset to first provider
        this._providerIndex = 0;
        return this._connectCurrentProvider();
      }

      try {
        p.connect();
      } catch (e) {
        console.warn('[FEED] Provider connect failed:', p.name, e);
        this._failoverNext();
      }
    }

    _failoverNext() {
      if (!this._running) return;
      this._closeWs();

      this._providerIndex = (this._providerIndex + 1) % this._providers.length;
      const wait = backoff(this._reconnectAttempt++);
      const next = this._providers[this._providerIndex]?.name || 'UNKNOWN';

      console.warn(`[FEED] Failover → ${next} (retry in ${wait}ms)`);
      setTimeout(() => this._connectCurrentProvider(), wait);
    }

    _closeWs() {
      try {
        if (this._ws) {
          this._ws.onopen = null;
          this._ws.onmessage = null;
          this._ws.onerror = null;
          this._ws.onclose = null;
          this._ws.close();
        }
      } catch (_) {}
      this._ws = null;
    }

    _emitCandle(c) {
      if (!this.onCandle) return;
      try {
        this.onCandle(c);
      } catch (e) {
        console.warn('[FEED] onCandle callback error:', e);
      }
    }

    // ---- BINANCE: real 1m klines (best source) ----
    _connectBinance() {
      const sym = lower(this.symbol);
      const url = `wss://stream.binance.com:9443/ws/${sym}@kline_${TF}`;

      console.log('[FEED] Connecting to BINANCE...');
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        this._reconnectAttempt = 0;
        console.log('[FEED][BINANCE] Connected');
      };

      this._ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (!msg || !msg.k) return;

          const k = msg.k;
          // Binance kline fields: t,o,h,l,c,v,x
          const candle = {
            ts: safeNum(k.t),
            tf: TF,
            symbol: this.symbol,
            open: safeNum(k.o),
            high: safeNum(k.h),
            low: safeNum(k.l),
            close: safeNum(k.c),
            volume: safeNum(k.v),
            closed: !!k.x,
            source: 'BINANCE'
          };

          this._lastClose = candle.close || this._lastClose;
          this._lastTickTs = now();
          this._emitCandle(candle);
        } catch (_) {}
      };

      this._ws.onerror = () => {
        console.warn('[FEED][BINANCE] Error');
      };

      this._ws.onclose = () => {
        console.warn('[FEED][BINANCE] Closed');
        this._failoverNext();
      };
    }

    // ---- COINBASE: ticker fallback (pseudo candle) ----
    _connectCoinbase() {
      console.log('[FEED] Connecting to COINBASE...');
      this._ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      const product = this._mapCoinbaseProduct(this.symbol);

      this._ws.onopen = () => {
        this._reconnectAttempt = 0;
        this._ws.send(JSON.stringify({
          type: 'subscribe',
          product_ids: [product],
          channels: ['ticker']
        }));
        console.log('[FEED][COINBASE] Connected');
      };

      this._ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (!msg || msg.type !== 'ticker') return;
          const price = safeNum(msg.price);
          if (!price) return;

          // Build a minimal pseudo-candle around the last price
          const ts = now();
          const candle = {
            ts,
            tf: TF,
            symbol: this.symbol,
            open: this._lastClose || price,
            high: Math.max(this._lastClose || price, price),
            low: Math.min(this._lastClose || price, price),
            close: price,
            volume: safeNum(msg.last_size),
            closed: false,
            source: 'COINBASE'
          };

          this._lastClose = price;
          this._lastTickTs = ts;
          this._emitCandle(candle);
        } catch (_) {}
      };

      this._ws.onerror = () => console.warn('[FEED][COINBASE] Error');
      this._ws.onclose = () => {
        console.warn('[FEED][COINBASE] Closed');
        this._failoverNext();
      };
    }

    _mapCoinbaseProduct(symbol) {
      // XRPUSDT → XRP-USD (best-effort)
      if (symbol === 'XRPUSDT' || symbol === 'XRPUSD') return 'XRP-USD';
      // Try generic mapping: ABCUSDT → ABC-USD
      const m = symbol.match(/^([A-Z0-9]+)(USDT|USD)$/);
      if (m) return `${m[1]}-USD`;
      return 'XRP-USD';
    }

    // ---- KRAKEN: trades fallback (pseudo candle) ----
    _connectKraken() {
      console.log('[FEED] Connecting to KRAKEN...');
      this._ws = new WebSocket('wss://ws.kraken.com');

      this._ws.onopen = () => {
        this._reconnectAttempt = 0;
        this._ws.send(JSON.stringify({
          event: 'subscribe',
          pair: ['XRP/USD'],
          subscription: { name: 'trade' }
        }));
        console.log('[FEED][KRAKEN] Connected');
      };

      this._ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);

          // Trade payload: [channelId, [[price, volume, time, side, orderType, misc]], "trade", "XRP/USD"]
          if (Array.isArray(data) && data[2] === 'trade') {
            const trades = data[1];
            if (!Array.isArray(trades) || trades.length === 0) return;

            // Use the last trade as price signal
            const last = trades[trades.length - 1];
            const price = safeNum(last[0]);
            const vol = safeNum(last[1]);

            if (!price) return;

            const ts = now();
            const candle = {
              ts,
              tf: TF,
              symbol: this.symbol,
              open: this._lastClose || price,
              high: Math.max(this._lastClose || price, price),
              low: Math.min(this._lastClose || price, price),
              close: price,
              volume: vol,
              closed: false,
              source: 'KRAKEN'
            };

            this._lastClose = price;
            this._lastTickTs = ts;
            this._emitCandle(candle);
          }
        } catch (_) {}
      };

      this._ws.onerror = () => console.warn('[FEED][KRAKEN] Error');
      this._ws.onclose = () => {
        console.warn('[FEED][KRAKEN] Closed');
        this._failoverNext();
      };
    }
  }

  global.MarketFeedManager = MarketFeedManager;
})(window);
