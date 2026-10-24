# Solar AI Monitoring System
### Machine Learning-Powered Solar PV Generation Forecasting & Condition-Based Maintenance Intelligence

A software-only Solar Photovoltaic (PV) monitoring platform designed to transform operational data into actionable generation forecasts, behavioral anomaly detection, and explainable condition-based maintenance recommendations.

---

## 🌟 Core System Objectives

1. **Short-Term Solar Energy Estimation**: Forecast short-term power output ($\text{kW}$) using a validated Random Forest regression model. An unsoiled physical baseline (trained without lag features) is used to calculate true performance loss without circular soiling masking.
2. **Detect Abnormal Performance Patterns**: Validate power dynamics using an Isolation Forest anomaly detector to identify statistical curve deviations and inverter tripping.
3. **Condition-Based Maintenance Guidance**: Classify plant operational health into three standardized categories using a single documented decision rules function:
   - **`Normal`**: Generation is within acceptable tolerance (< 8% loss); continue standard automated monitoring.
   - **`Cleaning Review`**: Empirical performance loss detected (>= 15% loss) under standard operating curves; possible soiling, verify by inspection.
   - **`Inspection`**: Sudden generation collapse (> 30% drop) or high-severity anomaly detected, warranting on-site physical/electrical technician inspection.
4. **Environmental & Resource Conservation**: Quantify tangible sustainability benefits, including avoided redundant washing to conserve water (scenario estimate with stated assumptions), maximizing clean renewable yield, and estimating avoided/lost grid emissions (0.716 kg CO₂/kWh per Central Electricity Authority India).
5. **Clean & Professional Web Dashboard**: A restrained, solar-inspired web interface built with React and Vite featuring two operational modes: Single Observation check and Batch CSV Upload.

---

## 🚀 Key Innovations & Architecture

- **Automatic History Lookup**: The user inputs ONLY current parameters (site, timestamp, generation now, temperature, humidity, wind speed). At startup, the Flask backend loads and indexes 1,195,267 historical records across 42 sites, automatically retrieving preceding generation ($t-15\text{m}$) and operational lags ($30\text{m}, 1\text{h}, 2\text{h}$).
- **Missing History Protection**: If no historical data exists before the chosen timestamp, the system returns a clear HTTP 404 error (`"No previous data found for this time"`). It never guesses or substitutes zero.
- **Physical Baseline without Lag Dependence**: To eliminate circular soiling logic (where lag features absorb and hide gradual dust accumulation), an unsoiled physical baseline model predicts expected generation using weather, capacity, and solar diurnal position alone.
- **Explainability & Prediction Spread**: Returns top 3 feature drivers, plain-English anomaly explanations, and 10th–90th percentile tree-spread prediction intervals.
- **Two Operational Modes**:
  - **Mode 1 (Single Observation)**: Site dropdown, datetime picker, "Use dataset values" auto-fill button, and immediate AI maintenance diagnosis.
  - **Mode 2 (Batch CSV Upload)**: Upload timeseries CSVs to evaluate daily Performance Ratio (PR), rolling loss slope, anomaly timeline, and timeseries curves.

---

## 📁 System Architecture & Directory Structure

```
EVS PROJECT/
├── backend/
│   ├── app.py                          # Flask REST API server (CORS-enabled, history indexed)
│   ├── train_models.py                 # Reproducible ML training & ablation pipeline
│   ├── model_evaluation_report.txt     # Formal model evaluation report
│   ├── requirements.txt                # Python dependencies
│   └── models/                         # ML artifacts and datasets
│       ├── solar_energy_random_forest.pkl   # Short-term nowcast RF model (21 features with lags)
│       ├── expected_generation_rf.pkl       # Physical expected baseline RF (17 features without lags)
│       ├── anomaly_model.pkl                # Isolation Forest (100 trees, 2% contamination)
│       ├── feature_columns.pkl              # 21 RF feature definitions
│       ├── expected_feature_columns.pkl     # 17 physical baseline feature definitions
│       ├── anomaly_features.pkl             # 18 IF feature definitions
│       ├── training_feature_ranges.json     # Feature min/max ranges for runtime drift warnings
│       ├── model_metrics.pkl                # Serialized evaluation metrics
│       ├── anomaly_results.csv              # Anomaly detection results dataset (75 MB)
│       └── maintenance_analysis_results.csv # Operational timeseries dataset (227 MB, 1.19M rows)
│
├── solar-ai-frontend/                  # React + Vite web dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx              # System status header
│   │   │   ├── ProjectOverview.jsx     # Section A: Project Problem Statement
│   │   │   ├── SolarInputForm.jsx      # Mode 1: Current parameter input form with history lookup
│   │   │   ├── BatchAnalysis.jsx       # Mode 2: Batch CSV upload component
│   │   │   ├── PredictionCards.jsx     # Section C: Generation prediction cards with history badge
│   │   │   ├── AnomalyCard.jsx         # Section D: Behavioral anomaly detection & explainability
│   │   │   ├── MaintenanceCard.jsx     # Section E: Explainable maintenance recommendations
│   │   │   ├── PerformanceChart.jsx    # Section F: Comparison chart & batch timeline curve
│   │   │   ├── CleaningCostBenefit.jsx # Interactive cleaning cost-benefit analysis
│   │   │   └── EnvironmentalBenefits.jsx # Section G: Sustainability & resource conservation
│   │   ├── pages/
│   │   │   └── Dashboard.jsx           # Main monitoring workspace with Mode 1 & 2 toggle
│   │   ├── services/
│   │   │   └── api.js                  # Axios client for Flask REST API
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                   # Restrained solar design system
│   ├── package.json
│   └── vite.config.js
│
├── app.py                              # Root backend launcher
├── start.bat                           # 1-Click launcher for Windows
├── test_backend_api.py                 # Automated backend test suite (10 test sections)
└── README.md
```

---

## 🔬 Machine Learning Evaluation & Baseline Comparison

Full metrics and ablation comparisons are documented in `backend/model_evaluation_report.txt`.

### 1. Model Ablation Study (With vs. Without Lag Features)
- **Model A (WITH Lags — Short-term Nowcast)**:
  - Features: 21 (includes `PreviousGeneration`, `Generation_30min_Ago`, `Generation_1hour_Ago`, `Generation_2hour_Ago`)
  - Held-out Test: $\text{MAE} = 1.4293\text{ kW}$, $\text{RMSE} = 3.2989\text{ kW}$, $R^2 = 0.9285$, $\text{MAPE} = 6.84\%$
  - Role: Immediate operational tracking and step-ahead generation estimation.
- **Model B (WITHOUT Lags — Physical Expected Baseline)**:
  - Features: 17 (ambient weather, site capacity, diurnal solar position)
  - Held-out Test: $\text{MAE} = 1.9254\text{ kW}$, $R^2 = 0.7735$
  - Role: Unsoiled physical baseline for calculating true performance loss without circular soiling masking.
- **Model C (HistGradientBoosting Comparison)**:
  - Evaluated on identical 17 physical features: $\text{MAE} = 1.9482\text{ kW}$, $R^2 = 0.7681$.

### 2. Behavioral Anomaly Detection & Synthetic Fault Validation
- **Model**: `IsolationForest` (100 Estimators, contamination = `0.02`, max samples = `256`)
- **Synthetic Fault Test (10,417 records, labeled synthetic)**:
  - Injected sudden daytime collapses ($\ge 75\%$ loss) into held-out clean records.
  - Combined detection logic flagged `100%` of severe collapse events.

---

## 🛠️ Step-by-Step Windows PowerShell Execution Guide

### Step 1: Open PowerShell and Navigate to Workspace
```powershell
cd "E:\SEM 7\EVS PROJECT"
```

### Step 2: Run Automated Backend Test Suite
Executes the comprehensive 10-point test suite covering history lookup, fewer inputs, 404 missing history rejection, soiling detection, fault inspection, and batch upload:
```powershell
py test_backend_api.py
```

### Step 3: Run Model Training & Ablation Pipeline (Optional)
To re-run the ablation study and re-generate `backend/model_evaluation_report.txt`:
```powershell
py backend/train_models.py
```

### Step 4: Build Frontend for Production (Optional)
```powershell
cd solar-ai-frontend
npm run build
cd ..
```

### Step 5: Start the Application

#### Option A: One-Click Windows Batch Launcher
```powershell
.\start.bat
```

#### Option B: Dedicated PowerShell Terminals
**Terminal 1 — Flask API Server:**
```powershell
cd "E:\SEM 7\EVS PROJECT"
py backend/app.py
```
*API server starts at `http://127.0.0.1:5000` (indexes 1.19M records on launch).*

**Terminal 2 — React Frontend:**
```powershell
cd "E:\SEM 7\EVS PROJECT\solar-ai-frontend"
npm run dev
```
*Web dashboard opens at `http://localhost:5173`.*

---

## 📡 REST API Documentation

### 1. Health Status
- **Method**: `GET /`
- **Response**: `{"status": "running", "system": "Solar AI Monitoring System"}`

### 2. Monitored Sites
- **Method**: `GET /api/sites`
- **Response**: Returns list of monitored solar arrays with CampusKey, SiteKey, nameplate kWp, number of panels, and historical coverage period (`2020-01-01` to `2022-04-23`).

### 3. Historical Dataset Values (Auto-fill)
- **Method**: `GET /api/dataset-values?campusKey=2&siteKey=1&timestamp=2021-06-15T13:30`
- **Response**: Returns actual historical generation and diurnal weather estimates for that site and timestamp.

### 4. Solar Analysis & Maintenance Prediction (Only Current Inputs)
- **Method**: `POST /api/analyze`
- **Request Body (JSON)**:
  ```json
  {
    "CampusKey": 2,
    "SiteKey": 1,
    "timestamp": "2021-06-15 13:30:00",
    "SolarGeneration": 8.81,
    "AirTemperature": 27.5,
    "RelativeHumidity": 50.0,
    "WindSpeed": 3.2
  }
  ```
  *(Notice: No PreviousGeneration, Expected, or lag fields required. The system retrieves them automatically.)*
- **Response Structure**:
  ```json
  {
    "success": true,
    "predicted_generation": 7.705,
    "expected_generation": 6.933,
    "actual_generation": 8.81,
    "generation_unit": "kW",
    "performance_loss_percent": 0.0,
    "lost_kwh": 0.0,
    "lost_co2_kg": 0.0,
    "co2_label": "estimated avoided or lost emissions",
    "anomaly_detected": false,
    "maintenance_status": "Normal",
    "recommendations": "NORMAL",
    "possible_causes": "No Significant Abnormal Cause",
    "maintenance_reason": "Performance is within the acceptable 8% operational threshold of expected generation.",
    "previous_data_used": {
      "timestamp": "2021-06-15 13:15:00",
      "value": 8.188,
      "unit": "kW",
      "lags": {
        "lag_30min": 6.531,
        "lag_1hour": 6.406,
        "lag_2hour": 7.938
      }
    },
    "prediction_interval": {
      "lower_bound": 6.85,
      "upper_bound": 8.50,
      "outside_interval": false
    },
    "explainability": {
      "top_features": [
        {"feature": "AirTemperature", "value": 27.5},
        {"feature": "Hour", "value": 13},
        {"feature": "kWp", "value": 25.0}
      ],
      "anomaly_reason": "Operational power dynamics conform to expected nominal distribution."
    }
  }
  ```

### 5. Batch CSV Upload
- **Method**: `POST /api/analyze-batch`
- **Payload**: `multipart/form-data` containing `file` (`.csv`).
- **Response**: Returns `processed_rows`, `metrics` (`performance_ratio`, `rolling_loss_slope`, `trend_diagnosis`, `total_actual_kwh`, `total_lost_kwh`, `total_lost_co2_kg`), and `timeline` (actual vs. expected for charting).

---

## 🌿 Environmental Benefits & Resource Conservation

- **Water Conservation (Scenario Estimate)**: Condition-based cleaning schedules cleanings only when surface soiling is empirically detected. This prevents an estimated 2 unneeded washes per month, conserving ~400–800 Liters of water monthly per array based on ~200–400 L/wash cycle assumptions.
- **Avoided Grid Emissions**: Avoided power deficit calculations apply the Central Electricity Authority (CEA) India Baseline Database Version 19 weighted average grid factor of `0.716 kg CO₂/kWh`.
- **Targeted Technician Dispatch**: Unifies recommendations so that normal arrays continue automated logging, soiling triggers cleaning review, and sudden collapse triggers physical electrical inspection.
