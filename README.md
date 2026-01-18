# ORACULUM — OkrtSystem Labs  
### Real‑Time Market Intelligence + AI Engine PRO (Self‑Learning) · Web App (Desktop + Mobile)

> **ORACULUM** es un panel operativo de inteligencia de mercado diseñado para **tomar el pulso a XRP/USDT en tiempo real**, detectar señales, visualizar estructura y ejecutar un **motor de aprendizaje continuo** orientado a precisión, estabilidad y rendimiento en producción.

---

## Lo que hace ORACULUM (en una frase)
**Convierte streams de mercado en decisión accionable**: *datos → contexto → señales → aprendizaje → memoria → optimización*.

---

## Highlights (por qué es diferente)
- **Tiempo real de verdad**: integración con feeds/streams para un flujo continuo de datos.
- **AI ENGINE PRO v1.6.9**: motor de aprendizaje siempre activo con:
  - **Auto‑Prediction** con horizontes configurables  
  - **Ensemble** y umbral de confianza  
  - **Optimización automática** para mejorar precisión con el tiempo  
  - **Memoria** y patrones persistentes por usuario
- **Persistencia segura multiusuario (Firebase/Firestore)**:
  - Estado **scoped por UID** (aislamiento por usuario)
  - Validación en reglas
  - Ahorro de cuota: escrituras **deduplicadas** cuando el estado no cambia
- **Rendimiento y estabilidad**:
  - Capping de cola de predicciones (mantiene las últimas, descarta antiguas)
  - Guardado robusto y control de frecuencia
- **UI “Enterprise‑grade”**:
  - Tarjetas modulares, lectura rápida, jerarquía visual
  - **Mobile‑first real**: en iPhone las cards se muestran **independientes y apiladas**, sin solapes

---

## Arquitectura (visión clara)
**ORACULUM (Front)**
- UI + dashboards + paneles operativos
- Motor AI (cliente) para predicción y aprendizaje
- Capa de persistencia (Firestore)

**Fuentes (Feeds)**
- Streams/REST de mercado (con failover en el feed manager)

**Persistencia**
- **Cloud Firestore**: estado del motor AI por usuario

---

## Componentes principales
- `index.html` — Aplicación web (UI + layout + wiring de módulos)
- `ai-engine-pro.js` — **AI ENGINE PRO** (predicción, memoria, optimización, persistencia)
- `market-feed-manager.js` — Gestión de datos de mercado (streaming/failover)

> ORACULUM está diseñado para desplegarse de forma simple (GitHub Pages / hosting estático) con un backend gestionado (Firebase).

---

## Seguridad (en serio)
ORACULUM está pensado para un repositorio público sin exponer el sistema a envenenamiento de datos:

- Legacy **`/ai/*` en solo lectura** (escritura bloqueada para evitar poisoning)
- Persistencia **por usuario** en:
  - `aiUsers/{uid}/engine/{docId}`
- Reglas con validaciones conservadoras y **catch‑all deny**
- Autenticación anónima compatible (UID aislado por sesión/navegador)
- Integrable con App Check / endurecimiento adicional

---

## Firestore (modelo de datos)
Documentos del motor (por usuario):

- `pro_models` — estadísticas por modelo (momentum/trend/volume/structure/patterns/mtf)
- `pro_memory` — memoria/patrones y correlaciones
- `pro_performance` — telemetría y métricas internas del motor
- `pro_horizons` — precisión por horizonte (2,5,10,15,30,60,120,240)
- `pro_pending` — cola de predicciones (**cap 25**)

---


## Operativa y verificación
En consola (DevTools) deberías ver:
- `State loaded from Firestore (scoped)`
- `AI Engine PRO ready`
- Auto‑predicción en ciclos

Verificación rápida del build:
```js
AIEnginePro.__okrtBuild
```

---

## Rendimiento (principios)
- Escrituras deduplicadas (no se guarda si el estado no cambia)
- Cap de `pending` para evitar crecimiento infinito
- Layout responsive sin reflows destructivos en móvil
- Diseño “observability‑first”: logs útiles para diagnóstico


---

## Capturas

<img src="docs/screens/oraculum_desktop.png" width="900">
<img src="docs/screens/oraculum_mobile.jpeg" width="320">
<img src="docs/screens/ai_engine_pro.png" width="900">



Ejemplo:
```md
![ORACULUM](https://franjuanp.github.io/OkrtSystemLabs/)

---

## Disclaimer
ORACULUM es una herramienta de análisis y visualización. No constituye asesoramiento financiero.

---

## Licencia / Copyright
© 2025–2026 **OkrtSystem Labs**. Todos los derechos reservados.

---

### Autor / Branding
**OkrtSystem Labs** · ORACULUM  
Diseñado para rendimiento, seguridad y presencia “production‑grade”.
