/*
  ORACULUM Market Feed Manager v1.1.0
  Multi-Exchange WebSocket Handler with Failover
  OkrtSystem Labs
  
  CHANGELOG v1.1.0:
  - FIX: Reconnect timeout cleanup to prevent memory leaks
  - FIX: Added connection state tracking
  - FIX: Added max reconnect attempts with exponential backoff
  - ADD: Proper cleanup method
  - ADD: Connection health monitoring
*/

class MarketFeedManager {
    constructor(symbol = 'XRPUSDT', onDataCallback) {
        this.symbol = symbol.toLowerCase();
        this.onData = onDataCallback;

        this.feeds = [
            { name: 'binance', connect: this.connectBinance.bind(this) },
            { name: 'coinbase', connect: this.connectCoinbase.bind(this) },
            { name: 'kraken', connect: this.connectKraken.bind(this) },
            { name: 'bitstamp', connect: this.connectBitstamp.bind(this) }
        ];

        this.activeFeedIndex = 0;
        this.ws = null;
        this.reconnectTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1500;
        this.maxReconnectDelay = 60000;
        this.isConnecting = false;
        this.isShuttingDown = false;
        this.lastDataTime = null;
        this.healthCheckInterval = null;

        console.log('[FEED] Manager initialized');
    }

    start() {
        console.log('[FEED] Starting feed manager...');
        this.isShuttingDown = false;
        this.connectActiveFeed();
        this.startHealthCheck();
    }

    stop() {
        console.log('[FEED] Stopping feed manager...');
        this.isShuttingDown = true;
        this.cleanup();
        this.stopHealthCheck();
    }

    startHealthCheck() {
        this.stopHealthCheck(); // Clear any existing
        this.healthCheckInterval = setInterval(() => {
            if (this.lastDataTime && Date.now() - this.lastDataTime > 60000) {
                console.warn('[FEED] No data received for 60s, reconnecting...');
                this.failover();
            }
        }, 30000);
    }

    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    connectActiveFeed() {
        if (this.isShuttingDown || this.isConnecting) return;
        
        this.isConnecting = true;
        const feed = this.feeds[this.activeFeedIndex];
        console.log(`[FEED] Connecting to ${feed.name.toUpperCase()}...`);
        
        try {
            feed.connect();
        } catch (e) {
            console.error(`[FEED] Connection error: ${e.message}`);
            this.isConnecting = false;
            this.failover();
        }
    }

    failover() {
        if (this.isShuttingDown) return;
        
        console.warn(`[FEED] ${this.feeds[this.activeFeedIndex].name.toUpperCase()} failed. Switching feed...`);
        this.cleanup();

        this.reconnectAttempts++;
        
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
            console.error('[FEED] Max reconnect attempts reached, resetting to first feed');
            this.reconnectAttempts = 0;
            this.activeFeedIndex = 0;
        } else {
            this.activeFeedIndex = (this.activeFeedIndex + 1) % this.feeds.length;
        }

        // Exponential backoff with jitter
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 1000,
            this.maxReconnectDelay
        );
        
        console.log(`[FEED] Reconnecting in ${(delay/1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`);
        
        // Clear any existing timeout BEFORE creating new one
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connectActiveFeed();
        }, delay);
    }

    cleanup() {
        this.isConnecting = false;
        
        // Clear reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        // Close WebSocket
        if (this.ws) {
            try {
                // Remove handlers to prevent triggering failover
                this.ws.onclose = null;
                this.ws.onerror = null;
                this.ws.onmessage = null;
                this.ws.onopen = null;
                this.ws.close();
            } catch (e) {
                // Ignore close errors
            }
            this.ws = null;
        }
    }

    onConnectionSuccess() {
        this.isConnecting = false;
        this.reconnectAttempts = 0; // Reset on successful connection
        this.lastDataTime = Date.now();
    }

    // =========================
    // BINANCE
    // =========================
    connectBinance() {
        const url = `wss://stream.binance.com:9443/ws/${this.symbol}@kline_1m`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][BINANCE] Connected');
            this.onConnectionSuccess();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.k) {
                    this.lastDataTime = Date.now();
                    const candle = {
                        source: 'binance',
                        open: parseFloat(data.k.o),
                        high: parseFloat(data.k.h),
                        low: parseFloat(data.k.l),
                        close: parseFloat(data.k.c),
                        volume: parseFloat(data.k.v),
                        timestamp: data.k.t
                    };
                    this.onData(candle);
                }
            } catch (e) {
                console.error('[FEED][BINANCE] Parse error', e);
            }
        };

        this.ws.onerror = (e) => {
            console.error('[FEED][BINANCE] Error', e.message || '');
            this.failover();
        };
        
        this.ws.onclose = (e) => {
            if (!this.isShuttingDown) {
                console.log('[FEED][BINANCE] Closed', e.code, e.reason);
                this.failover();
            }
        };
    }

    // =========================
    // COINBASE
    // =========================
    connectCoinbase() {
        const url = 'wss://advanced-trade-ws.coinbase.com';
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][COINBASE] Connected');
            this.onConnectionSuccess();
            const msg = {
                type: "subscribe",
                product_ids: ["XRP-USD"],
                channel: "candles"
            };
            this.ws.send(JSON.stringify(msg));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.events && data.events[0]?.candles) {
                    this.lastDataTime = Date.now();
                    const c = data.events[0].candles[0];
                    const candle = {
                        source: 'coinbase',
                        open: parseFloat(c.open),
                        high: parseFloat(c.high),
                        low: parseFloat(c.low),
                        close: parseFloat(c.close),
                        volume: parseFloat(c.volume),
                        timestamp: new Date(c.start).getTime()
                    };
                    this.onData(candle);
                }
            } catch (e) {
                console.error('[FEED][COINBASE] Parse error', e);
            }
        };

        this.ws.onerror = (e) => {
            console.error('[FEED][COINBASE] Error', e.message || '');
            this.failover();
        };
        
        this.ws.onclose = (e) => {
            if (!this.isShuttingDown) {
                console.log('[FEED][COINBASE] Closed', e.code, e.reason);
                this.failover();
            }
        };
    }

    // =========================
    // KRAKEN
    // =========================
    connectKraken() {
        const url = 'wss://ws.kraken.com';
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][KRAKEN] Connected');
            this.onConnectionSuccess();
            const msg = {
                event: "subscribe",
                pair: ["XRP/USD"],
                subscription: { name: "ohlc", interval: 1 }
            };
            this.ws.send(JSON.stringify(msg));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (Array.isArray(data) && data[1]) {
                    this.lastDataTime = Date.now();
                    const c = data[1];
                    const candle = {
                        source: 'kraken',
                        open: parseFloat(c[1]),
                        high: parseFloat(c[2]),
                        low: parseFloat(c[3]),
                        close: parseFloat(c[4]),
                        volume: parseFloat(c[6]),
                        timestamp: parseInt(c[0]) * 1000
                    };
                    this.onData(candle);
                }
            } catch (e) {
                console.error('[FEED][KRAKEN] Parse error', e);
            }
        };

        this.ws.onerror = (e) => {
            console.error('[FEED][KRAKEN] Error', e.message || '');
            this.failover();
        };
        
        this.ws.onclose = (e) => {
            if (!this.isShuttingDown) {
                console.log('[FEED][KRAKEN] Closed', e.code, e.reason);
                this.failover();
            }
        };
    }

    // =========================
    // BITSTAMP
    // =========================
    connectBitstamp() {
        const url = 'wss://ws.bitstamp.net';
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][BITSTAMP] Connected');
            this.onConnectionSuccess();
            const msg = {
                event: "bts:subscribe",
                data: { channel: "live_trades_xrpusd" }
            };
            this.ws.send(JSON.stringify(msg));
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'trade') {
                    this.lastDataTime = Date.now();
                    const t = data.data;
                    const candle = {
                        source: 'bitstamp',
                        open: parseFloat(t.price),
                        high: parseFloat(t.price),
                        low: parseFloat(t.price),
                        close: parseFloat(t.price),
                        volume: parseFloat(t.amount),
                        timestamp: parseInt(t.timestamp) * 1000
                    };
                    this.onData(candle);
                }
            } catch (e) {
                console.error('[FEED][BITSTAMP] Parse error', e);
            }
        };

        this.ws.onerror = (e) => {
            console.error('[FEED][BITSTAMP] Error', e.message || '');
            this.failover();
        };
        
        this.ws.onclose = (e) => {
            if (!this.isShuttingDown) {
                console.log('[FEED][BITSTAMP] Closed', e.code, e.reason);
                this.failover();
            }
        };
    }

    // =========================
    // STATUS
    // =========================
    getStatus() {
        return {
            activeFeed: this.feeds[this.activeFeedIndex]?.name || 'none',
            isConnected: this.ws?.readyState === WebSocket.OPEN,
            reconnectAttempts: this.reconnectAttempts,
            lastDataTime: this.lastDataTime,
            timeSinceLastData: this.lastDataTime ? Date.now() - this.lastDataTime : null
        };
    }
}

// =========================
// EXPORT GLOBAL
// =========================
window.MarketFeedManager = MarketFeedManager;
