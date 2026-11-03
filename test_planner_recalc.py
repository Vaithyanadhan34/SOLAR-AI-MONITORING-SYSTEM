"""
Unit test verifying that frontend recomputation of the cleaning decision
matches the Flask backend /api/cleaning-decision output across real data
and multiple slider combinations.
"""

import math
import requests

BASE_URL = "http://127.0.0.1:5000"

def frontend_recompute_cleaning_decision(base_data, water_per_wash_L, cleaning_cost, tariff_per_kwh):
    """
    Simulates the exact frontend recalculation performed in useMemo in CleaningPlannerPage.
    """
    base_timeseries = base_data.get("timeseries", [])
    base_decision = base_data.get("decision", "Wait")
    
    clean_now_threshold_kwh = round(cleaning_cost / tariff_per_kwh, 2)
    
    recomputed_timeseries = []
    crossed_threshold_date = None
    total_cum_val = 0.0
    total_cum_kwh = 0.0
    
    for pt in base_timeseries:
        cum_kwh = pt["cum_lost_kwh"]
        cum_val = round(cum_kwh * tariff_per_kwh, 2)
        total_cum_val = cum_val
        total_cum_kwh = cum_kwh
        
        if crossed_threshold_date is None and cum_val >= cleaning_cost:
            crossed_threshold_date = pt["date"]
            
        recomputed_timeseries.append({
            "date": pt["date"],
            "daily_lost_kwh": pt["daily_lost_kwh"],
            "cum_lost_kwh": cum_kwh,
            "cum_lost_value": cum_val,
            "cleaning_cost": cleaning_cost,
            "threshold_kwh": clean_now_threshold_kwh
        })
        
    if base_decision == "Inspect":
        decision = "Inspect"
        action_line = "Sudden high deficit detected. Inspect electrical wiring, inverters, or physical shading before washing."
        water_saved = float(water_per_wash_L)
    elif total_cum_val >= cleaning_cost:
        decision = "Clean now"
        action_line = f"Cumulative lost value ({total_cum_val:.1f}) exceeds cleaning cost ({cleaning_cost:.1f}). Washing is economically justified."
        water_saved = 0.0
    else:
        decision = "Wait"
        action_line = f"Cumulative loss ({total_cum_val:.1f}) has not reached cleaning cost ({cleaning_cost:.1f}). Wait before washing."
        water_saved = float(water_per_wash_L)
        
    return {
        "decision": decision,
        "action_line": action_line,
        "cumulative_lost_value": round(total_cum_val, 2),
        "cumulative_lost_kwh": round(total_cum_kwh, 2),
        "cleaning_cost": cleaning_cost,
        "clean_now_threshold_kwh": clean_now_threshold_kwh,
        "crossed_threshold_date": crossed_threshold_date,
        "water_saved_scenario_L": water_saved,
        "timeseries": recomputed_timeseries
    }

def run_tests():
    site = "site-1"
    timestamp = "2020-06-15 12:00:00"
    
    print("\n--- 1. Fetching Baseline from Backend ---")
    base_resp = requests.post(f"{BASE_URL}/api/cleaning-decision", json={
        "site": site,
        "timestamp": timestamp,
        "water_per_wash_L": 500.0,
        "cleaning_cost": 500.0,
        "tariff_per_kwh": 8.0,
    })
    assert base_resp.status_code == 200, f"Backend returned {base_resp.status_code}: {base_resp.text}"
    base_data = base_resp.json()
    print(f"Base decision: {base_data['decision']}, cumulative_lost_value: {base_data['cumulative_lost_value']}")
    
    # Test combinations
    test_cases = [
        {"name": "Combo 1: Lower cost, lower tariff (Clean now expected)", "water": 350.0, "cost": 250.0, "tariff": 6.0},
        {"name": "Combo 2: High cost, high tariff (Wait expected)", "water": 900.0, "cost": 1800.0, "tariff": 7.5},
        {"name": "Combo 3: Intermediate threshold crossover", "water": 600.0, "cost": 750.0, "tariff": 10.0},
        {"name": "Combo 4: Edge case low water, high cost", "water": 150.0, "cost": 2200.0, "tariff": 4.5},
    ]
    
    passed_all = True
    for tc in test_cases:
        print(f"\n--- Testing {tc['name']} ---")
        # 1. Backend call
        b_resp = requests.post(f"{BASE_URL}/api/cleaning-decision", json={
            "site": site,
            "timestamp": timestamp,
            "water_per_wash_L": tc["water"],
            "cleaning_cost": tc["cost"],
            "tariff_per_kwh": tc["tariff"],
        })
        assert b_resp.status_code == 200
        backend_res = b_resp.json()
        
        # 2. Frontend recompute
        frontend_res = frontend_recompute_cleaning_decision(
            base_data, tc["water"], tc["cost"], tc["tariff"]
        )
        
        # 3. Assertions
        print(f"Backend  : Decision={backend_res['decision']}, Threshold={backend_res['clean_now_threshold_kwh']}, LossVal={backend_res['cumulative_lost_value']}, Cross={backend_res['crossed_threshold_date']}")
        print(f"Frontend : Decision={frontend_res['decision']}, Threshold={frontend_res['clean_now_threshold_kwh']}, LossVal={frontend_res['cumulative_lost_value']}, Cross={frontend_res['crossed_threshold_date']}")
        
        assert frontend_res["decision"] == backend_res["decision"], \
            f"Decision mismatch: FE={frontend_res['decision']} vs BE={backend_res['decision']}"
            
        assert abs(frontend_res["clean_now_threshold_kwh"] - backend_res["clean_now_threshold_kwh"]) < 0.05, \
            f"Threshold mismatch: FE={frontend_res['clean_now_threshold_kwh']} vs BE={backend_res['clean_now_threshold_kwh']}"
            
        assert abs(frontend_res["cumulative_lost_value"] - backend_res["cumulative_lost_value"]) < 0.1, \
            f"Loss value mismatch: FE={frontend_res['cumulative_lost_value']} vs BE={backend_res['cumulative_lost_value']}"
            
        assert frontend_res["crossed_threshold_date"] == backend_res["crossed_threshold_date"], \
            f"Cross date mismatch: FE={frontend_res['crossed_threshold_date']} vs BE={backend_res['crossed_threshold_date']}"
            
        assert frontend_res["water_saved_scenario_L"] == backend_res["water_saved_scenario_L"], \
            f"Water saved mismatch: FE={frontend_res['water_saved_scenario_L']} vs BE={backend_res['water_saved_scenario_L']}"
            
        print(f"PASS: {tc['name']} matches backend output 100%!")

    print("\n=======================================================")
    print("ALL 4 RECALCULATION UNIT TEST COMBINATIONS PASSED!")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
