"""
backend/decision.py
Shared solar evaluation engine implementing unified decision rules across all endpoints and pages.

Enforces:
- Rule 1: Direction matters (delta_kW, shortfall_kW, excess_kW, lost_kWh never using abs()).
- Rule 2: Directional anomaly handling (Unusually low vs Unusually high).
- Rule 3: Single unified result object (status, grade, severity, reason, action, PR, delta, shortfall, excess, band).
- Rule 4: Data validity checks (capacity limits, negative generation, night-time anomalies, low sunlight threshold).
- Rule 5: Mathematical consistency: sum(shortfall) + sum(min(act, exp)) == expected.
"""

from typing import Dict, Any, Optional, Tuple


def evaluate_solar_reading(
    actual_kw: float,
    expected_kw: Optional[float],
    capacity_kwp: float = 25.0,
    lower_band_kw: Optional[float] = None,
    upper_band_kw: Optional[float] = None,
    hour: int = 12,
    minute: int = 0,
    is_iso_outlier: bool = False,
    prev_actual_kw: Optional[float] = None,
    gen_change_pct: Optional[float] = None,
    cutoffs: Optional[Dict[str, Any]] = None,
    interval_hours: float = 0.5,
    site_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates a single operational observation using the shared single source of truth.
    Returns a unified result dictionary.
    """
    # -------------------------------------------------------------------------
    # 1. Input Data Validity Checks (Rule 4)
    # -------------------------------------------------------------------------
    if actual_kw < 0.0:
        return {
            "is_valid": False,
            "error": "Generation cannot be negative.",
            "status_code": 400
        }

    max_capacity_limit = 1.2 * capacity_kwp
    if actual_kw > max_capacity_limit:
        return {
            "is_valid": False,
            "error": f"Reading ({actual_kw:.2f} kW) exceeds the site's capacity ({capacity_kwp:.1f} kWp). Check the value or the unit.",
            "status_code": 400
        }

    # Night time check (outside 06:00 to 18:59)
    is_night = (hour < 6 or hour >= 19)
    if is_night:
        if actual_kw > (0.05 * capacity_kwp):
            return {
                "is_valid": False,
                "error": f"High power reading ({actual_kw:.2f} kW) reported outside observed daylight hours ({hour:02d}:{minute:02d}). Check the timestamp or meter.",
                "status_code": 400
            }
        # Normal Night Standby
        return {
            "is_valid": True,
            "status": "Normal",
            "grade": "Normal",
            "severity": "normal",
            "action": "Performing as expected. Continue monitoring.",
            "reason": f"Night hours ({hour:02d}:{minute:02d}). Inverter in low-power idle standby.",
            "direction_text": "Night standby",
            "recommendation": "NORMAL",
            "possible_causes": "Normal night idle state",
            "PR": None,
            "performance_ratio": None,
            "delta_kW": 0.0,
            "shortfall_kW": 0.0,
            "excess_kW": 0.0,
            "lost_kWh": 0.0,
            "band": {
                "lower_kW": 0.0,
                "upper_kW": 0.0,
                "p25": 0.82,
                "p50": 0.98,
                "p75": 1.13,
                "site_id": site_id or "default",
                "bias_factor": 1.0
            },
            "validation_warning": None,
            "anomaly_direction": "Normal"
        }

    # -------------------------------------------------------------------------
    # 2. Low-Light Threshold Check (Rule 4)
    # -------------------------------------------------------------------------
    min_light_threshold_kw = 0.05 * capacity_kwp  # e.g. 1.25 kW for 25 kWp
    exp_val = expected_kw if (expected_kw is not None and expected_kw >= 0.0) else 0.0

    if exp_val < min_light_threshold_kw:
        # Not enough sunlight to judge performance
        delta_kw = round(actual_kw - exp_val, 3)
        shortfall_kw = 0.0
        excess_kw = max(0.0, delta_kw)
        lost_kwh = 0.0

        return {
            "is_valid": True,
            "status": "Normal",
            "grade": "Low Sunlight",
            "severity": "info",
            "action": "Low sunlight. Continue monitoring.",
            "reason": "Not enough sunlight to judge performance.",
            "direction_text": "Low sunlight period",
            "recommendation": "NORMAL",
            "possible_causes": "Low morning/evening solar irradiance",
            "PR": None,
            "performance_ratio": None,
            "delta_kW": delta_kw,
            "shortfall_kW": shortfall_kw,
            "excess_kW": excess_kw,
            "lost_kWh": lost_kwh,
            "band": {
                "lower_kW": round(lower_band_kw, 2) if lower_band_kw is not None else 0.0,
                "upper_kW": round(upper_band_kw, 2) if upper_band_kw is not None else round(min_light_threshold_kw, 2),
                "p25": round(cutoffs.get("p25", 0.82), 3) if cutoffs else 0.82,
                "p50": round(cutoffs.get("p50", 0.98), 3) if cutoffs else 0.98,
                "p75": round(cutoffs.get("p75", 1.13), 3) if cutoffs else 1.13,
                "site_id": site_id or "default",
                "bias_factor": round(cutoffs.get("bias_factor", 1.0), 3) if cutoffs else 1.0
            },
            "validation_warning": "Not enough sunlight to judge performance",
            "anomaly_direction": "Normal"
        }

    # -------------------------------------------------------------------------
    # 3. Core Calculations: Delta, PR, Shortfall, Excess, Lost Energy (Rule 1)
    # -------------------------------------------------------------------------
    delta_kw = round(actual_kw - exp_val, 3)
    pr = round(actual_kw / exp_val, 3)
    shortfall_kw = max(0.0, round(exp_val - actual_kw, 3))
    excess_kw = max(0.0, round(actual_kw - exp_val, 3))
    lost_kwh = round(shortfall_kw * interval_hours, 3)

    # Establish Reference Band (Tree spread or default 10%)
    if lower_band_kw is not None and upper_band_kw is not None and upper_band_kw >= lower_band_kw:
        ref_lower = max(0.0, lower_band_kw)
        ref_upper = upper_band_kw
    else:
        ref_lower = max(0.0, exp_val * 0.85)
        ref_upper = exp_val * 1.15

    # Establish Site Empirical Percentiles
    p25 = float(cutoffs.get("p25", 0.82)) if cutoffs else 0.82
    p50 = float(cutoffs.get("p50", 0.98)) if cutoffs else 0.98
    p75 = float(cutoffs.get("p75", 1.13)) if cutoffs else 1.13
    bias_factor = float(cutoffs.get("bias_factor", 1.0)) if cutoffs else 1.0

    # Direction plain-English text (Rule 7)
    if delta_kw > 0.05:
        pct_above = round((delta_kw / exp_val) * 100.0, 1)
        direction_text = f"{pct_above}% above expected"
    elif delta_kw < -0.05:
        pct_below = round((shortfall_kw / exp_val) * 100.0, 1)
        direction_text = f"{pct_below}% below expected"
    else:
        direction_text = "within the usual range"

    # -------------------------------------------------------------------------
    # 4. Directional Anomaly Handling (Rule 2)
    # -------------------------------------------------------------------------
    if actual_kw < ref_lower:
        if is_iso_outlier:
            anomaly_direction = "Unusually low"
        else:
            anomaly_direction = "Below expected band"
    elif actual_kw > ref_upper:
        if is_iso_outlier:
            anomaly_direction = "Unusually high"
        else:
            anomaly_direction = "Above expected band"
    else:
        # Inside the band is normal variation (even if Isolation Forest flagged it)
        anomaly_direction = "Within usual range"

    # -------------------------------------------------------------------------
    # 5. Grading and Cautious Action Mapping (Rule 3)
    # -------------------------------------------------------------------------
    # Very Good: PR >= p75 OR actual > upper band (no data-validity warning)
    if pr >= p75 or actual_kw > ref_upper:
        grade = "Very Good"
        status = "Normal"
        severity = "success"
        action = "Performing above its usual level. No action needed."
        recommendation = "OPTIMAL PERFORMANCE"
        possible_causes = "Clean panels and favourable solar conditions"

        if anomaly_direction == "Unusually high":
            reason = f"Output is above the expected range ({direction_text}). Check the meter reading or input values, or favourable conditions."
        else:
            reason = f"Performing above its usual level ({direction_text}). No action needed."

        shortfall_kw = 0.0
        lost_kwh = 0.0

    # Bad: PR < p25 OR actual < lower band OR "Unusually low"
    elif pr < p25 or actual_kw < ref_lower or anomaly_direction == "Unusually low":
        grade = "Bad"
        severity = "warning"

        # Check for sudden drop vs gradual decline
        is_sudden = (
            anomaly_direction == "Unusually low"
            or (gen_change_pct is not None and gen_change_pct <= -25.0)
            or (prev_actual_kw is not None and prev_actual_kw > 2.0 and actual_kw < (prev_actual_kw * 0.5))
        )

        if is_sudden:
            status = "Inspection"
            severity = "danger"
            action = "Inspection. Possible fault or shading, verify on site."
            recommendation = "INSPECTION RECOMMENDED"
            possible_causes = "Possible fault, shading, or inverter issue (verify on site)"
            reason = f"Inspection. Possible fault or shading, verify on site ({direction_text})."
        else:
            status = "Cleaning Review"
            severity = "warning"
            action = "Cleaning Review. Possible soiling, verify by inspection."
            recommendation = "CLEANING RECOMMENDED"
            possible_causes = "Possible soiling or gradual environmental degradation (verify by inspection)"
            reason = f"Cleaning Review. Possible soiling, verify by inspection ({direction_text})."

    # Normal: Within typical band (p25 to p75)
    else:
        grade = "Normal"
        status = "Normal"
        severity = "normal"
        action = "Performing as expected. Continue monitoring."
        recommendation = "NORMAL"
        possible_causes = "Normal operation"
        reason = f"Performing as expected ({direction_text}). Continue monitoring."

    return {
        "is_valid": True,
        "status": status,
        "grade": grade,
        "severity": severity,
        "action": action,
        "reason": reason,
        "direction_text": direction_text,
        "recommendation": recommendation,
        "possible_causes": possible_causes,
        "PR": pr,
        "performance_ratio": pr,
        "delta_kW": delta_kw,
        "shortfall_kW": shortfall_kw,
        "excess_kW": excess_kw,
        "lost_kWh": lost_kwh,
        "band": {
            "lower_kW": round(ref_lower, 2),
            "upper_kW": round(ref_upper, 2),
            "p25": round(p25, 3),
            "p50": round(p50, 3),
            "p75": round(p75, 3),
            "site_id": site_id or "default",
            "bias_factor": round(bias_factor, 3)
        },
        "validation_warning": None,
        "anomaly_direction": anomaly_direction
    }


def aggregate_energy_period(rows: list, interval_hours: float = 0.5) -> Dict[str, float]:
    """
    Computes energy balance over a collection of interval readings (Rule 5):
    - sum(shortfall_kWh) + sum(min(actual, expected)) == expected_kWh (within rounding)
    - actual_kWh = expected_kWh - shortfall_kWh + excess_kWh
    """
    total_actual_kwh = 0.0
    total_expected_kwh = 0.0
    total_shortfall_kwh = 0.0
    total_excess_kwh = 0.0
    total_min_energy_kwh = 0.0

    for r in rows:
        act = max(0.0, float(r.get("actual_kw", r.get("actual_generation", 0.0))))
        exp = max(0.0, float(r.get("expected_kw", r.get("expected_generation", act))))

        shortfall = max(0.0, exp - act)
        excess = max(0.0, act - exp)
        min_pwr = min(act, exp)

        total_actual_kwh += act * interval_hours
        total_expected_kwh += exp * interval_hours
        total_shortfall_kwh += shortfall * interval_hours
        total_excess_kwh += excess * interval_hours
        total_min_energy_kwh += min_pwr * interval_hours

    # Check sum(shortfall) + sum(min(act, exp)) == expected
    balance_error = abs((total_shortfall_kwh + total_min_energy_kwh) - total_expected_kwh)
    net_actual_calc = total_expected_kwh - total_shortfall_kwh + total_excess_kwh
    net_error = abs(net_actual_calc - total_actual_kwh)

    overall_pr = (
        round(total_actual_kwh / total_expected_kwh, 3)
        if total_expected_kwh > 0.01
        else None
    )

    return {
        "actual_kWh": round(total_actual_kwh, 2),
        "expected_kWh": round(total_expected_kwh, 2),
        "shortfall_kWh": round(total_shortfall_kwh, 2),
        "excess_kWh": round(total_excess_kwh, 2),
        "lost_kWh": round(total_shortfall_kwh, 2),  # Shortfall ONLY
        "overall_PR": overall_pr,
        "is_balanced": (balance_error < 0.05 and net_error < 0.05),
        "balance_error": round(balance_error, 4)
    }
