# ORACULUM — XRP Intelligence Terminal (OkrtSystem Labs)

ORACULUM is a single-file, security-hardened XRP market intelligence terminal featuring real-time data streams, quantitative indicators, AI-assisted scoring, and an integrated toolkit (Multi-TF, Backtesting, Smart Alerts, Risk, Strategy Builder, Correlation).

> Deployment: **single HTML file** (static hosting ready) + **PWA support**

---

## Key Features

### Real-Time Market Layer
- Multi-exchange real-time streams via WebSockets
- Live trade activity & flow signals
- Stability-focused reconnection logic

### Quant & Indicators Layer
- RSI, MACD, EMA, ATR, Bollinger Bands, ADX, Stochastic, Williams %R
- Volatility-aware targets and operational levels
- Context-based market regime detection

### AI Engine (Scoring)
- Market regime synthesis
- Signal Quality scoring (0–100)
- Proprietary logic treated as IP

### Tools Panel (Integrated Suite)
- Multi-Timeframe Engine (1M → 1D)
- Backtesting module (threshold-based evaluation)
- Smart Alerts + browser notifications
- Risk Calculator
- Fibonacci Tool
- Session Stats
- Strategy Builder
- Correlation matrix

---

## Security (Pentesting-Ready)
ORACULUM is designed with browser-level hardening and application-level defenses:

- Strict CSP with nonce and controlled origins
- Anti-XSS output handling
- Safe JSON parsing protections (anti-prototype pollution)
- Basic WS payload validation
- Rate limiting primitives
- CSP violation monitoring

---

## Performance
- WebSocket message throttling (max messages per second)
- Batched DOM updates via requestAnimationFrame
- Optional Lite mode for lower-end devices

---

## Installation / Run
### Option A — Local
1. Download `index.html`
2. Open it in a modern browser (Chrome/Edge/Firefox)

### Option B — Static Hosting
Upload `index.html` to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.)

---

## PWA
- Supports install prompt on compatible browsers
- Includes service worker registration and caching strategy

---

## Disclaimer
ORACULUM provides analytical intelligence and decision support.
It is not financial advice and should not be considered a trading guarantee.

---

## License / Ownership
© 2025–2026 OkrtSystem Labs. All rights reserved.
