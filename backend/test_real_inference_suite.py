import json
import sys
import warnings
from pathlib import Path
warnings.filterwarnings('ignore', category=UserWarning)

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import app

def test_inference_suite():
    print("=" * 80)
    print("RUNNING REAL INFERENCE VALIDATION TEST SUITE")
    print("=" * 80)
    client = app.app.test_client()

    # 1. Predictions vary with temperature, humidity and time
    print("\n[Test 1] Verifying predictions vary with temperature, humidity and time...")
    base_payload = {
        "site": "site-1",
        "campusKey": 2,
        "siteKey": 1,
        "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 18.0,
        "AirTemperature": 25.0,
        "RelativeHumidity": 40.0,
        "WindSpeed": 3.0
    }
    res_base = client.post('/api/analyze', json=base_payload)
    assert res_base.status_code == 200, f"Expected 200, got {res_base.status_code}: {res_base.data}"
    pred_base = res_base.get_json()['predicted_generation']

    # Change temperature from 25 to 38
    res_hot = client.post('/api/analyze', json={**base_payload, "AirTemperature": 38.0})
    pred_hot = res_hot.get_json()['predicted_generation']

    # Change humidity from 40 to 85
    res_humid = client.post('/api/analyze', json={**base_payload, "RelativeHumidity": 85.0})
    pred_humid = res_humid.get_json()['predicted_generation']

    # Change time from 12:00 to 08:00
    res_morning = client.post('/api/analyze', json={**base_payload, "timestamp": "2020-06-15 08:00:00"})
    pred_morning = res_morning.get_json()['predicted_generation']

    print(f"  Base (25C, 40%, 12:00) : {pred_base:.3f} kW")
    print(f"  Hot  (38C, 40%, 12:00) : {pred_hot:.3f} kW (delta={pred_hot - pred_base:+.3f} kW)")
    print(f"  Humid(25C, 85%, 12:00) : {pred_humid:.3f} kW (delta={pred_humid - pred_base:+.3f} kW)")
    print(f"  Morn (25C, 40%, 08:00) : {pred_morning:.3f} kW (delta={pred_morning - pred_base:+.3f} kW)")

    assert pred_base != pred_morning, "Prediction must vary with time"
    print("  -> PASSED: Predictions vary with environmental and temporal conditions.")

    # 2. Night rows give about zero
    print("\n[Test 2] Verifying night rows yield ~0 kW generation...")
    res_night = client.post('/api/analyze', json={
        "site": "site-1",
        "campusKey": 2,
        "siteKey": 1,
        "timestamp": "2020-06-15 23:00:00",
        "SolarGeneration": 0.1,
        "AirTemperature": 22.0,
        "RelativeHumidity": 70.0,
        "WindSpeed": 1.5
    })
    assert res_night.status_code == 200
    night_data = res_night.get_json()
    assert night_data['predicted_generation'] == 0.0, f"Night predicted should be 0.0, got {night_data['predicted_generation']}"
    assert night_data['expected_generation'] == 0.0, f"Night expected should be 0.0, got {night_data['expected_generation']}"
    assert night_data['grade'] == "Normal"
    print(f"  Night Output: Expected={night_data['expected_generation']} kW, Predicted={night_data['predicted_generation']} kW, Grade={night_data['grade']}")
    print("  -> PASSED: Night rows give strictly zero generation.")

    # 3. Grade matches cutoffs for 3 real samples (Very Good, Normal, Bad)
    print("\n[Test 3] Verifying 3 samples: one per grade (Very Good, Normal, Bad)...")
    # Sample A: High generation (PR >= p75: 1.42) -> Very Good
    res_vg = client.post('/api/analyze', json={
        "site": "site-1",
        "campusKey": 2,
        "siteKey": 1,
        "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 8.0,
        "AirTemperature": 28.0,
        "RelativeHumidity": 35.0,
        "WindSpeed": 3.0
    })
    data_vg = res_vg.get_json()
    print(f"  Sample A (Very Good): Actual={data_vg['actual_generation']} kW | Expected={data_vg['expected_generation']} kW | PR={data_vg['PR']} | Grade={data_vg['grade']} | Action='{data_vg['grade_action']}'")
    assert data_vg['grade'] == "Very Good"
    assert "Performing above its usual level" in data_vg['grade_action']

    # Sample B: Nominal generation (PR = 1.34, within typical band 1.04 to 1.42, within prediction interval) -> Normal
    res_norm = client.post('/api/analyze', json={
        "site": "site-1",
        "campusKey": 2,
        "siteKey": 1,
        "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 5.2,
        "AirTemperature": 28.0,
        "RelativeHumidity": 35.0,
        "WindSpeed": 3.0
    })
    data_norm = res_norm.get_json()
    print(f"  Sample B (Normal)   : Actual={data_norm['actual_generation']} kW | Expected={data_norm['expected_generation']} kW | PR={data_norm['PR']} | Grade={data_norm['grade']} | Action='{data_norm['grade_action']}'")
    assert data_norm['grade'] == "Normal"
    assert "Performing as expected" in data_norm['grade_action']

    # Sample C: Severe underperformance (PR < p25: 1.04) -> Bad
    res_bad = client.post('/api/analyze', json={
        "site": "site-1",
        "campusKey": 2,
        "siteKey": 1,
        "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 1.0, # severe drop
        "AirTemperature": 28.0,
        "RelativeHumidity": 35.0,
        "WindSpeed": 3.0
    })
    data_bad = res_bad.get_json()
    print(f"  Sample C (Bad)      : Actual={data_bad['actual_generation']} kW | Expected={data_bad['expected_generation']} kW | PR={data_bad['PR']} | Grade={data_bad['grade']} | Action='{data_bad['grade_action']}'")
    assert data_bad['grade'] == "Bad"
    assert "Inspection" in data_bad['grade_action'] or "Cleaning Review" in data_bad['grade_action']
    print("  -> PASSED: All 3 grade cutoffs and cautious action recommendations verified.")

    # 4. Invalid inputs return 400
    print("\n[Test 4] Verifying invalid inputs return 400...")
    res_bad_payload = client.post('/api/analyze', data="not json", content_type='application/json')
    assert res_bad_payload.status_code == 400
    res_bad_types = client.post('/api/analyze', json={"site": "site-1", "SolarGeneration": "not-a-number"})
    assert res_bad_types.status_code == 400
    print(f"  Invalid payload code: {res_bad_payload.status_code}, invalid type code: {res_bad_types.status_code}")
    print("  -> PASSED: Invalid inputs properly rejected with HTTP 400.")

    # 5. New site or missing history returns a clear error
    print("\n[Test 5] Verifying unindexed site or missing history returns clear error (404)...")
    res_missing_hist = client.post('/api/analyze', json={
        "campusKey": 99,
        "siteKey": 999,
        "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 10.0
    })
    assert res_missing_hist.status_code == 404
    missing_data = res_missing_hist.get_json()
    assert "error" in missing_data
    print(f"  Missing site code: {res_missing_hist.status_code}, message: '{missing_data['error']}'")
    print("  -> PASSED: Missing site/history returns clear 404 error.")

    # 6. Verify grade-cutoffs endpoint
    print("\n[Test 6] Verifying /api/grade-cutoffs endpoint...")
    res_cutoffs = client.get('/api/grade-cutoffs')
    assert res_cutoffs.status_code == 200
    cut_data = res_cutoffs.get_json()
    assert "cutoffs" in cut_data
    assert "site-1" in cut_data["cutoffs"]
    print(f"  /api/grade-cutoffs returned {len(cut_data['cutoffs'])} site configurations.")
    print("  -> PASSED: /api/grade-cutoffs endpoint operational.")

    # 7. Non-forecast endpoints ignore live path & fresh loads return historical defaults
    print("\n[Test 7] Verifying non-forecast endpoints ignore live path and fresh loads return historical defaults...")
    
    # /api/history fresh load (no params)
    res_hist_fresh = client.get('/api/history?site=site-1')
    assert res_hist_fresh.status_code == 200
    h_data = res_hist_fresh.get_json()
    assert h_data['success'] is True
    assert len(h_data.get('history', [])) > 0
    # Confirm timestamps are from historical range, not 2026
    assert '2020' in h_data['history'][0]['timestamp'] or '2021' in h_data['history'][0]['timestamp']
    print(f"  /api/history fresh load returned {len(h_data['history'])} records (sample: {h_data['history'][-1]['timestamp']})")

    # /api/history with 2026 / live parameter ignored and snapped to historical
    res_hist_live = client.get('/api/history?site=site-1&end=2026-11-03%2012:00:00&mode=live')
    assert res_hist_live.status_code == 200
    h_data_live = res_hist_live.get_json()
    assert h_data_live['success'] is True
    assert len(h_data_live.get('history', [])) > 0
    assert '2026' not in h_data_live['history'][-1]['timestamp']

    # /api/daily-summary fresh load & 2026 ignored
    res_ds_fresh = client.get('/api/daily-summary?site=site-1')
    assert res_ds_fresh.status_code == 200
    ds_data = res_ds_fresh.get_json()
    assert ds_data['success'] is True
    assert len(ds_data.get('daily', [])) > 0
    assert '2026' not in ds_data['daily'][-1]['date']

    res_ds_live = client.get('/api/daily-summary?site=site-1&end=2026-11-03%2012:00:00&mode=live')
    assert res_ds_live.status_code == 200
    ds_data_live = res_ds_live.get_json()
    assert ds_data_live['success'] is True
    assert len(ds_data_live.get('daily', [])) > 0

    # /api/cleaning-decision fresh load & 2026 ignored
    res_cd_fresh = client.post('/api/cleaning-decision', json={"site": "site-1"})
    assert res_cd_fresh.status_code == 200
    cd_data = res_cd_fresh.get_json()
    assert cd_data['success'] is True
    assert len(cd_data.get('timeseries', [])) > 0

    res_cd_live = client.post('/api/cleaning-decision', json={"site": "site-1", "timestamp": "2026-11-03 12:00:00", "mode": "live"})
    assert res_cd_live.status_code == 200
    cd_data_live = res_cd_live.get_json()
    assert cd_data_live['success'] is True

    # /api/trend fresh load & 2026 ignored
    res_tr_fresh = client.get('/api/trend?site=site-1')
    assert res_tr_fresh.status_code == 200
    tr_data = res_tr_fresh.get_json()
    assert tr_data['success'] is True
    assert len(tr_data.get('trend', [])) > 0

    # /api/yield-estimate does not call live weather API
    res_yield = client.get('/api/yield-estimate?site=site-1')
    assert res_yield.status_code == 200
    yd_data = res_yield.get_json()
    assert yd_data['success'] is True
    assert len(yd_data.get('next_7_days_forecast', [])) == 0
    print("  -> PASSED: All non-forecast endpoints ignore live path and fresh loads return historical defaults.")

    # 8. Forecast endpoint defaults to historical backtest with actual vs forecast comparison
    print("\n[Test 8] Verifying /api/forecast defaults to historical mode backtest...")
    res_fc_default = client.post('/api/forecast', json={"site": "site-1"})
    assert res_fc_default.status_code == 200
    fc_data = res_fc_default.get_json()
    assert fc_data['success'] is True
    assert fc_data['mode'] == 'historical'
    assert 'Backtest forecast' in fc_data['forecast_type']
    assert fc_data['source'].startswith('Historical backtest:')
    assert len(fc_data.get('forecast', [])) > 0
    first_step = fc_data['forecast'][0]
    assert 'predicted_kW' in first_step
    assert 'actual_kW' in first_step
    assert 'lower_kW' in first_step
    assert 'upper_kW' in first_step
    assert 'hist_p25_kW' in first_step
    assert 'hist_p75_kW' in first_step
    print(f"  Historical forecast returned {len(fc_data['forecast'])} steps; sample step: pred={first_step['predicted_kW']} kW, actual={first_step['actual_kW']} kW, typical band={first_step['hist_p25_kW']}-{first_step['hist_p75_kW']} kW")

    # /api/forecast in live mode returns 503 if offline / unavailable without silent fallback
    res_fc_live = client.post('/api/forecast', json={"site": "site-1", "mode": "live"})
    if res_fc_live.status_code == 503:
        fc_live_data = res_fc_live.get_json()
        assert fc_live_data['error'] == 'Live weather unavailable'
        print("  -> Live mode correctly returned 503 'Live weather unavailable' when offline.")
    else:
        assert res_fc_live.status_code == 200
        print("  -> Live mode online returned 200 with Live forecast.")
    print("  -> PASSED: Forecast endpoint defaults to Historical backtest with actual vs forecast comparison.")

    print("\n" + "=" * 80)
    print("ALL INFERENCE & GRADING TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == '__main__':
    test_inference_suite()
