<div align="center">

# ◈ AETHER
### Global Intelligence System

**by [OkrtSystem Labs](https://github.com/franjuanp)**

[![Version](https://img.shields.io/badge/version-2.0-00FFC8?style=flat-square&labelColor=0D1B2E)]()
[![Countries](https://img.shields.io/badge/countries-202-FF8C00?style=flat-square&labelColor=0D1B2E)]()
[![Categories](https://img.shields.io/badge/risk_categories-16-FF3355?style=flat-square&labelColor=0D1B2E)]()
[![Modules](https://img.shields.io/badge/modules-4-A259FF?style=flat-square&labelColor=0D1B2E)]()
[![No Server](https://img.shields.io/badge/backend-none-00FF88?style=flat-square&labelColor=0D1B2E)]()
[![AI](https://img.shields.io/badge/AI-Ollama%20%2F%20Mistral-FFD700?style=flat-square&labelColor=0D1B2E)]()

*Sistema de inteligencia predictiva de riesgos globales. 202 países. 16 categorías. Globo 3D interactivo. Feed de alertas en tiempo real. Análisis de flujos financieros globales. Todo en archivos HTML independientes, sin servidor, sin backend.*

**[→ Ver en vivo](https://franjuanp.github.io/OkrtSystemLabs/)**

---

</div>

## ¿Qué es AETHER?

AETHER es un ecosistema modular de inteligencia de riesgos globales que corre **completamente en local**, sin servidor, sin base de datos, sin dependencias de backend. Cuatro módulos HTML independientes que se abren desde el dashboard principal, cada uno especializado en una dimensión del análisis geopolítico y económico global.

---

## Arquitectura del ecosistema

```
OkrtSystem Labs — AETHER v2.0
│
├── index.html              — Dashboard principal (202 países · 16 categorías)
├── aether-globe-v3.html    — Globo 3D interactivo con datos de riesgo
├── aether-signal.html      — Feed de alertas en tiempo real
└── aether-vector.html      — Análisis de flujos financieros globales
```

Todos los módulos se abren desde los botones del **header del dashboard** (⬡ SIGNAL · ⬡ VECTOR · 🌐 GLOBE) sin necesidad de navegación adicional.

---

## Módulos

### 🌍 Dashboard Principal — `index.html`

El núcleo analítico del sistema. Motor completo de inteligencia de riesgos con:

- **202 países** con scoring en **16 categorías** de riesgo
- **Motor de propagación en cascada** con simulación Monte Carlo (400 iteraciones)
- **Shock Simulator** — 8 escenarios predefinidos + sliders manuales por categoría
- **Mapa mundial D3.js** — coropletas en 7 niveles, filtrable por categoría, con arcos de tensión geopolítica
- **Red de correlaciones** force-directed con 16 nodos arrastrables
- **Proyección temporal** con bandas de confianza p10/p50/p90
- **Termómetro Live** — top 8 categorías actualizadas cada 30 segundos
- **Ranking mundial** filtrable por región, categoría y orden
- **Señales de alerta** con 64 fuentes oficiales enlazadas
- **IA local** con Ollama/Mistral — predicciones, escenarios y chat contextual

---

### 🌐 Globe 3D — `aether-globe-v3.html`

Globo terrestre interactivo de máxima fidelidad visual construido sobre **Three.js**:

- **Textura NASA Blue Marble** real — Day/Night blend con shader GLSL personalizado
- **Ciclo día/noche en tiempo real** — el sol orbita el planeta con transición en el terminador
- **Luces de ciudades reales** en la zona nocturna (NASA Earth at Night)
- **Capa de nubes** animada con rotación independiente
- **155+ países con marcadores** codificados por nivel de riesgo (CRITICAL / HIGH / MEDIUM / LOW)
- **18 arcos de tensión geopolítica** animados con convoy de partículas
- **Panel de análisis** al click — señal de inteligencia, arcos relacionados, coordenadas
- **Retícula de targeting** animada al seleccionar un país
- **5.000 estrellas** procedurales en el fondo
- **Etiquetas de países** en canvas 2D sobreimpuestas con visibilidad por ángulo

**Controles:** arrastrar para rotar · scroll para zoom · click en marcador para análisis

---

### ⬡ Signal — `aether-signal.html`

Feed de alertas globales en tiempo real conectado a **APIs públicas reales**:

| Fuente | Contenido | Actualización |
|--------|-----------|---------------|
| **USGS** | Terremotos M4.5+ en los últimos 7 días | Tiempo real |
| **NASA EONET** | Eventos naturales activos (incendios, volcanes, tormentas) | Diaria |
| **ReliefWeb OCHA** | Alertas humanitarias de Naciones Unidas | Diaria |
| **GDELT Project** | Eventos geopolíticos, conflictos y economía en noticias | Cada 15 min |
| **WHO / OMS** | Alertas de salud global y brotes epidémicos | Curada |

**Funcionalidades:**
- Filtros por categoría: Conflicto · Geopolítica · Economía · Sismología · Clima · Humanitaria · Salud
- Ordenación por recencia, severidad o categoría
- Panel de detalle con análisis de impacto por evento
- Ticker inferior con las últimas alertas en bucle continuo
- Indicador de estado por fuente en tiempo real
- Refresco automático cada 5 minutos

---

### ⬡ Vector — `aether-vector.html`

Visualización **Sankey interactiva** de flujos financieros globales con datos reales 2022-23 (World Bank / IMF / BIS):

**5 tipos de flujo:**
- 🔴 **Deuda soberana** — tenencias de bonos entre países y regiones
- 🟡 **Comercio exterior** — flujos de exportación e importación
- 🟢 **Inversión Directa (IED)** — capital productivo entre economías
- 🟣 **Remesas** — transferencias de trabajadores emigrantes
- 🔵 **Reservas de divisas** — acumulación y distribución de reservas

**Funcionalidades:**
- Filtros por tipo de flujo y región de origen
- Umbral mínimo de volumen ajustable (slider)
- Click en nodo → detalle de entradas/salidas con barras comparativas
- Click en flujo → análisis del corredor financiero con contexto geopolítico
- Top 6 flujos activos en panel lateral
- Tooltips en hover con volumen y % del total global

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
- Navegador moderno (Chrome, Firefox, Edge — recomendado Chrome)
- Conexión a internet para cargar librerías CDN y APIs en tiempo real
- [Ollama](https://ollama.ai) con Mistral instalado *(solo para funciones de IA)*

### Uso directo en GitHub Pages

```
https://franjuanp.github.io/OkrtSystemLabs/
```

### Uso local (sin IA)
```bash
# Servir con Python
python -m http.server 8080
# → http://localhost:8080
```

### Uso local (con IA — Ollama/Mistral)
```powershell
# Windows PowerShell
taskkill /F /IM ollama.exe
$env:OLLAMA_ORIGINS="*"
ollama serve

# En otra terminal
python -m http.server 8080
```

```bash
# Linux / macOS
OLLAMA_ORIGINS="*" ollama serve &
python3 -m http.server 8080
```

```bash
# Instalar modelo Mistral
ollama pull mistral
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Visualización 3D** | Three.js r128 · GLSL Shaders · WebGL |
| **Visualización 2D** | D3.js v7 · TopoJSON · Canvas API |
| **Geodatos** | Natural Earth 110m · NASA Blue Marble · NASA EONET |
| **APIs en tiempo real** | USGS Earthquake · GDELT · ReliefWeb · WHO |
| **Datos financieros** | World Bank · IMF BOP · BIS Debt Statistics |
| **IA local** | Ollama REST API · Mistral 7B |
| **Sin frameworks** | Vanilla JS · CSS custom properties |
| **Sin build** | Archivos HTML independientes · sin npm · sin bundler |

---

## Motor analítico

```
Score final = Base histórico (World Bank, Freedom House, SIPRI, GHS...)
            + Ajuste por velocidad de cambio (tendencia actual)
            + Boost por correlación cruzada entre categorías
            + Propagación en cascada temporal
            ± Shock manual (Shock Simulator)
```

**Componentes del motor:**
- `enhancedScore()` — scoring base con correlación cruzada
- `simulateCascade()` — propagación temporal semana a semana
- `runMonteCarlo()` — 400 simulaciones, ruido gaussiano Box-Muller → bandas p10/p50/p90
- `computeResilienceIndex()` — capacidad de amortiguación sistémica por país
- `detectInflections()` — detección de aceleración del deterioro (segunda derivada)
- `runShockCascade()` — propagación de shocks manuales con overrides por categoría

---

## Fuentes de datos

`World Bank` · `Freedom House` · `Fragile States Index (FSI)` · `SIPRI` · `GHS Index (NTI)` · `UN HDI` · `FAO` · `WHO` · `IMF WEO` · `IIF` · `ACLED` · `NOAA` · `NASA` · `USGS` · `GDELT` · `ReliefWeb OCHA` · `BIS` · `Transparency International` · `V-Dem` · `Our World in Data`

---

## Protección intelectual

Este software está protegido mediante:
- **Ofuscación de código** — lógica del motor encriptada y transformada
- **Domain fingerprinting** — vinculado al dominio autorizado `franjuanp.github.io`
- **Copyright** — © OkrtSystem Labs. Todos los derechos reservados.

La reproducción, distribución o uso comercial no autorizado está prohibido.

---

<div align="center">

**AETHER** es una herramienta de investigación e inteligencia estratégica.
Los análisis son estimaciones orientativas y no deben usarse como única fuente para decisiones críticas.

---

*© 2025 OkrtSystem Labs · AETHER Global Intelligence System*
*[franjuanp.github.io/OkrtSystemLabs](https://franjuanp.github.io/OkrtSystemLabs)*

</div>
