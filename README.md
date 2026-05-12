<h1 align="center">
  ⛏️ GoldTrack PE — Tactical Decision Support System
</h1>

<p align="center">
  <strong>6–12 Month Operational Analytics for Peru Gold Mining Management</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express" />
  <img src="https://img.shields.io/badge/Chart.js-4.x-FF6384?style=flat-square&logo=chart.js" />
  <img src="https://img.shields.io/badge/ApexCharts-3.x-00E396?style=flat-square" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />
</p>

---

## 📋 Overview

**GoldTrack PE** is a **tactical-level Decision Support System (DSS)** designed for middle-to-upper management in the Peruvian gold mining sector. The system provides data-driven operational insights over a **6–12 month planning horizon**, enabling managers to make informed decisions about:

- **Budget Variance Tracking** — Real-time comparison of budgeted vs. actual financial performance
- **Scenario Simulation** — What-if analysis based on gold price fluctuations (±30%)
- **Mine Performance Scoring** — Composite tactical scoring (AISC efficiency + ROI + risk)
- **Production Forecasting** — Year-end target attainment projections
- **Cost Structure Analysis** — OPEX breakdown with industry-standard benchmarks

### DSS Classification

| Attribute | Value |
|-----------|-------|
| **DSS Type** | Data-Driven + Model-Driven (Hybrid) |
| **Decision Level** | Tactical (Middle Management) |
| **Planning Horizon** | 6–12 Months |
| **Decision Domain** | Production, Budget, Risk Management |
| **Data Model** | 3NF Relational (MySQL/InnoDB) |
| **Portfolio** | 39 Active Peru Gold Mines |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                    CLIENT                         │
│  ┌────────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Dashboard  │  │  Map     │  │  Charts      │ │
│  │ (Vanilla   │  │ (Leaflet)│  │ (Chart.js +  │ │
│  │  JS/HTML)  │  │          │  │  ApexCharts) │ │
│  └─────┬──────┘  └────┬─────┘  └──────┬───────┘ │
│        └───────────────┼───────────────┘         │
│                        │ REST API                 │
├────────────────────────┼─────────────────────────┤
│                   SERVER                          │
│  ┌─────────────────────┴─────────────────────┐   │
│  │         Express.js API Layer              │   │
│  │  • /api/top-mines (Portfolio + Scenario)  │   │
│  │  • /api/mine-detail/:id (Drill-down)      │   │
│  │  • /api/financial/kpi (Aggregated KPIs)   │   │
│  │  • /api/financial/history (Time-series)   │   │
│  │  • /api/financial/cost-breakdown (OPEX)   │   │
│  └─────────────────────┬─────────────────────┘   │
│                        │                          │
│  ┌─────────────────────┴─────────────────────┐   │
│  │           MySQL 8.0 (InnoDB)              │   │
│  │  companies ──┐                            │   │
│  │  regions ────┤── mines ── mine_metrics    │   │
│  │              └──────────────────────────  │   │
│  │         3NF Normalized Schema             │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 📊 Dashboard Modules

### 1. Tactical Overview (Anlık Durum)
- 4 KPI Cards: Realized Profit, CAPEX Budget, AISC, Production Target
- Interactive Leaflet map with color-coded mine markers (by ROI)
- Live gold price ticker simulation

### 2. Mine Performance Scorecard (Maden Performansı)
- Sortable performance table with tactical scoring (A/B/C/D grades)
- Drill-down detail panel with 12-month production & profit charts
- CSV export for offline analysis

### 3. Budget & Finance (Bütçe & Finans)
- Budget vs. Actual variance analysis (ApexCharts)
- OPEX cost breakdown (donut chart)
- Period filters: 6M / 1Y / All

### 4. Tactical Analysis Tools (Hedef Analizi)
- **Budget Variance Analysis** — Identifies overspending categories
- **Break-Even Analysis** — Monthly minimum production threshold
- **Year-End Forecast** — Q4 target attainment projection
- **Efficiency Benchmark** — Bubble chart (risk vs. score vs. reserve)

### 5. Improvement Opportunities (İyileştirme Fırsatları)
- Ranked list of underperforming mines requiring intervention
- Click-to-drill-down for operational details

### 6. AI Tactical Report (Akıllı Rapor)
- Auto-generated executive summary based on current data
- Context-aware recommendations
- PDF export capability

---

## 🔧 Tactical Scoring Algorithm

The system uses a **composite scoring model** (0–100) to evaluate each mine:

```
Tactical Score = Budget Efficiency (40) + ROI Performance (30) + Risk Profile (30)
```

| Component | Weight | Logic |
|-----------|--------|-------|
| **AISC Efficiency** | 40 pts | Linear scale: ≤$1000/oz → 40pts, ≥$1500/oz → 10pts |
| **ROI Performance** | 30 pts | Capped linear: ROI/15 × 30, max 30 |
| **Risk Profile** | 30 pts | Inverse scale: Level 1→30, 2→25, 3→15, 4→5, 5→0 |

Grades: **A** (≥80) · **B** (≥60) · **C** (≥40) · **D** (<40)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **MySQL** ≥ 8.0 (running on default or custom port)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/goldtrack-pe.git
cd goldtrack-pe

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Start the server (auto-creates database & seeds data)
npm start
```

The server will:
1. Create the `goldtrack_pe` database if it doesn't exist
2. Run the schema (tables created with `IF NOT EXISTS`)
3. Seed 24 months of synthetic production data (only if `mine_metrics` is empty)
4. Start the API at `http://localhost:3000`

### Development

```bash
npm run dev    # Starts with --watch for auto-reload
```

---

## 📁 Project Structure

```
goldtrack-pe/
├── public/                   # Frontend (static files)
│   ├── index.html            # Main SPA layout
│   ├── dashboard.js          # Core DSS logic & event handling
│   ├── map.js                # Leaflet map integration
│   ├── chartManager.js       # Chart.js configuration module
│   └── style.css             # Custom styles (animations, slider, etc.)
│
├── server/                   # Backend
│   ├── server.js             # Express API & business logic
│   ├── schema.sql            # 3NF database schema + seed data
│   └── data/
│       ├── db.js             # MySQL connection pool (dotenv-based)
│       └── mockData.js       # Static mine reference data
│
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `127.0.0.1` | MySQL host address |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | *(empty)* | MySQL password |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `goldtrack_pe` | Database name |
| `PORT` | `3000` | API server port |

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, Vanilla JS, TailwindCSS CDN | SPA dashboard interface |
| **Visualization** | Chart.js, ApexCharts, Leaflet.js | Charts, donut graphs, interactive maps |
| **Backend** | Node.js, Express.js | RESTful API server |
| **Database** | MySQL 8.0 (InnoDB) | 3NF relational data model |
| **Export** | jsPDF, html2canvas | PDF report generation |

---

## 📄 License

This project is licensed under the MIT License.
