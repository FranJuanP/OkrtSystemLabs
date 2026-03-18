<div align="center">

# ◈ AETHER
### Global Intelligence System

**by [OkrtSystem Labs](https://github.com/okrtsystemlabs)**

[![Version](https://img.shields.io/badge/version-1.0-00FFC8?style=flat-square&labelColor=0D1B2E)](.)
[![Countries](https://img.shields.io/badge/countries-202-FF8C00?style=flat-square&labelColor=0D1B2E)](.)
[![Categories](https://img.shields.io/badge/risk_categories-16-FF3355?style=flat-square&labelColor=0D1B2E)](.)
[![Size](https://img.shields.io/badge/size-448KB-A259FF?style=flat-square&labelColor=0D1B2E)](.)
[![No Server](https://img.shields.io/badge/backend-none-00FF88?style=flat-square&labelColor=0D1B2E)](.)
[![AI](https://img.shields.io/badge/AI-Ollama%20%2F%20Mistral-FFD700?style=flat-square&labelColor=0D1B2E)](.)

*Motor de inteligencia predictiva de riesgos globales. 202 países. 16 categorías. Cascada temporal. Monte Carlo. Todo en un único archivo HTML.*

---

</div>

## ¿Qué es AETHER?  ( https://franjuanp.github.io/OkrtSystemLabs/ )

AETHER es un sistema de inteligencia de riesgos globales que corre **completamente en local**, sin servidor, sin base de datos, sin dependencias de backend. Un único archivo HTML de 448KB que contiene:

- Datos de riesgo de **202 países** en **16 categorías**
- Un **motor de propagación en cascada** con simulación Monte Carlo (400 iteraciones)
- Un **Shock Simulator** para explorar escenarios hipotéticos en tiempo real
- Integración con **Ollama/Mistral** para predicciones e informes generados por IA local
- Visualizaciones interactivas con **D3.js** — mapa mundial, red de correlaciones, gráficas temporales

---

## Capturas

| Mapa Mundial | Motor de Cascada | Shock Simulator |
|:---:|:---:|:---:|
| Coropletas de riesgo en 7 niveles | Proyección temporal + MC | Escenarios hipotéticos |

---

## Características principales

### 🌍 Cobertura global
202 países con scoring en 16 dimensiones de riesgo, calibrados con datos reales de World Bank, Freedom House, Fragile States Index, SIPRI, GHS Index y otros organismos internacionales.

### 🧮 Algoritmo multicapa
```
Score final = Base histórico
            + Ajuste por velocidad de cambio (tendencia actual)
            + Boost por correlación cruzada entre categorías
            + Propagación en cascada temporal
```

### ⚡ Motor de Propagación en Cascada
- **Matriz de propagación temporal** — cada par de categorías tiene `{strength, lag (semanas), decay}`
- **Cascade Simulator** — simula semana a semana cómo un shock viaja por la red de 16 nodos
- **Monte Carlo (400 sim)** — perturba parámetros con ruido gaussiano → bandas de confianza p10/p50/p90
- **Resilience Index** — capacidad de amortiguación sistémica de cada país
- **Inflection Detector** — detecta aceleración del deterioro (segunda derivada)

### ⚡ Shock Simulator
Introduce shocks manuales en cualquier categoría y observa cómo se propagan:
- 8 escenarios predefinidos: *Recesión global, Pandemia, Guerra regional, Colapso climático...*
- 16 sliders de ajuste manual (−50 a +50 por categoría)
- Gráfica comparativa baseline vs con shock
- Tabla de impacto en cascada por categoría al final del horizonte

### 🗺️ Mapa mundial D3.js
- Coropletas en 7 niveles: `#00CC66 → #44DD88 → #FFD700 → #FF8C00 → #FF4422 → #FF0033`
- Pulso animado en países críticos (score ≥ 75)
- Tooltip con score global + top 4 categorías
- Click para cargar cualquier país en el dashboard
- Filtrable por categoría

### 🤖 IA local con Ollama/Mistral
- **Predicción estructurada** — diagnóstico, amenazas con probabilidades, señales de alerta, proyección a 6/12/24 meses
- **Escenarios predictivos** — Optimista / Base / Pesimista con probabilidades
- **Chat libre** — conversación contextual con la región activa como contexto
- Sin APIs externas, sin costes, sin límites de uso

---

## Las 16 Categorías de Riesgo

| # | Categoría | Descripción |
|---|-----------|-------------|
| 1 | 💰 **Económico** | PIB, inflación, desempleo, deuda |
| 2 | 🌐 **Geopolítico** | Conflictos, alianzas, tensiones regionales |
| 3 | 🏥 **Sanitario** | Esperanza de vida, cobertura, mortalidad |
| 4 | 🌡️ **Climático** | Temperatura, eventos extremos, estrés hídrico |
| 5 | 👥 **Cohesión Social** | Desigualdad, polarización, libertades |
| 6 | 💻 **Tecnológico** | Ciberataques, brecha digital, innovación |
| 7 | 🌽 **Seg. Alimentaria** | Autosuficiencia, importaciones, hambre |
| 8 | 🧠 **Salud Mental** | Depresión, suicidio, recursos disponibles |
| 9 | ⚡ **Energético** | Dependencia, mix renovable, reservas |
| 10 | 📊 **Demográfico** | Natalidad, envejecimiento, migración |
| 11 | 🏙️ **Urbano/Infra.** | Vivienda, transporte, saneamiento |
| 12 | 🔬 **Ciencia/I+D** | Inversión, talento, patentes |
| 13 | ⚖️ **Justicia/DDHH** | Estado de derecho, corrupción, libertades |
| 14 | 💳 **Financiero** | Reservas, deuda, estabilidad monetaria |
| 15 | 🌊 **Océanos/Marina** | Biodiversidad, acidificación, pesca |
| 16 | 🦠 **Bioseguridad** | Preparación pandémica, vigilancia, GHS Index |

---

## Instalación y uso

### Requisitos
- Navegador moderno (Chrome, Firefox, Edge)
- Conexión a internet (solo para cargar el mapa D3.js desde CDN)
- [Ollama](https://ollama.ai) con Mistral instalado (para funciones de IA)

### Sin IA (modo solo datos)
```bash
# Opción 1: abrir directamente en el navegador
open AETHER.html

# Opción 2: servir con Python (recomendado)
python -m http.server 8080
# → http://localhost:8080/AETHER.html
```

### Con IA (Ollama/Mistral)
```powershell
# Windows PowerShell — necesario para CORS
taskkill /F /IM ollama.exe
$env:OLLAMA_ORIGINS="*"
ollama serve

# En otra terminal
cd C:\ruta\a\AETHER
python -m http.server 8080
```

```bash
# Linux / macOS
OLLAMA_ORIGINS="*" ollama serve &
cd /ruta/a/AETHER
python3 -m http.server 8080
```

Asegúrate de tener el modelo Mistral:
```bash
ollama pull mistral
```

---

## Arquitectura técnica

```
AETHER.html (448KB)
│
├── DATA{}              — 202 países × 16 categorías × 4 indicadores
├── ISO_MAP{}           — ~220 códigos ISO numéricos → alpha3
├── VELOCITY{}          — vectores de tendencia por país/categoría
├── CORR_MATRIX[][]     — matriz de correlación 16×16
├── PROP_MATRIX{}       — matriz de propagación {strength, lag, decay}
│
├── Motor base          — enhancedScore() con correlación cruzada
├── Motor cascada       — simulateCascade() con propagación temporal
├── Monte Carlo         — runMonteCarlo() 400 sim, Box-Muller
├── Resiliencia         — computeResilienceIndex()
├── Inflexión           — detectInflections() segunda derivada
├── Shock Simulator     — runShockCascade() con overrides manuales
│
├── D3.js               — mapa mundial TopoJSON + red de correlaciones
├── Chart.js Canvas     — gráficas de proyección temporal
└── Ollama API          — http://localhost:11434/api/chat
```

### Stack
- **Visualización**: D3.js v7, TopoJSON, Canvas API
- **IA**: Ollama REST API (Mistral 7B local)
- **Datos externos**: World Bank API (datos live opcionales)
- **Sin frameworks**: Vanilla JS, CSS custom properties
- **Sin build**: archivo único, sin npm, sin bundler

---

## Módulos visuales

| Módulo | Descripción |
|--------|-------------|
| **Mapa mundial** | D3 Natural Earth, 202 países coloreados, click interactivo |
| **16 Gauges** | Semicírculos SVG animados por categoría |
| **Termómetro live** | Top 8 categorías con actualización cada 30s |
| **Red de correlaciones** | D3 force-directed, 16 nodos arrastrables |
| **Proyección temporal** | Canvas con bandas Monte Carlo p10/p50/p90 |
| **Árbol de cascada** | Shocks activos con lag y magnitud |
| **Semáforo de aceleración** | 16 categorías ordenadas por urgencia |
| **Shock Simulator** | Sliders + gráfica baseline vs shock |
| **Ranking mundial** | Filtrable por región, categoría, Top N, orden |
| **Señales de alerta** | 64 fuentes oficiales ponderadas por score |

---

## Fuentes de datos

Los scores base están calibrados con datos de:

`World Bank` · `Freedom House` · `Fragile States Index (FSI)` · `SIPRI` · `GHS Index (NTI)` · `UN HDI` · `FAO` · `WHO` · `IMF WEO` · `IIF` · `ACLED` · `NOAA` · `IPCC` · `Transparency International` · `V-Dem` · `Our World in Data`


MIT License — © 2025 OkrtSystem Labs

---

<div align="center">

**AETHER** es una herramienta de investigación e inteligencia estratégica.  
Los datos son de referencia y no deben usarse como única fuente para decisiones críticas.

---

*Construido con 🌐 por OkrtSystem Labs*

</div>
