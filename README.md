# XRP ORACULUM – AI Engine PRO v1.0  
### by OkrtSystem Labs

XRP ORACULUM es una plataforma avanzada de inteligencia de mercado diseñada para análisis técnico, detección de patrones y generación de señales mediante **IA modular, memoria persistente y arquitectura serverless**.

El proyecto está orientado a demostrar cómo se puede construir una herramienta financiera **enterprise-grade** en entorno web ligero, sin servidores dedicados y con seguridad real en despliegue público.

---

## 🚀 Características principales

- **AI Engine PRO v1.0**
  - Motor de IA modular basado en *Ensemble Learning*
  - 6 modelos especializados trabajando en conjunto
  - Sistema de votación por consenso, confluencia y contexto

- **Memoria persistente (Firestore)**
  - Almacenamiento de patrones validados
  - Historial de escenarios exitosos
  - Reutilización de conocimiento en tiempo real

- **Arquitectura Serverless**
  - Single-file HTML
  - Sin backend tradicional
  - Firebase como capa de seguridad y persistencia

- **Multi-feed con Failover automático**
  - Binance (primary)
  - Coinbase (fallback)
  - Kraken (fallback)
  - Conmutación automática si un exchange cae

- **Seguridad Enterprise en entorno público**
  - Firebase App Check (reCAPTCHA v3 en modo ENFORCE)
  - Autenticación anónima
  - Protección contra bots, scrapers y llamadas externas

- **Telemetría multi-exchange**
  - Binance, Coinbase, Kraken, Bitstamp, Bybit, Crypto.com
  - Detección de whales, spoofing y anomalías de liquidez

---

## 🧠 AI Engine PRO – Arquitectura

El motor no se basa en un único indicador ni en lógica lineal.  
Funciona como un **sistema de votación por conjunto (Ensemble Voting)** donde varios módulos compiten y colaboran:

### Modelos activos

1. **Momentum**
   - RSI
   - Stochastic
   - Divergencias

2. **Trend**
   - EMA Cross
   - MACD
   - ADX

3. **Volume**
   - OBV
   - Delta de volumen acumulado (CVD)
   - Flujo de órdenes

4. **Structure (Smart Money)**
   - Order Blocks
   - Fair Value Gaps (FVG)
   - Zonas de liquidez

5. **Patterns**
   - Reconocimiento de velas
   - Patrones chartistas

6. **Multi-Timeframe (MTF)**
   - Confluencia desde 1m hasta 4h

---

## 🔁 Auto-Optimización

El motor incorpora un **Optimization Loop** que:

- Recalibra pesos de cada modelo según rendimiento reciente  
- Aplica *learning rate* dinámico  
- Refuerza lo que funciona  
- Reduce ruido y falsos positivos  

Esto convierte al sistema en un motor adaptativo, no estático.

---

## 🧠 Memoria Persistente

A través de Firestore, XRP ORACULUM almacena:

- Patrones exitosos  
- Escenarios validados  
- Condiciones de mercado previas a movimientos relevantes  

Cuando el mercado actual se asemeja a un escenario histórico:

- Ajusta confianza  
- Reprioriza señales  
- Reduce falsos positivos  

---

## 🌐 Arquitectura de datos

Crypto Exchanges (WebSocket Streams)
↓
MarketFeedManager (Failover automático)
↓
Client Side (Browser)

- UI

- AI Engine PRO

- Telemetría
↓
Serverless Backend (Firebase)

- App Check

- Auth Anónimo

- Firestore Memory
---


---

## 🛡 Seguridad

XRP ORACULUM está diseñado para ser **público pero protegido**:

- **Firebase App Check (ENFORCE)**
  - Bloquea bots, scrapers y tráfico automatizado

- **Autenticación anónima**
  - Sin login tradicional
  - Sin exposición de credenciales

- **Validación por token**
  - Solo la app legítima accede a la base de datos

---

## 🧱 Stack Tecnológico

- **Frontend:** Vanilla JavaScript (ES6+)
- **Realtime Data:** WebSocket API
- **Backend Serverless:** Firebase (Firestore, Auth, App Check)
- **Deploy:** GitHub Pages

---

## 📊 Estado actual

- AI Engine PRO operativo  
- Multi-feed activo con failover  
- Firestore conectado  
- App Check en modo ENFORCE  
- Memoria persistente habilitada  
- Optimización automática activa  

---

## ⚠️ Disclaimer

**NO ES CONSEJO FINANCIERO.**  
XRP ORACULUM es una herramienta experimental de análisis técnico y arquitectura de IA aplicada a mercados financieros.

---

## 🔗 Demo

https://franjuanp.github.io/OkrtSystemLabs/

---

© 2026 OkrtSystem Labs. Todos los derechos reservados.



