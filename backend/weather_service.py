import datetime
import logging
from typing import Dict, List, Any, Optional
import requests
import numpy as np
import pandas as pd
import pytz

try:
    import pvlib
    PVLIB_AVAILABLE = True
except ImportError:
    PVLIB_AVAILABLE = False

logger = logging.getLogger("solar_ai.weather")

class LiveWeatherUnavailableError(Exception):
    """Raised when the Open-Meteo live weather API fails or is unreachable."""
    pass

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

def fetch_live_weather_forecast(
    latitude: float,
    longitude: float,
    timezone: str = "Asia/Kolkata",
    forecast_days: int = 7,
    timeout_sec: float = 6.0
) -> Dict[str, Any]:
    """
    Fetches real-time weather and irradiance forecast from Open-Meteo API.
    Raises LiveWeatherUnavailableError if connection fails or status is not 200.
    Never silently substitutes old data.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,cloud_cover",
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,cloud_cover",
        "wind_speed_unit": "ms", # Ensures unit matches training data m/s
        "timezone": timezone,
        "forecast_days": forecast_days
    }
    try:
        resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=timeout_sec)
        if resp.status_code != 200:
            raise LiveWeatherUnavailableError(
                f"Open-Meteo returned status {resp.status_code}: {resp.text[:100]}"
            )
        data = resp.json()
        if "hourly" not in data or "time" not in data["hourly"]:
            raise LiveWeatherUnavailableError("Malformed response structure from Open-Meteo.")
        return data
    except (requests.RequestException, ValueError) as exc:
        logger.error(f"Failed to fetch live weather from Open-Meteo: {exc}")
        raise LiveWeatherUnavailableError(f"Live weather unavailable: {str(exc)}") from exc

def fetch_recent_weather_history(
    latitude: float,
    longitude: float,
    days: int = 7,
    timezone: str = "Asia/Kolkata",
    timeout_sec: float = 6.0
) -> Dict[str, Any]:
    """
    Fetches actual recent weather for the past X days in 2026 using past_days parameter.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,cloud_cover",
        "wind_speed_unit": "ms",
        "timezone": timezone,
        "past_days": min(max(1, days), 14),
        "forecast_days": 1
    }
    try:
        resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=timeout_sec)
        if resp.status_code != 200:
            raise LiveWeatherUnavailableError(f"Open-Meteo past weather returned {resp.status_code}")
        return resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.error(f"Failed fetching past weather: {exc}")
        raise LiveWeatherUnavailableError(f"Live weather unavailable: {str(exc)}") from exc

def simulate_pvlib_physics(
    capacity_kwp: float,
    tilt_deg: float,
    azimuth_deg: float,
    latitude: float,
    longitude: float,
    timestamps: List[str],
    temperatures: List[float],
    irradiances: List[float],
    timezone: str = "Asia/Kolkata"
) -> List[float]:
    """
    Computes a physics-based expected power line using pvlib.
    Label: 'Physics-model estimate (simulated)'. Never used as actual or training target.
    """
    if not PVLIB_AVAILABLE or not timestamps:
        # Fallback to simple physics approximation: GHI * Capacity / 1000 * temp_derate
        results = []
        for ghi, temp in zip(irradiances, temperatures):
            ghi_val = max(0.0, float(ghi or 0.0))
            temp_val = float(temp or 25.0)
            derate = 1.0 - 0.004 * max(0.0, temp_val - 25.0)
            pwr = round(max(0.0, min(capacity_kwp, (ghi_val / 1000.0) * capacity_kwp * 0.85 * derate)), 2)
            results.append(pwr)
        return results

    try:
        times_idx = pd.to_datetime(timestamps)
        if times_idx.tz is None:
            times_idx = times_idx.tz_localize(timezone)

        solpos = pvlib.solarposition.get_solarposition(times_idx, latitude, longitude)
        apparent_zenith = solpos['apparent_zenith']
        apparent_azimuth = solpos['azimuth']

        ghi_series = pd.Series([max(0.0, float(x or 0.0)) for x in irradiances], index=times_idx)
        temp_series = pd.Series([float(x or 25.0) for x in temperatures], index=times_idx)

        # Estimate DNI and DHI from GHI using Erbs model
        erbs_res = pvlib.irradiance.erbs(ghi_series, apparent_zenith, times_idx)
        dni = erbs_res['dni'].fillna(0.0)
        dhi = erbs_res['dhi'].fillna(0.0)

        # Total plane of array irradiance
        poa = pvlib.irradiance.get_total_irradiance(
            surface_tilt=tilt_deg,
            surface_azimuth=azimuth_deg,
            solar_zenith=apparent_zenith,
            solar_azimuth=apparent_azimuth,
            dni=dni,
            ghi=ghi_series,
            dhi=dhi
        )
        poa_global = poa['poa_global'].fillna(0.0)

        # Cell temperature estimate
        cell_temp = pvlib.temperature.faiman(poa_global, temp_series)

        # PVWatts DC output
        pdc = pvlib.pvsystem.pvwatts_dc(
            poa_global,
            cell_temp,
            pdc0=capacity_kwp,
            gamma_pdc=-0.004
        )
        return [round(float(max(0.0, min(capacity_kwp, val))), 2) for val in pdc.fillna(0.0)]
    except Exception as e:
        logger.warning(f"pvlib calculation error: {e}, using empirical physics fallback")
        results = []
        for ghi, temp in zip(irradiances, temperatures):
            ghi_val = max(0.0, float(ghi or 0.0))
            temp_val = float(temp or 25.0)
            derate = 1.0 - 0.004 * max(0.0, temp_val - 25.0)
            pwr = round(max(0.0, min(capacity_kwp, (ghi_val / 1000.0) * capacity_kwp * 0.85 * derate)), 2)
            results.append(pwr)
        return results

if __name__ == '__main__':
    print("Testing Open-Meteo live forecast connection for Chennai (13.0827, 80.2707)...")
    try:
        fc = fetch_live_weather_forecast(13.0827, 80.2707, "Asia/Kolkata", 1)
        h = fc['hourly']
        print(f"Success! Retrieved {len(h['time'])} forecast steps.")
        print("First 3 steps:", list(zip(h['time'][:3], h['temperature_2m'][:3], h['wind_speed_10m'][:3], h['shortwave_radiation'][:3])))
        
        phys = simulate_pvlib_physics(
            capacity_kwp=25.0,
            tilt_deg=15.0,
            azimuth_deg=180.0,
            latitude=13.0827,
            longitude=80.2707,
            timestamps=h['time'][:5],
            temperatures=h['temperature_2m'][:5],
            irradiances=h['shortwave_radiation'][:5]
        )
        print("pvlib simulated power for first 5 steps:", phys)
    except Exception as exc:
        print("Error during test:", exc)
