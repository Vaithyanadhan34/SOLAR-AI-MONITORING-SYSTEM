import os
import sys
import joblib
import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / 'models'

print("=" * 80)
print("PART 1: DIAGNOSTIC ANALYSIS OF DATA & CURRENT MODELS")
print("=" * 80)

# 1. Inspect Model A (solar_energy_random_forest.pkl)
rf_path = MODELS_DIR / 'solar_energy_random_forest.pkl'
feat_path = MODELS_DIR / 'feature_columns.pkl'
exp_rf_path = MODELS_DIR / 'expected_generation_rf.pkl'
exp_feat_path = MODELS_DIR / 'expected_feature_columns.pkl'

print("\n--- 1. Current Model A Feature Importances ---")
if rf_path.exists() and feat_path.exists():
    rf_model = joblib.load(rf_path)
    feature_cols = list(joblib.load(feat_path))
    importances = dict(zip(feature_cols, rf_model.feature_importances_))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    lag_share = 0.0
    for f, imp in sorted_imp:
        is_lag = any(k in f.lower() for k in ['prev', 'lag', 'generation_'])
        if is_lag:
            lag_share += imp
        tag = "[LAG FEATURE]" if is_lag else ""
        print(f"  {f:28s}: {imp*100:6.2f}% {tag}")
    print(f"\n  >> TOTAL LAG / PREVIOUS-GENERATION FEATURE SHARE: {lag_share*100:.2f}%")
else:
    print("Model A files not found.")

print("\n--- 1b. Current Model B (Expected Generation) Feature Importances ---")
if exp_rf_path.exists() and exp_feat_path.exists():
    exp_rf = joblib.load(exp_rf_path)
    exp_cols = list(joblib.load(exp_feat_path))
    exp_imp = dict(zip(exp_cols, exp_rf.feature_importances_))
    sorted_exp = sorted(exp_imp.items(), key=lambda x: x[1], reverse=True)
    for f, imp in sorted_exp:
        print(f"  {f:28s}: {imp*100:6.2f}%")
else:
    print("Model B files not found.")

# 2. Check Data Quality of maintenance_analysis_results.csv
csv_path = MODELS_DIR / 'maintenance_analysis_results.csv'
print(f"\n--- 2. Dataset Inspection & Quality Check on {csv_path.name} ---")
if not csv_path.exists():
    print(f"Error: {csv_path} does not exist!")
    sys.exit(1)

# Sample or read full
print("Reading dataset headers and first 100,000 rows for fast sanity checks...")
df_head = pd.read_csv(csv_path, nrows=5)
print("Columns in CSV:", df_head.columns.tolist())

# Check coordinates
print("Checking for coordinates (latitude / longitude)...")
has_coords = any('lat' in c.lower() or 'lon' in c.lower() or 'coord' in c.lower() for c in df_head.columns)
print(f"Coordinates found in CSV columns: {has_coords}")

# Load full dataset for comprehensive audit
print("\nLoading full dataset for complete data quality audit (1.19M rows)...")
df = pd.read_csv(csv_path)
print(f"Total rows: {len(df):,}")

# Missing values
print("\nMissing values per column:")
for c, cnt in df.isnull().sum().items():
    if cnt > 0:
        print(f"  {c}: {cnt:,} ({cnt/len(df)*100:.2f}%)")
if df.isnull().sum().sum() == 0:
    print("  None! (0 missing values)")

# Duplicates
dups = df.duplicated(subset=['Timestamp', 'CampusKey', 'SiteKey']).sum()
print(f"\nTimestamp duplicates per site: {dups:,}")

# Negative values
neg_actual = (df['ActualGeneration'] < 0).sum()
neg_pred = (df['PredictedGeneration'] < 0).sum()
print(f"Negative ActualGeneration values: {neg_actual:,}")
print(f"Negative PredictedGeneration values: {neg_pred:,}")

# Parse timestamp
df['Timestamp'] = pd.to_datetime(df['Timestamp'])
df['Hour'] = df['Timestamp'].dt.hour
df['Month'] = df['Timestamp'].dt.month
df['Date'] = df['Timestamp'].dt.date

# Night values check (Hour < 6 or Hour >= 19)
night_mask = (df['Hour'] < 6) | (df['Hour'] >= 19)
night_non_zero = ((df['ActualGeneration'] > 0.05) & night_mask).sum()
print(f"Night records (Hours <6 or >=19): {night_mask.sum():,} ({night_mask.mean()*100:.1f}%)")
print(f"Night records with non-zero generation (>0.05 kW): {night_non_zero:,} ({night_non_zero/night_mask.sum()*100:.2f}%)")

# Extreme sensor outliers (e.g. > 150 kW on 25 kW site or negative)
cap_map = {1: 25.0, 2: 20.0, 3: 30.0} # from app / metadata
print(f"Max ActualGeneration observed: {df['ActualGeneration'].max():.2f} kW")
print(f"Min ActualGeneration observed: {df['ActualGeneration'].min():.2f} kW")

# Stuck sensor values (same non-zero value repeated for > 6 consecutive intervals)
print("\nChecking for stuck values...")
stuck_count = 0
for (ck, sk), group in df.groupby(['CampusKey', 'SiteKey']):
    group_sorted = group.sort_values('Timestamp')
    diffs = group_sorted['ActualGeneration'].diff()
    # consecutive zeros in diff where value > 0.5
    stuck_mask = (diffs == 0) & (group_sorted['ActualGeneration'] > 1.0)
    stuck_count += stuck_mask.sum()
print(f"Consecutive identical non-zero generation readings: {stuck_count:,}")

# Timestamp gaps
print("\nTimestamp interval checks:")
for (ck, sk), group in df.groupby(['CampusKey', 'SiteKey']):
    times = group['Timestamp'].sort_values()
    deltas = times.diff().dt.total_seconds() / 60.0
    val_counts = deltas.value_counts().head(3)
    print(f"  Site (Campus {ck}, Site {sk}): {len(times):,} readings from {times.min().date()} to {times.max().date()}. Top intervals: {dict(val_counts)}")
    break # show first site sample

# 3. Baseline Comparison on Chronological Hold-out Set
print("\n--- 3. Baseline Comparison (Chronological 80/20 Holdout) ---")
# Sort chronologically
df = df.sort_values(['Timestamp', 'CampusKey', 'SiteKey']).reset_index(drop=True)
split_idx = int(len(df) * 0.8)
train_df = df.iloc[:split_idx].copy()
test_df = df.iloc[split_idx:].copy()

print(f"Train period: {train_df['Timestamp'].min()} to {train_df['Timestamp'].max()} ({len(train_df):,} rows)")
print(f"Test period : {test_df['Timestamp'].min()} to {test_df['Timestamp'].max()} ({len(test_df):,} rows)")

y_test = test_df['ActualGeneration'].values

# Baseline 1: Persistence (previous reading for that site)
# Find previous reading in test_df
test_df['Persistence'] = test_df.groupby(['CampusKey', 'SiteKey'])['ActualGeneration'].shift(1)
# fill first with last from train_df if available, else actual
test_df['Persistence'] = test_df['Persistence'].fillna(test_df['ActualGeneration'])
y_persist = test_df['Persistence'].values

# Baseline 2: Hour-of-day average per site computed strictly on train_df
site_hour_means = train_df.groupby(['CampusKey', 'SiteKey', 'Hour'])['ActualGeneration'].mean().rename('HourAvg')
test_df = test_df.merge(site_hour_means, on=['CampusKey', 'SiteKey', 'Hour'], how='left')
test_df['HourAvg'] = test_df['HourAvg'].fillna(0.0)
y_houravg = test_df['HourAvg'].values

# Model predictions on test_df
y_pred_current = test_df['PredictedGeneration'].values

def calc_metrics(y_true, y_pred, name=""):
    mae = np.mean(np.abs(y_true - y_pred))
    rmse = np.sqrt(np.mean((y_true - y_pred)**2))
    ss_tot = np.sum((y_true - np.mean(y_true))**2)
    ss_res = np.sum((y_true - y_pred)**2)
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    wape = (np.sum(np.abs(y_true - y_pred)) / np.sum(y_true)) * 100.0 if np.sum(y_true) > 0 else 0.0
    # Safe MAPE on non-near-zero actuals (> 0.5 kW)
    mask = y_true > 0.5
    mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0 if mask.sum() > 0 else 0.0
    return {
        'name': name,
        'MAE': mae,
        'RMSE': rmse,
        'R2': r2,
        'WAPE (%)': wape,
        'MAPE (>0.5kW %)': mape
    }

print("\n--- OVERALL METRICS (ALL 24 HOURS, INCLUDING NIGHT) ---")
b1_m = calc_metrics(y_test, y_persist, "Persistence (t-15m)")
b2_m = calc_metrics(y_test, y_houravg, "Hour-of-Day Mean")
cur_m = calc_metrics(y_test, y_pred_current, "Current Model in CSV")

for m in [b1_m, b2_m, cur_m]:
    print(f"  {m['name']:25s} | MAE: {m['MAE']:5.3f} kW | RMSE: {m['RMSE']:5.3f} kW | R²: {m['R2']:6.4f} | WAPE: {m['WAPE (%)']:5.2f}% | MAPE: {m['MAPE (>0.5kW %)']:5.2f}%")

# Daytime-only metrics
print("\n--- DAYTIME-ONLY METRICS (HOURS 06:00 to 18:45, SOLAR HOURS) ---")
day_mask = (test_df['Hour'] >= 6) & (test_df['Hour'] < 19)
y_test_day = y_test[day_mask]
y_persist_day = y_persist[day_mask]
y_houravg_day = y_houravg[day_mask]
y_cur_day = y_pred_current[day_mask]

b1_day = calc_metrics(y_test_day, y_persist_day, "Persistence (t-15m) [Day]")
b2_day = calc_metrics(y_test_day, y_houravg_day, "Hour-of-Day Mean [Day]")
cur_day = calc_metrics(y_test_day, y_cur_day, "Current Model [Day]")

for m in [b1_day, b2_day, cur_day]:
    print(f"  {m['name']:28s} | MAE: {m['MAE']:5.3f} kW | RMSE: {m['RMSE']:5.3f} kW | R²: {m['R2']:6.4f} | WAPE: {m['WAPE (%)']:5.2f}% | MAPE: {m['MAPE (>0.5kW %)']:5.2f}%")

# Error by hour of day
print("\n--- ERROR BY HOUR OF DAY (Current Model on Test Set) ---")
test_df['AbsError'] = np.abs(test_df['ActualGeneration'] - test_df['PredictedGeneration'])
hourly_err = test_df.groupby('Hour')[['ActualGeneration', 'PredictedGeneration', 'AbsError']].mean()
print(f"Hour | Avg Actual (kW) | Avg Predicted (kW) | Mean Abs Error (kW)")
print("-" * 55)
for h, r in hourly_err.iterrows():
    print(f"{int(h):4d} | {r['ActualGeneration']:15.2f} | {r['PredictedGeneration']:18.2f} | {r['AbsError']:19.2f}")

# Error by site
print("\n--- ERROR BY SITE (Current Model on Test Set) ---")
site_err = test_df.groupby(['CampusKey', 'SiteKey'])[['ActualGeneration', 'PredictedGeneration', 'AbsError']].agg({
    'ActualGeneration': 'mean',
    'PredictedGeneration': 'mean',
    'AbsError': ['mean', 'count']
})
print(site_err.head(10))

# Error by month
print("\n--- ERROR BY MONTH (Current Model on Test Set) ---")
monthly_err = test_df.groupby('Month')[['ActualGeneration', 'PredictedGeneration', 'AbsError']].mean()
print(f"Month| Avg Actual (kW) | Avg Predicted (kW) | Mean Abs Error (kW)")
print("-" * 55)
for m, r in monthly_err.iterrows():
    print(f"{int(m):4d} | {r['ActualGeneration']:15.2f} | {r['PredictedGeneration']:18.2f} | {r['AbsError']:19.2f}")

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
