import json
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
    print("Model names:", data2.get('energy_model_name'), "|", data2.get('anomaly_model_name'))
    print("Metrics:", data2.get('metrics'))
    print("Feature counts: RF =", len(data2.get('energy_features', [])), "ISO =", len(data2.get('anomaly_features', [])))
    assert res2.status_code == 200
    assert len(data2['energy_features']) == 21
    assert len(data2['anomaly_features']) == 18

    print("\n--- 3. Testing POST /api/analyze (Normal Case) ---")
    payload_normal = {
        "CampusKey": 2,
        "SiteKey": 1,
        "kWp": 25.0,
        "Number of panels": 100,
        "ApparentTemperature": 28.0,
        "AirTemperature": 26.5,
        "DewPointTemperature": 17.0,
        "RelativeHumidity": 55.0,
        "WindSpeed": 3.2,
        "WindDirection": 175.0,
        "SolarGeneration": 38.0,
        "PreviousGeneration": 39.0,
        "Generation_30min_Ago": 37.5,
        "Generation_1hour_Ago": 35.0,
        "Generation_2hour_Ago": 30.0,
        "timestamp": "2024-06-15 13:30:00"
    }
    res3 = client.post('/api/analyze', json=payload_normal)
    print("Status:", res3.status_code)
    print("Response:", json.dumps(res3.get_json(), indent=2))
    assert res3.status_code == 200
    assert res3.get_json()['success'] is True

    print("\n--- 4. Testing POST /api/analyze (Soiling / Cleaning Needed Scenario) ---")
    payload_soiling = {
        "CampusKey": 2,
        "SiteKey": 1,
        "kWp": 25.0,
        "Number of panels": 100,
        "ApparentTemperature": 32.0,
        "AirTemperature": 30.0,
        "DewPointTemperature": 15.0,
        "RelativeHumidity": 40.0,
        "WindSpeed": 2.0,
        "WindDirection": 180.0,
        "SolarGeneration": 21.0,
        "PreviousGeneration": 28.0,
        "Generation_30min_Ago": 29.0,
        "Generation_1hour_Ago": 30.0,
        "Generation_2hour_Ago": 30.0,
        "timestamp": "2024-06-15 13:30:00"
    }
    res4 = client.post('/api/analyze', json=payload_soiling)
    print("Status:", res4.status_code)
    data4 = res4.get_json()
    print("Recommendation:", data4['maintenance']['recommendation'])
    print("Possible cause:", data4['maintenance']['possible_cause'])
    print("Reason:", data4['maintenance']['reason'])
    print("Loss %:", data4['performance']['loss_percent'])
    assert res4.status_code == 200
    assert data4['maintenance']['recommendation'] == 'CLEANING RECOMMENDED'

    print("\n--- 5. Testing POST /api/analyze (Sudden Drop Anomaly Scenario) ---")
    payload_fault = {
        "CampusKey": 2,
        "SiteKey": 1,
        "kWp": 25.0,
        "Number of panels": 100,
        "ApparentTemperature": 32.0,
        "AirTemperature": 30.0,
        "DewPointTemperature": 15.0,
        "RelativeHumidity": 40.0,
        "WindSpeed": 2.0,
        "WindDirection": 180.0,
        "SolarGeneration": 2.0,  # Sudden drop from 45.0
        "PreviousGeneration": 45.0,
        "Generation_30min_Ago": 44.0,
        "Generation_1hour_Ago": 42.0,
        "Generation_2hour_Ago": 38.0,
        "timestamp": "2024-06-15 13:30:00"
    }
    res5 = client.post('/api/analyze', json=payload_fault)
    print("Status:", res5.status_code)
    data5 = res5.get_json()
    print("Recommendation:", data5['maintenance']['recommendation'])
    print("Possible cause:", data5['maintenance']['possible_cause'])
    print("Anomaly status:", data5['anomaly']['status'])
    print("Loss %:", data5['performance']['loss_percent'])
    assert res5.status_code == 200

    print("\n--- 6. Testing POST /api/analyze (Invalid / Empty Payload Rejection) ---")
    res6 = client.post('/api/analyze', json={})
    print("Status:", res6.status_code)
    print("Response:", res6.get_json())
    assert res6.status_code == 400
    assert res6.get_json()['success'] is False

    print("\n--- 7. Testing Direct Field Consistency & Power Units ---")
    assert 'predicted_generation' in data5
    assert data5['generation_unit'] == 'kW'
    assert 'maintenance_status' in data5
    assert data5['maintenance_status'] in ['Normal', 'Cleaning Review', 'Inspection']
    assert 'anomaly_detected' in data5
    print("Direct fields verified: predicted_generation, generation_unit=kW, maintenance_status, anomaly_detected.")

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_api()
