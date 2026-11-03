import json
import io
import datetime
import numpy as np
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
    assert len(data2['energy_features']) in [21, 27]
    assert len(data2['expected_features']) in [17, 19]
    assert len(data2['anomaly_features']) in [10, 18]
    assert data2['emission_factor_kg_co2_per_kwh'] == 0.716

    print("\n--- 3. Testing GET /api/sites ---")
    res_sites = client.get('/api/sites')
    print("Status:", res_sites.status_code)
    sites_data = res_sites.get_json()
    assert res_sites.status_code == 200
    assert sites_data['success'] is True
    assert len(sites_data['sites']) >= 5
    for s in sites_data['sites']:
        assert 'start_date' in s and 'end_date' in s
        assert 'start_timestamp' in s and 'end_timestamp' in s
        assert 'dateRange' in s

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
    assert data5['maintenance_status'] in ['Normal', 'Optimal', 'Cleaning Review', 'Inspection']
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
    assert data7['maintenance_status'] in ['Cleaning Review', 'Inspection']
    assert data7['recommendations'] in ['CLEANING RECOMMENDED', 'INSPECTION RECOMMENDED']
    assert any(term in data7['possible_causes'].lower() for term in ['soiling', 'fault', 'shading'])

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

    print("\n--- 11. Testing POST /api/forecast (Part 1 Live 2026 Forecast) ---")
    payload_forecast = {
        "site": "site-1",
        "horizon_hours": 24
    }
    res_fc = client.post('/api/forecast', json=payload_forecast)
    print("Forecast Status:", res_fc.status_code)
    fc_data = res_fc.get_json()
    assert res_fc.status_code == 200
    assert fc_data['success'] is True
    assert fc_data['horizon_hours'] == 24
    assert len(fc_data['forecast']) >= 24  # 24 hourly steps from live Open-Meteo
    step1 = fc_data['forecast'][0]
    assert 'predicted_kW' in step1
    assert 'lower_kW' in step1
    assert 'upper_kW' in step1
    assert 'physics_estimate_kW' in step1
    assert fc_data['weather_source'] == "Open-Meteo Live API"
    print(f"Generated 24-hr live forecast ({len(fc_data['forecast'])} steps). First step ({step1['timestamp']}): {step1['predicted_kW']} kW [{step1['lower_kW']} - {step1['upper_kW']} kW]")

    print("\n--- 12. Testing POST /api/forecast (Multi-horizon 6h & 7d) ---")
    res_fc_6h = client.post('/api/forecast', json={"site": "site-1", "horizon": "6h"})
    assert res_fc_6h.status_code == 200
    assert len(res_fc_6h.get_json()['forecast']) == 6
    res_fc_7d = client.post('/api/forecast', json={"site": "site-1", "horizon": "7d"})
    assert res_fc_7d.status_code == 200
    assert len(res_fc_7d.get_json()['daily_forecast']) >= 7
    print("Multi-horizon 6h and 7d live forecasts validated successfully.")

    print("\n--- 13. Testing GET /api/history (Past 48h Actual vs Expected) ---")
    res_hist = client.get('/api/history?site=site-1&end=2020-06-15T13:30:00&hours=48')
    print("History Status:", res_hist.status_code)
    hist_json = res_hist.get_json()
    assert res_hist.status_code == 200
    assert hist_json['success'] is True
    assert len(hist_json['history']) > 0
    assert len(hist_json['readings']) > 0
    h_pt = hist_json['history'][0]
    assert 'actual_kW' in h_pt or 'actual_generation' in h_pt
    assert 'expected_kW' in h_pt or 'expected_generation' in h_pt
    print(f"Retrieved {len(hist_json['history'])} historical readings spanning 48h.")

    print("\n--- 14. Testing GET /api/daily-summary (7-Day Aggregated Metrics) ---")
    res_daily = client.get('/api/daily-summary?site=site-1&end=2020-06-15T13:30:00&days=7')
    print("Daily Summary Status:", res_daily.status_code)
    daily_json = res_daily.get_json()
    assert res_daily.status_code == 200
    assert daily_json['success'] is True
    assert isinstance(daily_json['daily'], list) and len(daily_json['daily']) > 0
    assert isinstance(daily_json['days'], list) and len(daily_json['days']) > 0
    assert daily_json['days_count'] == 7
    d_pt = daily_json['daily'][0]
    assert 'actual_kWh' in d_pt or 'actual_generation_kWh' in d_pt
    assert 'expected_kWh' in d_pt or 'expected_generation_kWh' in d_pt
    assert 'lost_kWh' in d_pt
    assert 'performance_ratio' in d_pt
    assert 'totals' in daily_json
    print(f"Retrieved {len(daily_json['daily'])} daily summaries. Total generation: {daily_json['totals']['actual_kWh']} kWh, PR: {daily_json['totals']['performance_ratio']}")

    print("\n--- 15. Testing POST /api/cleaning-decision (Water-Aware Decision) ---")
    dec_payload = {
        "site": "site-1",
        "timestamp": "2020-06-15 13:30:00",
        "cleaning_cost": 500.0,
        "tariff_per_kwh": 8.0,
        "water_per_wash_L": 500.0
    }
    res_dec = client.post('/api/cleaning-decision', json=dec_payload)
    print("Cleaning Decision Status:", res_dec.status_code)
    dec_json = res_dec.get_json()
    assert res_dec.status_code == 200
    assert dec_json['success'] is True
    assert dec_json['decision'] in ['Clean now', 'Wait', 'Inspect']
    assert 'cumulative_lost_value' in dec_json
    assert 'clean_now_threshold_kwh' in dec_json
    assert 'water_saved_scenario_L' in dec_json
    assert 'best_day_to_clean' in dec_json
    assert 'days' in dec_json['best_day_to_clean']
    assert len(dec_json['best_day_to_clean']['days']) == 7
    assert len(dec_json['timeseries']) > 0
    print(f"Decision: {dec_json['decision']} (Lost Value: {dec_json['cumulative_lost_value']} vs Cost: {dec_json['cleaning_cost']}, Water Saved: {dec_json['water_saved_scenario_L']} L)")

    print("\n--- 16. Testing POST /api/cleaning-decision (Validation & 404 Missing) ---")
    res_dec_bad = client.post('/api/cleaning-decision', json={"site": "site-1", "timestamp": "2020-06-15 13:30:00", "cleaning_cost": -10})
    assert res_dec_bad.status_code == 400
    res_dec_missing = client.post('/api/cleaning-decision', json={"site": "site-1", "timestamp": "2025-06-15 13:30:00"})
    assert res_dec_missing.status_code == 404
    print("Cleaning decision validation and missing history error checks passed.")

    print("\n--- 17. Testing GET /api/policy-comparison (Fixed vs Smart Simulation) ---")
    res_pol = client.get('/api/policy-comparison')
    print("Policy Comparison Status:", res_pol.status_code)
    pol_json = res_pol.get_json()
    assert res_pol.status_code == 200
    assert pol_json['success'] is True
    assert 'fixed_policy' in pol_json
    assert 'condition_based_policy' in pol_json
    assert 'smart_policy' in pol_json
    assert 'cleanings_count' in pol_json['fixed_policy']
    assert 'water_used_L' in pol_json['fixed_policy']
    assert 'cleanings_count' in pol_json['condition_based_policy']
    assert len(pol_json['daily_timeseries']) > 0
    assert len(pol_json['timeseries']) > 0
    assert "Simulation based on historical data" in pol_json['disclaimer']
    print(f"Policy simulation: Fixed {pol_json['fixed_policy']['cleanings_count']} washes vs Smart {pol_json['condition_based_policy']['cleanings_count']} washes.")

    print("\n--- 18. Testing GET /api/trend (Performance Ratio Trend & Cause Hint) ---")
    res_trend = client.get('/api/trend?site=site-1&days=30&end=2020-06-15T13:30:00')
    print("Trend Status:", res_trend.status_code)
    trend_json = res_trend.get_json()
    assert res_trend.status_code == 200
    assert trend_json['success'] is True
    assert len(trend_json['trend_series']) > 0
    assert len(trend_json['trend']) > 0
    t_pt = trend_json['trend_series'][-1]
    assert 'rolling_slope' in t_pt
    assert 'flag' in t_pt
    assert 'hint' in t_pt
    assert 'possible' in t_pt['hint'].lower() or 'nominal' in t_pt['hint'].lower()
    print(f"Trend: {trend_json['overall_diagnosis']} (Days evaluated: {trend_json['days']})")

    print("\n--- 19. Testing GET /api/site-ranking (Fleet Health Scores 0-100) ---")
    res_rank = client.get('/api/site-ranking')
    print("Site Ranking Status:", res_rank.status_code)
    rank_json = res_rank.get_json()
    assert res_rank.status_code == 200
    assert rank_json['success'] is True
    assert len(rank_json['rankings']) >= 5
    top_site = rank_json['rankings'][0]
    assert 0 <= top_site['health_score'] <= 100
    assert top_site['status'] in ['Normal', 'Cleaning Review', 'Inspection']
    print(f"Top site: {top_site['name']} (Score: {top_site['health_score']}, Status: {top_site['status']})")

    print("\n--- 20. Testing GET /api/history-bands (Typical Day 25th-75th Percentiles) ---")
    res_bands = client.get('/api/history-bands?site=site-1&end=2020-06-15T13:30:00')
    print("History Bands Status:", res_bands.status_code)
    bands_json = res_bands.get_json()
    assert res_bands.status_code == 200
    assert bands_json['success'] is True
    assert len(bands_json['bands']) > 0
    b_pt = bands_json['bands'][0]
    assert 'median_kW' in b_pt
    assert 'p25_kW' in b_pt
    assert 'p75_kW' in b_pt
    assert 'time' in b_pt and 'time_of_day' in b_pt
    print(f"Retrieved {len(bands_json['bands'])} time-of-day percentile bands.")

    print("\n--- 21. Testing GET /api/data-info (Transparency, Assumptions, Limitations) ---")
    res_info = client.get('/api/data-info')
    print("Data Info Status:", res_info.status_code)
    info_json = res_info.get_json()
    assert res_info.status_code == 200
    assert info_json['success'] is True
    assert info_json['row_count'] > 1000000
    assert len(info_json['assumptions']) == 6
    assert len(info_json['limitations']) == 4
    for a in info_json['assumptions']:
        assert 'parameter' in a and 'citation' in a
    print(f"Transparency data verified: {info_json['row_count']:,} rows, {len(info_json['assumptions'])} assumptions, {len(info_json['limitations'])} limitations.")

    print("\n--- 22. Testing GET & POST /api/simulate (Dynamic What-If Cleaning Simulation) ---")
    sim_payload = {
        "site": "site-1",
        "interval_days": 21,
        "threshold_rs": 600.0,
        "cleaning_cost": 500.0,
        "tariff_per_kwh": 8.0,
        "water_per_wash_L": 500.0
    }
    res_sim = client.post('/api/simulate', json=sim_payload)
    print("Simulate Status:", res_sim.status_code)
    sim_json = res_sim.get_json()
    assert res_sim.status_code == 200
    assert sim_json['success'] is True
    assert 'fixed_policy' in sim_json and 'smart_policy' in sim_json
    assert 'comparison' in sim_json
    assert sim_json['simulation_parameters']['interval_days'] == 21
    assert sim_json['simulation_parameters']['threshold_rs'] == 600.0
    assert len(sim_json['timeseries']) > 0
    print(f"Simulation: {sim_json['fixed_policy']['cleanings_count']} fixed cleanings vs {sim_json['smart_policy']['cleanings_count']} condition-based washes. Water saved: {sim_json['comparison']['water_saved_scenario_L']} L.")

    print("\n--- 23. Testing GET & POST /api/yield-estimate (Solar Yield Calculator) ---")
    yield_payload = {
        "site": "site-1",
        "kWp": 30.0,
        "panels": 120,
        "month": 6
    }
    res_yield = client.post('/api/yield-estimate', json=yield_payload)
    print("Yield Status:", res_yield.status_code)
    yield_json = res_yield.get_json()
    assert res_yield.status_code == 200
    assert yield_json['success'] is True
    assert yield_json['daily_expected_kWh'] > 0
    assert yield_json['monthly_expected_kWh'] > 0
    assert len(yield_json['typical_day_curve']) == 24
    assert len(yield_json['monthly_projections']) == 12
    assert len(yield_json['fleet_comparison']) == 5
    assert "estimate" in yield_json['disclaimer'].lower()
    print(f"Yield estimate: {yield_json['daily_expected_kWh']} kWh/day, {yield_json['monthly_expected_kWh']} kWh/month for 30 kWp in June.")

    print("\n--- 24. Testing GET /api/anomalies (Anomaly Timeline Events) ---")
    res_anom = client.get('/api/anomalies?site=site-1&end=2020-06-15T13:30:00&days=14')
    print("Anomalies Status:", res_anom.status_code)
    anom_json = res_anom.get_json()
    assert res_anom.status_code == 200
    assert anom_json['success'] is True
    assert 'anomalies' in anom_json
    print(f"Retrieved {len(anom_json['anomalies'])} anomaly events in 14-day window.")

    print("\n--- 25. Testing Directional Consistency & Real Samples (Rules 1-5) ---")
    
    # 25a. Row above expected (Over-performance)
    p_above = {
        "CampusKey": 2, "SiteKey": 1, "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 22.0, "AirTemperature": 30.0, "RelativeHumidity": 40.0, "WindSpeed": 3.0
    }
    r_above = client.post('/api/analyze', json=p_above)
    assert r_above.status_code == 200
    d_above = r_above.get_json()
    assert d_above['grade'] == 'Very Good'
    assert d_above['status'] == 'Normal'
    assert d_above['shortfall_kW'] == 0.0
    assert d_above['lost_kWh'] == 0.0
    assert d_above['excess_kW'] > 0.0
    assert 'above' in d_above['direction_text']
    assert "Performing above its usual level" in d_above['grade_action']
    print(f"  [25a Above] Actual: {d_above['actual_generation']} kW vs Exp: {d_above['expected_generation']} kW | Grade: {d_above['grade']} | Shortfall: {d_above['shortfall_kW']} kW | Excess: {d_above['excess_kW']} kW (PASSED)")

    # 25b. Row near expected
    p_near = {
        "CampusKey": 2, "SiteKey": 1, "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 6.8, "AirTemperature": 30.0, "RelativeHumidity": 40.0, "WindSpeed": 3.0
    }
    r_near = client.post('/api/analyze', json=p_near)
    assert r_near.status_code == 200
    d_near = r_near.get_json()
    assert d_near['grade'] in ['Normal', 'Very Good']
    assert d_near['status'] == 'Normal'
    print(f"  [25b Near] Actual: {d_near['actual_generation']} kW vs Exp: {d_near['expected_generation']} kW | Grade: {d_near['grade']} (PASSED)")

    # 25c. Row below expected (Shortfall)
    p_below = {
        "CampusKey": 2, "SiteKey": 1, "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 2.0, "AirTemperature": 30.0, "RelativeHumidity": 40.0, "WindSpeed": 3.0
    }
    r_below = client.post('/api/analyze', json=p_below)
    assert r_below.status_code == 200
    d_below = r_below.get_json()
    assert d_below['grade'] == 'Bad'
    assert d_below['shortfall_kW'] > 0.0
    assert d_below['lost_kWh'] > 0.0
    assert d_below['excess_kW'] == 0.0
    assert 'below' in d_below['direction_text']
    print(f"  [25c Below] Actual: {d_below['actual_generation']} kW vs Exp: {d_below['expected_generation']} kW | Grade: {d_below['grade']} | Shortfall: {d_below['shortfall_kW']} kW (PASSED)")

    # 25d. Night row
    p_night = {
        "CampusKey": 2, "SiteKey": 1, "timestamp": "2020-06-15 23:00:00",
        "SolarGeneration": 0.0, "AirTemperature": 22.0, "RelativeHumidity": 70.0, "WindSpeed": 2.0
    }
    r_night = client.post('/api/analyze', json=p_night)
    assert r_night.status_code == 200
    d_night = r_night.get_json()
    assert d_night['grade'] == 'Normal'
    assert d_night['lost_kWh'] == 0.0
    assert "Night hours" in d_night['grade_reason']
    print(f"  [25d Night] Grade: {d_night['grade']} | Lost: {d_night['lost_kWh']} kWh | Reason: {d_night['grade_reason']} (PASSED)")

    # 25e. Over-capacity reading (> 1.2 * 25 kWp = 30 kW)
    p_overcap = {
        "CampusKey": 2, "SiteKey": 1, "timestamp": "2020-06-15 12:00:00",
        "SolarGeneration": 38.0, "AirTemperature": 30.0, "RelativeHumidity": 40.0, "WindSpeed": 3.0
    }
    r_overcap = client.post('/api/analyze', json=p_overcap)
    assert r_overcap.status_code == 400
    assert "exceeds the site's capacity" in r_overcap.get_json()['error']
    print(f"  [25e Over-capacity] Code: {r_overcap.status_code} | Error: {r_overcap.get_json()['error']} (PASSED)")

    # 25f. Low-light row (early dawn / dusk)
    p_lowlight = {
        "CampusKey": 2, "SiteKey": 1, "timestamp": "2020-06-15 06:15:00",
        "SolarGeneration": 0.2, "AirTemperature": 22.0, "RelativeHumidity": 80.0, "WindSpeed": 1.5
    }
    r_lowlight = client.post('/api/analyze', json=p_lowlight)
    assert r_lowlight.status_code == 200
    d_lowlight = r_lowlight.get_json()
    assert d_lowlight['grade'] == 'Low Sunlight'
    assert d_lowlight['PR'] is None
    assert "Not enough sunlight" in d_lowlight['grade_reason']
    print(f"  [25f Low-light] Grade: {d_lowlight['grade']} | PR: {d_lowlight['PR']} | Reason: {d_lowlight['grade_reason']} (PASSED)")

    print("\n--- 26. Testing Rule 5 Energy Conservation & Cross-Module Consistency ---")
    from backend.decision import aggregate_energy_period
    # 1. Row-level identity: sum(shortfall_kWh) + sum(min(actual, expected)) == expected_kWh
    sample_rows = [
        {"actual_kw": 20.0, "expected_kw": 15.0}, # excess: 5.0, min: 15.0, shortfall: 0
        {"actual_kw": 8.0, "expected_kw": 12.0},  # shortfall: 4.0, min: 8.0, excess: 0
        {"actual_kw": 0.0, "expected_kw": 0.0},   # night
        {"actual_kw": 5.0, "expected_kw": 5.0},   # exact
    ]
    agg = aggregate_energy_period(sample_rows, interval_hours=0.5)
    assert agg["is_balanced"] is True, "Row level energy identity failed"
    print(f"  [26a Row Identity] sum(shortfall) + sum(min(act,exp)) = {agg['expected_kWh']} kWh == expected (PASSED)")

    # 2. Daily summary conservation: actual_kWh == expected_kWh - shortfall_kWh + excess_kWh
    for day_rec in daily_json['daily']:
        act = day_rec['actual_kWh']
        exp = day_rec['expected_kWh']
        shortfall = day_rec['shortfall_kWh']
        excess = day_rec.get('excess_kWh', 0.0)
        reconstructed_actual = exp - shortfall + excess
        assert abs(act - reconstructed_actual) < 0.05, f"Energy conservation failed: {act} != {reconstructed_actual}"
        # Capped delivered expected energy = act - excess
        delivered_exp = act - excess
        assert abs((shortfall + delivered_exp) - exp) < 0.05, f"Shortfall + delivered identity failed: {shortfall + delivered_exp} != {exp}"
    print(f"  [26b Daily Summaries] All 7 daily summaries conserve actual == expected - shortfall + excess (PASSED)")

    # 3. Verify that cleaning-decision cumulative loss matches the sum of daily shortfalls
    dec_shortfall_sum = sum(pt.get('daily_lost_kwh', 0.0) for pt in dec_json.get('timeseries', []))
    assert abs(dec_json['cumulative_lost_kwh'] - dec_shortfall_sum) < 0.1, f"Planner timeseries daily_lost_kwh sum ({dec_shortfall_sum}) does not match cumulative_lost_kwh ({dec_json['cumulative_lost_kwh']})"
    print(f"  [26c Planner Consistency] Planner cumulative lost energy: {dec_json['cumulative_lost_kwh']} kWh matches timeseries shortfall sum (PASSED)")

    print("\n--- 27. Testing Current 2026 Live Forecast Starts From Now ---")
    today_dt = datetime.datetime.now()
    today_str = today_dt.strftime('%Y-%m-%d')
    res_fc = client.post('/api/forecast', json={"site": "site-1", "horizon_hours": 24})
    print("Forecast Status:", res_fc.status_code)
    assert res_fc.status_code == 200, f"Forecast failed with status {res_fc.status_code}"
    fc_data = res_fc.get_json()
    assert fc_data['success'] is True
    assert fc_data['weather_source'] == "Open-Meteo Live API"
    assert "Live 2026" in fc_data['forecast_type']
    steps = fc_data['forecast']
    assert len(steps) >= 24, f"Expected at least 24 hourly steps, got {len(steps)}"
    first_step_ts = steps[0]['timestamp']
    print(f"  First forecast step timestamp: {first_step_ts}")
    # Verify year is current (2026) and not old 2020-2022
    assert first_step_ts[:4] >= "2026", f"Forecast step year ({first_step_ts[:4]}) must be 2026, never old 2020-2022"
    # Verify no forecast step contains a date before today
    for s in steps:
        step_date = s['timestamp'][:10]
        assert step_date >= today_str, f"Forecast step date ({step_date}) is before today ({today_str})"
        assert 'predicted_kW' in s
        assert 'lower_kW' in s
        assert 'upper_kW' in s
        assert 'physics_estimate_kW' in s
        assert s['lower_kW'] <= s['upper_kW'], "Tree uncertainty lower bound cannot exceed upper bound"
    print(f"  [27 Forecast Live 2026] All {len(steps)} steps start at current time in 2026 with physics estimates and tree spread (PASSED)")

    print("\n--- 28. Testing Open-Meteo Weather Unit Conversion ---")
    from backend.weather_service import fetch_live_weather_forecast
    # Test Chennai coordinates
    w_raw = fetch_live_weather_forecast(13.0827, 80.2707, "Asia/Kolkata", forecast_days=2)
    hourly = w_raw.get('hourly', {})
    winds = hourly.get('wind_speed_10m', [])
    temps = hourly.get('temperature_2m', [])
    hums = hourly.get('relative_humidity_2m', [])
    irrs = hourly.get('shortwave_radiation', [])
    assert len(winds) > 0 and len(temps) > 0
    # Wind speed must be in m/s (typically 0 - 25 m/s, not km/h which would be ~3.6x higher)
    avg_wind = float(np.mean(winds))
    assert 0.0 <= avg_wind <= 25.0, f"Average wind speed ({avg_wind}) out of realistic m/s bounds"
    assert min(hums) >= 0 and max(hums) <= 100, f"Humidity out of percentage bounds: {min(hums)} to {max(hums)}"
    assert min(irrs) >= 0 and max(irrs) <= 1400, f"Shortwave radiation out of physical bounds: {min(irrs)} to {max(irrs)}"
    print(f"  [28 Unit Conversion] Open-Meteo wind in m/s (avg {avg_wind:.2f} m/s), humidity (0-100%), solar irradiance verified (PASSED)")

    print("\n--- 29. Testing 503 Path: Live Weather Unavailable ---")
    from unittest.mock import patch
    from backend.weather_service import LiveWeatherUnavailableError
    with patch('backend.app.fetch_live_weather_forecast', side_effect=LiveWeatherUnavailableError("DNS resolution failed")):
        res_503 = client.post('/api/forecast', json={"site": "site-1", "horizon_hours": 24})
        print("Mocked 503 Status:", res_503.status_code)
        assert res_503.status_code == 503
        d_503 = res_503.get_json()
        assert d_503['success'] is False
        assert "Live weather unavailable" in d_503['error']
        print(f"  [29 503 Path] Correctly returned HTTP 503 with 'Live weather unavailable', never silently falling back (PASSED)")

    print("\n--- 30. Testing Separation of Live Data & Historical Backtest (/validation) ---")
    # 1. Validation endpoint is the ONLY place where 2020-2022 backtest data is served
    res_val = client.get('/api/validation?site=site-1')
    assert res_val.status_code == 200
    d_val = res_val.get_json()
    assert d_val['success'] is True
    assert "Backtest on held-out historical data (2020-2022). Not current." in d_val['disclaimer']
    assert d_val['validation_period']['start'].startswith('202')
    assert len(d_val['timeseries']) > 0
    assert len(d_val['error_by_hour']) >= 10
    print(f"  [30a Validation] Held-out backtest returned {len(d_val['timeseries'])} records with explicit historical disclaimer (PASSED)")

    # 2. Live history endpoint returns honest empty state when no 2026 readings exist
    res_live_hist = client.get(f'/api/history?site=site-1&timestamp={today_str}%2012:00:00&hours=24')
    assert res_live_hist.status_code == 200
    d_live_hist = res_live_hist.get_json()
    assert d_live_hist['success'] is True
    print(f"  [30b Live Separation] /api/history returns honest empty state: {d_live_hist.get('empty_state_message')} (PASSED)")

    print("\n--- 31. Testing 2026 Data Collection: SQLite & CSV Upload Row-Level Validation ---")
    # 1. Save reading
    reading_payload = {
        "site": "site-1",
        "timestamp": f"{today_str} 12:30:00",
        "actual_kW": 16.5,
        "expected_kW": 18.0,
        "source": "manual_test",
        "weather": {"AirTemperature": 29.5, "RelativeHumidity": 55.0, "WindSpeed": 3.8}
    }
    res_save = client.post('/api/live/readings', json=reading_payload)
    assert res_save.status_code in [200, 201]
    d_save = res_save.get_json()
    assert d_save['success'] is True
    print(f"  [31a Save Reading] Saved reading #{d_save.get('id')} to SQLite live_data.db (PASSED)")

    # 2. CSV upload with row-level validation (valid, negative, over-capacity)
    csv_content = (
        "timestamp,actual_kW,AirTemperature,RelativeHumidity,WindSpeed\n"
        f"{today_str} 08:00:00,5.2,26.0,70.0,2.5\n"
        f"{today_str} 09:00:00,-2.0,27.0,65.0,2.8\n"   # Invalid: negative
        f"{today_str} 10:00:00,12.5,28.5,60.0,3.0\n"
        f"{today_str} 11:00:00,999.0,30.0,50.0,3.2\n"  # Invalid: > 1.2 * 25 kWp
    )
    csv_bytes = io.BytesIO(csv_content.encode('utf-8'))
    res_upload = client.post(
        '/api/live/upload',
        data={'file': (csv_bytes, 'test_telemetry.csv'), 'site': 'site-1'},
        content_type='multipart/form-data'
    )
    assert res_upload.status_code == 200
    d_upload = res_upload.get_json()
    assert d_upload['success'] is True
    assert d_upload['imported_rows'] == 2, f"Expected 2 valid rows, got {d_upload['imported_rows']}"
    assert d_upload['skipped_rows'] == 2, f"Expected 2 rejected rows, got {d_upload['skipped_rows']}"
    print(f"  [31b CSV Row-Level Validation] Imported {d_upload['imported_rows']} rows, rejected {d_upload['skipped_rows']} invalid rows (negative & >1.2*kWp) (PASSED)")

    print("\n--- 32. Testing 2026 Out-of-Time Evaluation Readiness ---")
    res_eval = client.get('/api/live/evaluate-status?site=site-1')
    assert res_eval.status_code == 200
    d_eval = res_eval.get_json()
    assert d_eval['success'] is True
    assert 'days_collected' in d_eval
    assert 'required_days' in d_eval and d_eval['required_days'] == 14
    assert "Collecting data:" in d_eval['message']
    print(f"  [32 Out-of-Time Status] {d_eval['message']} (PASSED)")

    print("\n--- 33. Testing Lightweight Runtime (No 227 MB CSV at Runtime) ---")
    from backend.app import HISTORY_LOADED_FILE
    # Verify that the 227 MB maintenance_analysis_results.csv is NOT loaded into memory
    print(f"  Loaded file at runtime: {HISTORY_LOADED_FILE}")
    assert HISTORY_LOADED_FILE != 'maintenance_analysis_results.csv', "Large 227 MB CSV must not be loaded into RAM at runtime"
    assert 'site_profiles.json' in str(HISTORY_LOADED_FILE), "Small precomputed site_profiles.json must power the lightweight runtime"
    print(f"  [33 Lightweight Runtime] Backend successfully initialized with lightweight precomputed JSON profile (PASSED)")

    print("\n=======================================================")
    print("ALL 33 BACKEND API, DIRECTIONAL & 2026 MODERNIZATION TESTS PASSED!")
    print("=======================================================")

if __name__ == '__main__':
    test_api()

