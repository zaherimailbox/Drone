# Project Summary – Autonomous Pulse Induction Drone (APID) – GCS Tactical Mission Planner Module

## Overview
This repository implements a **real‑time ground control station (GCS)** for an autonomous pulse‑induction (PI) drone. The backend is a **Go server** (standard library only) that serves HTML/CSS/JS assets, bundles CSS in‑memory, and provides a REST API for mission planning. The frontend is built with **vanilla HTML5/CSS3/ES6** and **Leaflet.js** (CDN with local fallback). The UI follows a strict modularity rule: all mission‑planner assets live under `web/modules/mission_planner/` with a `.mp-` CSS namespace and communicate with the main dashboard via **CustomEvents**.

## Target Platform
- **Hardware**: Raspberry Pi 5 (8 GB) + Official M.2 HAT (NVMe SSD) 
- **OS**: Raspberry Pi OS (64‑bit / ARM64) 
- **Companion MCU**: STM32 NUCLEO‑G474RE (6‑Wire SPI0) 
- **Flight Controller**: CubePilot Cube Orange+ / Pixhawk 6X (Dual‑GNSS RTK)

## Architectural Doctrine
| Layer | Technology | Notes |
|------|------------|-------|
| **Backend** | Go (net/http, html/template, encoding/json, os, math, path/filepath) | No external Go dependencies. All logic lives under `internal/mission/`. |
| **Frontend** | Vanilla HTML/CSS/JS + Leaflet 1.9.4 (CDN, fallback) | No build tools, no heavy frameworks. |
| **Modularity Rule** | Assets under `web/modules/mission_planner/` with `.mp-` class prefix. Interaction via DOM `CustomEvent`s only. |

## Directory Structure (relevant parts)
```
Drone/
├─ core/                     # Global UI assets (theme.css, event-bus.js)
├─ modules/                  # Other GCS UI modules (camera-board, flight-control, …)
│   └─ mission-config/       # (currently empty – placeholder for future config UI)
├─ internal/mission/        # Backend mission‑planning package
│   ├─ models.go            # Data structures (Mission, Cell, Waypoint, Stats, etc.)
│   ├─ planner.go           # Grid generation, sweep path, constrained RTH (stubs)
│   ├─ storage.go           # ❓ (to be implemented – JSON persistence, tile cache)
│   └─ handlers.go          # ❓ (to be implemented – HTTP API handlers)
├─ web/modules/mission_planner/
│   ├─ mission_planner.html # Isolated HTML partial – dual‑tab card + modal overlay
│   ├─ mission_planner.css  # Dark‑cyan styling, .mp- namespace, 70vw×70vh modal
│   └─ mission_planner.js   # Leaflet map, drawing, grid painting, API client
├─ index.html                # Main dashboard template (loaded by Go server)
├─ main.go                  # Go server – in‑memory template & CSS bundling, gzip middleware
├─ main.js                  # Front‑end entry point (ES modules loader)
├─ go.mod                    # Go module definition
└─ ...
```

## Key Backend Files
- **`main.go`** – Sets up `http.ServeMux`, serves bundled CSS (`/assets/bundle.css`), static files (`/core/`, `/modules/`, `/main.js`), and the root HTML page from RAM. Includes a gzip compression middleware for low‑latency delivery.
- **`internal/mission/models.go`** – Defines the mission schema (IDs, vertices, cells, waypoints, statistics) and a helper `Clone()` for deep‑copy via JSON.
- **`internal/mission/planner.go`** – Stubs for the core algorithms:
  - `GenerateGrid` – ENU projection, polygon clipping (>50 % area), edge smoothing.
  - `ComputeSweepPath` – Boustrophedon (snake) traversal with orientation selection.
  - `ComputeConstrainedRTH` – Diagonal RTH with safety checks and A* fallback.
  - Helper functions for ENU ↔ LatLon conversion and altitude validation.
- **`internal/mission/storage.go`** *(to be added)* – Handles persistence of missions (`./data/missions/*.json`) and offline tile caching (`./data/tiles/`).
- **`internal/mission/handlers.go`** *(to be added)* – Registers the REST endpoints listed in the specification (`/api/mission/...`).

## Frontend UI Specification (Mission Planner Module)
- **Card Replacement** – Replaces the existing “GRID SURVEY & MOSAIC PUZZLE (4X4 SECTOR)” card with a new **TACTICAL MISSION PLANNER & SECTOR MATRIX** card containing two tabs:
  1. **TACTICAL MAP** – Leaflet map preview, status bar (cell count, ETA, home sync).
  2. **SECTOR MATRIX** – Displays the existing numeric sector matrix; auto‑switches when the mission state becomes `MISSION_STARTED`.
- **Header Action** – Button `btn-expand-map-modal` opens a **centered overlay modal** (70 vw × 70 vh) with a semi‑transparent blurred backdrop.
- **Modal Details** – Fixed centered overlay, backdrop `rgba(5,12,20,0.72)` with `backdrop-filter: blur(4px)`. Contains a Leaflet map with:
  - Tile layers: Google Hybrid, Esri Satellite, OSM Engineering, and a local offline cache (`/api/mission/tiles/...`).
  - Toolbar controls for drawing mode, grid step, mission profile, cell‑state palette, virtual/home sync, sweep‑axis rotation, safe RTH altitude, and save/load.
- **Cell Behavioral States** – Five states (`SCAN_ACTIVE`, `TRANSIT_LOW`, `TRANSIT_SAFE`, `PHOTO_ONLY`, `NO_FLY`) each with a distinct color and UAV behavior.
- **API Contracts** – POST/GET endpoints for grid generation, path recalculation, mission save/list/load, and tile serving (see spec). All endpoints must validate `safe_altitude_m` against `[1.0, 15.0]` m.
- **Frontend‑Backend Bridge** – CustomEvents such as `mp:mission-loaded`, `mp:live-gps-update`, `mp:mission-execution-state` drive UI updates and tab switching.

## Next Development Steps (high‑level)
1. Implement `storage.go` – JSON marshal/unmarshal, file I/O, tile cache logic.
2. Implement `handlers.go` – Register routes, decode/validate payloads, call planner functions, write responses.
3. Complete algorithmic stubs in `planner.go` (grid clipping, edge smoothing, Boustrophedon, diagonal RTH + A* fallback).
4. Add the missing **frontend files** (`mission_planner.html`, `.css`, `.js`) matching the UI spec.
5. Create a **README.md** describing build/run on Raspberry Pi 5, hardware connections, and API usage.
6. Add `.gitignore` (Go binaries, `data/` caches, OS files) and optional CI workflow.
7. Optional Dockerfile for local testing.

---
*این فایل خلاصهٔ پروژه را در مسیر زیر ذخیره کرده‌ام برای استفادهٔ مجدد و صرفه‌جویی در مصرف توکن.*

[PROJECT_SUMMARY.md](file:///Users/taha/Desktop/Drone/PROJECT_SUMMARY.md)
