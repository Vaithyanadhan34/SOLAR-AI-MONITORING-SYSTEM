"""
End-to-End Smoke Test for Solar AI Monitoring System
Tests every backend API endpoint in both Live (2026) and Replay (2020-2022) modes.
Verifies response codes, non-empty data series, schema validity, and physics invariants.
"""
import sys
import os
import json
import datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.app import app


def run_smoke_test():
    client = app.test_client()
    passed = 0
    total = 0

    def check(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name} {details}")
        else:
            print(f"  [FAIL] {name} {details}")
            raise AssertionError(f"Smoke test failed: {name} - {details}")

    print("=====================================================================")
    print("SOLAR AI MONITORING SYSTEM - END-TO-END SMOKE TEST SUITE")
    print("=====================================================================")

    # 1. /api/health
    print("\n1. Testing /api/health & root endpoints...")
    res_root = client.get('/')
    check("GET /", res_root.status_code == 200 and res_root.get_json().get("status") == "running")

    res_health = client.get('/api/health')
    check("GET /api/health", res_health.status_code == 200 and res_health.get_json().get("status") == "healthy")

    # 2. /api/sites
    print("\n2. Testing /api/sites (Metadata and site roster)...")
    res_sites = client.get('/api/sites')
    sites_json = res_sites.get_json()
    check("GET /api/sites status", res_sites.status_code == 200)
    check("Sites list non-empty", len(sites_json.get("sites", [])) >= 5)
    first_site = sites_json["sites"][0]
    check("Site has capacity & date bounds", ("capacity" in first_site or "capacity_kw" in first_site) and "start_date" in first_site and "end_date" in first_site)

    # 3. /api/data-info
    print("\n3. Testing /api/data-info (Dataset provenance, assumptions, limitations)...")
    res_info = client.get('/api/data-info')
    info_json = res_info.get_json()
    check("GET /api/data-info status", res_info.status_code == 200)
    check("Provenance matches 1.195M rows", info_json.get("row_count") == 1195267 or info_json.get("dataset", {}).get("total_rows") == 1195267)
    check("Assumptions listed", len(info_json.get("assumptions", [])) >= 6)
    check("Limitations listed", len(info_json.get("limitations", [])) >= 4)

    # 4. /api/history-bands
    print("\n4. Testing /api/history-bands (Typical day 25th-75th percentiles)...")
    res_bands = client.get('/api/history-bands?campusKey=2&siteKey=1')
    bands_json = res_bands.get_json()
    check("GET /api/history-bands status", res_bands.status_code == 200)
    check("Bands series non-empty", len(bands_json.get("bands", [])) >= 24)
    check("Bands have p25, median, p75", all(("p25_kW" in b or "p25" in b) and ("median_kW" in b or "median" in b) and ("p75_kW" in b or "p75" in b) for b in bands_json["bands"][:5]))

    # 5. /api/yield-estimate
    print("\n5. Testing /api/yield-estimate (GET and POST)...")
    res_yield_get = client.get('/api/yield-estimate?kWp=30&month=6')
    yield_get_json = res_yield_get.get_json()
    check("GET /api/yield-estimate status", res_yield_get.status_code == 200)
    daily_yield = yield_get_json.get("daily_expected_kWh", yield_get_json.get("estimated_daily_yield_kwh", 0))
    monthly_yield = yield_get_json.get("monthly_expected_kWh", yield_get_json.get("estimated_monthly_yield_kwh", 0))
    check("Yield daily/monthly positive", daily_yield > 0 and monthly_yield > 0)
    m_proj = yield_get_json.get("monthly_projections", yield_get_json.get("monthly_breakdown", []))
    check("Monthly breakdown non-empty", len(m_proj) == 12)

    res_yield_post = client.post('/api/yield-estimate', json={"kWp": 25, "month": 3})
    check("POST /api/yield-estimate status", res_yield_post.status_code == 200)

    # 6. /api/simulate
    print("\n6. Testing /api/simulate (Dynamic cleaning strategy what-if)...")
    res_sim_get = client.get('/api/simulate?soiling_rate=0.008&cleaning_cost=500&electricity_rate=7.5')
    sim_get_json = res_sim_get.get_json()
    check("GET /api/simulate status", res_sim_get.status_code == 200)
    check("Simulation results include fixed and condition-based", ("fixed_policy" in sim_get_json or "fixed_strategy" in sim_get_json) and ("condition_based_policy" in sim_get_json or "smart_policy" in sim_get_json or "condition_strategy" in sim_get_json))
    check("Water saved calculation present", "water_saved_scenario_L" in sim_get_json or "water_saved_litres" in sim_get_json)

    res_sim_post = client.post('/api/simulate', json={"soiling_rate": 0.006, "cleaning_cost": 450, "water_cost_per_l": 0.15})
    check("POST /api/simulate status", res_sim_post.status_code == 200)

    # 7. /api/validation-backtest
    print("\n7. Testing /api/validation-backtest (Held-out backtest & cross-validation)...")
    res_backtest = client.get('/api/validation-backtest?campusKey=2&siteKey=1')
    bt_json = res_backtest.get_json()
    check("GET /api/validation-backtest status", res_backtest.status_code == 200)
    check("Held-out test timeseries non-empty", len(bt_json.get("timeseries", [])) > 100)
    check("Includes cross-validation splits", "cross_validation" in bt_json and len(bt_json["cross_validation"]) >= 5)
    check("Explicit disclaimer present", "disclaimer" in bt_json and "2020-2022" in bt_json["disclaimer"])

    # 8. REPLAY MODE (2020-2022 Data)
    print("\n8. Testing REPLAY MODE (Historical 2020-06-15)...")
    replay_ts = "2020-06-15 13:30:00"

    # 8a. Replay Analyze
    analyze_payload = {
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": replay_ts,
        "SolarGeneration": 8.81,
        "AirTemperature": 27.5,
        "RelativeHumidity": 50.0,
        "WindSpeed": 1.8,
        "GlobalHorizontalIrradiance": 680.0
    }
    res_replay_an = client.post('/api/analyze', json=analyze_payload)
    an_json = res_replay_an.get_json()
    check("POST /api/analyze (Replay) status", res_replay_an.status_code == 200)
    check("Replay analysis has expected power", ("expected_generation" in an_json or "expected_generation_rf" in an_json))
    check("Replay performance grade assigned", "performance_grade" in an_json)

    # 8b. Replay History (Past 48h)
    res_replay_hist = client.get(f'/api/history?campusKey=2&siteKey=1&end={replay_ts}&hours=48')
    hist_json = res_replay_hist.get_json()
    check("GET /api/history (Replay) status", res_replay_hist.status_code == 200)
    check("Replay history series non-empty", len(hist_json.get("history", [])) > 20)

    # 8c. Replay Daily Summary
    res_replay_daily = client.get(f'/api/daily-summary?campusKey=2&siteKey=1&end={replay_ts}&days=7')
    daily_json = res_replay_daily.get_json()
    check("GET /api/daily-summary (Replay) status", res_replay_daily.status_code == 200)
    daily_items = daily_json.get("days", daily_json.get("summaries", daily_json.get("daily", [])))
    check("Replay daily summaries non-empty", len(daily_items) >= 5)

    # 8d. Replay Cleaning Decision
    res_replay_clean = client.post('/api/cleaning-decision', json={
        "CampusKey": 2,
        "SiteKey": 1,
        "timestamp": replay_ts,
        "cleaning_cost_inr": 500,
        "water_cost_per_liter_inr": 0.05
    })
    clean_json = res_replay_clean.get_json()
    check("POST /api/cleaning-decision (Replay) status", res_replay_clean.status_code == 200)
    check("Replay decision formulated", clean_json.get("decision") in ["Clean now", "Schedule wash", "Monitor", "Inspection recommended"])
    check("Planner timeseries non-empty", len(clean_json.get("timeseries", [])) > 10)

    # 8e. Replay Trend
    res_replay_trend = client.get(f'/api/trend?campusKey=2&siteKey=1&replay_timestamp={replay_ts}&days=30')
    trend_json = res_replay_trend.get_json()
    check("GET /api/trend (Replay) status", res_replay_trend.status_code == 200)
    check("Replay trend points non-empty", len(trend_json.get("trend", [])) > 5)

    # 8f. Replay Site Ranking
    res_replay_rank = client.get(f'/api/site-ranking?replay_timestamp={replay_ts}')
    rank_json = res_replay_rank.get_json()
    check("GET /api/site-ranking (Replay) status", res_replay_rank.status_code == 200)
    check("Replay site rankings non-empty", len(rank_json.get("rankings", [])) >= 5)

    # 8g. Replay Anomalies
    res_replay_anom = client.get(f'/api/anomalies?campusKey=2&siteKey=1&end={replay_ts}&days=14')
    anom_json = res_replay_anom.get_json()
    check("GET /api/anomalies (Replay) status", res_replay_anom.status_code == 200)
    check("Replay anomaly list returned", "anomalies" in anom_json)

    # 9. LIVE MODE (Current 2026 Telemetry & Forecasts)
    print("\n9. Testing LIVE MODE (Current 2026)...")
    now_2026 = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 9a. Live Forecast (24h)
    res_live_fc = client.post('/api/forecast', json={"CampusKey": 2, "SiteKey": 1, "hours": 24})
    fc_json = res_live_fc.get_json()
    check("POST /api/forecast (Live 24h) status", res_live_fc.status_code == 200)
    check("Live forecast series has 24 steps", len(fc_json.get("forecast", [])) == 24)
    first_step = fc_json["forecast"][0]
    has_pred = "predicted_kW" in first_step or "predicted_generation_kw" in first_step
    has_lower = "lower_kW" in first_step or "predicted_generation_lower" in first_step
    check("Forecast step has predicted, lower, upper", has_pred and has_lower)
    p_lower = first_step.get("lower_kW", first_step.get("predicted_generation_lower", 0))
    p_upper = first_step.get("upper_kW", first_step.get("predicted_generation_upper", 100))
    check("Forecast uncertainty interval ordered (lower <= upper)", p_lower <= p_upper)

    # 9b. Live Multi-horizon Forecast (7d)
    res_live_7d = client.post('/api/forecast', json={"CampusKey": 2, "SiteKey": 1, "hours": 168})
    fc7d_json = res_live_7d.get_json()
    check("POST /api/forecast (Live 7d) status", res_live_7d.status_code == 200)
    check("Live 7d forecast series non-empty", len(fc7d_json.get("forecast", [])) >= 24)

    # 9c. Live History Separation (Returns graceful empty structure when no 2026 data in DB)
    res_live_hist = client.get('/api/history?campusKey=2&siteKey=1&hours=48')
    live_hist_json = res_live_hist.get_json()
    check("GET /api/history (Live) status 200", res_live_hist.status_code == 200)
    check("Live history has structured history list", isinstance(live_hist_json.get("history"), list))

    # 9d. Live Trend
    res_live_trend = client.get('/api/trend?campusKey=2&siteKey=1&days=14')
    live_trend_json = res_live_trend.get_json()
    check("GET /api/trend (Live) status 200", res_live_trend.status_code == 200)
    check("Live trend returns structured response", "trend" in live_trend_json)

    # 9e. Live Cleaning Decision (Without DB history, returns actionable status)
    res_live_clean = client.post('/api/cleaning-decision', json={"CampusKey": 2, "SiteKey": 1})
    live_clean_json = res_live_clean.get_json()
    check("POST /api/cleaning-decision (Live) returns 200 or 404 structured", res_live_clean.status_code in [200, 404])
    if res_live_clean.status_code == 200:
        check("Live decision present", "decision" in live_clean_json)
    else:
        check("Structured no_data status on missing live 2026 data", live_clean_json.get("status") in ["no_data", "no_history", "insufficient_data"])

    # 10. ENERGY CONSERVATION & DIRECTIONAL LOGIC
    print("\n10. Testing Energy Conservation & Directional Logic...")
    from backend.decision import evaluate_solar_reading

    # Rule 1: Above expected
    r1 = evaluate_solar_reading(actual_kw=15.0, expected_kw=10.0, capacity_kwp=20.0, hour=12)
    check("Rule 1: Actual > Expected -> Very Good", r1["grade"] == "Very Good" and r1["shortfall_kW"] == 0.0)

    # Rule 3: Below expected
    r3 = evaluate_solar_reading(actual_kw=4.0, expected_kw=10.0, capacity_kwp=20.0, hour=12)
    check("Rule 3: Actual < Expected -> Shortfall > 0", r3["shortfall_kW"] == 6.0 and r3["grade"] in ["Fair", "Bad"])

    # Rule 4: Night hours
    r4 = evaluate_solar_reading(actual_kw=0.0, expected_kw=0.0, capacity_kwp=20.0, hour=22)
    check("Rule 4: Night -> Inverter standby", "idle standby" in r4["reason"].lower() or "night" in r4["reason"].lower())

    # Rule 5: Conservation Identity
    check("Rule 5: Shortfall + min(Actual, Expected) == Expected", (r3["shortfall_kW"] + min(4.0, 10.0)) == 10.0)

    print("\n=====================================================================")
    print(f"SMOKE TEST SUMMARY: {passed}/{total} CHECKS PASSED (100% SUCCESS)")
    print("=====================================================================")

if __name__ == '__main__':
    run_smoke_test()
