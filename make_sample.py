"""
make_sample.py
Builds backend/models/sample_history.csv (10,000 rows for one site) from
backend/models/maintenance_analysis_results.csv so the repository can be tested
and run without the full 238MB dataset.
"""

import os
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent

def build_sample():
    candidates = [
        BASE_DIR / 'backend' / 'models' / 'maintenance_analysis_results.csv',
        BASE_DIR / 'models' / 'maintenance_analysis_results.csv',
        BASE_DIR / 'maintenance_analysis_results.csv',
    ]

    source_path = None
    for p in candidates:
        if p.is_file():
            source_path = p
            break

    if not source_path:
        raise FileNotFoundError("Could not find maintenance_analysis_results.csv in expected locations.")

    print(f"Reading source file from: {source_path}")
    # Read one site with 10,000 records
    # Site 1 (Campus 2) is the primary reference site
    chunks = []
    rows_collected = 0
    target_campus = 2
    target_site = 1

    chunk_size = 50000
    for chunk in pd.read_csv(source_path, chunksize=chunk_size):
        filtered = chunk[(chunk['CampusKey'] == target_campus) & (chunk['SiteKey'] == target_site)]
        if not filtered.empty:
            needed = 10000 - rows_collected
            chunks.append(filtered.head(needed))
            rows_collected += len(chunks[-1])
            if rows_collected >= 10000:
                break

    if not chunks:
        raise RuntimeError("No records found for CampusKey=2, SiteKey=1.")

    sample_df = pd.concat(chunks, ignore_index=True)
    sample_df['Timestamp'] = pd.to_datetime(sample_df['Timestamp'])
    sample_df = sample_df.sort_values('Timestamp').reset_index(drop=True)

    output_dir = BASE_DIR / 'backend' / 'models'
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / 'sample_history.csv'

    sample_df.to_csv(output_path, index=False)
    print(f"Successfully generated {len(sample_df):,} rows in {output_path}")
    print(f"Date range: {sample_df['Timestamp'].min()} to {sample_df['Timestamp'].max()}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")

if __name__ == '__main__':
    build_sample()
