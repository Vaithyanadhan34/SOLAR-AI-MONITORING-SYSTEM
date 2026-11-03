import os
import json
import datetime
from pathlib import Path
from typing import Dict, Any, List
import numpy as np
import pandas as pd
import joblib

BASE_DIR = Path(__file__).resolve().parent
REPORT_PATH = BASE_DIR / 'recent_data_report.txt'

def evaluate_recent_data(site_id: str = "site-1") -> Dict[str, Any]:
    """
    Checks if at least 14 days of saved 2026 daytime readings exist for a site in backend/data/uploads.
    If so, computes out-of-time error metrics (MAE, RMSE, WAPE) using the lag-free expected RF model.
    Writes the report to recent_data_report.txt.
    """
    import data_access
    site_data = data_access.get_merged_site_data(site_id)
    df = site_data.get('df')
    if df is None or df.empty:
        return {
            "ready": False,
            "days_collected": 0,
            "required_days": 14,
            "site_id": site_id,
            "message": "Collecting data: 0 of 14 days"
        }

    df_up = df[df['source'] == 'uploaded'].copy()
    if df_up.empty:
        return {
            "ready": False,
            "days_collected": 0,
            "required_days": 14,
            "site_id": site_id,
            "message": "Collecting data: 0 of 14 days"
        }

    df_up['dt'] = pd.to_datetime(df_up['ts'])
    df_2026 = df_up[df_up['dt'].dt.year >= 2026].copy()
    if df_2026.empty:
        return {
            "ready": False,
            "days_collected": 0,
            "required_days": 14,
            "site_id": site_id,
            "message": "Collecting data: 0 of 14 days"
        }

    df_2026['date'] = df_2026['dt'].dt.strftime('%Y-%m-%d')
    df_2026['hour'] = df_2026['dt'].dt.hour

    # Filter daytime rows only (between 6 AM and 7 PM)
    daytime_df = df_2026[(df_2026['hour'] >= 6) & (df_2026['hour'] < 19)].copy()
    unique_days = int(daytime_df['date'].nunique())

    if unique_days < 14:
        status_msg = f"Collecting data: {unique_days} of 14 days"
        return {
            "ready": False,
            "days_collected": unique_days,
            "required_days": 14,
            "total_daytime_readings": len(daytime_df),
            "site_id": site_id,
            "message": status_msg
        }

    # If 14 days exist, compute true out-of-time test metrics
    act = daytime_df['actual_kW'].astype(float).values
    exp = daytime_df['expected_kW'].astype(float).values
    errors = exp - act
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    sum_act = float(np.sum(act))
    wape = float(np.sum(abs_errors) / sum_act * 100.0) if sum_act > 0 else 0.0

    report_lines = [
        "==================================================================",
        f"2026 REAL DATA OUT-OF-TIME EVALUATION REPORT (Site: {site_id})",
        f"Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "==================================================================",
        f"Days Evaluated: {unique_days} days (Chronological 2026 Readings)",
        f"Daytime Samples: {len(daytime_df):,} rows (06:00 - 18:30)",
        f"Mean Absolute Error (MAE): {mae:.3f} kW",
        f"Root Mean Square Error (RMSE): {rmse:.3f} kW",
        f"Weighted Absolute Percentage Error (WAPE): {wape:.2f} %",
        "------------------------------------------------------------------",
        "Storage: Local files (backend/data/uploads)",
        "=================================================================="
    ]
    report_text = "\n".join(report_lines)
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(report_text)

    return {
        "ready": True,
        "days_collected": unique_days,
        "required_days": 14,
        "total_daytime_readings": len(daytime_df),
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "wape": round(wape, 2),
        "site_id": site_id,
        "report_file": str(REPORT_PATH),
        "message": f"Evaluation Ready: {unique_days} days collected. Out-of-time metrics computed."
    }
