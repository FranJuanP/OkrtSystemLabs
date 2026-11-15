<div align="center">

# ◈ AETHER
### Global Intelligence System

**by [OkrtSystem Labs](https://github.com/franjuanp)**

[![Version](https://img.shields.io/badge/version-2.0-00FFC8?style=flat-square&labelColor=0D1B2E)]()
[![Countries](https://img.shields.io/badge/countries-217-FF8C00?style=flat-square&labelColor=0D1B2E)]()
[![Categories](https://img.shields.io/badge/risk_categories-16-FF3355?style=flat-square&labelColor=0D1B2E)]()
[![Modules](https://img.shields.io/badge/modules-4-A259FF?style=flat-square&labelColor=0D1B2E)]()
[![No Server](https://img.shields.io/badge/backend-none-00FF88?style=flat-square&labelColor=0D1B2E)]()
[![AI](https://img.shields.io/badge/AI-Ollama%20%C2%B7%20clave%20propia-FFD700?style=flat-square&labelColor=0D1B2E)]()

*Sistema público de inteligencia de riesgos globales. 217 países y 16 categorías calculados con 63 indicadores oficiales, globo 3D con eventos de las últimas 72 horas, feed de alertas y flujos financieros. Sin servidor y sin backend.*

**[→ Ver en vivo](https://franjuanp.github.io/OkrtSystemLabs/)**

---

</div>

## ¿Qué es AETHER?

AETHER es un ecosistema modular de inteligencia de riesgos globales. Son páginas estáticas, servidas desde GitHub Pages e instalables como PWA, con todo el motor analítico en el navegador: sin servidor, sin base de datos y sin backend.

Los datos se descargan de fuentes públicas con trabajos de GitHub Actions: los indicadores cada semana y los eventos cada media hora. Cada dato lleva su valor, año, fuente y enlace, y la metodología está publicada en [`METHODOLOGY.md`](METHODOLOGY.md) y en la página de metodología de la web.

---

## Arquitectura del ecosistema

```
OkrtSystem Labs · AETHER v2.0
│
├── index.html              Panel principal (217 países · 16 categorías)
├── aether-globe-v3.html    Globo 3D con riesgo, arcos y eventos
├── aether-signal.html      Feed de alertas y eventos
├── aether-vector.html      Flujos financieros globales
├── metodologia.html        Metodología y procedencia de los datos
│
├── data/latest.json        Indicadores (trabajo semanal, en el repositorio)
├── data/events.json        Eventos, conflicto y mercados (cada despliegue)
├── data/vector.json        Flujos de Vector
│
└── mcp/aether-mcp.mjs      Servidor MCP local para agentes
```

Todos los módulos se abren desde la cabecera del panel (⬡ SIGNAL · ⬡ VECTOR · 🌐 GLOBE).

---

## Módulos

### 🌍 Panel principal · `index.html`

- **217 países** con puntuación en **16 categorías** de riesgo, calculada con datos oficiales
- **Eventos recientes por país**: lo ocurrido en las últimas 72 horas, el conflicto según GDELT y los mercados de predicción que preguntan por el país
- **Shock Simulator**: 8 escenarios predefinidos o perturbaciones manuales que se propagan por la cascada
- **Proyección temporal** con 400 simulaciones Monte Carlo y bandas p10/p50/p90
- **Red de correlaciones** medida entre los 217 países, con cadenas de riesgo
- **Termómetro de riesgo** con las 8 categorías más altas
- **Ranking mundial** filtrable por región, categoría y orden
- **Capa operativa**: brief, explicabilidad por categoría y watchlist persistente
- **Exportación** de los eventos de un territorio (CSV y GeoJSON) y de la watchlist (CSV)
- **IA** con Ollama en local o con un proveedor y tu propia clave: predicciones, escenarios y chat con el contexto del país

---

### 🌐 Globo 3D · `aether-globe-v3.html`

Construido sobre **Three.js**:

- **Textura NASA Blue Marble** con mezcla día/noche en un shader GLSL y luces de ciudades en la cara nocturna
- **Capa de nubes** animada y 5.000 estrellas de fondo
- **217 países** con marcadores por nivel de riesgo, los mismos números que el panel
- **Eventos de las últimas 72 horas** como rombos, con color por tipo (sismo, volcán, incendio, tormenta, inundación, sequía, salud, conflicto) y tamaño por severidad. Al pulsar uno se abre su ficha con fuente, cifras y enlace
- **92 arcos geopolíticos** en 6 tipos (conflicto, tensión, sanción, energía, alianza y proxy). Empiezan ocultos y se muestran con GLOBAL o con un tipo
- **Panel del país**: puntuación, categoría dominante, eventos recientes, conflicto GDELT y tensiones relacionadas

**Controles:** arrastrar para rotar · scroll para zoom · pulsar un país o un evento para ver su detalle

---

### ⬡ Signal · `aether-signal.html`

Feed de alertas con fuentes públicas reales:

| Fuente | Contenido | Cómo llega |
|--------|-----------|------------|
| **USGS** | Terremotos M4,5+ de los últimos 7 días, con alerta PAGER | Navegador y proceso periódico |
| **NASA EONET** | Eventos naturales activos (incendios, volcanes, tormentas) | Navegador y proceso periódico |
| **OMS** | Brotes notificados (Disease Outbreak News) | Navegador y proceso periódico |
| **GDELT** | Noticias de conflicto, geopolítica y economía | Navegador y proceso periódico |
| **GDELT · eventos** | Sucesos violentos con el lugar donde ocurrieron | Proceso periódico |
| **GDACS** | Alertas de desastre de la ONU y la Comisión Europea | Proceso periódico |
| **NOAA SWPC** | Clima espacial: escalas G, S y R activas | Proceso periódico |
| **ReliefWeb** | Pendiente: su API exige un `appname` aprobado | No se consulta |

**Funcionalidades:** filtros por categoría (incluida clima espacial), ordenación por recencia, severidad o categoría, ficha de detalle por evento, ticker, estado de cada fuente y refresco cada 5 minutos.

---

### ⬡ Vector · `aether-vector.html`

Visualización **Sankey** de flujos financieros globales con datos de Banco Mundial, FMI y BIS:

- 🔴 **Deuda soberana** · 🟡 **Comercio exterior** · 🟢 **Inversión directa** · 🟣 **Remesas** · 🔵 **Reservas de divisas**
- Filtros por tipo de flujo y región, umbral de volumen, detalle por nodo y por corredor

---

## Las 16 categorías de riesgo

| # | Categoría | | # | Categoría |
|---|-----------|---|---|-----------|
| 1 | 💰 Económico | | 9 | ⚡ Energético |
| 2 | 🌐 Geopolítico | | 10 | 📊 Demográfico |
| 3 | 🏥 Sanitario | | 11 | 🏙️ Urbano/Infra. |
| 4 | 🌡️ Climático | | 12 | 🔬 Ciencia/I+D |
| 5 | 👥 Cohesión social | | 13 | ⚖️ Justicia/DDHH |
| 6 | 💻 Tecnológico | | 14 | 💳 Financiero |
| 7 | 🌽 Seg. alimentaria | | 15 | 🌊 Océanos |
| 8 | 🧠 Salud mental | | 16 | 🦠 Bioseguridad |

Los indicadores de cada categoría, su fuente y su dirección de riesgo están en [`METHODOLOGY.md`](METHODOLOGY.md).

---

## Motor analítico: cinco capas

1. **Score base.** Cada indicador se convierte en el percentil de riesgo del país entre 217. La categoría es la media de sus indicadores y el índice mezcla, a partes iguales, la media de las categorías y la de las tres peores.
2. **Tendencia.** El ritmo de cada categoría, en puntos de riesgo por año, medido entre los dos últimos datos publicados de sus indicadores.
3. **Correlación.** Matriz 16×16 medida entre los 217 países. Cuando dos categorías que suelen ir juntas están las dos altas, la tarjeta añade un ajuste que se muestra aparte de la base.
4. **Cascada.** Los shocks se propagan entre categorías con fuerza, retardo y decaimiento, con impactos de segundo y tercer orden. **Es un modelo ilustrativo**: su matriz y los pesos de resiliencia son supuestos explícitos, no estimaciones.
5. **Monte Carlo.** 400 simulaciones con semilla. El ruido del estado inicial depende de la confianza de cada dato y el de la tendencia de su dispersión.

La formulación completa está en [`METHODOLOGY.md`](METHODOLOGY.md).

**Componentes:** `src/core/scoring.js` (puntuación, ritmo y correlación), `src/dashboard/sim-core.js` (cascada y Monte Carlo, también en un Web Worker), `src/dashboard/engine.js` (panel).

---

## Fuentes de datos

**Indicadores** (semanal, sin clave): Banco Mundial (WDI, WGI y UHC) · INFORM Risk del JRC · UCDP · ND-GAIN · FMI COFER · Tesoro de EEUU TIC · Natural Earth.

**Eventos** (cada despliegue, sin clave): USGS · NASA EONET · OMS · GDACS · GDELT (noticias y exportación de eventos) · NOAA SWPC.

**Mercados de predicción** (cada despliegue, sin clave): Polymarket · Manifold.

**Vector:** Banco Mundial · FMI · BIS.

Licencias y detalle de cada fuente en [`METHODOLOGY.md`](METHODOLOGY.md).

---

## Instalación y uso

### Uso directo

```
https://franjuanp.github.io/OkrtSystemLabs/
```

### Desarrollo local

```bash
npm ci
npm run dev            # servidor de desarrollo de Vite
npm run build          # construir dist/
npm run preview        # servir dist/ en http://localhost:8080

npm run datos          # descargar los indicadores (data/latest.json)
npm run eventos        # descargar eventos, conflicto y mercados (data/events.json)
npm run test:unit      # pruebas unitarias
npm run test:todo      # unitarias, build y pruebas de navegador
```

### Despliegue

El sitio se construye con Vite y se publica desde `.github/workflows/deploy-pages.yml` en cada push a `main`. El trabajo `eventos.yml` lanza un despliegue cada media hora para refrescar los eventos.

> **Ajuste que hay que hacer una sola vez:** en *Settings → Pages → Build and deployment → Source*, elegir **«GitHub Actions»** en lugar de «Deploy from a branch».

### IA con Ollama en local

> **Por qué no `OLLAMA_ORIGINS="*"` ni `OLLAMA_HOST=0.0.0.0`:** con `*` cualquier web que visites puede hablar con tu Ollama desde tu propio navegador (leer tus modelos y lanzarles peticiones), y con `0.0.0.0` lo expones además a toda tu red local, sin autenticación. Por eso se listan solo los dos orígenes desde los que se sirve AETHER y Ollama escucha únicamente en `127.0.0.1`, que es lo que hace por defecto.

```powershell
# Windows PowerShell
taskkill /F /IM ollama.exe
$env:OLLAMA_ORIGINS="https://franjuanp.github.io,http://localhost:8080"
ollama serve
```

```bash
# Linux / macOS
OLLAMA_ORIGINS="https://franjuanp.github.io,http://localhost:8080" ollama serve
```

```bash
ollama pull mistral
```

### IA con tu propia clave

En la barra de IA del panel se puede elegir **Anthropic, OpenAI, Google Gemini u OpenRouter** y escribir tu propia clave:

- La clave se guarda **solo en tu navegador**: en la sesión, o recordada si marcas *Recordar*. *Olvidar* la borra.
- Se envía **solo al proveedor elegido**, en una cabecera y nunca en la URL. AETHER no tiene servidor y no la ve.
- No se escribe en consola, no entra en ninguna exportación y se borra de los mensajes de error.
- La política de seguridad de la página solo permite conectar con esos cuatro proveedores y con Ollama en local.
- **El repositorio no contiene ninguna clave.** Cada consulta la paga la cuenta del proveedor de quien la hace.

### Servidor MCP

`mcp/aether-mcp.mjs` permite que un agente (Claude Desktop, Claude Code, Cursor) consulte AETHER: riesgo de un país, ranking, tendencias, eventos recientes y conflicto. Sin dependencias ni claves. Instrucciones en [`mcp/README.md`](mcp/README.md).

```bash
npm run mcp
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Visualización 3D** | Three.js · shaders GLSL · WebGL |
| **Visualización 2D** | D3 (selección, arrastre y fuerzas) · Canvas |
| **Build** | Vite · vite-plugin-pwa (service worker y manifiesto) |
| **Datos** | GitHub Actions · JSON validado con esquema (Ajv) |
| **Pruebas** | Vitest (unitarias) · Playwright con Chromium y WebKit (navegador) |
| **IA** | Ollama en local · Anthropic, OpenAI, Gemini u OpenRouter con clave propia |
| **Agentes** | Servidor MCP por stdio, sin dependencias |

---

## Limitaciones conocidas

- Las puntuaciones son **relativas** entre 217 países: un CRÍTICO dice que el país está entre los peores, no que haya cruzado un umbral absoluto.
- Los indicadores tienen años distintos según la fuente; cada dato muestra el suyo.
- La cascada es un modelo ilustrativo; sirve para explorar cómo se encadenan los riesgos, no para predecir cifras.
- GDELT mide cobertura de prensa, no víctimas. Los mercados de predicción son el precio de preguntas concretas, no una medida del riesgo.
- Los 92 arcos del globo y los temas de vigilancia del panel son capas editoriales escritas a mano.
- ReliefWeb no se consulta hasta tener un `appname` aprobado.

---

## Autoría y licencia

**© OkrtSystem Labs. Todos los derechos reservados.** La reproducción, distribución o uso comercial no autorizado está prohibido.

### Aviso de copia no oficial

Cuando AETHER se abre desde un host que no es `franjuanp.github.io`, `localhost` o `127.0.0.1`, muestra un aviso discreto de copyright en una esquina. La aplicación sigue funcionando con normalidad.

> **Esto no es una medida de seguridad.** Todo el código se ejecuta en el navegador de quien visita la página y cualquiera puede quitar el aviso de una copia. Es, exactamente, un aviso de autoría. La protección real de la obra es la legal: el copyright y los términos de uso.

### Seguridad

- Política de seguridad de contenido (CSP) por página, con la lista exacta de orígenes a los que se conecta.
- `referrer` en `no-referrer`.
- Todo texto que llega de fuentes externas se escapa antes de pintarse; hay pruebas de XSS en cada cambio.

---

<div align="center">

**AETHER** es una herramienta de investigación e inteligencia estratégica.
Los análisis son estimaciones orientativas y no deben usarse como única fuente para decisiones críticas.

---

*© 2025 OkrtSystem Labs · AETHER Global Intelligence System*
*[franjuanp.github.io/OkrtSystemLabs](https://franjuanp.github.io/OkrtSystemLabs)*

</div>
