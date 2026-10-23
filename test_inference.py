import joblib
import pandas as pd
import numpy as np

rf_model = joblib.load('solar_energy_random_forest.pkl')
iso_model = joblib.load('anomaly_model.pkl')
feature_cols = joblib.load('feature_columns.pkl')
anomaly_cols = joblib.load('anomaly_features.pkl')

print("Loaded models successfully.")

# Sample input dictionary
sample_input = {
    'CampusKey': 2,
    'SiteKey': 1,
    'kWp': 25.0,
    'Number of panels': 100,
    'ApparentTemperature': 28.5,
    'AirTemperature': 27.0,
    'DewPointTemperature': 18.0,
    'RelativeHumidity': 60.0,
    'WindSpeed': 3.5,
    'WindDirection': 180.0,
    'SolarGeneration': 38.5,
    'PreviousGeneration': 40.0,
    'Generation_30min_Ago': 39.0,
    'Generation_1hour_Ago': 37.0,
    'Generation_2hour_Ago': 32.0,
    'Year': 2024,
    'Month': 6,
    'Day': 15,
    'Hour': 13,
    'Minute': 30,
    'DayOfWeek': 5,
    'DayOfYear': 167
}

# Derived features for anomaly model
gen_change = sample_input['SolarGeneration'] - sample_input['PreviousGeneration']
prev = sample_input['PreviousGeneration']
gen_change_pct = ((gen_change / prev) * 100.0) if prev > 0 else 0.0
sample_input['GenerationChange'] = gen_change
sample_input['GenerationChangePercent'] = gen_change_pct

# Test RF prediction
df_rf = pd.DataFrame([sample_input])[feature_cols]
pred_gen = float(rf_model.predict(df_rf)[0])
print(f"Predicted Generation: {pred_gen:.2f} kW")

# Test Isolation Forest prediction
df_iso = pd.DataFrame([sample_input])[anomaly_cols]
iso_pred = iso_model.predict(df_iso)[0]  # 1 for Normal, -1 for Anomaly
iso_score = float(iso_model.decision_function(df_iso)[0])
print(f"Isolation Forest Label: {iso_pred}, Score: {iso_score:.4f}")
status = "Normal" if iso_pred == 1 else "Anomaly"
print(f"Status: {status}")

# Calculate performance metrics
actual_gen = sample_input['SolarGeneration']
gen_diff = pred_gen - actual_gen
loss_pct = max(0.0, (gen_diff / pred_gen) * 100.0) if pred_gen > 0 else 0.0
print(f"Generation Difference: {gen_diff:.2f}, Loss %: {loss_pct:.2f}%")
