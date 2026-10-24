import json
import io
from backend.app import app

def test_api():
    client = app.test_client()

    print("\n--- 1. Testing GET / ---")
    res1 = client.get('/')
    print("Status:", res1.status_code)
    print("Response:", res1.get_json())
    assert res1.status_code == 200
    assert res1.get_json()['status'] == 'running'

    print("\n--- 2. Testing GET /api/model-info ---")
    res2 = client.get('/api/model-info')
    print("Status:", res2.status_code)
    data2 = res2.get_json()
    print("Model names:", data2.get('energy_model_name'), "|", data2.get('expected_model_name'))
    print("Metrics:", data2.get('metrics'))
    print("Feature counts: RF =", len(data2.get('energy_features', [])),
          "Expected =", len(data2.get('expected_features', [])),
          "ISO =", len(data2.get('anomaly_features', [])))
    assert res2.status_code == 200
    assert len(data2['energy_features']) == 21
    assert len(data2['expected_features']) == 17
    assert len(data2['anomaly_features']) == 18
    assert 'emission_factor_kg_co2_per_kwh' in data2
    assert data2['emission_factor_kg_co2_per_kwh'] == 0.716

    print("\n--- 3. Testing GET /api/sites ---")
    res_sites = client.get('/api/sites')
    print("Status:", res_sites.status_code)
    sites_data = res_sites.get_json()
    assert res_sites.status_code == 200
    assert sites_data['success'] is True
    assert len(sites_data['sites']) >= 5
    print(f"Monitored sites: {len(sites_data['sites'])} sites loaded.")

    print("\n--- 4. Testing GET /api/dataset-values (Auto-fill Weather & History) ---")
    res_vals = client.get('/api/dataset-values?campusKey=2&siteKey=1&timestamp=2021-06-15T13:30')
    print("Status:", res_vals.status_code)
    vals_data = res_vals.get_json()
    assert res_vals.status_code == 200
    assert vals_data['success'] is True
    assert vals_data['found'] is True
    assert 'SolarGeneration' in vals_data
    assert 'AirTemperature' in vals_data
    assert 'RelativeHumidity' in vals_data
    assert 'WindSpeed' in vals_data
    print(f"Dataset values for 2021-06-15 13:30: Gen={vals_data['SolarGeneration']} kW, Temp={vals_data['AirTemperature']} C")

    print("\n--- 5. Testing POST /api/analyze (Normal Case - Only Current Inputs) ---")
    # User enters ONLY current data: site, time, actual generation, and weather.
    # No PreviousGeneration or lag fields are supplied!
    payload_normal = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": "2021-06-15 13:30:00",
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
    assert data5['maintenance_status'] == 'Normal'
    assert data5['recommendations'] == 'NORMAL'
    assert 'previous_data_used' in data5
    prev_used = data5['previous_data_used']
    print(f"Previous data automatically used: {prev_used['value']} kW at {prev_used['timestamp']}")
    print(f"Lags automatically used: {prev_used['lags']}")
    assert prev_used['value'] > 0.0
    assert 'lag_30min' in prev_used['lags']
    assert 'lag_1hour' in prev_used['lags']
    assert 'lag_2hour' in prev_used['lags']
    assert 'lost_kwh' in data5
    assert 'lost_co2_kg' in data5
    assert 'prediction_interval' in data5
    assert 'explainability' in data5

    print("\n--- 6. Testing POST /api/analyze (Missing History Error 404) ---")
    # If no historical data exists before this timestamp, return clear 404 (never use zero or guess)
    payload_missing = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": "2024-06-15 13:30:00",
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
    print("Missing history correctly rejected with HTTP 404:", data6['error'])

    print("\n--- 7. Testing POST /api/analyze (Possible Soiling Scenario) ---")
    # Date 2020-01-01 10:15:00: expected ~15.8 kW, current degraded to 11.5 kW (~27% loss under normal curve)
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
    print("Status:", data7['maintenance_status'])
    print("Recommendation:", data7['recommendations'])
    print("Reason:", data7['maintenance_reason'])
    print("Loss %:", data7['performance_loss_percent'])
    assert data7['maintenance_status'] == 'Cleaning Review'
    assert data7['recommendations'] == 'CLEANING RECOMMENDED'
    assert "soiling (verify by inspection)" in data7['possible_causes'].lower() or "soiling" in data7['possible_causes'].lower()

    print("\n--- 8. Testing POST /api/analyze (Sudden Drop Anomaly Scenario) ---")
    # Date 2020-01-04 15:15:00: sudden drop from ~17 kW to 3.96 kW
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
    print("Status:", data8['maintenance_status'])
    print("Recommendation:", data8['recommendations'])
    print("Reason:", data8['maintenance_reason'])
    assert data8['maintenance_status'] == 'Inspection'
    assert data8['recommendations'] == 'INSPECTION RECOMMENDED'

    print("\n--- 9. Testing POST /api/analyze (Invalid / Empty Payload Rejection) ---")
    res9 = client.post('/api/analyze', json={})
    print("Status:", res9.status_code)
    assert res9.status_code == 400
    assert res9.get_json()['success'] is False

    print("\n--- 10. Testing POST /api/analyze-batch (Batch CSV Upload Endpoint) ---")
    csv_content = """Timestamp,SolarGeneration,kWp,Number of panels,AirTemperature,RelativeHumidity,WindSpeed
2021-06-15 10:00:00,5.5,25.0,100,27.0,55,3.0
2021-06-15 10:30:00,6.0,25.0,100,28.0,52,3.1
2021-06-15 11:00:00,6.5,25.0,100,29.0,50,3.2
2021-06-15 11:30:00,7.0,25.0,100,30.0,48,3.2
2021-06-15 12:00:00,7.5,25.0,100,31.0,45,3.0
"""
    data_file = {'file': (io.BytesIO(csv_content.encode('utf-8')), 'test_batch.csv')}
    res10 = client.post('/api/analyze-batch', data=data_file, content_type='multipart/form-data')
    print("Batch Status:", res10.status_code)
    batch_json = res10.get_json()
    assert res10.status_code == 200
    assert batch_json['success'] is True
    assert batch_json['processed_rows'] == 5
    assert 'performance_ratio' in batch_json['metrics']
    assert 'rolling_loss_slope' in batch_json['metrics']
    assert 'trend_diagnosis' in batch_json['metrics']
    assert len(batch_json['timeline']) == 5
    print(f"Batch processed: {batch_json['processed_rows']} rows. PR={batch_json['metrics']['performance_ratio']:.2f}")

    print("\n=======================================================")
    print("ALL 10 BACKEND API TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == '__main__':
    test_api()
