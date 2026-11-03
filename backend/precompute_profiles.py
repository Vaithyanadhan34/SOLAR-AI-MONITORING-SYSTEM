import os
import sys
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / 'models'
CSV_PATH = MODELS_DIR / 'maintenance_analysis_results.csv'

def precompute():
    print(f"Checking for historical dataset at {CSV_PATH}...")
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} does not exist!")
        return

    print("Loading historical dataset (this may take a few seconds)...")
    t0 = time.time()
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df):,} rows in {time.time()-t0:.2f}s.")

    df['Timestamp'] = pd.to_datetime(df['Timestamp'])
    df['Hour'] = df['Timestamp'].dt.hour
    df['Minute'] = df['Timestamp'].dt.minute
    df['TimeSlot'] = df['Hour'].astype(str).str.zfill(2) + ":" + df['Minute'].astype(str).str.zfill(2)
    df['Month'] = df['Timestamp'].dt.month
    df['Date'] = df['Timestamp'].dt.strftime('%Y-%m-%d')

    overall_start = df['Timestamp'].min().strftime('%Y-%m-%d')
    overall_end = df['Timestamp'].max().strftime('%Y-%m-%d')

    site_profiles = {
        "metadata": {
            "training_period_start": overall_start,
            "training_period_end": overall_end,
            "total_records": len(df),
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S')
        },
        "sites": {}
    }

    # Also build a compact validation sample for the held-out test period (e.g. 2 weeks in June 2021)
    validation_start = "2021-06-01"
    validation_end = "2021-06-14"
    val_df = df[(df['Date'] >= validation_start) & (df['Date'] <= validation_end)].copy()

    val_sample_data = {
        "validation_period": {
            "start": validation_start,
            "end": validation_end,
            "description": "Backtest on held-out historical data (2020-2022). Not current."
        },
        "sites": {}
    }

    for (c, s), grp in df.groupby(['CampusKey', 'SiteKey']):
        site_key_str = f"{c}_{s}"
        ck = int(c)
        sk = int(s)
        site_id = f"site-{sk}" if ck == 2 else (f"site-4" if (ck, sk) == (3, 11) else (f"site-5" if (ck, sk) == (1, 27) else f"site-{ck}-{sk}"))
        
        cap = float(grp['kWp'].iloc[0]) if 'kWp' in grp.columns else 25.0
        panels = int(grp['Number of panels'].iloc[0]) if 'Number of panels' in grp.columns else int(cap * 4)

        # 1. 24-hour typical day bands (30-min slots)
        slot_bands = []
        for slot, slot_grp in grp.groupby('TimeSlot'):
            act_vals = slot_grp['ActualGeneration'].values
            exp_vals = slot_grp['PredictedGeneration'].values if 'PredictedGeneration' in slot_grp.columns else act_vals
            
            slot_bands.append({
                "time": slot,
                "time_of_day": slot,
                "median_kW": round(float(np.median(act_vals)), 2),
                "p25_kW": round(float(np.percentile(act_vals, 25)), 2),
                "p75_kW": round(float(np.percentile(act_vals, 75)), 2),
                "min_kW": round(float(np.min(act_vals)), 2),
                "max_kW": round(float(np.max(act_vals)), 2),
                "expected_median_kW": round(float(np.median(exp_vals)), 2),
                "expected_p25_kW": round(float(np.percentile(exp_vals, 25)), 2),
                "expected_p75_kW": round(float(np.percentile(exp_vals, 75)), 2)
            })

        slot_bands.sort(key=lambda x: x["time"])

        # 2. Monthly specific yield averages
        monthly_stats = {}
        for m, m_grp in grp.groupby('Month'):
            # group by date to get daily totals
            daily_act = m_grp.groupby('Date')['ActualGeneration'].sum() * 0.5
            daily_exp = (m_grp.groupby('Date')['PredictedGeneration'].sum() * 0.5) if 'PredictedGeneration' in m_grp.columns else daily_act
            
            monthly_stats[int(m)] = {
                "avg_daily_actual_kwh": round(float(daily_act.mean()), 2),
                "avg_daily_expected_kwh": round(float(daily_exp.mean()), 2),
                "specific_yield": round(float(daily_act.mean() / cap), 2)
            }

        site_profiles["sites"][site_id] = {
            "siteId": site_id,
            "campusKey": ck,
            "siteKey": sk,
            "capacity_kWp": cap,
            "panels": panels,
            "row_count": len(grp),
            "start_date": grp['Date'].min(),
            "end_date": grp['Date'].max(),
            "typical_day_bands": slot_bands,
            "monthly_stats": monthly_stats
        }

        # Validation sample for this site
        site_val_grp = val_df[(val_df['CampusKey'] == ck) & (val_df['SiteKey'] == sk)].copy()
        if len(site_val_grp) > 0:
            site_val_grp.sort_values('Timestamp', inplace=True)
            timeseries_records = []
            for _, r in site_val_grp.iterrows():
                timeseries_records.append({
                    "timestamp": r['Timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
                    "actual_kW": round(float(r['ActualGeneration']), 2),
                    "expected_kW": round(float(r['PredictedGeneration']), 2) if 'PredictedGeneration' in r else round(float(r['ActualGeneration']), 2)
                })

            # Error by hour of day
            site_val_grp['Error_kW'] = site_val_grp['ActualGeneration'] - site_val_grp['PredictedGeneration']
            site_val_grp['AbsError_kW'] = site_val_grp['Error_kW'].abs()
            hourly_err = []
            for h, h_grp in site_val_grp.groupby('Hour'):
                hourly_err.append({
                    "hour": int(h),
                    "mae_kW": round(float(h_grp['AbsError_kW'].mean()), 3),
                    "mean_error_kW": round(float(h_grp['Error_kW'].mean()), 3),
                    "actual_mean_kW": round(float(h_grp['ActualGeneration'].mean()), 3),
                    "expected_mean_kW": round(float(h_grp['PredictedGeneration'].mean()), 3)
                })
            hourly_err.sort(key=lambda x: x["hour"])

            val_sample_data["sites"][site_id] = {
                "siteId": site_id,
                "campusKey": ck,
                "siteKey": sk,
                "records_count": len(site_val_grp),
                "timeseries": timeseries_records,
                "hourly_error": hourly_err
            }

    # Save site_profiles.json
    out_profiles = MODELS_DIR / 'site_profiles.json'
    with open(out_profiles, 'w', encoding='utf-8') as f:
        json.dump(site_profiles, f, indent=2)
    print(f"Saved site profiles to {out_profiles} ({out_profiles.stat().st_size / 1024:.1f} KB)")

    # Save historical_validation_sample.json
    out_val = MODELS_DIR / 'historical_validation_sample.json'
    with open(out_val, 'w', encoding='utf-8') as f:
        json.dump(val_sample_data, f, indent=2)
    print(f"Saved validation sample to {out_val} ({out_val.stat().st_size / 1024:.1f} KB)")
    print("Precomputation complete! The backend can now run with ZERO reliance on the 227 MB CSV at runtime.")

if __name__ == '__main__':
    precompute()
