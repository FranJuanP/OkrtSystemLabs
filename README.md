# HEIMDALL Sense WiFi

**Wireless presence detection through RSSI signal analysis**  
**OkrtSystem Labs**

---

## Overview

**HEIMDALL Sense WiFi** is a professional module focused on **presence and movement detection through wireless signal behavior**, without using cameras as the primary sensing element.

The system analyses **RSSI fluctuations** captured from nearby WiFi environments, builds temporal windows, applies calibration, and infers activity states such as **presence**, **motion**, and **adjacent-zone/through-wall activity**.

It is designed as a **specialized sensing component** that can operate as part of a broader HEIMDALL ecosystem, feeding telemetry, events, and status outputs to higher-level orchestration or visualization layers.

---

## What the tool does

HEIMDALL Sense WiFi continuously observes the surrounding wireless environment and transforms raw signal variation into interpretable operational signals.

In practical terms, the module can:

- detect **presence** from RSSI variance patterns
- estimate **movement intensity** over time
- maintain rolling buffers for signal stability analysis
- perform **baseline calibration** to adapt thresholds to the environment
- identify **through-wall / adjacent-zone activity** by correlating multiple BSSIDs
- prioritize trusted or known SSIDs inside the analysis logic
- generate **events, timelines, alerts, and webhook-compatible outputs**
- expose data to a wider platform through an embeddable UI panel and bridge layer

---

## Core capabilities

### 1. Presence sensing without camera-centric dependency
The module is built around the idea of **presence without visual capture**, using wireless telemetry as the observation layer.

### 2. Continuous RSSI analysis
The system samples nearby WiFi signal levels on a recurring interval and stores them in rolling buffers to evaluate behavior over time instead of relying on isolated snapshots.

### 3. Environmental calibration
A dedicated calibration phase learns the baseline behavior of the local RF environment, allowing the engine to apply more realistic thresholds and reduce false positives.

### 4. Motion inference
Motion is inferred through changes in signal variance and temporal instability patterns across observed BSSIDs.

### 5. Through-wall / adjacent-zone detection
When enough signal evidence is available, the module correlates multiple wireless traces to detect activity compatible with movement in nearby or separated zones.

### 6. Operator-oriented interface
The project includes an embeddable panel with status, graphs, labels, timeline/event logging, and operational indicators aligned with the visual language of the HEIMDALL environment.

### 7. Integration-ready output
The architecture supports structured outputs and webhook-style integration so the sensing layer can be consumed by other modules, dashboards, or automation workflows.

---

## High-level workflow

```text
WiFi environment scan
        ↓
RSSI capture per BSSID
        ↓
Rolling buffer + temporal windowing
        ↓
Calibration / baseline learning
        ↓
Variance and correlation analysis
        ↓
Presence / motion / through-wall inference
        ↓
Timeline, alerts, status, bridge output
```

---

## Technical profile

- **Language:** Python
- **Interface layer:** PyQt6
- **Signal model:** RSSI-based temporal analysis
- **Data handling:** rolling buffers, event logs, local persistence support
- **Operational model:** embeddable sensing module for HEIMDALL
- **Output options:** UI telemetry, event timeline, status endpoint, webhook-style bridge
- **Platform orientation:** Windows WiFi environments with standard adapters

---

## Design philosophy

HEIMDALL Sense WiFi is not positioned as a generic consumer gadget. It is conceived as a **professional sensing and telemetry module**, with emphasis on:

- signal-driven inference
- operator visibility
- modular integration
- calibration-aware detection
- controlled-environment deployment

The project follows the broader **OkrtSystem Labs** design language: dark tactical interface, high-contrast telemetry cues, and a disciplined separation between sensing, visualization, and orchestration.

---

## Potential use cases

- smart-space activity awareness
- non-visual occupancy estimation
- local telemetry enrichment for security environments
- lab experimentation with RF-based sensing
- research and prototyping around WiFi motion inference
- integration into larger defensive, monitoring, or automation platforms

---

## Repository contents

This repository is intended to present the **concept, positioning, and interface vision** of the module.

Depending on the publication strategy, it may include:

- presentation HTML
- visual assets
- screenshots
- architectural descriptions
- documentation

---

## Visual identity

HEIMDALL Sense WiFi adopts a visual style inspired by **futuristic tactical telemetry**, combining:

- luminous architectural wireframes
- circular wireless propagation cues
- holographic human presence markers
- dark UI surfaces with cyan/white energy lines
- green activity signatures for detected entities

This visual language is designed to communicate **precision, technical maturity, and operational awareness**.

---

## Operational note

This project is presented as a **professional and research-oriented module**. Deployment, testing, and evaluation should always be carried out in **authorized environments**, with appropriate governance, permissions, and technical validation.

---

## Brand

**OkrtSystem Labs**  
Advanced concepts, tools, and interfaces for next-generation cyber and sensing environments.

---

## Contact / publication note

This README can be used as the front-page description for GitHub together with a presentation HTML, screenshots, and branded visual assets.

