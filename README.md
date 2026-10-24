# Solar AI Monitoring System
### AI-Powered Solar PV Generation Forecasting & Condition-Based Maintenance Intelligence

A clean, beginner-friendly Solar Photovoltaic (PV) monitoring platform designed for college students and plant operators. The user enters only current readings, and the system automatically looks up past operational history to evaluate panel health, generate 24-hour forecasts, and provide clear condition-based cleaning and inspection guidance.

---

## 🌟 Core System Highlights

1. **Zero ML Jargon on Main Screen**: Designed for complete beginners. Complex terms ("lags", "nowcast", "telemetry", "Isolation Forest", "Random Forest", and error metrics like MAE/RMSE) are absent from the primary display and kept strictly inside collapsed reference sections.
2. **Current-Only User Input**: The user enters only site, date-time, actual power now (kW), and outdoor weather (temperature, humidity, wind). The system retrieves previous operational readings automatically from indexed history.
3. **Calm, High-Contrast UI**: Warm off-white background (`#fbf9f5`), dark slate text (`#1e293b`), and an amber accent (`#d97706`). Status colors are reserved strictly for results: Green (**Normal**), Amber (**Cleaning Review**), and Red (**Inspection**).
4. **Three Interactive Graph Tabs (Phase 4)**:
   - **Past (24h)**: Displays actual vs expected power over the preceding 24 hours with a "Now" marker.
   - **Forecast (24h)**: Recursive 30-minute step predictions using typical 7-day weather averages, with tree spread bands.
   - **Compare**: Toggle between 7-day daily energy yields (actual vs expected kWh with performance ratio) and today vs historical hourly profiles.
5. **Robust History Handling (Phase 1)**:
   - Loads from `backend/models/maintenance_analysis_results.csv` with automatic fallback to `backend/models/sample_history.csv` (10,000 rows).
   - If neither exists, the backend starts gracefully, `/api/model-info` reports `"history: unavailable"`, and `/api/analyze` returns HTTP 404 (never guesses or substitutes zeros).

---

## 🚀 Quick Start (Windows PowerShell)

Run all commands from the repository root directory (`E:\SEM 7\EVS PROJECT`).

### 1. Python Environment Setup
```powershell
# Verify Python version (3.10+ recommended)
py --version

# Install backend dependencies
py -m pip install -r backend/requirements.txt
```

### 2. (Optional) Generate Sample History CSV
If running on a fresh clone without the full 238MB dataset:
```powershell
py make_sample.py
# Generates backend/models/sample_history.csv (10,000 rows, ~2MB)
```

### 3. Run Backend API Tests
Run the automated test suite verifying all 14 API endpoints:
```powershell
py test_backend_api.py
```

### 4. Start the Backend Server (Port 5000)
```powershell
py backend/app.py
# Server starts on http://127.0.0.1:5000 with CORS enabled
```

### 5. Start Frontend Development Server (Port 5173)
In a second PowerShell terminal:
```powershell
cd solar-ai-frontend
npm install
npm run dev
# App is accessible at http://localhost:5173
```

### 6. Build Frontend for Production
```powershell
cd solar-ai-frontend
npm run build
```

---

## 📡 REST API Specification

| Endpoint | Method | Description | Inputs |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | Health check | None |
| `/api/model-info` | `GET` | Model metadata, feature lists, history status, and available date range | None |
| `/api/sites` | `GET` | Monitored solar sites, capacities, panels, and date range | None |
| `/api/dataset-values` | `GET` | Auto-fills example weather & generation for site & timestamp | `campusKey`, `siteKey`, `timestamp` |
| `/api/analyze` | `POST` | Primary inference: computes expected power, loss %, anomaly check, and maintenance status | `site`, `timestamp`, `SolarGeneration`, `AirTemperature`, `RelativeHumidity`, `WindSpeed` |
| `/api/forecast` | `POST` | Recursive 30-min forecast up to 24 hours with tree spread intervals | `site`, `timestamp`, `horizon_hours` (1-24) |
| `/api/history` | `GET` | Historical actual vs expected generation readings | `site`, `end`, `hours` (default 48) |
| `/api/daily-summary` | `GET` | Aggregated daily metrics (`actual_kWh`, `expected_kWh`, `lost_kWh`, `performance_ratio`) | `site`, `end`, `days` (default 7) |
| `/api/analyze-batch` | `POST` | Batch CSV upload timeseries analysis | Multipart CSV file |

---

## 📋 Maintenance Decision Rules

All recommendations are governed by a single documented rules function (`calculate_maintenance_logic` in `backend/app.py`):

1. **`Normal`**:
   - Condition: Performance loss < 8% under nominal curve behavior.
   - Plain Guidance: *"No action needed right now. Solar array is operating within normal expectations."*
2. **`Cleaning Review`**:
   - Condition: Performance loss ≥ 15% (or 8–15% degradation) under standard operating curves.
   - Plain Guidance: *"Possible dirt: check the panel surface first to verify if dust has gathered. Clean only if a layer is visually confirmed."*
3. **`Inspection`**:
   - Condition: Sudden generation collapse (> 30% drop) or Isolation Forest behavioral anomaly flagged.
   - Plain Guidance: *"Sudden drop detected: have a qualified technician inspect the inverter, electrical cables, and DC disconnects."*

---

## 🌿 Environmental Benefits & CO₂ Standard
- **Water Conservation**: Cleaning only when empirical performance loss warrants it saves water in dry regions.
- **Emission Factor**: Grid emission displacement uses **0.716 kg CO₂/kWh**, citing the *Central Electricity Authority (CEA) India, CO₂ Baseline Database for the Indian Power Sector, Version 19*.
- **Asset Longevity**: Spotting electrical and inverter faults early protects solar equipment from permanent damage.

---

## 🛠️ Repository File Structure

```
EVS PROJECT/
├── backend/
│   ├── app.py                      # Flask REST API server with all 9 endpoints
│   ├── make_sample.py              # Script to build sample_history.csv
│   ├── requirements.txt            # Python dependencies
│   ├── model_evaluation_report.txt # Technical ablation report (MAE/RMSE/R2)
│   └── models/
│       ├── solar_energy_random_forest.pkl # Random Forest Regressor (with lags)
│       ├── expected_generation_rf.pkl     # Physical Baseline RF (without lags)
│       ├── anomaly_model.pkl              # Isolation Forest (100 trees)
│       ├── feature_columns.pkl            # Feature names
│       ├── sample_history.csv             # 10,000-row sample dataset (committed)
│       └── maintenance_analysis_results.csv # Full 1.19M-row dataset (gitignored)
│
├── solar-ai-frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx          # Header with title and status dot
│   │   │   ├── SolarInputForm.jsx  # Current parameter form with ? tooltips
│   │   │   ├── ResultPanel.jsx     # Result display (status banner, big numbers)
│   │   │   ├── GraphsPanel.jsx     # Past (24h), Forecast (24h), Compare switcher
│   │   │   ├── PerformanceChart.jsx# Batch upload timeseries chart
│   │   │   └── BatchAnalysis.jsx   # CSV modal upload component
│   │   ├── pages/
│   │   │   └── Dashboard.jsx       # Main single-page application layout
│   │   ├── services/
│   │   │   └── api.js              # Axios API service
│   │   ├── index.css               # Warm off-white, amber accent design system
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── make_sample.py                  # Root sample generator
├── test_backend_api.py             # 14-test verification suite
├── test_inference.py               # Lightweight inference check
└── README.md
```
