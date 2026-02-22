<div align="center">

```
╔══════════════════════════════════════════════════════════════╗
║        S.I.R.E.N.A.  WINDOWS EDITION  v1.2.0                ║
║      WiFi · BLE · Bluetooth Scanner & Pentesting Toolkit     ║
║           OkrtSystem Labs — Tactical Mod Phase 2.5 HVT       ║
╚══════════════════════════════════════════════════════════════╝
```

![Version](https://img.shields.io/badge/version-1.2.0-cyan?style=for-the-badge&logo=python)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=for-the-badge&logo=windows)
![Python](https://img.shields.io/badge/python-3.10%2B-green?style=for-the-badge&logo=python)
![AI](https://img.shields.io/badge/AI-Ollama%20Local-purple?style=for-the-badge)
![License](https://img.shields.io/badge/use-Authorized%20Only-red?style=for-the-badge)

**Sistema de Inteligencia y Reconocimiento de Espectro para Networks Airborne**

*WiFi · BLE · Bluetooth · AI-Powered Autonomous Pentesting*

</div>

---

> [!CAUTION]
> **USO EXCLUSIVAMENTE AUTORIZADO**
> S.I.R.E.N.A. es una herramienta de auditoría de seguridad inalámbrica destinada **únicamente** a profesionales de ciberseguridad con autorización expresa sobre los sistemas bajo análisis. El uso no autorizado puede constituir un delito. OkrtSystem Labs no se responsabiliza del uso indebido.

---

## Tabla de Contenidos

| # | Sección |
|---|---------|
| 01 | [Requisitos del Sistema](#01-requisitos-del-sistema) |
| 02 | [Instalación de Dependencias](#02-instalación-de-dependencias) |
| 03 | [Configuración Inicial](#03-configuración-inicial) |
| 04 | [Primer Arranque](#04-primer-arranque) |
| 05 | [Visión General de la Interfaz](#05-visión-general-de-la-interfaz) |
| 06 | [Scanner WiFi](#06-scanner-wifi) |
| 07 | [Scanner BLE / Bluetooth](#07-scanner-ble--bluetooth) |
| 08 | [Signal Finder](#08-signal-finder) |
| 09 | [Red Team — Ataques WiFi](#09-red-team--ataques-wifi) |
| 10 | [Red Team — Ataques BLE](#10-red-team--ataques-ble) |
| 11 | [AI Agent — Agente Autónomo](#11-ai-agent--agente-autónomo-de-pentesting) |
| 12 | [Military Mode](#12-military-mode) |
| 13 | [IRK Manager](#13-irk-manager) |
| 14 | [Base de Datos](#14-base-de-datos-sirenadb) |
| 15 | [Exportación de Informes](#15-exportación-de-informes) |
| 16 | [Logs y Diagnóstico](#16-logs-y-diagnóstico) |
| 17 | [Resolución de Problemas](#17-resolución-de-problemas) |
| 18 | [Referencia Rápida](#18-referencia-rápida) |

---

## 01 Requisitos del Sistema

| Componente | Requisito |
|-----------|-----------|
| **SO** | Windows 10 (20H2+) o Windows 11 — 64-bit |
| **Python** | 3.10, 3.11 o 3.12 — añadir al PATH |
| **Privilegios** | Administrador recomendado para módulos activos |
| **WiFi** | Adaptador USB 802.11ac con monitor mode (Realtek RTL8811AU recomendado) |
| **BLE** | Cualquier adaptador Bluetooth 4.0+ integrado o USB |
| **AI Engine** | Ollama instalado + modelo compatible (mistral, llama3, qwen2.5...) |

### Dependencias Opcionales por Módulo

| Dependencia | Módulo que la requiere | Estado sin ella |
|------------|----------------------|----------------|
| `Npcap` | Captura WiFi pasiva, Inyección, Deauth, WPA Capture | Módulos activos deshabilitados |
| `scapy` | Todos los ataques WiFi | Red Team WiFi no disponible |
| `bleak` | Escaneo BLE, GATT Scan, RPA Tracker | Fallback a WinRT si disponible |
| `pywifi` | Escaneo WiFi pasivo | Degradado o sin escaneo |
| `winrt / winsdk` | BLE Spam, BLE avanzado Windows-native | Solo modo bleak si disponible |
| Ollama (local) | AI Agent autónomo | Agente AI no funcional |

---

## 02 Instalación de Dependencias

### Paso 1 — Entorno Python

```powershell
# Crear entorno virtual (recomendado)
python -m venv sirena_env
.\sirena_env\Scripts\Activate.ps1

# Dependencias núcleo
pip install PyQt6 pywifi scapy bleak winsdk

# Dependencias opcionales para BLE avanzado
pip install winrt-Windows.Devices.Bluetooth
pip install winrt-Windows.Devices.Bluetooth.Advertisement
```

### Paso 2 — Npcap (captura e inyección WiFi)

Descargar desde **https://npcap.com** e instalar con la opción **"WinPcap API-compatible Mode"** activada. Reiniciar el equipo tras la instalación.

> [!NOTE]
> Npcap debe instalarse **antes** de ejecutar SIRENA si se requieren capacidades de inyección o captura de paquetes 802.11. Sin Npcap, Scapy no puede operar en Windows.

### Paso 3 — Ollama (AI Engine local)

```bash
# Descargar e instalar desde https://ollama.com
ollama serve                  # inicia el servidor en background

# Descargar un modelo compatible (en otra terminal)
ollama pull mistral           # recomendado — buen balance rendimiento/calidad
ollama pull llama3:8b         # alternativa liviana
ollama pull qwen2.5:7b        # buena capacidad para pentesting
```

### Paso 4 — Módulos complementarios de SIRENA

Asegúrese de que los siguientes archivos estén en el mismo directorio que el script principal:

| Archivo | Descripción | Requerido para |
|---------|-------------|----------------|
| `sirena_agent_v2.py` | AI Agent v2 con soporte Ollama | AI Agent |
| `sirena_military_mode.py` | Panel Military Mode | Mil. Mode |
| `sirena_ext/event_bus.py` | Bus de eventos tácticos | Opcional |
| `sirena_ext/rules_engine.py` | Motor de reglas tácticas | Opcional |

---

## 03 Configuración Inicial

SIRENA carga su configuración desde dos fuentes opcionales en el directorio del script:

### `config.json`

```json
{
  "SIRENA_WIFI_IFACE":   "Wi-Fi 2",
  "SIRENA_ADAPTER_MAC":  "00:c0:ca:b6:1e:16",
  "OLLAMA_HOST":         "http://localhost:11434",
  "OLLAMA_MODEL":        "mistral"
}
```

### `.env` (alternativo)

```env
SIRENA_WIFI_IFACE=Wi-Fi 2
SIRENA_ADAPTER_MAC=00:c0:ca:b6:1e:16
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=mistral
```

### Parámetros de Configuración

| Parámetro | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `SIRENA_WIFI_IFACE` | Nombre del adaptador WiFi en Windows | `Wi-Fi 2` |
| `SIRENA_ADAPTER_MAC` | MAC del adaptador WiFi principal | `00:c0:ca:b6:1e:16` |
| `OLLAMA_HOST` | URL del servidor Ollama local | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modelo Ollama a usar para el agente | `mistral` |

> [!TIP]
> Para conocer el nombre exacto de tu adaptador WiFi en Windows:
> ```powershell
> Get-NetAdapter | Select-Object Name, InterfaceDescription, MacAddress
> ```

### Precedencia de Configuración

```
Variable de entorno del sistema  →  .env  →  config.json  →  Valor por defecto interno
```

---

## 04 Primer Arranque

1. Abra PowerShell o CMD **como Administrador**
2. Active el entorno virtual si lo usa: `.\sirena_env\Scripts\Activate.ps1`
3. Navegue al directorio del script
4. Ejecute:

```powershell
python sirena_v1_2_0_tactical_mod_phase2_5_hvt.py
```

5. La **Splash Screen** mostrará la secuencia de inicialización (~9 segundos)
6. Las advertencias de capacidades aparecerán en la consola. La aplicación arranca igualmente con las funciones disponibles.

### Comprobaciones al Arranque (Preflight)

| Verificación | Estado OK | Impacto si falla |
|-------------|-----------|-----------------|
| Sistema operativo Windows | Plataforma detectada | Funciones nativas Windows limitadas |
| Privilegios Administrador | `IsUserAnAdmin() = True` | Módulos activos deshabilitados |
| Npcap instalado | `C:\Windows\System32\Npcap` existe | Sin captura/inyección 802.11 |
| Módulo `scapy` | `import scapy` correcto | Red Team WiFi no disponible |
| Módulo `bleak` / `winrt` | BLE backend disponible | Scanner BLE no funcional |

---

## 05 Visión General de la Interfaz

La interfaz se organiza en pestañas principales con estética **Matrix/cyberpunk**:

| Pestaña | Función |
|---------|---------|
| ◈ **WIFI SCANNER** | Escaneo pasivo/activo 802.11. SSID, BSSID, seguridad, canal, RSSI, vendor |
| ◈ **BLE / BT SCANNER** | Escaneo BLE y Bluetooth Classic. Detección MACs RPA, manufacturer data |
| ◈ **SIGNAL FINDER** | Rastreador de dispositivo por MAC. Medidor de señal en tiempo real |
| ◈ **RED TEAM** | Suite completa: Deauth, WPA Capture, Karma, Evil Twin, BLE Spam, GATT Scan... |
| ◈ **AI AGENT** | Agente de pentesting autónomo con Ollama. Assessment completo por fases |
| ◈ **MILITARY MODE** | Módulo operacional avanzado para objetivos de alta prioridad (HVT) |
| ◈ **IRK MANAGER** | Gestión de Identity Resolving Keys para resolución de MACs RPA |

### Código de Colores

| Color | Significado |
|-------|------------|
| 🔵 **CIAN** | Información primaria, datos de red, títulos |
| 🟢 **VERDE** | Estado OK, señal fuerte (RSSI > -60 dBm) |
| 🟣 **MORADO** | AI Agent, acciones tácticas |
| 🔴 **ROJO** | Errores, señal débil, alertas CRÍTICAS |
| 🟠 **NARANJA** | Advertencias, severidad HIGH |
| 🟡 **AMARILLO** | Avisos MEDIUM, señal media |
| 🔷 **AZUL** | Redes WiFi, BSSID |
| 🟪 **VIOLETA** | Dispositivos BLE |

---

## 06 Scanner WiFi

Detecta redes 802.11 en el entorno con almacenamiento en BD local y estadísticas EWMA de señal (α=0.3).

### Controles Principales

| Control | Función |
|---------|---------|
| `▶ START` | Inicia escaneo continuo con pywifi |
| `■ STOP` | Detiene el escaneo manteniendo datos |
| Campo Adaptador | Nombre del adaptador WiFi (ej. `Wi-Fi 2`) |
| Campo Filtro | Filtra por SSID, BSSID o fabricante |
| `EXPORT CSV` | Exporta en formato WiGLE CSV |
| `CLEAR` | Borra todos los registros WiFi de la BD |

### Columnas de la Tabla

| Columna | Descripción |
|---------|-------------|
| SSID | Nombre de la red. `<hidden>` si no se emite |
| BSSID | MAC del punto de acceso |
| RSSI | Potencia de señal (dBm). Código de color automático |
| CH | Canal 802.11 (1-13 para 2.4GHz, 36-177 para 5GHz) |
| SECURITY | Tipo de seguridad: WPA3, WPA2, WPA, WEP, OPEN |
| VENDOR | Fabricante del AP por OUI del BSSID |
| LAST SEEN | Última vez visto (HH:MM:SS) |

### Menú Contextual (clic derecho)

| Opción | Acción |
|--------|--------|
| 📋 Copiar BSSID / SSID | Copia al portapapeles |
| ⚙ AI Agent → assessment autónomo | Carga la red en el AI Agent |
| 🔎 Filtrar por BSSID / Vendor | Aplica filtro automáticamente |
| Red Team → ataques | Abre Red Team con objetivo precargado |

> [!TIP]
> Clic en las cabeceras de columna para ordenar la tabla. La columna RSSI ordena numéricamente para encontrar los APs más cercanos.

---

## 07 Scanner BLE / Bluetooth

Detecta dispositivos Bluetooth Low Energy y Bluetooth Classic con identificación automática de fabricante y soporte para MACs aleatorias (RPA).

### Controles Principales

| Control | Función |
|---------|---------|
| `▶ START BLE SCAN` | Inicia escaneo BLE (bleak o WinRT) |
| `■ STOP` | Detiene el escaneo |
| Filtro de texto | Filtra por nombre/MAC/fabricante |
| Checkbox RPA Only | Muestra solo dispositivos con MAC aleatoria |
| `CLEAR` | Elimina todos los registros BLE de la BD |

### Columnas de la Tabla BLE

| Columna | Descripción |
|---------|-------------|
| NAME | Nombre del dispositivo o `<unnamed>` |
| MAC | Dirección MAC BLE |
| RSSI | Intensidad de señal con código de color |
| RPA | "RPA" si MAC aleatoria resoluble, "—" si pública |
| MFR DATA | Primeros 30 bytes del manufacturer data (hex) |
| VENDOR | Fabricante identificado |
| LAST SEEN | Última detección |

### Detección Inteligente de Dispositivos Apple / Google / Microsoft

| Pattern en MFR DATA | Dispositivo identificado |
|---------------------|--------------------------|
| `0x1907` / `0x0719` | AirPods Pro |
| `0x1005` | iPhone |
| Contiene `watch` | Apple Watch |
| `0x0600` (Microsoft) | Microsoft Swift Pair |
| `0xE000` (Google) | Google Fast Pair |

### Menú Contextual BLE

| Opción | Acción |
|--------|--------|
| 🔍 GATT Scan | Enumera servicios GATT del dispositivo |
| 📡 BLE Spam | Simula el tipo de dispositivo detectado |
| 🎯 RPA Tracker | Rastrea el dispositivo con IRKs almacenados |
| 📶 Signal Finder | Abre Signal Finder con la MAC precargada |
| ⚙ AI Agent | Carga el dispositivo como objetivo BLE |

---

## 08 Signal Finder

Herramienta para localizar físicamente un dispositivo basándose en intensidad de señal.

### Uso

1. Introduce la **MAC Address** del dispositivo: `XX:XX:XX:XX:XX:XX`
2. Añade un **Alias** descriptivo (opcional)
3. Selecciona el **Tipo de Scan**: `AUTO (WiFi+BLE)`, `WIFI ONLY` o `BLE ONLY`
4. Si el dispositivo usa RPA, introduce el **IRK** (32 chars hex)
5. Pulsa `▶ START TRACKING`
6. Muévete físicamente — señal más alta = mayor proximidad al objetivo

### Panel de Señal

- **Medidor gráfico** de intensidad en dBm, actualizado en cada detección
- **Contador de detecciones** total desde el inicio del rastreo
- **Log de historial** con timestamp, RSSI y estado de cada detección

> [!NOTE]
> Signal Finder se puede invocar directamente desde el menú contextual del Scanner BLE con la MAC precargada automáticamente.

---

## 09 Red Team — Ataques WiFi

> [!WARNING]
> Los módulos de esta sección realizan **ataques activos** sobre infraestructura de red. Su uso sin autorización expresa del propietario es ilegal. Utilice únicamente en entornos de laboratorio o en redes sobre las que tenga autorización documentada.

La mayoría de ataques WiFi requieren **Scapy + Npcap + adaptador en monitor mode**.

### Ataques Disponibles

| Ataque | Descripción | Requisitos |
|--------|-------------|------------|
| **DEAUTH** | Envía paquetes de deautenticación 802.11. Desconecta clientes del AP. Soporta cliente específico o broadcast `FF:FF:FF:FF:FF:FF` | Scapy + Npcap + Admin |
| **AUTH FLOOD** | Inunda la tabla de asociaciones del AP con Auth+Assoc requests de MACs aleatorias. DoS contra clientes legítimos | Scapy + Npcap + Admin |
| **WPA HANDSHAKE CAPTURE** | Captura el 4-way handshake WPA/WPA2. Envía deauths para forzar reconexión. Guarda `.cap` para cracking offline | Scapy + Npcap + Admin |
| **KARMA ATTACK** | AP rogue que responde a cualquier Probe Request. Dispositivos con auto-connect se asocian al AP falso | Scapy + Npcap + Admin |
| **EVIL TWIN** | AP gemelo con mismo SSID usando Windows Hosted Network (netsh). No requiere Scapy. Monitoriza clientes vía ARP | Admin (netsh) |
| **BEACON FLOOD** | Inunda el espectro 2.4GHz con APs falsos. SSIDs configurables o aleatorios. Ciclo automático canales 1/6/11 | Scapy + Npcap + Admin |
| **PROBE SNIFFER** | Captura pasiva de Probe Requests 802.11. Revela historial de redes conocidas de dispositivos cercanos | Scapy + Npcap |

### Procedimiento — WPA Handshake Capture

1. Scanner WiFi → clic derecho sobre el AP → **Red Team → WPA Capture**
2. Especifica la ruta de salida del `.cap` (ej. `capture_objetivo.cap`)
3. Activa **Deauth Trigger** para forzar reconexión de clientes
4. Espera la captura de los 4 mensajes EAPOL (M1, M2, M3, M4)
5. Crack offline:

```bash
hashcat -m 22000 capture.cap.hc22000 wordlist.txt
# o
aircrack-ng -w wordlist.txt -b <BSSID> capture.cap
```

### Procedimiento — Evil Twin

1. Introduce el **SSID exacto** del AP a clonar
2. Define la **contraseña** del AP falso (mín. 8 chars; default: `sirena00`)
3. Establece la **duración** máxima en segundos (máx. 60)
4. Pulsa `▶ START` → el log mostrará los clientes que se conecten

> [!CAUTION]
> El archivo `.cap` generado contiene hashes WPA/WPA2 que pueden usarse para intentar recuperar la contraseña offline. Mantenga estos archivos con acceso restringido y elimínelos tras completar la auditoría.

---

## 10 Red Team — Ataques BLE

### GATT Scan — Enumeración de Servicios

1. Introduce la MAC del dispositivo BLE (o selecciónalo con clic derecho → GATT Scan)
2. Pulsa `▶ START GATT SCAN`
3. La tabla muestra: Handle, UUID, descripción, propiedades y valor leído de cada característica

### Modos de Ataque BLE (Targeted Attack)

| Modo | Descripción | Requiere conexión |
|------|-------------|:-----------------:|
| `PS_ADV_BLAST` | Advertisement blast nativo Windows. Sin dependencias. Más compatible | No |
| `MULTI_ADV_BLAST` | 60+ publishers simultáneos de advertising packets | No |
| `ADV_CLONE_FLOOD` | Clona el advertising del objetivo y lo inunda | No |
| `CONNECTION_FLOOD` | Flood de intentos de conexión al dispositivo objetivo | Intento |
| `NOTIFY_FLOOD` | Flood de requests de notificación GATT | Sí |
| `ATT_READ_FLOOD` | Flood de lecturas ATT a todas las características | Sí |
| `GATT_WRITE_FLOOD` | Flood de escrituras GATT | Sí |
| `BT_SOCKET_FLOOD` | Flood vía socket Bluetooth Classic | Sí |
| `SCAN_REQ_FLOOD` | Flood de scan requests BLE | No |

### RPA Tracker

1. Asegúrate de tener IRKs configurados en el **IRK Manager**
2. Pulsa `▶ START RPA TRACKER` → SIRENA carga todos los IRKs de la BD
3. Cuando una MAC RPA coincida con un IRK, aparece en tabla con: IRK, MAC resuelta, RSSI y timestamp

---

## 11 AI Agent — Agente Autónomo de Pentesting

El AI Agent ejecuta de forma **autónoma** un assessment completo de seguridad usando un modelo de lenguaje local (Ollama), tomando decisiones sobre qué herramientas ejecutar en cada fase.

### Prerrequisitos

```bash
# 1. Ollama debe estar corriendo
ollama serve

# 2. Verificar modelo disponible
ollama list

# 3. Test de conectividad
curl http://localhost:11434/v1/models
```

Configura el modelo en `config.json` con la clave `OLLAMA_MODEL`.

### Tipos de Objetivo

**WiFi:**

| Campo | Requerido |
|-------|:---------:|
| BSSID (MAC del AP) | ✅ |
| SSID | Recomendado |
| Security (WPA2, WPA3...) | Recomendado |
| Channel / RSSI / Vendor | Opcional |

**BLE:**

| Campo | Requerido |
|-------|:---------:|
| MAC Address | ✅ |
| Name / Manufacturer | Recomendado |
| RSSI | Opcional |

> [!TIP]
> **Acceso rápido:** Desde cualquier Scanner, clic derecho sobre el objetivo → **⚙ AI Agent → assessment autónomo**. Los datos se precargan automáticamente.

### Fases del Assessment

```
[RECONOC.] → [PASIVO] → [RESILIENC.] → [AUTENT.] → [AVANZADO] → [INFORME]
```

| Fase | Herramientas | Objetivo |
|------|-------------|---------|
| 1. Reconocimiento | `query_scan_db`, `run_probe_sniffer` | Recopilar info del objetivo y entorno |
| 2. Análisis Pasivo | `run_probe_sniffer` | Captura sin interacción con el objetivo |
| 3. Resiliencia | `run_deauth`, `run_ble_attack` | Probar robustez ante ataques de disponibilidad |
| 4. Autenticación | `run_wpa_capture`, `run_evil_twin`, `run_karma`, `run_auth_flood` | Evaluar seguridad de autenticación |
| 5. Avanzado | `run_beacon_flood`, `analyze_handshake_file` | Técnicas avanzadas según hallazgos |
| 6. Informe | `report_finding`, `conclude_assessment` | Generar resumen ejecutivo + nivel de riesgo |

### Pestañas del Panel AI Agent

| Pestaña | Contenido |
|---------|-----------|
| LOG DE ACTIVIDAD | Registro cronológico de acciones y resultados |
| RAZONAMIENTO IA | Cadena de razonamiento del modelo (cómo toma decisiones) |
| HALLAZGOS | Lista de vulnerabilidades detectadas + resumen ejecutivo |

### Niveles de Severidad

| Nivel | Descripción |
|-------|------------|
| 🔴 `CRITICAL` | Vulnerabilidad explotable de forma inmediata y de alto impacto |
| 🟠 `HIGH` | Vulnerabilidad importante con explotación no trivial |
| 🟡 `MEDIUM` | Riesgo moderado, generalmente requiere condiciones adicionales |
| 🟢 `LOW` | Riesgo bajo, problema de configuración o exposición menor |
| ⚫ `INFO` | Observación informativa, no representa riesgo directo |

### Límites del Agente

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `MAX_TURNS` | 30 | Turnos máximos antes de forzar conclusión automática |
| Duración max. por tool | 60 seg | Hard cap por herramienta ejecutada |
| Contexto máximo | 10 turnos | Poda automática del historial |

> [!NOTE]
> **Memoria de sesión:** El agente recuerda los resultados de hasta 3 assessments previos sobre el mismo objetivo. Permite correlacionar hallazgos entre sesiones y priorizar áreas ya exploradas.

### Controles del Agente

| Botón | Acción |
|-------|--------|
| `▶ INICIAR ASSESSMENT` | Lanza el agente con el objetivo configurado |
| `■ DETENER` | Envía señal de parada — el agente concluye limpiamente |
| `EXPORTAR INFORME` | Guarda el informe en TXT, JSON o HTML |

---

## 12 Military Mode

Módulo operacional avanzado implementado en `sirena_military_mode.py`. Proporciona capacidades de reconocimiento y ataque táctico extendidas para operaciones de alta prioridad **(HVT — High Value Target)**.

> [!NOTE]
> Requiere que `sirena_military_mode.py` esté presente en el directorio de la aplicación. Si no se encuentra, la pestaña no aparece pero la aplicación funciona con normalidad.

---

## 13 IRK Manager

Gestor de **Identity Resolving Keys (IRKs)** — claves criptográficas de 16 bytes que permiten resolver Resolvable Private Addresses (RPA) de dispositivos BLE.

### ¿Por qué son necesarias las IRKs?

Los dispositivos BLE modernos usan MACs aleatorias que cambian periódicamente para evitar el rastreo. Con el IRK correcto (obtenido durante el emparejamiento BLE), SIRENA puede seguir rastreando un dispositivo específico aunque cambie su MAC.

### Gestión de IRKs

| Operación | Descripción |
|-----------|-------------|
| Añadir IRK | IRK en hexadecimal (32 chars = 16 bytes) + nombre + tipo de dispositivo |
| Listar IRKs | Muestra todos los IRKs con nombre, tipo y resoluciones exitosas |
| Eliminar IRK | Borra el IRK seleccionado de la BD |

```
# Formato IRK (32 caracteres hexadecimales, sin separadores)
Ejemplo: A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6
```

> [!CAUTION]
> Los IRKs solo se obtienen durante el emparejamiento BLE (bonding). En un contexto de auditoría, se obtienen del tráfico BLE capturado o de los logs del sistema del dispositivo objetivo si se dispone de acceso.

---

## 14 Base de Datos (sirena.db)

SIRENA usa SQLite3 para persistencia local. La base de datos se crea automáticamente en el directorio del script.

### Tablas Principales

| Tabla | Contenido |
|-------|-----------|
| `network` | Todas las redes/dispositivos detectados (WiFi, BLE, BT). RSSI con EWMA α=0.3 |
| `location` | Registros de geolocalización asociados a redes |
| `session` | Sesiones de escaneo con timestamps y estadísticas |
| `irk` | Identity Resolving Keys para resolución RPA |
| `agent_session` | Historial de assessments del AI Agent con hallazgos y resumen |
| `tactical_alert` | Alertas tácticas del motor de reglas: tipo, severidad, confianza, objetivo |

### Suavizado EWMA de Señal

El RSSI almacenado es un promedio móvil exponencial para estabilidad ante fluctuaciones:

```
RSSI_nuevo = 0.3 × RSSI_actual + 0.7 × RSSI_anterior
```

---

## 15 Exportación de Informes

### Formatos del AI Agent

| Formato | Descripción | Uso recomendado |
|---------|-------------|----------------|
| **TXT** | Texto plano con nivel de riesgo, resumen y hallazgos con evidencia | Incluir en reportes de texto |
| **JSON** | Estructura completa con contadores por severidad | Integración con otras herramientas |
| **HTML** | Informe visual con estilo SIRENA, badges de severidad y distribución | Entrega al cliente |

### Formato del informe JSON

```json
{
  "tool": "S.I.R.E.N.A. AI Pentesting Agent",
  "version": "1.2.0",
  "organization": "OkrtSystem Labs",
  "timestamp": "2025-01-01 12:00:00",
  "target": { "type": "wifi", "ssid": "TargetNet", "bssid": "AA:BB:CC:DD:EE:FF" },
  "risk_level": "HIGH",
  "summary": "Resumen ejecutivo...",
  "findings": [
    {
      "severity": "CRITICAL",
      "title": "WPA2 Handshake capturado",
      "description": "...",
      "evidence": "...",
      "recommendation": "...",
      "timestamp": "12:05:32"
    }
  ],
  "finding_counts": {
    "CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 1, "INFO": 2
  }
}
```

### Exportación WiGLE CSV (Scanner WiFi)

Compatible con WiGLE WiFi 1.4 y herramientas GIS:

```
WigleWifi-1.4,appRelease=SIRENA-Win,...
MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,...
```

---

## 16 Logs y Diagnóstico

### Archivo de Crashes

```
sirena_crash.log   ←  mismo directorio que el script
```

Captura automáticamente todas las excepciones incluyendo las de hilos secundarios. Cada entrada incluye fecha/hora, nombre del hilo y traceback completo.

### Niveles del Log del AI Agent

| Nivel | Color | Significado |
|-------|-------|-------------|
| `INFO` | Blanco | Información general del proceso |
| `ACTION` | Morado | Herramienta siendo ejecutada por el agente |
| `RESULT` | Verde | Resultado retornado por la herramienta |
| `OK` | Verde | Operación completada con éxito |
| `WARN` | Amarillo | Advertencia no crítica |
| `ERR` | Rojo | Error en la operación |

---

## 17 Resolución de Problemas

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| Scanner WiFi no detecta redes | pywifi sin acceso al adaptador | Verificar nombre con `Get-NetAdapter`. Ejecutar como Admin. Reiniciar servicio WLAN AutoConfig |
| `Open handle failed!` en consola | pywifi inicializando | Normal al arrancar. Si persiste: reiniciar servicio WLAN AutoConfig |
| Módulos Red Team deshabilitados | Falta Npcap, Scapy o Admin | Instalar Npcap. Ejecutar como Admin. `pip install scapy` |
| Scanner BLE no detecta dispositivos | bleak no instalado | `pip install bleak`. Verificar que BT está activado en Windows |
| AI Agent — error de conexión | Ollama no está corriendo | Ejecutar `ollama serve`. Verificar con `ollama list` |
| AI Agent responde sin ejecutar tools | Modelo sin soporte function calling | Cambiar a mistral, qwen2.5 o llama3.1+ |
| Evil Twin no crea el AP | Hosted Network no soportado | `netsh wlan show drivers` → verificar "Hosted network supported: Yes" |
| App se cierra sin error | Excepción en hilo secundario | Revisar `sirena_crash.log` |
| WPA Capture sin frames EAPOL | Sin clientes o sin monitor mode | Verificar clientes activos. Comprobar soporte monitor mode del adaptador |

---

## 18 Referencia Rápida

### Comandos de Inicio

```powershell
# Arranque normal (PowerShell como Admin)
python sirena_v1_2_0_tactical_mod_phase2_5_hvt.py

# Con entorno virtual
.\sirena_env\Scripts\Activate.ps1
python sirena_v1_2_0_tactical_mod_phase2_5_hvt.py

# Verificar adaptadores WiFi
Get-NetAdapter | Select-Object Name, MacAddress

# Verificar Ollama
ollama serve          # iniciar servidor
ollama list           # listar modelos
ollama pull mistral   # descargar modelo recomendado
```

### Flujo de Trabajo — Auditoría WiFi

```
WiFi Scanner → START
      ↓
Identificar APs objetivo
      ↓
Clic derecho → AI Agent
      ↓
Assessment autónomo completo
      ↓
Revisar Hallazgos → Exportar Informe HTML/JSON
```

### Flujo de Trabajo — Auditoría BLE

```
BLE Scanner → START
      ↓
Identificar dispositivos objetivo
      ↓
Clic derecho → GATT Scan (enumerar servicios)
      ↓
Clic derecho → AI Agent (assessment BLE)
      ↓
Exportar Informe
```

### Matriz de Capacidades

| Módulo | Sin Admin | Con Admin | Con Admin + Npcap |
|--------|:---------:|:---------:|:-----------------:|
| WiFi Scanner (pasivo) | ⚠️ Limitado | ✅ | ✅ |
| BLE / BT Scanner | ✅ | ✅ | ✅ |
| Signal Finder | ✅ | ✅ | ✅ |
| Red Team — Deauth / Inject | ❌ | ❌ | ✅ |
| Red Team — Evil Twin | ❌ | ✅ | ✅ |
| Red Team — BLE Spam | ⚠️ Parcial | ✅ | ✅ |
| GATT Scan | ✅ | ✅ | ✅ |
| AI Agent (Ollama) | ⚠️ Solo pasivo | ✅ Activo | ✅ Completo |

### Archivos Generados

| Archivo | Descripción |
|---------|-------------|
| `sirena.db` | Base de datos SQLite con todos los registros |
| `sirena_crash.log` | Log de excepciones no manejadas |
| `hs_<BSSID>.cap` | Capturas WPA handshake |
| `sirena_report.*` | Informes del AI Agent (txt / json / html) |
| `wigle_export_*.csv` | Exportaciones WiGLE del Scanner WiFi |
| `config.json` | Configuración de usuario |
| `.env` | Variables de entorno opcionales |

---

<div align="center">

```
S.I.R.E.N.A. v1.2.0  ·  OkrtSystem Labs
Para uso exclusivo en entornos autorizados
Tactical Mod Phase 2.5 HVT  ·  Windows Edition
```

</div>
