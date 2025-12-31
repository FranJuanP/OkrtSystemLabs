# ◆ XRP ORACULUM | OkrtSystem Labs
## Guía de Usuario Completa

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Requisitos](#requisitos)
3. [Instalación](#instalación)
4. [Panel Principal](#panel-principal)
5. [Motor Predictivo V3](#motor-predictivo-v3)
6. [Indicadores Técnicos](#indicadores-técnicos)
7. [Gráfico de Velas](#gráfico-de-velas)
8. [Order Book](#order-book)
9. [Whale Tracker](#whale-tracker)
10. [XRP ETF Tracker](#xrp-etf-tracker)
11. [Smart Alerts](#smart-alerts)
12. [Herramientas de Trading](#herramientas-de-trading)
13. [Configuración](#configuración)
14. [Atajos de Teclado](#atajos-de-teclado)
15. [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Introducción

**XRP ORACULUM** es un dashboard de trading profesional para XRP/USDT que proporciona datos en tiempo real, análisis técnico avanzado, seguimiento de ballenas y herramientas de gestión de riesgo.

### Características Principales

- ✅ Datos en tiempo real de Binance
- ✅ Motor predictivo con 15+ indicadores
- ✅ Detección de 20+ patrones de velas
- ✅ Whale tracking en 6 exchanges
- ✅ 7 XRP ETFs monitorizados
- ✅ 8 herramientas de trading avanzadas
- ✅ PWA instalable en móvil

---

## Requisitos

### Navegador Web
- Google Chrome (recomendado)
- Mozilla Firefox
- Microsoft Edge
- Safari

### Conexión
- Internet estable (para WebSocket en tiempo real)

### Dispositivos
- PC, Mac, Tablet o Smartphone

---

## Instalación

### Opción 1: Web (Sin instalación)
1. Abre tu navegador
2. Ve a: `https://franjuanp.github.io/OkrtSystemLabs/`
3. ¡Listo!

### Opción 2: PWA en Móvil

**Android (Chrome):**
1. Abre la web en Chrome
2. Espera 5 segundos → aparece banner "Install XRP ORACULUM"
3. Toca "INSTALL APP"
4. Confirma la instalación

**iPhone/iPad (Safari):**
1. Abre la web en Safari
2. Toca el botón Compartir (⬆️)
3. Selecciona "Añadir a pantalla de inicio"
4. Toca "Añadir"

### Opción 3: Aplicación Windows
1. Descarga `XRP_ORACULUM_APP.zip`
2. Descomprime la carpeta
3. Ejecuta `BUILD.bat`
4. Instala desde `dist/XRP ORACULUM Setup.exe`

---

## Panel Principal

### Barra Superior (Header)

| Elemento | Descripción |
|----------|-------------|
| **◆ XRP ORACULUM** | Logo y nombre de la aplicación |
| **BTC: $XX,XXX** | Precio actual de Bitcoin |
| **ETF AUM: $X.XXB** | Total de activos bajo gestión de ETFs XRP |
| **XRP Locked: XXXM** | Total de XRP bloqueado en ETFs |
| **Accuracy: XX%** | Precisión del motor predictivo |
| **Timeframe** | Selector de temporalidad (1m, 5m, 15m, 1h, 4h) |
| **🔇 OFF** | Toggle de sonido para alertas |
| **● / ○** | Toggle modo oscuro/claro |
| **📄 CSV** | Exportar datos a CSV |
| **🛠️ TOOLS** | Abrir panel de herramientas |
| **🟢 LIVE** | Indicador de conexión en tiempo real |

### KPIs Principales (Fila superior)

| KPI | Descripción | Interpretación |
|-----|-------------|----------------|
| **XRP/USDT** | Precio actual | Verde = subiendo, Rojo = bajando |
| **24H VOL** | Volumen en 24 horas | Mayor volumen = más liquidez |
| **FEAR & GREED** | Índice de miedo/codicia | 0-25 = Miedo extremo, 75-100 = Codicia extrema |
| **FUNDING RATE** | Tasa de financiación de futuros | Positivo = más longs, Negativo = más shorts |
| **OPEN INTEREST** | Interés abierto en derivados | Subiendo = más posiciones abiertas |
| **MARKET SCORE** | Puntuación general del mercado | 0-40 = Bearish, 40-60 = Neutral, 60-100 = Bullish |

---

## Motor Predictivo V3

### Ubicación
Panel izquierdo, sección "🧠 PREDICTIVE ENGINE V3"

### Componentes

| Elemento | Descripción |
|----------|-------------|
| **ENSEMBLE TARGET** | Precio predicho para los próximos 5 minutos |
| **Confidence** | Nivel de confianza de la predicción (0-100%) |
| **Accuracy** | Precisión histórica del modelo |
| **PREDICTION HISTORY** | Gráfico visual de aciertos (verde) y fallos (rojo) |

### Cómo Funciona

El motor combina múltiples indicadores técnicos:
- RSI, Stoch RSI, Williams %R
- MACD, EMA Cross
- ADX, Bollinger Bands
- OBV, Volumen
- Patrones de velas

### Interpretación del Score

| Score | Señal | Color |
|-------|-------|-------|
| 0-30 | STRONG SELL | 🔴 Rojo |
| 31-45 | SELL | 🔴 Rojo claro |
| 46-55 | NEUTRAL | ⚪ Gris |
| 56-70 | BUY | 🟢 Verde claro |
| 71-100 | STRONG BUY | 🟢 Verde |

---

## Indicadores Técnicos

### Pestaña MOMENTUM

| Indicador | Rango | Interpretación |
|-----------|-------|----------------|
| **RSI (14)** | 0-100 | <30 = Oversold (compra), >70 = Overbought (venta) |
| **Stoch RSI** | 0-100 | <20 = Oversold, >80 = Overbought |
| **Williams %R** | -100 a 0 | <-80 = Oversold, >-20 = Overbought |
| **Momentum** | % | Velocidad del cambio de precio |

### Pestaña TREND

| Indicador | Interpretación |
|-----------|----------------|
| **MACD** | >0 = Bullish, <0 = Bearish |
| **EMA Cross** | EMA9 > EMA21 = Bullish |
| **ADX** | >25 = Tendencia fuerte |
| **Bollinger** | Precio cerca de banda superior/inferior |

### Pestaña VOLUME

| Indicador | Interpretación |
|-----------|----------------|
| **OBV** | Subiendo = Acumulación, Bajando = Distribución |
| **VWAP** | Precio vs precio promedio ponderado por volumen |
| **Vol Delta** | Diferencia entre volumen comprador y vendedor |
| **Whale Flow** | Flujo neto de transacciones de ballenas |

---

## Gráfico de Velas

### Elementos Visuales

| Elemento | Color | Descripción |
|----------|-------|-------------|
| **Velas alcistas** | 🟢 Verde | Cierre > Apertura |
| **Velas bajistas** | 🔴 Rojo | Cierre < Apertura |
| **EMA 9** | 🔵 Cyan | Media móvil rápida |
| **EMA 21** | 🟣 Púrpura | Media móvil lenta |
| **Soporte** | 🟢 Verde | Línea de tendencia alcista |
| **Resistencia** | 🔴 Rojo | Línea de tendencia bajista |

### Señales de Cruce EMA

| Señal | Significado |
|-------|-------------|
| EMA9 cruza arriba de EMA21 | 🟢 Golden Cross (Alcista) |
| EMA9 cruza abajo de EMA21 | 🔴 Death Cross (Bajista) |

### Patrones Detectados

La herramienta detecta automáticamente 20+ patrones:

**Patrones Alcistas:**
- Hammer, Inverted Hammer
- Bullish Engulfing
- Morning Star
- Three White Soldiers
- Piercing Line

**Patrones Bajistas:**
- Shooting Star, Hanging Man
- Bearish Engulfing
- Evening Star
- Three Black Crows
- Dark Cloud Cover

**Patrones Neutrales:**
- Doji, Spinning Top
- Inside Bar

---

## Order Book

### Ubicación
Panel derecho, sección "📊 ORDER BOOK"

### Componentes

| Elemento | Descripción |
|----------|-------------|
| **ASK (SELL)** | Órdenes de venta (rojo) |
| **BID (BUY)** | Órdenes de compra (verde) |
| **Mid Price** | Precio medio actual |

### Indicadores del Order Book

| Indicador | Descripción |
|-----------|-------------|
| **LIQUIDITY FLOW** | Balance entre compradores y vendedores |
| **CVD** | Cumulative Volume Delta - presión compradora/vendedora |

---

## Whale Tracker

### Ubicación
Panel derecho, pestaña "WHALES"

### Exchanges Monitorizados

| Exchange | Color Badge |
|----------|-------------|
| BINANCE | 🟡 Amarillo |
| KRAKEN | 🟣 Púrpura |
| BITSTAMP | 🟢 Verde |
| BYBIT | 🟠 Naranja |
| COINBASE | 🔵 Azul |
| CRYPTO.COM | 🔵 Cyan |

### Información Mostrada

Cada transacción de ballena muestra:
- **Tipo**: BUY (verde) o SELL (rojo)
- **Cantidad**: En miles de XRP (ej: 7.5K)
- **Exchange**: Badge con color
- **Valor**: En USD (ej: 14.2K$)
- **Hora**: Timestamp

### Umbrales

| Tipo | Umbral | Alerta |
|------|--------|--------|
| Whale normal | ≥5,000 XRP | Se muestra en lista |
| Big Whale | ≥25,000 XRP | Alerta + sonido |

---

## XRP ETF Tracker

### Ubicación
Panel izquierdo inferior, sección "📈 XRP ETF TRACKER"

### ETFs Monitorizados

| Ticker | Entidad | AUM |
|--------|---------|-----|
| XRPC | Canary Capital | $328.5M |
| TOXR | 21Shares | $257.2M |
| XRP | Bitwise | $233.0M |
| GXRP | Grayscale | $228.3M |
| XRPZ | Franklin | $208.6M |
| XRPR | REX-Osprey | $101.4M |
| BITW | Bitwise Index | $52.3M |

### Métricas

| Métrica | Descripción |
|---------|-------------|
| **Total AUM** | Activos totales bajo gestión |
| **XRP Locked** | Total de XRP en los ETFs |
| **Progress to 1B** | Progreso hacia 1 billón de XRP bloqueado |

---

## Smart Alerts

### Ubicación
Panel derecho, sección "⚡ SMART ALERTS"

### Tipos de Alertas

| Color | Tipo | Descripción |
|-------|------|-------------|
| 🟢 Verde | Bullish | Señales alcistas |
| 🔴 Rojo | Bearish | Señales bajistas |
| 🔵 Azul | Info | Información general |
| 🟠 Naranja | Warning | Advertencias |

### Ejemplos de Alertas

- "RSI BULLISH DIVERGENCE detected!"
- "🐋 BIG WHALE: BUY 25K XRP on BINANCE"
- "Pattern detected: HAMMER (bullish)"
- "EMA Cross: Golden Cross detected"

---

## Herramientas de Trading

### Acceso
Clic en botón **🛠️ TOOLS** en la barra superior

### 1. 📊 Multi-Timeframe

Análisis simultáneo de 5 temporalidades:
- 1 minuto, 5 minutos, 15 minutos, 1 hora, 4 horas

**Información por timeframe:**
- Precio actual
- Señal (BULLISH/NEUTRAL/BEARISH)
- RSI
- MACD
- Tendencia

**MTF Consensus:** Resumen de señales de todas las temporalidades

### 2. 🎯 Risk Calculator

Calculadora de gestión de riesgo:

**Inputs:**
| Campo | Descripción |
|-------|-------------|
| Account Balance | Tu capital en USDT |
| Risk % | Porcentaje de riesgo por operación |
| Entry Price | Precio de entrada |
| Leverage | Apalancamiento (1x-125x) |
| Stop Loss | Precio de stop loss |
| Take Profit | Precio de take profit |

**Outputs:**
- Risk Amount ($)
- Position Size (XRP)
- Position Value ($)
- Potential Loss/Profit
- Liquidation Price
- Risk:Reward Ratio

**Botones útiles:**
- "Use Current Price": Auto-rellena con precio actual
- "Auto SL/TP": Sugiere SL -2%, TP +4%

### 3. 🔔 Price Alerts

Crea alertas personalizadas de precio:

**Tipos:**
- Price Above: Alerta cuando precio ≥ target
- Price Below: Alerta cuando precio ≤ target

**Quick Alerts:** Botones para crear alertas rápidas:
- +1%, -1%, +2.5%, -2.5%, +5%, -5%

**Características:**
- Sonido de notificación
- Notificación del navegador
- Persistencia (se guardan entre sesiones)

### 4. 📐 Fibonacci

Niveles de retroceso de Fibonacci automáticos:

**Niveles:**
| Nivel | Interpretación |
|-------|----------------|
| 0% (High) | Máximo del swing |
| 23.6% | Retroceso menor |
| 38.2% | Retroceso importante |
| 50% | Nivel psicológico |
| 61.8% | "Golden ratio" - nivel clave |
| 78.6% | Último soporte antes de reversión |
| 100% (Low) | Mínimo del swing |

**Información adicional:**
- Swing High y Low de 24h
- Rango del precio
- Zona actual del precio

### 5. 📈 Session Stats

Estadísticas de tu sesión de trading:

**Métricas:**
| Métrica | Descripción |
|---------|-------------|
| Session Time | Tiempo activo |
| Session High/Low | Máximo y mínimo de la sesión |
| Range % | Volatilidad de la sesión |
| Bullish/Bearish Signals | Contadores de señales |
| Patterns Detected | Patrones identificados |
| Whale Trades | Operaciones de ballenas |

**Predicciones:**
- Total de predicciones
- Correctas / Incorrectas
- Session Accuracy

### 6. 🤖 Strategy Builder

Crea tus propias estrategias de alerta:

**Indicadores disponibles:**
- RSI, Stoch RSI, MACD
- Price, Volume 24h, Funding Rate

**Operadores:**
- < (menor que)
- > (mayor que)
- ↗ Cross Up
- ↘ Cross Down

**Lógica:**
- AND: Ambas condiciones deben cumplirse
- OR: Una condición debe cumplirse

**Ejemplo:**
"Si RSI < 30 AND MACD > 0 → Alerta Bullish"

### 7. 🔗 Correlation

Correlación de XRP con otras criptomonedas:

**Pares monitorizados:**
- XRP/BTC
- XRP/ETH
- XRP/SOL

**Interpretación:**
| Correlación | Significado |
|-------------|-------------|
| +0.7 a +1.0 | Fuerte positiva (se mueven juntos) |
| -0.3 a +0.3 | Débil/Ninguna (independientes) |
| -0.7 a -1.0 | Fuerte negativa (se mueven opuesto) |

### 8. 👁️ Watchlist

Seguimiento de 6 criptomonedas principales:

| Crypto | Símbolo |
|--------|---------|
| Bitcoin | BTC |
| Ethereum | ETH |
| Solana | SOL |
| XRP | XRP |
| Cardano | ADA |
| Dogecoin | DOGE |

**Información por crypto:**
- Precio actual
- Cambio 24h (%)
- Mini-gráfico de 8 horas

**Market Overview:**
- Total Market Cap
- BTC Dominance
- 24H Volume

---

## Configuración

### Toggle Sonido
- Clic en **🔇 OFF** / **🔊 ON**
- Activa/desactiva sonidos de alertas

### Toggle Tema
- Clic en **●** (círculo)
- Alterna entre modo oscuro y claro

### Selector de Timeframe
- Desplegable con opciones: 1m, 5m, 15m, 1h, 4h
- Cambia la temporalidad del gráfico e indicadores

### Exportar CSV
- Clic en **📄 CSV**
- Descarga datos del historial de predicciones

---

## Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| **T** | Abrir/cerrar panel de Tools |
| **S** | Toggle sonido ON/OFF |
| **D** | Toggle modo Dark/Light |
| **ESC** | Cerrar modales/overlays |

---

## Preguntas Frecuentes

### ¿Los datos son en tiempo real?
Sí, la conexión WebSocket proporciona datos en tiempo real de Binance y otros 5 exchanges.

### ¿Qué significa el indicador LIVE verde?
Indica que la conexión WebSocket está activa y recibiendo datos.

### ¿Por qué a veces se desconecta?
Las conexiones WebSocket pueden interrumpirse. La herramienta se reconecta automáticamente en 3 segundos.

### ¿Las alertas funcionan si cierro la app?
No, las alertas solo funcionan mientras la app está abierta. Para alertas cuando la app está cerrada, necesitarías un bot de Telegram.

### ¿Los datos se guardan?
- Alertas personalizadas: Sí (localStorage)
- Estrategias: Sí (localStorage)
- Historial de predicciones: Solo durante la sesión

### ¿Puedo usar esto para trading real?
Esta herramienta es para **fines educativos e informativos**. No es consejo financiero. Siempre haz tu propia investigación (DYOR) antes de operar.

### ¿Funciona en móvil?
Sí, es responsive y se puede instalar como PWA en Android e iOS.

### ¿Qué precisión tiene el motor predictivo?
La precisión varía según las condiciones del mercado. El indicador "Accuracy" muestra el rendimiento histórico en tiempo real.

---

## Soporte

### Web
https://franjuanp.github.io/OkrtSystemLabs/

### GitHub
https://github.com/FranJuanP/OkrtSystemLabs

---

## Disclaimer

⚠️ **AVISO IMPORTANTE**

Esta herramienta es solo para fines educativos e informativos. No constituye consejo financiero, de inversión ni de trading.

- El trading de criptomonedas conlleva riesgos significativos
- Puedes perder todo tu capital invertido
- Rendimientos pasados no garantizan resultados futuros
- Siempre haz tu propia investigación (DYOR)
- Nunca inviertas más de lo que puedes permitirte perder

**OkrtSystem Labs no se hace responsable de pérdidas derivadas del uso de esta herramienta.**

---

*◆ XRP ORACULUM | OkrtSystem Labs*
*Versión 3.0 - Diciembre 2025*
