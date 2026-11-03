"""
simulate_policies.py
Replays historical solar generation data per site under two maintenance strategies:
1. Fixed 14-day cleaning schedule
2. Condition-based (water-aware) cleaning rule

Outputs:
- backend/policy_comparison_report.txt
- backend/models/policy_comparison.json

Label: "Simulation based on historical data and stated assumptions. The dataset has no real cleaning events, so this is a scenario model."
"""

import os
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / 'models'

def find_history_file():
    candidates = [
        MODELS_DIR / 'maintenance_analysis_results.csv',
        MODELS_DIR / 'sample_history.csv',
        BASE_DIR.parent / 'models' / 'maintenance_analysis_results.csv',
    ]
    for c in candidates:
        if c.exists():
            return c
    return None

def run_simulation(history_csv_path=None, target_site_id='site-1', cleaning_cost=500.0, tariff_kwh=8.0, water_per_wash=500.0):
    if history_csv_path is None:
        history_csv_path = find_history_file()
    if history_csv_path is None or not Path(history_csv_path).exists():
        raise FileNotFoundError("Historical telemetry dataset not found for policy simulation.")

    print(f"Loading history from {history_csv_path} for simulation on {target_site_id}...")
    df = pd.read_csv(history_csv_path)

    # Filter by site (site-1 is campus 2, site 1)
    if 'CampusKey' in df.columns and 'SiteKey' in df.columns:
        sub = df[(df['CampusKey'] == 2) & (df['SiteKey'] == 1)].copy()
        if len(sub) == 0:
            sub = df.iloc[:5000].copy()
    else:
        sub = df.iloc[:5000].copy()

    # Sort by timestamp
    ts_col = 'Timestamp' if 'Timestamp' in sub.columns else 'timestamp'
    sub[ts_col] = pd.to_datetime(sub[ts_col])
    sub = sub.sort_values(ts_col).reset_index(drop=True)

    actual_col = 'ActualGeneration' if 'ActualGeneration' in sub.columns else ('SolarGeneration' if 'SolarGeneration' in sub.columns else 'actual_generation')
    exp_col = 'PredictedGeneration' if 'PredictedGeneration' in sub.columns else ('expected_generation' if 'expected_generation' in sub.columns else None)

    # Derive date
    sub['Date'] = sub[ts_col].dt.date
    dates = sub['Date'].unique()

    # Pre-aggregate daily actual vs expected
    daily_records = []
    for d in dates:
        day_rows = sub[sub['Date'] == d]
        act_arr = day_rows[actual_col].values
        if exp_col and exp_col in day_rows.columns:
            exp_arr = day_rows[exp_col].values
        else:
            exp_arr = act_arr * 1.15
        
        act_sum = float(np.sum(act_arr) * 0.5)
        exp_sum = float(np.sum(exp_arr) * 0.5)
        shortfalls = np.maximum(0.0, exp_arr - act_arr) * 0.5
        lost_kwh = float(np.sum(shortfalls))

        daily_records.append({
            'date': str(d),
            'actual_kWh': round(act_sum, 2),
            'expected_kWh': round(exp_sum, 2),
            'lost_kWh': round(lost_kwh, 2),
            'shortfall_kWh': round(lost_kwh, 2)
        })

    # Policy 1: Fixed 14-day schedule
    fixed_cleanings = 0
    fixed_cum_cleanings = []
    fixed_daily_lost = []
    fixed_cum_lost = []
    fixed_tot_lost = 0.0

    # Policy 2: Condition-based rule (clean when cumulative lost value >= cleaning cost)
    smart_cleanings = 0
    smart_cum_cleanings = []
    smart_daily_lost = []
    smart_cum_lost = []
    smart_tot_lost = 0.0
    smart_loss_accumulator = 0.0

    clean_threshold_kwh = cleaning_cost / tariff_kwh

    for idx, r in enumerate(daily_records):
        # 1. Fixed Schedule: cleans every 14 days
        if idx > 0 and (idx % 14 == 0):
            fixed_cleanings += 1

        fixed_cum_cleanings.append(fixed_cleanings)
        day_lost_fixed = r['lost_kWh']
        fixed_tot_lost += day_lost_fixed
        fixed_daily_lost.append(round(day_lost_fixed, 2))
        fixed_cum_lost.append(round(fixed_tot_lost, 2))

        # 2. Smart Condition-based: accumulates lost energy until value >= cleaning cost
        smart_loss_accumulator += r['lost_kWh']
        if smart_loss_accumulator >= clean_threshold_kwh:
            smart_cleanings += 1
            smart_loss_accumulator = 0.0 # reset after cleaning

        smart_cum_cleanings.append(smart_cleanings)
        day_lost_smart = r['lost_kWh']
        smart_tot_lost += day_lost_smart
        smart_daily_lost.append(round(day_lost_smart, 2))
        smart_cum_lost.append(round(smart_tot_lost, 2))

    fixed_water_used = round(fixed_cleanings * water_per_wash, 1)
    smart_water_used = round(smart_cleanings * water_per_wash, 1)
    water_saved_scenario = max(0.0, fixed_water_used - smart_water_used)

    daily_timeseries = []
    # Sample up to 60 days for fast frontend rendering and charting
    step_size = max(1, len(daily_records) // 60)
    for i in range(0, len(daily_records), step_size):
        daily_timeseries.append({
            'date': daily_records[i]['date'],
            'fixed_daily_lost_kWh': fixed_daily_lost[i],
            'smart_daily_lost_kWh': smart_daily_lost[i],
            'fixed_cum_cleanings': fixed_cum_cleanings[i],
            'smart_cum_cleanings': smart_cum_cleanings[i],
            'fixed_cum_lost_kWh': fixed_cum_lost[i],
            'smart_cum_lost_kWh': smart_cum_lost[i],
        })

    simulation_result = {
        "success": True,
        "site": target_site_id,
        "disclaimer": "Simulation based on historical data and stated assumptions. The dataset contains no real cleaning events, so this is an empirical scenario model.",
        "assumptions": {
            "cleaning_cost": cleaning_cost,
            "tariff_per_kwh": tariff_kwh,
            "clean_now_threshold_kwh": round(clean_threshold_kwh, 2),
            "water_per_wash_L": water_per_wash,
            "fixed_interval_days": 14,
            "total_simulated_days": len(daily_records)
        },
        "fixed_policy": {
            "cleanings_count": fixed_cleanings,
            "water_used_L": fixed_water_used,
            "energy_lost_kWh": round(fixed_tot_lost, 1),
            "total_cleaning_cost": round(fixed_cleanings * cleaning_cost, 2),
            "total_cost_with_energy": round(fixed_cleanings * cleaning_cost + fixed_tot_lost * tariff_kwh, 2)
        },
        "condition_based_policy": {
            "cleanings_count": smart_cleanings,
            "water_used_L": smart_water_used,
            "energy_lost_kWh": round(smart_tot_lost, 1),
            "total_cleaning_cost": round(smart_cleanings * cleaning_cost, 2),
            "total_cost_with_energy": round(smart_cleanings * cleaning_cost + smart_tot_lost * tariff_kwh, 2)
        },
        "comparison": {
            "cleanings_avoided": fixed_cleanings - smart_cleanings,
            "water_saved_scenario_L": water_saved_scenario,
            "cost_difference": round((fixed_cleanings - smart_cleanings) * cleaning_cost, 2),
            "water_saved_label": "scenario estimate based on avoided wash cycles"
        },
        "daily_timeseries": daily_timeseries
    }

    # Save to JSON
    json_path = MODELS_DIR / 'policy_comparison.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(simulation_result, f, indent=2)

    # Save text report
    report_path = BASE_DIR / 'policy_comparison_report.txt'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("SOLAR AI MONITORING SYSTEM — POLICY SIMULATION REPORT\n")
        f.write("=" * 65 + "\n")
        f.write(f"Disclaimer: {simulation_result['disclaimer']}\n\n")
        f.write(f"Site Evaluated: {target_site_id}\n")
        f.write(f"Simulated Duration: {len(daily_records)} days\n")
        f.write(f"Parameters: Tariff = {tariff_kwh} / kWh, Cleaning Cost = {cleaning_cost}, Water = {water_per_wash} L/wash\n")
        f.write("-" * 65 + "\n")
        f.write(f"Fixed 14-Day Schedule:\n")
        f.write(f"  - Total Cleanings: {fixed_cleanings}\n")
        f.write(f"  - Total Water Used: {fixed_water_used:,.1f} L\n")
        f.write(f"  - Energy Lost: {fixed_tot_lost:,.1f} kWh\n")
        f.write(f"  - Total Cost (Washes + Lost Energy): {simulation_result['fixed_policy']['total_cost_with_energy']:,.2f}\n\n")
        f.write(f"Condition-Based (Smart) Rule:\n")
        f.write(f"  - Total Cleanings: {smart_cleanings}\n")
        f.write(f"  - Total Water Used: {smart_water_used:,.1f} L\n")
        f.write(f"  - Energy Lost: {smart_tot_lost:,.1f} kWh\n")
        f.write(f"  - Total Cost (Washes + Lost Energy): {simulation_result['condition_based_policy']['total_cost_with_energy']:,.2f}\n\n")
        f.write(f"Scenario Comparison:\n")
        f.write(f"  - Avoided Washes: {fixed_cleanings - smart_cleanings}\n")
        f.write(f"  - Estimated Water Saved: {water_saved_scenario:,.1f} L ({simulation_result['comparison']['water_saved_label']})\n")
        f.write("=" * 65 + "\n")

    print(f"Policy simulation complete. Saved report to {report_path} and JSON to {json_path}")
    return simulation_result

if __name__ == '__main__':
    run_simulation()
