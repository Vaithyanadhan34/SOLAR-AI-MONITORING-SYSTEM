import json
import io
import datetime
from backend.app import app

def test_api():
    client = app.test_client()

    print("\n--- 1. Testing GET / ---")
    res1 = client.get('/')
    print("Status:", res1.status_code)
    assert res1.status_code == 200
    assert res1.get_json()['status'] == 'running'

    print("\n--- 2. Testing GET /api/model-info ---")
    res2 = client.get('/api/model-info')
    print("Status:", res2.status_code)
    data2 = res2.get_json()
    assert res2.status_code == 200
    assert data2['history'] in ['available', 'unavailable']
    assert 'date_range' in data2
    if data2['history'] == 'available':
        assert data2['date_range'] is not None
        assert 'start' in data2['date_range'] or 'min' in data2['date_range']
        print(f"History status: {data2['history']} (File: {data2.get('history_file')}, Range: {data2['date_range']['start']} to {data2['date_range']['end']})")
    assert len(data2['energy_features']) == 21
    assert len(data2['expected_features']) == 17
    assert len(data2['anomaly_features']) == 18
    assert data2['emission_factor_kg_co2_per_kwh'] == 0.716

    print("\n--- 3. Testing GET /api/sites ---")
    res_sites = client.get('/api/sites')
    print("Status:", res_sites.status_code)
    sites_data = res_sites.get_json()
    assert res_sites.status_code == 200
    assert sites_data['success'] is True
    assert len(sites_data['sites']) >= 5

    print("\n--- 4. Testing GET /api/dataset-values ---")
    res_vals = client.get('/api/dataset-values?campusKey=2&siteKey=1&timestamp=2020-06-15T13:30')
    print("Status:", res_vals.status_code)
    vals_data = res_vals.get_json()
    assert res_vals.status_code == 200
    assert vals_data['success'] is True
    assert vals_data['found'] is True
    assert 'SolarGeneration' in vals_data

    print("\n--- 5. Testing POST /api/analyze (Normal Operational Case) ---")
    payload_normal = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": "2020-06-15 13:30:00",
        "SolarGeneration": 8.81,
        "AirTemperature": 27.5,
        "RelativeHumidity": 50.0,
        "WindSpeed": 3.2
    }
    res5 = client.post('/api/analyze', json=payload_normal)
    print("Status:", res5.status_code)
    data5 = res5.get_json()
    assert res5.status_code == 200
    assert data5['success'] is True
    assert data5['maintenance_status'] in ['Normal', 'Cleaning Review', 'Inspection']
    assert 'previous_data_used' in data5
    prev_used = data5['previous_data_used']
    assert prev_used['value'] > 0.0
    assert 'lag_30min' in prev_used['lags']
    assert 'lost_kwh' in data5
    assert 'lost_co2_kg' in data5
    print(f"Auto-retrieved previous reading: {prev_used['value']} kW at {prev_used['timestamp']}")

    print("\n--- 6. Testing POST /api/analyze (Missing History Error 404) ---")
    payload_missing = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": "2025-06-15 13:30:00",
        "SolarGeneration": 12.0,
        "AirTemperature": 28.0,
        "RelativeHumidity": 50.0,
        "WindSpeed": 3.0
    }
    res6 = client.post('/api/analyze', json=payload_missing)
    print("Status:", res6.status_code)
    data6 = res6.get_json()
    assert res6.status_code == 404
    assert data6['success'] is False
    assert "No previous data found" in data6['error']

    print("\n--- 7. Testing POST /api/analyze (Possible Soiling Scenario) ---")
    payload_soiling = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": "2020-01-01 10:15:00",
        "SolarGeneration": 11.5,
        "AirTemperature": 28.0,
        "RelativeHumidity": 45.0,
        "WindSpeed": 2.5
    }
    res7 = client.post('/api/analyze', json=payload_soiling)
    print("Status:", res7.status_code)
    data7 = res7.get_json()
    assert res7.status_code == 200
    assert data7['maintenance_status'] == 'Cleaning Review'
    assert data7['recommendations'] == 'CLEANING RECOMMENDED'
    assert "soiling" in data7['possible_causes'].lower()

    print("\n--- 8. Testing POST /api/analyze (Sudden Drop Anomaly Scenario) ---")
    payload_fault = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": "2020-01-04 15:15:00",
        "SolarGeneration": 3.96,
        "AirTemperature": 26.0,
        "RelativeHumidity": 50.0,
        "WindSpeed": 2.5
    }
    res8 = client.post('/api/analyze', json=payload_fault)
    print("Status:", res8.status_code)
    data8 = res8.get_json()
    assert res8.status_code == 200
    assert data8['maintenance_status'] == 'Inspection'
    assert data8['recommendations'] == 'INSPECTION RECOMMENDED'

    print("\n--- 9. Testing POST /api/analyze (Invalid / Empty Payload Rejection) ---")
    res9 = client.post('/api/analyze', json={})
    print("Status:", res9.status_code)
    assert res9.status_code == 400
    assert res9.get_json()['success'] is False

    print("\n--- 10. Testing POST /api/analyze-batch ---")
    csv_content = """Timestamp,SolarGeneration,kWp,Number of panels,AirTemperature,RelativeHumidity,WindSpeed
2020-06-15 10:00:00,5.5,25.0,100,27.0,55,3.0
2020-06-15 10:30:00,6.0,25.0,100,28.0,52,3.1
2020-06-15 11:00:00,6.5,25.0,100,29.0,50,3.2
2020-06-15 11:30:00,7.0,25.0,100,30.0,48,3.2
2020-06-15 12:00:00,7.5,25.0,100,31.0,45,3.0
"""
    data_file = {'file': (io.BytesIO(csv_content.encode('utf-8')), 'test_batch.csv')}
    res10 = client.post('/api/analyze-batch', data=data_file, content_type='multipart/form-data')
    print("Batch Status:", res10.status_code)
    batch_json = res10.get_json()
    assert res10.status_code == 200
    assert batch_json['success'] is True
    assert batch_json['processed_rows'] == 5

    print("\n--- 11. Testing POST /api/forecast (Phase 2 Recursive RF Forecast) ---")
    payload_forecast = {
        "site": "site-1",
        "timestamp": "2020-06-15 12:00:00",
        "horizon_hours": 24
    }
    res_fc = client.post('/api/forecast', json=payload_forecast)
    print("Forecast Status:", res_fc.status_code)
    fc_data = res_fc.get_json()
    assert res_fc.status_code == 200
    assert fc_data['success'] is True
    assert fc_data['horizon_hours'] == 24
    assert len(fc_data['forecast']) == 48  # 48 30-min steps
    step1 = fc_data['forecast'][0]
    assert 'predicted_kW' in step1
    assert 'lower_kW' in step1
    assert 'upper_kW' in step1
    assert 'weather_assumption' in fc_data
    print(f"Generated 24-hr forecast (48 steps). First step ({step1['timestamp']}): {step1['predicted_kW']} kW [{step1['lower_kW']} - {step1['upper_kW']} kW]")

    print("\n--- 12. Testing POST /api/forecast (Validation & Error Cases) ---")
    # Invalid horizon
    res_fc_bad = client.post('/api/forecast', json={"site": "site-1", "timestamp": "2020-06-15 12:00:00", "horizon_hours": 36})
    assert res_fc_bad.status_code == 400
    # Insufficient history before timestamp
    res_fc_early = client.post('/api/forecast', json={"site": "site-1", "timestamp": "2020-01-02 12:00:00", "horizon_hours": 24})
    assert res_fc_early.status_code == 404
    print("Forecast validation and insufficient history tests passed.")

    print("\n--- 13. Testing GET /api/history (Phase 2 Past 48h Actual vs Expected) ---")
    res_hist = client.get('/api/history?site=site-1&end=2020-06-15T13:30:00&hours=48')
    print("History Status:", res_hist.status_code)
    hist_json = res_hist.get_json()
    assert res_hist.status_code == 200
    assert hist_json['success'] is True
    assert len(hist_json['history']) > 0
    h_pt = hist_json['history'][0]
    assert 'actual_kW' in h_pt
    assert 'expected_kW' in h_pt
    print(f"Retrieved {len(hist_json['history'])} historical readings spanning 48h.")

    print("\n--- 14. Testing GET /api/daily-summary (Phase 2 7-Day Aggregated Metrics) ---")
    res_daily = client.get('/api/daily-summary?site=site-1&end=2020-06-15T13:30:00&days=7')
    print("Daily Summary Status:", res_daily.status_code)
    daily_json = res_daily.get_json()
    assert res_daily.status_code == 200
    assert daily_json['success'] is True
    assert len(daily_json['daily']) > 0
    d_pt = daily_json['daily'][0]
    assert 'actual_kWh' in d_pt
    assert 'expected_kWh' in d_pt
    assert 'lost_kWh' in d_pt
    assert 'performance_ratio' in d_pt
    assert 'totals' in daily_json
    print(f"Retrieved {len(daily_json['daily'])} daily summaries. Total generation: {daily_json['totals']['actual_kWh']} kWh, PR: {daily_json['totals']['performance_ratio']}")

    print("\n=======================================================")
    print("ALL 14 BACKEND API TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == '__main__':
    test_api()
