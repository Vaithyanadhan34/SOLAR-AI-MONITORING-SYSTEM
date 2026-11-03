"""
pick_samples.py
Inspects historical maintenance dataset, prints per-site date ranges and row counts,
and outputs 5 real sample rows for testing inference and operational endpoints.
"""

import sys
import os
from pathlib import Path
import pandas as pd
import json

BASE_DIR = Path(__file__).resolve().parent

CSV_CANDIDATES = [
    BASE_DIR / 'backend' / 'models' / 'maintenance_analysis_results.csv',
    BASE_DIR / 'backend' / 'models' / 'sample_history.csv',
    BASE_DIR / 'models' / 'maintenance_analysis_results.csv',
    BASE_DIR / 'maintenance_analysis_results.csv',
]

SITE_METADATA = {
    (2, 1): {"id": "site-1", "name": "Site 1 (Campus 2 — 25 kWp)"},
    (2, 2): {"id": "site-2", "name": "Site 2 (Campus 2 — 20 kWp)"},
    (2, 3): {"id": "site-3", "name": "Site 3 (Campus 2 — 15 kWp)"},
    (3, 11): {"id": "site-4", "name": "Site 11 (Campus 3 — 100 kWp)"},
    (1, 27): {"id": "site-5", "name": "Site 27 (Campus 1 — 100 kWp)"},
}

def main():
    csv_path = None
    for p in CSV_CANDIDATES:
        if p.is_file():
            csv_path = p
            break

    if not csv_path:
        print("ERROR: Maintenance dataset CSV not found in any standard location.")
        sys.exit(1)

    print(f"Reading dataset: {csv_path} ({csv_path.stat().st_size / (1024*1024):.1f} MB)")
    
    # Read sample to detect columns
    sample_df = pd.read_csv(csv_path, nrows=10)
    has_campus = 'CampusKey' in sample_df.columns
    has_site = 'SiteKey' in sample_df.columns
    cols = list(sample_df.columns)
    
    # Load dataset with key columns
    load_cols = [c for c in ['Timestamp', 'CampusKey', 'SiteKey', 'ActualGeneration', 'PredictedGeneration'] if c in cols]
    df = pd.read_csv(csv_path, usecols=load_cols)
    df['Timestamp'] = pd.to_datetime(df['Timestamp'])

    print("\n" + "=" * 70)
    print("PER-SITE DATE RANGES AND COVERAGE")
    print("=" * 70)
    
    for (campus, site), meta in SITE_METADATA.items():
        site_df = df[(df['CampusKey'] == campus) & (df['SiteKey'] == site)]
        if len(site_df) == 0:
            print(f"- {meta['name']} (Campus={campus}, Site={site}): NO DATA")
        else:
            t_min = site_df['Timestamp'].min()
            t_max = site_df['Timestamp'].max()
            print(f"- {meta['name']} [id: {meta['id']}]:")
            print(f"    CampusKey={campus}, SiteKey={site}")
            print(f"    Start: {t_min.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    End:   {t_max.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    Total Readings: {len(site_df):,} rows")

    print("\n" + "=" * 70)
    print("5 REAL SAMPLE ROWS FROM HISTORICAL DATASET")
    print("=" * 70)

    # Read full 5 representative daytime rows with non-zero generation
    full_sample_df = pd.read_csv(csv_path, nrows=5000)
    daytime_samples = full_sample_df[full_sample_df['ActualGeneration'] > 1.0].head(5)
    
    display_cols = [c for c in [
        'Timestamp', 'CampusKey', 'SiteKey', 'ActualGeneration', 
        'PredictedGeneration', 'SolarIrradiance', 'Temperature', 'WindSpeed'
    ] if c in daytime_samples.columns]
    
    if len(display_cols) < 4:
        display_cols = list(full_sample_df.columns[:8])

    print(daytime_samples[display_cols].to_string(index=False))
    print("\nJSON Format (for endpoint testing):")
    samples_records = daytime_samples[display_cols].to_dict(orient='records')
    print(json.dumps(samples_records, indent=2, default=str))

if __name__ == '__main__':
    main()
