import os
import json
import time
import uuid
import datetime
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / 'data' / 'uploads'
BATCHES_FILE = UPLOADS_DIR / 'batches.json'

_LOCK = threading.Lock()
_CACHE: Dict[str, Dict[str, Any]] = {}

def ensure_upload_dirs():
    """Creates backend/data/uploads directory if not present."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    if not BATCHES_FILE.exists():
        with _LOCK:
            if not BATCHES_FILE.exists():
                tmp_path = UPLOADS_DIR / f"batches_{uuid.uuid4().hex[:6]}.tmp"
                with open(tmp_path, 'w', encoding='utf-8') as f:
                    json.dump([], f, indent=2)
                tmp_path.replace(BATCHES_FILE)

ensure_upload_dirs()

def normalize_site_key(site: Any) -> str:
    """Normalizes any site identifier (tuple, int, string) to 'site-X'."""
    if isinstance(site, tuple) and len(site) == 2:
        # CampusKey, SiteKey
        ck, sk = int(site[0]), int(site[1])
        # Known mapping
        from app import SITE_METADATA  # lazy import
        if (ck, sk) in SITE_METADATA:
            return str(SITE_METADATA[(ck, sk)].get('id', f"site-{sk}"))
        return f"site-{sk}"

    s = str(site).strip().lower()
    if s.isdigit():
        return f"site-{s}"
    s = s.replace('_', '-')
    if not s.startswith('site-'):
        s = f"site-{s}"
    return s

def _get_site_csv_path(site_key: str) -> Path:
    norm_key = normalize_site_key(site_key)
    return UPLOADS_DIR / f"{norm_key}.csv"

def get_batches() -> List[Dict[str, Any]]:
    """Returns the list of uploaded batches from batches.json."""
    ensure_upload_dirs()
    if not BATCHES_FILE.exists():
        return []
    try:
        with open(BATCHES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading batches.json: {e}")
        return []

def _save_batches(batches: List[Dict[str, Any]]):
    """Atomically writes batches.json under lock."""
    ensure_upload_dirs()
    tmp_path = UPLOADS_DIR / f"batches_{uuid.uuid4().hex[:6]}.tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(batches, f, indent=2)
    os.replace(tmp_path, BATCHES_FILE)

def save_uploaded_rows(site_id: str, rows: List[Dict[str, Any]], batch_meta: Dict[str, Any]) -> Dict[str, Any]:
    """
    Atomically merges new uploaded rows into backend/data/uploads/<site_key>.csv.
    Newest upload wins on duplicate (site, ts). Sorted by ts.
    """
    ensure_upload_dirs()
    norm_key = normalize_site_key(site_id)
    csv_path = _get_site_csv_path(norm_key)

    cols = ['ts', 'actual_kW', 'temp', 'humidity', 'wind', 'expected_kW', 'source', 'batch_id']
    new_df = pd.DataFrame(rows)
    for c in cols:
        if c not in new_df.columns:
            new_df[c] = None
    new_df = new_df[cols]
    new_df['ts'] = pd.to_datetime(new_df['ts']).dt.strftime('%Y-%m-%d %H:%M:%S')

    with _LOCK:
        if csv_path.exists() and csv_path.stat().st_size > 0:
            try:
                existing_df = pd.read_csv(csv_path)
                if len(existing_df) == 0:
                    combined = new_df
                elif len(new_df) == 0:
                    combined = existing_df
                else:
                    combined = pd.concat([existing_df, new_df], ignore_index=True)
            except Exception as e:
                logger.warning(f"Could not read existing CSV {csv_path}: {e}; overwriting with new upload.")
                combined = new_df
        else:
            combined = new_df

        # Newest upload wins on duplicate (site, ts); sort by ts
        combined = combined.drop_duplicates(subset=['ts'], keep='last')
        combined = combined.sort_values('ts').reset_index(drop=True)

        tmp_csv = UPLOADS_DIR / f"{norm_key}_{uuid.uuid4().hex[:6]}.tmp"
        combined.to_csv(tmp_csv, index=False)
        os.replace(tmp_csv, csv_path)

        # Update batches.json
        batches = get_batches()
        batches.insert(0, batch_meta)
        _save_batches(batches)

        # Invalidate cache
        if norm_key in _CACHE:
            del _CACHE[norm_key]

    return {"success": True, "rows_merged": len(combined)}

def delete_batch(batch_id: str) -> Dict[str, Any]:
    """
    Removes rows matching batch_id from all <site_key>.csv files and updates batches.json.
    """
    ensure_upload_dirs()
    removed_from_batches = False
    with _LOCK:
        batches = get_batches()
        new_batches = [b for b in batches if str(b.get('batch_id')) != str(batch_id)]
        if len(new_batches) < len(batches):
            removed_from_batches = True
            _save_batches(new_batches)

        # Scan all site csvs in UPLOADS_DIR
        for p in UPLOADS_DIR.glob('site-*.csv'):
            try:
                df = pd.read_csv(p)
                if 'batch_id' in df.columns:
                    orig_len = len(df)
                    df = df[df['batch_id'].astype(str) != str(batch_id)]
                    if len(df) < orig_len:
                        tmp_p = UPLOADS_DIR / f"{p.stem}_{uuid.uuid4().hex[:6]}.tmp"
                        df.to_csv(tmp_p, index=False)
                        os.replace(tmp_p, p)
                        s_key = p.stem
                        if s_key in _CACHE:
                            del _CACHE[s_key]
            except Exception as e:
                logger.error(f"Error filtering batch {batch_id} from {p}: {e}")

    return {"success": True, "batch_id": batch_id, "removed": removed_from_batches}

def get_merged_site_data(site: Any) -> Dict[str, Any]:
    """
    Merges historical baseline from HISTORY_INDEX with uploaded rows from <site_key>.csv.
    Uploaded rows take precedence on duplicate timestamp (uploaded wins on clash).
    Cached per site; invalidates automatically when uploaded file mtime changes.
    """
    import app as backend_app
    norm_key = normalize_site_key(site)
    csv_path = _get_site_csv_path(norm_key)

    mtime = csv_path.stat().st_mtime if csv_path.exists() else None

    # Check cache
    cached = _CACHE.get(norm_key)
    if cached and cached.get('mtime') == mtime:
        return cached['data']

    # Retrieve base historical index
    ck, sk = 2, 1
    for (c, s), m in backend_app.SITE_METADATA.items():
        if m.get('id') == norm_key:
            ck, sk = c, s
            break
    key = (ck, sk)

    hist_data = backend_app.HISTORY_INDEX.get(key, {})
    hist_times = hist_data.get('times', np.array([]))
    hist_actuals = hist_data.get('actuals', np.array([]))
    hist_expecteds = hist_data.get('expecteds', np.array([]))

    # Convert historical to DataFrame
    if len(hist_times) > 0:
        df_hist = pd.DataFrame({
            'ts': [pd.Timestamp(t).strftime('%Y-%m-%d %H:%M:%S') for t in hist_times],
            'actual_kW': hist_actuals.astype(np.float64),
            'temp': 25.0,
            'humidity': 50.0,
            'wind': 3.0,
            'expected_kW': hist_expecteds.astype(np.float64),
            'source': 'historical',
            'batch_id': ''
        })
    else:
        df_hist = pd.DataFrame(columns=['ts', 'actual_kW', 'temp', 'humidity', 'wind', 'expected_kW', 'source', 'batch_id'])

    # Read uploaded CSV if exists
    if csv_path.exists() and csv_path.stat().st_size > 0:
        try:
            df_up = pd.read_csv(csv_path)
            for c in ['ts', 'actual_kW', 'temp', 'humidity', 'wind', 'expected_kW', 'source', 'batch_id']:
                if c not in df_up.columns:
                    df_up[c] = None
            df_up['source'] = 'uploaded'
            df_up['ts'] = pd.to_datetime(df_up['ts']).dt.strftime('%Y-%m-%d %H:%M:%S')
            if len(df_hist) == 0:
                df_merged = df_up
            elif len(df_up) == 0:
                df_merged = df_hist
            else:
                df_merged = pd.concat([df_hist, df_up], ignore_index=True)
        except Exception as e:
            logger.warning(f"Error reading upload file {csv_path}: {e}")
            df_merged = df_hist
    else:
        df_merged = df_hist

    if len(df_merged) == 0:
        empty_res = {
            'times': np.array([]),
            'actuals': np.array([]),
            'expecteds': np.array([]),
            'sources': np.array([]),
            'temps': np.array([]),
            'humidities': np.array([]),
            'winds': np.array([]),
            'batch_ids': [],
            'start_timestamp': '2020-01-01 08:15:00',
            'end_timestamp': '2022-04-23 23:59:59',
            'start_date': '2020-01-01',
            'end_date': '2022-04-23',
            'row_count': 0,
            'uploaded_count': 0,
            'uploaded_2026_count': 0,
            'uploaded_2026_days': 0,
            'df': df_merged
        }
        _CACHE[norm_key] = {'mtime': mtime, 'data': empty_res}
        return empty_res

    # Uploaded wins on duplicate timestamp
    df_merged = df_merged.drop_duplicates(subset=['ts'], keep='last')
    df_merged = df_merged.sort_values('ts').reset_index(drop=True)

    times_dt = pd.to_datetime(df_merged['ts'])
    times_arr = np.array([np.datetime64(t) for t in times_dt])
    act_arr = df_merged['actual_kW'].to_numpy(dtype=np.float64)
    exp_arr = df_merged['expected_kW'].to_numpy(dtype=np.float64)
    sources_arr = df_merged['source'].to_numpy()
    temps_arr = df_merged['temp'].fillna(25.0).to_numpy(dtype=np.float64)
    hums_arr = df_merged['humidity'].fillna(50.0).to_numpy(dtype=np.float64)
    winds_arr = df_merged['wind'].fillna(3.0).to_numpy(dtype=np.float64)
    batch_ids = df_merged['batch_id'].fillna('').tolist()

    s_min_ts = str(df_merged['ts'].iloc[0])
    s_max_ts = str(df_merged['ts'].iloc[-1])
    s_min_d = s_min_ts[:10]
    s_max_d = s_max_ts[:10]

    up_mask = (sources_arr == 'uploaded')
    up_count = int(np.sum(up_mask))
    df_up_only = df_merged[up_mask]
    df_2026 = df_up_only[df_up_only['ts'].str.startswith('2026')]
    up_2026_count = len(df_2026)
    up_2026_days = int(df_2026['ts'].str.slice(0, 10).nunique()) if up_2026_count > 0 else 0

    if up_count > 0:
        up_min_d = str(df_up_only['ts'].iloc[0])[:10]
        up_max_d = str(df_up_only['ts'].iloc[-1])[:10]
        uploaded_range = f"{up_min_d} to {up_max_d}"
    else:
        up_min_d = None
        up_max_d = None
        uploaded_range = None

    available_dates = sorted(list(set(df_merged['ts'].str.slice(0, 10).dropna().tolist())))

    merged_data = {
        'times': times_arr,
        'actuals': act_arr,
        'expecteds': exp_arr,
        'sources': sources_arr,
        'temps': temps_arr,
        'humidities': hums_arr,
        'winds': winds_arr,
        'batch_ids': batch_ids,
        'start_timestamp': s_min_ts,
        'end_timestamp': s_max_ts,
        'start_date': s_min_d,
        'end_date': s_max_d,
        'available_dates': available_dates,
        'row_count': len(df_merged),
        'uploaded_count': up_count,
        'uploaded_2026_count': up_2026_count,
        'uploaded_2026_days': up_2026_days,
        'uploaded_date_min': up_min_d,
        'uploaded_date_max': up_max_d,
        'uploaded_range': uploaded_range,
        'df': df_merged
    }

    _CACHE[norm_key] = {'mtime': mtime, 'data': merged_data}
    return merged_data

def get_series(site: Any, start: Optional[Any] = None, end: Optional[Any] = None) -> pd.DataFrame:
    """
    Returns historical data MERGED with uploaded CSV (uploaded wins on clash),
    each row tagged source 'historical' or 'uploaded'.
    Filters between start and end if provided.
    """
    data = get_merged_site_data(site)
    df = data['df'].copy()
    if df.empty:
        return df

    if start:
        s_str = str(start).replace('T', ' ')
        df = df[df['ts'] >= s_str]
    if end:
        e_str = str(end).replace('T', ' ')
        df = df[df['ts'] <= e_str]

    return df.reset_index(drop=True)

def lookup_history(campus_key: int, site_key: int, dt_input: Any) -> Optional[Dict[str, Any]]:
    """
    Finds the previous generation and operational lags (30 min, 1 h, 2 h) automatically
    for the chosen site and timestamp from the merged data layer.
    """
    site_data = get_merged_site_data((campus_key, site_key))
    times = site_data['times']
    actuals = site_data['actuals']
    expecteds = site_data['expecteds']
    sources = site_data['sources']

    if len(times) == 0:
        return None

    try:
        clean_ts = str(dt_input).replace('T', ' ')
        target_dt = pd.to_datetime(clean_ts)
    except Exception:
        return None

    target_np = np.datetime64(target_dt)
    pos = np.searchsorted(times, target_np)

    if pos == 0:
        return None

    if pos >= len(times):
        diff_hours = (target_np - times[-1]) / np.timedelta64(1, 'h')
        if diff_hours > 24:
            return None
        pos = len(times)

    prev_idx = pos - 1
    prev_time = pd.Timestamp(times[prev_idx]).strftime('%Y-%m-%d %H:%M:%S')
    prev_val = float(actuals[prev_idx])
    prev_source = str(sources[prev_idx])

    def get_lag_val(minutes):
        lag_target = target_np - np.timedelta64(minutes, 'm')
        lp = np.searchsorted(times, lag_target)
        if lp < len(times) and times[lp] == lag_target:
            return float(actuals[lp])
        elif lp > 0:
            return float(actuals[lp - 1])
        return prev_val

    lag_30m = get_lag_val(30)
    lag_1h = get_lag_val(60)
    lag_2h = get_lag_val(120)

    exact_idx = pos if (pos < len(times) and times[pos] == target_np) else None
    if exact_idx is None and pos < len(times) and (times[pos] - target_np) / np.timedelta64(1, 'm') <= 15:
        exact_idx = pos
    elif exact_idx is None and pos > 0 and (target_np - times[pos - 1]) / np.timedelta64(1, 'm') <= 15:
        exact_idx = pos - 1

    hist_expected = float(expecteds[exact_idx]) if exact_idx is not None else None

    return {
        'previous_value': round(prev_val, 3),
        'previous_timestamp': prev_time,
        'previous_source': prev_source,
        'lag_30min': round(lag_30m, 3),
        'lag_1hour': round(lag_1h, 3),
        'lag_2hour': round(lag_2h, 3),
        'historical_expected': round(hist_expected, 3) if hist_expected is not None else None
    }

def get_upload_stats() -> Dict[str, Any]:
    """Returns counts of saved/uploaded 2026 readings per site."""
    from app import SITE_METADATA
    stats = {}
    total_all = 0
    total_2026 = 0
    for (ck, sk), m in SITE_METADATA.items():
        s_id = m['id']
        data = get_merged_site_data(s_id)
        stats[s_id] = {
            "name": m['name'],
            "total_uploaded": data['uploaded_count'],
            "uploaded_2026": data['uploaded_2026_count'],
            "uploaded_2026_days": data['uploaded_2026_days'],
            "date_range": {
                "start": data['start_date'],
                "end": data['end_date']
            }
        }
        total_all += data['uploaded_count']
        total_2026 += data['uploaded_2026_count']

    return {
        "sites": stats,
        "total_uploaded_rows": total_all,
        "total_2026_rows": total_2026,
        "batches_count": len(get_batches())
    }

def get_evaluation_status(site_val: str) -> Dict[str, Any]:
    """
    Evaluates 14-day progress using merged uploaded readings (no SQLite).
    """
    data = get_merged_site_data(site_val)
    days_collected = data['uploaded_2026_days']
    total_readings = data['uploaded_2026_count']

    ready = (days_collected >= 14)
    message = (
        f"Evaluation Ready: {days_collected} of 14 days collected"
        if ready
        else f"Collecting data: {days_collected} of 14 days"
    )
    return {
        "site": site_val,
        "ready": ready,
        "days_collected": days_collected,
        "required_days": 14,
        "total_daytime_readings": total_readings,
        "message": message,
        "storage": "Local files (backend/data/uploads)"
    }
