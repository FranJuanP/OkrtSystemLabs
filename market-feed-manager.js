/*
  ORACULUM Market Feed Manager
  Multi-Exchange WebSocket Handler with Failover
  OkrtSystem Labs
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

        console.log('[FEED] Manager initialized');
    }

    start() {
        console.log('[FEED] Starting feed manager...');
        this.connectActiveFeed();
    }

    connectActiveFeed() {
        const feed = this.feeds[this.activeFeedIndex];
        console.log(`[FEED] Connecting to ${feed.name.toUpperCase()}...`);
        feed.connect();
    }

    failover() {
        console.warn(`[FEED] ${this.feeds[this.activeFeedIndex].name.toUpperCase()} failed. Switching feed...`);
        this.cleanup();

        this.activeFeedIndex = (this.activeFeedIndex + 1) % this.feeds.length;

        this.reconnectTimeout = setTimeout(() => {
            this.connectActiveFeed();
        }, 1500);
    }

    cleanup() {
        if (this.ws) {
            try {
                this.ws.close();
            } catch (e) {}
            this.ws = null;
        }
    }

    // =========================
    // BINANCE
    // =========================
    connectBinance() {
        const url = `wss://stream.binance.com:9443/ws/${this.symbol}@kline_1m`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => console.log('[FEED][BINANCE] Connected');

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.k) {
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

        this.ws.onerror = () => this.failover();
        this.ws.onclose = () => this.failover();
    }

    // =========================
    // COINBASE
    // =========================
    connectCoinbase() {
        const url = 'wss://advanced-trade-ws.coinbase.com';
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][COINBASE] Connected');
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

        this.ws.onerror = () => this.failover();
        this.ws.onclose = () => this.failover();
    }

    // =========================
    // KRAKEN
    // =========================
    connectKraken() {
        const url = 'wss://ws.kraken.com';
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][KRAKEN] Connected');
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

        this.ws.onerror = () => this.failover();
        this.ws.onclose = () => this.failover();
    }

    // =========================
    // BITSTAMP
    // =========================
    connectBitstamp() {
        const url = 'wss://ws.bitstamp.net';
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[FEED][BITSTAMP] Connected');
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

        this.ws.onerror = () => this.failover();
        this.ws.onclose = () => this.failover();
    }
}

// =========================
// EXPORT GLOBAL
// =========================
window.MarketFeedManager = MarketFeedManager;
