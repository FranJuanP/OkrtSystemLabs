# 🔮 XRP ORACULUM — AI ENGINE PRO

<img width="600" height="900" alt="image" src="https://github.com/user-attachments/assets/f6c66d03-40dd-4da7-a961-dcb148a84af0" />


**XRP ORACULUM** es una plataforma avanzada de análisis y predicción de mercado desarrollada por **OkrtSystem Labs**, diseñada para operar en tiempo real sobre criptomercados con un enfoque profesional, estable y explicable.

La versión actual integra **AI ENGINE PRO v1.6.9**, un motor de inteligencia artificial completamente modular que combina *market data*, *microestructura*, *aprendizaje adaptativo* y *explicabilidad*.

---

## 🧠 ¿Qué es AI ENGINE PRO?

AI ENGINE PRO es un motor de decisión en tiempo real que **no fuerza señales**, sino que evalúa continuamente el estado del mercado y **solo actúa cuando existe ventaja estadística real**.

Su filosofía es clara:
> *Mejor no operar que operar sin ventaja.*

Por eso, la neutralidad es un **resultado consciente**, no un fallo.

---

## ⚙️ Arquitectura general


<img width="1893" height="1039" alt="Captura de pantalla 2026-01-22 172625" src="https://github.com/user-attachments/assets/89c7abeb-8c9f-4642-94ed-95ac7dad1dc8" />


AI ENGINE PRO se ejecuta en modo *always-active* y está compuesto por los siguientes bloques:

1. **Market Feed Manager**  
   Conexión en tiempo real a múltiples exchanges (Binance, Coinbase, Kraken, Bybit, Bitstamp) con failover automático.

2. **Indicadores técnicos y estructura**  
   Velas, RSI, EMAs, momentum, volumen, estructura de mercado y microestructura ligera.

3. **AI Core (Ensemble)**  
   Conjunto de modelos especializados que votan una dirección común (BULL / BEAR / NEUTRAL).

4. **Calibración de confianza**  
   Ajuste dinámico de la confianza según histórico, régimen y rendimiento reciente.

5. **Flow Control & Safety Guards**  
   Protección contra sobre-predicción, loops, saturación y estados inestables.

6. **Regime Detection**  
   Identificación automática de mercado *Trending* o *Ranging*.

7. **WHY Engine (Explicabilidad)**  
   Traduce cada decisión en razones humanas entendibles.

---

## 📊 Panel AI ENGINE PRO — Guía de interpretación


<img width="979" height="393" alt="Captura de pantalla 2026-01-22 195105" src="https://github.com/user-attachments/assets/81e7aeed-951b-4625-a427-56633c6885cd" />


### 🔹 CURRENT SIGNAL
- **BULL / BEAR / NEUTRAL**
- Representa la decisión actual del motor.
- *NEUTRAL* indica ausencia de ventaja clara.

### 🔹 Confidence (%)
- Nivel de confianza **real**, no decorativa.
- Valores bajos implican cautela.

### 🔹 Accuracy
- Acierto histórico del motor en la sesión activa.

### 🔹 Session
- Número de predicciones evaluadas en la sesión actual.

### 🔹 Pending
- Predicciones aún no verificadas (control de flujo activo).

### 🔹 Completed
- Predicciones ya verificadas contra el mercado.

### 🔹 Patterns
- Patrones aprendidos y validados por el sistema.

### 🔹 Best Horizons
- Horizontes temporales donde el motor rinde mejor (2m, 5m, 10m, 15m).

### 🔹 Models Breakdown
- Peso relativo de cada familia de modelos:
  - Momentum
  - Trend
  - Volume
  - Structure
  - MTF (multi-timeframe)

---

## 🧩 WHY Engine — Explicabilidad

Cada predicción incluye un bloque **WHY**, que responde a:

> **¿Por qué la IA ha decidido esto?**

Ejemplos:
- *"Neutral because volume divergence and weak structure alignment"*
- *"Bear bias driven by microstructure imbalance and momentum loss"*

Esto convierte a AI ENGINE PRO en un sistema **auditable**, ideal para:
- Aprendizaje
- Backtesting
- Confianza del usuario

---

## 🛡️ Estabilidad y seguridad

- Protección anti-freeze (FreezeGuard)
- Control de predicciones pendientes
- Reconexión automática de feeds
- Persistencia segura en Firestore (scoped)
- Sin dependencias de Service Workers

Probado en sesiones prolongadas (+240 min) sin bloqueos.

---

## 🚀 Estado del proyecto

- ✅ Motor estable
- ✅ Explicabilidad integrada
- ✅ Flujo controlado
- ✅ Preparado para evolución


---

## 🧪 Aviso

Este proyecto **no es una herramienta de trading automático**.  
Es un sistema de **análisis, apoyo a la decisión y aprendizaje de mercado**.

---

## 🧬 OkrtSystem Labs

Investigación aplicada en:
- Inteligencia Artificial
- Ciberseguridad
- Sistemas predictivos
- Arquitecturas robustas

<img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/3bf1b716-6486-479c-82df-2391cf1f1ffb" />

   © OkrtSystem Labs 
