import os
import json
from pathlib import Path
import pandas as pd
import sys
sys.path.insert(0, 'backend')
from app import SITE_METADATA, resolve_site_info
import data_access

print("=== DIAGNOSIS OF UPLOADS & SITE KEYS ===")
uploads_dir = Path('backend/data/uploads')
print(f"(a) Uploads directory exists: {uploads_dir.exists()}")
if uploads_dir.exists():
    files = list(uploads_dir.glob('*.csv'))
    print(f"    CSV files found: {[f.name for f in files]}")
    for f in files:
        df = pd.read_csv(f)
        min_ts = df['ts'].min() if ('ts' in df.columns and len(df) > 0) else 'None'
        max_ts = df['ts'].max() if ('ts' in df.columns and len(df) > 0) else 'None'
        print(f"    File {f.name}: {len(df)} rows, Date range: {min_ts} to {max_ts}")

batches_file = uploads_dir / 'batches.json'
print(f"(b) batches.json exists: {batches_file.exists()}")
if batches_file.exists():
    try:
        with open(batches_file, 'r', encoding='utf-8') as bf:
            batches = json.load(bf)
        print(f"    Batches listed: {len(batches)}")
        for b in batches:
            print("   ", b)
    except Exception as e:
        print("    Error reading batches.json:", e)

print("(d) Site keys in SITE_METADATA:")
for k, v in SITE_METADATA.items():
    print(f"    tuple={k} -> id={v.get('id')}, name={v.get('name')}")

print("\n(e) Inspecting get_merged_site_data for site-1:")
s1_data = data_access.get_merged_site_data('site-1')
print(f"    row_count: {s1_data.get('row_count')}, uploaded_count: {s1_data.get('uploaded_count')}")
print(f"    start_date: {s1_data.get('start_date')}, end_date: {s1_data.get('end_date')}")
print(f"    start_timestamp: {s1_data.get('start_timestamp')}, end_timestamp: {s1_data.get('end_timestamp')}")

