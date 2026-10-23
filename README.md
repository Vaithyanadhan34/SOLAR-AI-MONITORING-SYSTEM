# Solar AI Monitoring System
### Machine Learning-Powered Solar PV Generation Forecasting & Condition-Based Maintenance Intelligence

A software-only Solar Photovoltaic (PV) monitoring platform designed to transform operational data into actionable generation forecasts, behavioral anomaly detection, and explainable condition-based maintenance recommendations.

---

## 🌟 Core System Objectives

1. **Predict Future Solar Energy Generation**: Forecast instantaneous solar power output ($\text{kW}$) using a validated Random Forest regression model trained on legitimate operational and environmental features.
2. **Detect Abnormal Performance Patterns**: Validate real-time power dynamics using an Isolation Forest anomaly detector to identify statistical curve deviations.
3. **Condition-Based Maintenance Guidance**: Classify plant operational health into three standardized categories:
   - **`Normal`**: Generation is within acceptable tolerance; continue standard automated monitoring.
   - **`Cleaning Review`**: Empirical performance loss detected under standard operating patterns, indicating gradual dust and soiling accumulation.
   - **`Inspection`**: Sudden generation drops or severe anomalous deviations detected, warranting on-site physical/electrical technician inspection.
4. **Environmental & Resource Conservation**: Highlight tangible sustainability benefits, including avoiding premature washing to conserve scarce water in arid solar installations, maximizing clean renewable power yield, and reducing unnecessary maintenance labor.
5. **Clean & Professional Web Dashboard**: A restrained, solar-inspired web interface built with React and Vite prioritizing information clarity, responsiveness, and direct model inference.

---

## 📁 System Architecture & Directory Structure

```
EVS PROJECT/
├── backend/
│   ├── app.py                          # Flask REST API server (CORS-enabled)
│   ├── train_models.py                 # Reproducible ML training & baseline evaluation pipeline
│   ├── model_evaluation_report.txt     # Formal model evaluation report
│   ├── requirements.txt                # Python dependencies
│   └── models/                         # ML artifacts and datasets
│       ├── solar_energy_random_forest.pkl   # Random Forest Regressor (50 trees, max depth 20)
│       ├── anomaly_model.pkl                # Isolation Forest (100 trees, 2% contamination)
│       ├── feature_columns.pkl              # 21 RF feature definitions
│       ├── anomaly_features.pkl             # 18 IF feature definitions
│       ├── model_metrics.pkl                # Serialized evaluation metrics
│       ├── anomaly_results.csv              # Anomaly detection results dataset (75 MB)
│       └── maintenance_analysis_results.csv # Operational timeseries dataset (227 MB, 1.19M rows)
│
├── solar-ai-frontend/                  # React + Vite web dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx              # System status header
│   │   │   ├── ProjectOverview.jsx     # Section A: Project Problem Statement
│   │   │   ├── SolarInputForm.jsx      # Section B: Operational parameter input form
│   │   │   ├── PredictionCards.jsx     # Section C: Generation prediction cards (kW)
│   │   │   ├── AnomalyCard.jsx         # Section D: Behavioral anomaly detection
│   │   │   ├── MaintenanceCard.jsx     # Section E: Explainable maintenance recommendations
│   │   │   ├── PerformanceChart.jsx    # Section F: Actual vs Predicted comparison chart
│   │   │   ├── EnvironmentalBenefits.jsx # Section G: Sustainability & resource conservation
│   │   │   └── SystemStatus.jsx        # Backend live heartbeat indicator
│   │   ├── pages/
│   │   │   └── Dashboard.jsx           # Main monitoring workspace
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
├── test_backend_api.py                 # Automated backend test suite
└── README.md
```

---

## 🔬 Machine Learning Evaluation & Baseline Comparison

### 1. Solar Generation Forecast (Random Forest)
- **Model**: `RandomForestRegressor` (50 Estimators, max depth 20)
- **Feature Schema (21 Inputs)**: Campus Key, Site Key, Installed Capacity (kWp), Number of panels, Apparent Temperature, Air Temperature, Dew Point Temperature, Relative Humidity, Wind Speed, Wind Direction, Previous Generation (t-1), Generation Lags (30m, 1h, 2h), Year, Month, Day, Hour, Minute, Day of Week, Day of Year.
- **Held-Out Test Set (239,054 records)**:
  - **Mean Absolute Error (MAE)**: `1.4293 kW`
  - **Root Mean Square Error (RMSE)**: `3.2989 kW`
  - **Mean Absolute Percentage Error (MAPE)**: `6.84 %`
  - **Coefficient of Determination ($R^2$)**: `0.9285` (92.85%)
- **Baseline Comparison (Full 1,195,267 Timeseries Records)**:
  - Random Forest Model: $\text{MAE} = 1.2841\text{ kW}$, $\text{RMSE} = 2.8511\text{ kW}$, $R^2 = 0.9352$
  - Persistence Baseline ($y_{t} = y_{t-1}$): $\text{MAE} = 1.3111\text{ kW}$, $\text{RMSE} = 3.0556\text{ kW}$, $R^2 = 0.9256$
  - Climatology / Mean Baseline ($\bar{y}$): $\text{MAE} = 6.4514\text{ kW}$, $\text{RMSE} = 11.2037\text{ kW}$, $R^2 = 0.0000$

### 2. Behavioral Anomaly Detection (Isolation Forest)
- **Model**: `IsolationForest` (100 Estimators, contamination = `0.02`, max samples = `256`)
- **Feature Schema (18 Inputs)**: Solar Generation, Generation Lags, Rate of Change ($\Delta \text{kW}$), Rate of Change ($\% deviation$), Weather parameters, Temporal cycles.
- **Validation**: Evaluated across 150,000 operational observations; achieved exact empirical anomaly detection rate of `2.00%`.

---

## 🛠️ Step-by-Step Windows PowerShell Execution Guide

### Step 1: Clone / Navigate to Workspace
```powershell
cd "E:\SEM 7\EVS PROJECT"
```

### Step 2: Run ML Training & Evaluation Pipeline
To re-train, validate against baselines, and re-generate `backend/model_evaluation_report.txt`:
```powershell
py backend/train_models.py
```

### Step 3: Run Backend Verification Tests
Verify all API endpoints, input rejection, model loading, and maintenance logic:
```powershell
py test_backend_api.py
```

### Step 4: Build Frontend for Production (Optional)
```powershell
cd solar-ai-frontend
npm run build
cd ..
```

### Step 5: Start the Application

#### Option A: One-Click Launcher
Run the provided batch script:
```powershell
.\start.bat
```

#### Option B: Dedicated Terminals
**Terminal 1 — Flask API Server:**
```powershell
py app.py
```
*API server starts at `http://127.0.0.1:5000`.*

**Terminal 2 — React Frontend:**
```powershell
cd solar-ai-frontend
npm run dev
```
*Web dashboard opens at `http://localhost:5173`.*

---

## 📡 REST API Documentation

### 1. Health Status
- **Method**: `GET /`
- **Response**:
  ```json
  {
    "status": "running",
    "system": "Solar AI Monitoring System"
  }
  ```

### 2. Model Metadata & Features
- **Method**: `GET /api/model-info`
- **Response**: Returns model architecture names, 21 Random Forest features, 18 Isolation Forest features, and held-out evaluation metrics.

### 3. Solar Analysis & Maintenance Prediction
- **Method**: `POST /api/analyze`
- **Request Body (JSON)**:
  ```json
  {
    "CampusKey": 2,
    "SiteKey": 1,
    "kWp": 25.0,
    "Number of panels": 100,
    "SolarGeneration": 20.0,
    "PreviousGeneration": 26.5,
    "AirTemperature": 32.0,
    "RelativeHumidity": 38.0,
    "WindSpeed": 2.1,
    "timestamp": "2024-06-15 13:30:00"
  }
  ```
- **Response Structure**:
  ```json
  {
    "success": true,
    "predicted_generation": 25.66,
    "generation_unit": "kW",
    "actual_generation": 20.0,
    "generation_difference": 5.66,
    "performance_loss_percent": 22.06,
    "anomaly_detected": false,
    "anomaly_score": 0.0888,
    "anomaly_status": "Normal",
    "maintenance_status": "Cleaning Review",
    "possible_causes": "Possible Environmental Effect / Soiling",
    "recommendations": "CLEANING RECOMMENDED",
    "maintenance_reason": "Significant performance loss detected.",
    "model_status": "Loaded and operational"
  }
  ```

---

## 🌿 Environmental Benefits Summary

- **Water Conservation**: Eliminating unnecessary wash cycles prevents hundreds of liters of water waste per cleaning cycle, critical in arid solar regions.
- **Clean Energy Maximization**: Promptly detecting soiling and faults restores full kilowatt capacity, displacing fossil-generated grid electricity.
- **Labor Optimization**: Replaces arbitrary calendar sweeps with targeted condition-based technician dispatch.
- **Asset Protection**: Early warning of abnormal inverter or string behavior prevents premature panel degradation.
