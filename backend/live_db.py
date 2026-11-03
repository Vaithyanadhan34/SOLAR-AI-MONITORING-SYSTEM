import os
import json
import sqlite3
import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import pandas as pd

DB_PATH = Path(__file__).resolve().parent / 'live_data.db'

def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    try:
        with conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS live_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                site_id TEXT NOT NULL,
                campus_key INTEGER NOT NULL,
                site_key INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                actual_kw REAL NOT NULL,
                expected_kw REAL NOT NULL,
                weather_used TEXT,
                source TEXT NOT NULL DEFAULT 'manual_save',
                grade TEXT,
                status TEXT,
                shortfall_kw REAL DEFAULT 0.0,
                excess_kw REAL DEFAULT 0.0,
                lost_kwh REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(site_id, timestamp)
            )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_live_site_time ON live_readings(site_id, timestamp)")
    finally:
        conn.close()

def save_reading(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves or replaces a single 2026 live reading in SQLite.
    """
    init_db()
    conn = get_connection()
    try:
        site_id = str(data.get('site_id', 'site-1'))
        campus_key = int(data.get('campus_key', 2))
        site_key = int(data.get('site_key', 1))
        timestamp = str(data.get('timestamp', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))).replace('T', ' ')
        actual_kw = max(0.0, float(data.get('actual_kw', data.get('SolarGeneration', 0.0))))
        expected_kw = max(0.0, float(data.get('expected_kw', actual_kw)))
        weather_used = data.get('weather_used')
        if isinstance(weather_used, dict):
            weather_json = json.dumps(weather_used)
        elif isinstance(weather_used, str):
            weather_json = weather_used
        else:
            weather_json = json.dumps({
                "temperature": data.get('AirTemperature'),
                "humidity": data.get('RelativeHumidity'),
                "wind_speed": data.get('WindSpeed'),
                "shortwave_radiation": data.get('shortwave_radiation')
            })

        source = str(data.get('source', 'manual_save'))
        grade = str(data.get('grade', 'Normal'))
        status = str(data.get('status', 'Normal'))
        shortfall_kw = max(0.0, float(data.get('shortfall_kW', data.get('shortfall_kw', max(0.0, expected_kw - actual_kw)))))
        excess_kw = max(0.0, float(data.get('excess_kW', data.get('excess_kw', max(0.0, actual_kw - expected_kw)))))
        lost_kwh = max(0.0, float(data.get('lost_kWh', data.get('lost_kwh', shortfall_kw * 0.5))))

        with conn:
            conn.execute("""
                INSERT INTO live_readings (
                    site_id, campus_key, site_key, timestamp, actual_kw, expected_kw,
                    weather_used, source, grade, status, shortfall_kw, excess_kw, lost_kwh
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(site_id, timestamp) DO UPDATE SET
                    actual_kw=excluded.actual_kw,
                    expected_kw=excluded.expected_kw,
                    weather_used=excluded.weather_used,
                    source=excluded.source,
                    grade=excluded.grade,
                    status=excluded.status,
                    shortfall_kw=excluded.shortfall_kw,
                    excess_kw=excluded.excess_kw,
                    lost_kwh=excluded.lost_kwh
            """, (
                site_id, campus_key, site_key, timestamp, actual_kw, expected_kw,
                weather_json, source, grade, status, shortfall_kw, excess_kw, lost_kwh
            ))

        return {
            "success": True,
            "saved": True,
            "site_id": site_id,
            "timestamp": timestamp,
            "actual_kw": actual_kw,
            "expected_kw": expected_kw
        }
    finally:
        conn.close()

def get_readings(site_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 1000) -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    try:
        query = "SELECT * FROM live_readings WHERE site_id = ?"
        params: List[Any] = [site_id]
        if start_date:
            query += " AND timestamp >= ?"
            params.append(f"{start_date} 00:00:00")
        if end_date:
            query += " AND timestamp <= ?"
            params.append(f"{end_date} 23:59:59")
        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        cur = conn.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            if r.get('weather_used'):
                try:
                    r['weather_used'] = json.loads(r['weather_used'])
                except Exception:
                    pass
        return rows
    finally:
        conn.close()

def get_stats() -> Dict[str, Any]:
    init_db()
    conn = get_connection()
    try:
        cur = conn.execute("SELECT site_id, COUNT(*) as count, MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM live_readings GROUP BY site_id")
        per_site = {}
        total = 0
        for r in cur.fetchall():
            per_site[r['site_id']] = {
                "count": r['count'],
                "min_timestamp": r['min_ts'],
                "max_timestamp": r['max_ts']
            }
            total += r['count']
        return {
            "total_readings": total,
            "sites": per_site
        }
    finally:
        conn.close()

def import_csv_readings(df: pd.DataFrame, site_id: str, campus_key: int, site_key: int, capacity_kwp: float) -> Dict[str, Any]:
    """
    Validates and imports CSV rows into live_readings table.
    Row-level validation checks:
      1. Valid parseable timestamp
      2. Non-negative actual_kw
      3. actual_kw <= 1.2 * capacity_kwp
    """
    init_db()
    total_rows = len(df)
    valid_records = []
    rejected_rows = []

    # Identify timestamp and generation columns case-insensitively
    col_map = {str(c).lower().replace('_', '').replace(' ', ''): c for c in df.columns}
    time_col = None
    for target in ['timestamp', 'datetime', 'time', 'date']:
        if target in col_map:
            time_col = col_map[target]
            break

    gen_col = None
    for target in ['actualkw', 'actualgeneration', 'solargeneration', 'powerkw', 'actual', 'generation', 'power', 'gen']:
        if target in col_map:
            gen_col = col_map[target]
            break

    if not time_col or not gen_col:
        return {
            "success": False,
            "error": f"CSV must contain a timestamp column (e.g. 'Timestamp') and generation column (e.g. 'SolarGeneration' or 'actual_kW'). Found: {list(df.columns)}"
        }

    for idx, row in df.iterrows():
        raw_ts = row[time_col]
        raw_gen = row[gen_col]

        # 1. Parse timestamp
        try:
            ts = pd.to_datetime(str(raw_ts).replace('T', ' '))
            ts_str = ts.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            rejected_rows.append({"row": int(idx) + 1, "reason": f"Invalid timestamp format: {raw_ts}"})
            continue

        # 2. Parse generation
        try:
            gen = float(raw_gen)
        except (ValueError, TypeError):
            rejected_rows.append({"row": int(idx) + 1, "reason": f"Non-numeric generation value: {raw_gen}"})
            continue

        # 3. Non-negative check
        if gen < 0.0:
            rejected_rows.append({"row": int(idx) + 1, "reason": f"Negative generation value: {gen} kW"})
            continue

        # 4. Over-capacity check
        if gen > (1.2 * capacity_kwp):
            rejected_rows.append({"row": int(idx) + 1, "reason": f"Generation ({gen:.2f} kW) exceeds 1.2x site capacity ({capacity_kwp} kWp)"})
            continue

        # Optional weather attributes if present in CSV
        temp = float(row.get('AirTemperature', row.get('temperature', 30.0))) if pd.notnull(row.get('AirTemperature', row.get('temperature'))) else 30.0
        hum = float(row.get('RelativeHumidity', row.get('humidity', 50.0))) if pd.notnull(row.get('RelativeHumidity', row.get('humidity'))) else 50.0
        wind = float(row.get('WindSpeed', row.get('wind_speed', 3.0))) if pd.notnull(row.get('WindSpeed', row.get('wind_speed'))) else 3.0
        irr = float(row.get('shortwave_radiation', row.get('irradiance', 0.0))) if pd.notnull(row.get('shortwave_radiation', row.get('irradiance'))) else 0.0

        w_json = json.dumps({
            "temperature": temp,
            "humidity": hum,
            "wind_speed": wind,
            "shortwave_radiation": irr
        })

        valid_records.append((
            site_id, campus_key, site_key, ts_str, gen, gen, w_json, "csv_upload", "Normal", "Normal", 0.0, 0.0, 0.0
        ))

    conn = get_connection()
    inserted_count = 0
    try:
        with conn:
            for rec in valid_records:
                conn.execute("""
                    INSERT INTO live_readings (
                        site_id, campus_key, site_key, timestamp, actual_kw, expected_kw,
                        weather_used, source, grade, status, shortfall_kw, excess_kw, lost_kwh
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(site_id, timestamp) DO UPDATE SET
                        actual_kw=excluded.actual_kw,
                        expected_kw=excluded.expected_kw,
                        weather_used=excluded.weather_used,
                        source=excluded.source
                """, rec)
                inserted_count += 1
    finally:
        conn.close()

    return {
        "success": True,
        "total_rows": total_rows,
        "imported_rows": inserted_count,
        "valid_rows": inserted_count,
        "skipped_rows": len(rejected_rows),
        "rejected_rows_count": len(rejected_rows),
        "rejected_rows": rejected_rows[:50],
        "message": f"Successfully imported {inserted_count} rows ({len(rejected_rows)} rows skipped)."
    }

if __name__ == '__main__':
    init_db()
    print("live_data.db initialized successfully at", DB_PATH)
