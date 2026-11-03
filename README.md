# Solar AI Monitoring System
### Solar PV Generation Forecasting, Anomaly Detection & Water-Aware Operations

The **Solar AI Monitoring System** is an engineering-grade operational monitoring and decision-support platform for solar photovoltaic installations. Trained on 1,195,267 validated 15-minute telemetry observations across 42 physical installations (2020–2022), it combines a physical unsoiled baseline model (Model A, $R^2 = 0.692$) for shortfall detection and performance ratio grading with a short-term nowcasting model (Model B, $R^2 = 0.950$) for recursive multi-horizon power forecasts (6h, 24h, 7d). The platform features an empirical Isolation Forest for operational anomaly detection, a water-aware economic cleaning engine that balances cumulative lost revenue against wash costs to conserve water, dynamic simulation what-if tools, and strict separation between Live (current 2026 Open-Meteo weather & SQLite telemetry) and Historical Replay (2020–2022) modes with zero fabricated data.

---

## 🌟 Architecture & Pages

1. **Check (`/`)**: Real-time operational diagnosis comparing actual solar power against the unsoiled physical baseline. Displays directional status band (**Normal**, **Cleaning Review**, **Inspection**), shortfall kW, performance ratio, and actionable plain-English recommendations.
2. **Forecast (`/forecast`)**: Live 2026 multi-horizon generation forecast (6 hours, 24 hours, 7 days) driven by Open-Meteo live solar irradiance with Random Forest tree-spread uncertainty intervals (10th–90th percentile) and historical 25th–75th percentile comparison bands.
3. **Solar Yield Calculator (`/yield`)**: Monthly and annual PV energy yield estimation parameterized by site capacity (kWp), tilt angle, and target month, showing 24-hour diurnal generation curves and fleet benchmarks.
4. **Cleaning Planner (`/planner`)**: Economic decision engine calculating the exact crossover date where cumulative unwashed generation losses exceed the cleaning cost, including a 7-day "Best Day to Clean" insolation forecast.
5. **Simulation (`/simulation`)**: Historical replay comparing routine fixed-interval washing against condition-based washing, demonstrating avoided cleanings and water conserved.
6. **Operational Insights (`/insights`)**: Multi-day operational trends, 48-hour actual vs baseline generation curves, rolling performance ratio slopes (*slow decline*, *sudden drop*, *recovery*), and fleet-wide health scores (0–100).
7. **Model Validation (`/validation`)**: Model evaluation page presenting held-out test splits, cross-validation metrics, and diurnal error distributions with explicit historical disclaimers.
8. **Data & Assumptions (`/data`)**: Provenance transparency page detailing the 1.195M records dataset, zero missing values, trained model specifications, verified engineering citations (CEA India emission factor: 0.716 kg CO2/kWh), and physical limitations.

---

## 📊 Real Model Validation Metrics

All models were evaluated on the held-out test set (daylight hours only, $06:00 \le \text{hour} < 19:00$) across 170,355 records from the full 1,195,267 observation dataset:

| Model / Baseline | Algorithm & Features | Target | $R^2$ Score | MAE (kW) | RMSE (kW) | WAPE (%) | Role in System |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Model A (Physical Baseline)** | Random Forest (19 features, NO LAGS) | Specific Yield | **0.6917** | **3.353** | **6.796** | **41.37%** | Clean baseline for PR, shortfall, & cleaning decisions |
| **Model B (Short-Term Nowcast)** | Random Forest (27 features, WITH LAGS) | Power (kW) | **0.9495** | **1.122** | **2.752** | **13.84%** | Recursive step forecasting (6h to 7d) |
| **Persistence Baseline** | $P(t) = P(t - 30\text{min})$ | Power (kW) | 0.9378 | 1.345 | 3.052 | 16.60% | Short-term empirical benchmark |
| **HistGradientBoosting** | Histogram GBDT (Model A features) | Specific Yield | 0.7565 | 3.157 | 6.041 | 38.95% | Benchmark regressor |
| **Hour-of-Day Mean** | Empirical diurnal mean curve | Power (kW) | 0.6842 | 3.711 | 6.879 | 45.79% | Climatological baseline |
| **Same-Time-Yesterday** | $P(t) = P(t - 24\text{h})$ | Power (kW) | 0.3465 | 5.137 | 9.895 | 63.38% | Climatological benchmark |

### Cross-Validation & Generalization
- **TimeSeriesSplit Cross-Validation (5 Folds)**: Mean $R^2 = 0.2956 \pm 0.1148$ (evaluating non-stationary temporal generalization without lookahead bias).
- **Leave-One-Site-Out Cross-Validation**: Held-out Campus 2 Site 1 achieves $R^2 = 0.5689$, confirming that normalized specific yield models successfully transfer across unobserved solar arrays.
- **Isolation Forest & Synthetic Faults**: Anomaly detection identifies 85.0% of synthetic generation drops without false alarming on cloud transients.

---

## 🚀 Quick Start (Windows PowerShell)

All commands are executed from the repository root: `E:\SEM 7\EVS PROJECT`.

### 1. Python Environment Setup
```powershell
# Verify Python version (3.10+ recommended)
py --version

# Create virtual environment (optional)
py -m venv venv
.\venv\Scripts\Activate.ps1

# Install required packages (zero-cost open-source libraries only)
py -m pip install -r backend/requirements.txt
```

### 2. Model Training (Full 1.195M Dataset)
To retrain Model A, Model B, and the Isolation Forest from scratch on the full operational dataset:
```powershell
py backend/train_models.py
# Generates models in backend/models/ and outputs backend/model_evaluation_report.txt
```

### 3. Start Backend Server (Port 5000)
```powershell
py backend/app.py
# Backend initializes on http://127.0.0.1:5000 with precomputed JSON profiles (< 0.1s startup)
```

### 4. Start Frontend Development Server (Port 5173)
In a separate PowerShell terminal:
```powershell
cd solar-ai-frontend
npm install
npm run dev
# Web application opens on http://localhost:5173
```

### 5. Run Automated Test Suites
Run the comprehensive test suites to verify all endpoints, directional physics, and live collection:
```powershell
# 1. Full 33-step API integration test suite
py test_backend_api.py

# 2. End-to-end smoke test suite (all endpoints in Live & Replay modes)
py backend/smoke_test.py
```

### 6. Build Frontend for Production
```powershell
cd solar-ai-frontend
npm run build
```

---

## 🌐 2026 Live Mode & Offline Operation

### Uploading 2026 Telemetry via CSV
To upload new operational readings into the local SQLite database (`backend/live_data.db`):
1. Navigate to the **Check** page (`http://localhost:5173/`).
2. Click **Upload CSV** or select the batch audit tool.
3. CSV schema must include: `timestamp`, `actual_kW` (or `SolarGeneration`), `AirTemperature`, `RelativeHumidity`, `WindSpeed`.
4. Row-level validation automatically rejects negative generation and values exceeding 120% of rated capacity.

### Testing Offline Operation (Wi-Fi Off)
The system is fully resilient to internet dropouts:
- When network access is unavailable, the backend gracefully catches network timeouts from Open-Meteo and falls back to precomputed monthly solar climatology and local SQLite profiles.
- If live forecasts are requested without network, the system returns a structured HTTP 503 error with an actionable user message (`"Live weather unavailable. Using local climatology fallback."`), never fabricating coordinates or silently claiming historical data is current.

---

## ⚖️ Documented Assumptions & Limitations

1. **Historical Telemetry Span**: The historical training dataset covers **2020-01-01 to 2022-04-23**. Historical Replay mode strictly queries this window; Live mode operates in the current year (2026) using live weather APIs and SQLite.
2. **Visual Inspection Requirement**: Model A identifies generation shortfalls relative to clean physical expectations. Dust or soiling accumulation cannot be definitively confirmed without visual panel inspection.
3. **Simulation Disclaimer**: The Cleaning Simulation evaluates condition-based triggers against fixed intervals over historical timeseries data. The original dataset contains unlabelled natural cleaning events (e.g., rainfall), which the model detects as sudden performance recoveries.
4. **Emissions & Water Citations**:
   - Grid emission factor: `0.716 kg CO2/kWh` (*Central Electricity Authority (CEA) India, CO2 Baseline Database for the Indian Power Sector, Version 19*).
   - Water volume benchmark: `500 Liters per wash` (~5 L per panel across nominal 100-panel 25 kWp array in semi-arid conditions).
