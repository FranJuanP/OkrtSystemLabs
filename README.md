# XRP ORACULUM — OkrtSystem Labs

**Real-time Market Intelligence + AI Engine PRO (client-only)**  
Public deployment en **GitHub Pages** (single-file build) con **seguridad endurecida**.

---

## Visión
**XRP ORACULUM** nace con un objetivo claro: construir una herramienta capaz de **observar el mercado en tiempo real**, detectar patrones útiles y ejecutar una capa de inteligencia (AI Engine) que pueda evolucionar sin romper la base.

Este proyecto está diseñado con mentalidad “producto”:
- Robustez en tiempo real
- Modularidad
- Seguridad real para publicación pública
- Evolución incremental (Base → PRO → Enterprise)

---

## Qué es ORACULUM
**ORACULUM** es una herramienta web para **monitorización y análisis cripto** que combina:

- **Flujo en vivo** mediante WebSockets (multi-exchange)
- **Contexto histórico** (candles) para enriquecer lectura de mercado
- **AI Learning Base** como núcleo estable
- **AI Engine PRO** como capa avanzada conectada al núcleo, con memoria persistente

> ORACULUM no es solo un dashboard: es un sistema vivo que procesa señal, contexto y persistencia.

---

## Características principales
### Real-time Core
- Conexiones WebSocket multi-exchange para datos live.
- Gestión de estado y refresco de información en UI.
- Arquitectura orientada a estabilidad (evita colapsos ante flujo continuo).

### Contexto histórico
- Carga de histórico de velas (1m) para contexto inicial.
- Base para construir señales robustas y métricas agregadas.

### AI Learning Base (núcleo)
- Preparado para:
  - organizar señal
  - consolidar patrones
  - exponer un “punto único” de integración para módulos superiores

### AI Engine PRO v1.0.0
Capa avanzada integrada sobre el núcleo (`AILearning`):

- Hook directo sobre el core (enganche estable)
- Estado persistente en Firestore
- Modelos y features activos
- Preparada para evolución incremental sin tocar el core

---

## Arquitectura
### Frontend (Single-file build)
- Aplicación publicada como **HTML único** (GitHub Pages).
- UI y lógica de orquestación integradas en el mismo archivo.

### Módulo PRO externo
- Carga modular mediante:
  - `ai-engine-pro.js?v=1.0.0`
- Cache-busting con querystring para evitar problemas de caché.

### Firebase
- **Authentication (Anonymous)**: identidad silenciosa sin login UI.
- **Firestore**: persistencia de estado, memoria y patrones.
- **App Check (reCAPTCHA v3) en ENFORCE**: protección anti-abuso en producción pública.

---

## Seguridad (hardening real para publicación pública)
ORACULUM está diseñado para operar públicamente de forma segura, evitando los errores típicos de apps client-only.

### 1) Content Security Policy (CSP)
- Política CSP restrictiva, basada en lista blanca.
- Bloqueo de ejecución no autorizada y mitigación frente a vectores comunes de inyección.

### 2) App Check (ENFORCE)
- Firestore protegido mediante **App Check (reCAPTCHA v3)**
- Solo la app verificada puede acceder a Firestore
- Bloqueo de scripts externos / abuso automatizado

### 3) Auth anónimo
- Cada cliente obtiene una sesión válida
- Permite operar Firestore sin credenciales visibles del usuario
- Compatible con reglas seguras (lectura controlada / escritura autenticada)

### Nota importante sobre `firebaseConfig`
En Firebase Web, el `firebaseConfig` puede existir en frontend por diseño.  
La seguridad real la garantizan:
- Rules bien configuradas
- App Check
- Auth (aunque sea anónimo)
- Restricciones de uso

---

## Estado del proyecto
✅ Publicado en GitHub Pages  
✅ AI Engine PRO activo  
✅ Firestore protegido con App Check ENFORCE  
✅ Auth anónimo funcionando  
✅ Single-file build estable

---

## Uso / Despliegue
### GitHub Pages
La aplicación se publica como:
- `index.html`
- `ai-engine-pro.js`

---

## Copyright
© 2026 **OkrtSystem Labs**. Todos los derechos reservados.
