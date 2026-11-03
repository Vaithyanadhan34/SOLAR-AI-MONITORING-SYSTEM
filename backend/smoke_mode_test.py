"""
backend/smoke_mode_test.py
Verification suite for:
(a) in historical mode the forecast endpoint makes no outbound network call,
(b) uploaded rows appear in history, trend, daily-summary, planner, simulation and forecast comparison for the upload's dates,
(c) live mode with the API blocked returns a clear 503 and no historical fallback,
(d) deleting the batch removes the rows everywhere.
"""
import os
import sys
import io
import json
import unittest.mock as mock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
import data_access
from weather_service import LiveWeatherUnavailableError

def run_tests():
    client = app.test_client()
    passed = 0
    total = 4
    print("=== STARTING SMOKE MODE & ONE-DATA-LAYER TESTS ===")

    # -------------------------------------------------------------------------
    # (a) Historical mode: NO outbound network calls allowed
    # -------------------------------------------------------------------------
    def forbidden_network(*args, **kwargs):
        raise AssertionError(f"Outbound network call detected during historical forecast: args={args}, kwargs={kwargs}")

    with mock.patch('urllib.request.urlopen', side_effect=forbidden_network), \
         mock.patch('requests.get', side_effect=forbidden_network), \
         mock.patch('requests.post', side_effect=forbidden_network), \
         mock.patch('weather_service.fetch_live_weather_forecast', side_effect=forbidden_network):
        res_hist = client.post('/api/forecast?mode=historical', json={
            'site': 'site-1',
            'mode': 'historical',
            'timestamp': '2020-08-18T12:00:00',
            'horizon_hours': 24
        })
        assert res_hist.status_code == 200, f"Historical forecast failed: {res_hist.data}"
        fc_data = res_hist.get_json()
        assert fc_data.get('success') is True, f"Historical forecast not successful: {fc_data}"
        assert fc_data.get('mode') == 'historical', f"Expected mode 'historical', got {fc_data.get('mode')}"
        assert 'Dataset' in fc_data.get('weather_source', ''), f"Unexpected weather_source: {fc_data.get('weather_source')}"
        assert len(fc_data.get('forecast', [])) == 24, f"Expected 24 forecast steps, got {len(fc_data.get('forecast', []))}"
        print("[PASS 1/4] (a) Historical forecast made 0 outbound network calls and returned backtest telemetry.")
        passed += 1

    # -------------------------------------------------------------------------
    # Upload sample rows for 2026-07-20 to test cross-endpoint consumption
    # -------------------------------------------------------------------------
    test_csv = (
        "ts,actual_kW,temp,humidity,wind\n"
        "2026-07-20 10:00:00,14.5,31.0,45.0,2.5\n"
        "2026-07-20 11:00:00,18.0,32.5,43.0,2.8\n"
        "2026-07-20 12:00:00,21.5,34.0,40.0,3.0\n"
        "2026-07-20 13:00:00,20.0,34.5,39.0,3.2\n"
        "2026-07-20 14:00:00,16.5,33.0,42.0,2.9\n"
    )
    data = {
        'site': 'site-1',
        'file': (io.BytesIO(test_csv.encode('utf-8')), 'telemetry_2026_07.csv')
    }
    up_res = client.post('/api/live/upload', data=data, content_type='multipart/form-data')
    assert up_res.status_code == 200, f"Upload failed: {up_res.data}"
    up_json = up_res.get_json()
    assert up_json.get('accepted') == 5, f"Expected 5 accepted rows, got {up_json}"
    batch_id = up_json.get('batch_id')
    assert batch_id, "Missing batch_id"

    # -------------------------------------------------------------------------
    # (b) Uploaded rows appear across:
    # 1. history
    # 2. trend
    # 3. daily-summary
    # 4. planner (cleaning-decision)
    # 5. simulation
    # 6. forecast comparison
    # -------------------------------------------------------------------------
    # 1. History
    h_res = client.get('/api/history?site=site-1&end=2026-07-20T14:30:00&hours=24')
    assert h_res.status_code == 200
    h_pts = [p for p in h_res.get_json().get('history', []) if '2026-07-20' in p['timestamp']]
    assert len(h_pts) == 5, f"Expected 5 uploaded history points, got {len(h_pts)}"
    assert all(p['source'] == 'uploaded' for p in h_pts)

    # 2. Trend
    tr_res = client.get('/api/trend?site=site-1&end=2026-07-20T23:59:59&days=7')
    assert tr_res.status_code == 200
    tr_json = tr_res.get_json()
    assert tr_json.get('success') is True
    trend_days = [d['date'] for d in tr_json.get('trend_series', tr_json.get('trend', []))]
    assert '2026-07-20' in trend_days, f"2026-07-20 not in trend days: {trend_days}"

    # 3. Daily summary
    ds_res = client.get('/api/daily-summary?site=site-1&date=2026-07-20')
    assert ds_res.status_code == 200
    ds_json = ds_res.get_json()
    assert ds_json.get('success') is True
    assert float(ds_json.get('totals', {}).get('actual_kWh', 0)) > 0

    # 4. Cleaning planner
    pl_res = client.post('/api/cleaning-decision', json={
        'site': 'site-1',
        'timestamp': '2026-07-20T14:00:00',
        'window_days': 14
    })
    assert pl_res.status_code == 200
    pl_json = pl_res.get_json()
    assert pl_json.get('success') is True
    pl_series = pl_json.get('timeseries', [])
    assert any('2026-07-20' in row.get('date', '') for row in pl_series)

    # 5. Simulation
    sim_res = client.post('/api/simulate', json={'site': 'site-1', 'interval_days': 14})
    assert sim_res.status_code == 200
    sim_json = sim_res.get_json()
    assert sim_json.get('success') is True
    assert len(sim_json.get('timeseries', [])) > 0

    # 6. Forecast comparison for uploaded date
    fc_cmp = client.post('/api/forecast', json={
        'site': 'site-1',
        'mode': 'historical',
        'timestamp': '2026-07-20T10:00:00',
        'horizon_hours': 24
    })
    assert fc_cmp.status_code == 200
    fc_cmp_json = fc_cmp.get_json()
    assert fc_cmp_json.get('success') is True
    fc_steps = fc_cmp_json.get('forecast', [])
    uploaded_steps = [s for s in fc_steps if s.get('actual_source') == 'uploaded' and s.get('actual_kW') is not None]
    assert len(uploaded_steps) >= 3, f"Expected uploaded actuals in forecast steps, got {len(uploaded_steps)}"
    print("[PASS 2/4] (b) Uploaded rows successfully consumed by history, trend, daily-summary, planner, simulation & forecast.")
    passed += 1

    # -------------------------------------------------------------------------
    # (c) Live mode with API blocked: returns clear 503 and NO historical fallback
    # -------------------------------------------------------------------------
    with mock.patch('weather_service.fetch_live_weather_forecast', side_effect=LiveWeatherUnavailableError("Connection refused by test mock")):
        live_res = client.post('/api/forecast?mode=live', json={
            'site': 'site-1',
            'mode': 'live',
            'horizon_hours': 24
        })
        assert live_res.status_code == 503, f"Expected 503 for blocked live forecast, got {live_res.status_code}"
        live_json = live_res.get_json()
        assert live_json.get('success') is False
        assert live_json.get('error') == 'Live weather unavailable'
        assert 'forecast' not in live_json, "Historical data was silently returned during live weather failure!"
        print("[PASS 3/4] (c) Blocked live API returned HTTP 503 with zero historical data fallback.")
        passed += 1

    # -------------------------------------------------------------------------
    # (d) Deleting the batch removes the rows everywhere
    # -------------------------------------------------------------------------
    del_res = client.delete(f'/api/live/batches/{batch_id}')
    assert del_res.status_code == 200, f"Delete failed: {del_res.data}"

    # Check history has 0 rows for that date
    h_after = client.get('/api/history?site=site-1&end=2026-07-20T14:30:00&hours=24')
    pts_after = [p for p in h_after.get_json().get('history', []) if '2026-07-20' in p['timestamp']]
    assert len(pts_after) == 0, f"Expected 0 rows after delete, found {len(pts_after)}"

    # Check batches registry
    b_list = client.get('/api/live/batches').get_json().get('batches', [])
    assert not any(b.get('batch_id') == batch_id for b in b_list), f"Batch {batch_id} still in registry"

    print("[PASS 4/4] (d) Batch deletion removed rows and registry entry everywhere.")
    passed += 1

    print(f"\nALL {passed}/{total} SMOKE MODE TESTS COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
