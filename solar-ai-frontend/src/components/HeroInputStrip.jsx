import React, { useState, useEffect } from 'react';
import { fetchSites, fetchDatasetValues } from '../services/api';

const DEFAULT_SITES = [
  { id: 'site-1', name: 'Site 1 (Campus 2)', campusKey: 2, siteKey: 1, capacity: '25.0', panels: '100' },
  { id: 'site-2', name: 'Site 2 (Campus 2)', campusKey: 2, siteKey: 2, capacity: '20.0', panels: '80' },
  { id: 'site-3', name: 'Site 3 (Campus 2)', campusKey: 2, siteKey: 3, capacity: '30.0', panels: '120' },
];

export default function HeroInputStrip({
  onAnalyze,
  isLoading,
  isBackendConnected,
  onSiteOrDateChange,
  currentSite,
  currentTimestamp,
}) {
  const [sites, setSites] = useState(DEFAULT_SITES);
  const [selectedSiteId, setSelectedSiteId] = useState(currentSite?.id || 'site-1');
  const [timestamp, setTimestamp] = useState(currentTimestamp || '2020-06-15T13:30');
  const [actualPower, setActualPower] = useState('18.5');
  const [airTemp, setAirTemp] = useState('28.5');
  const [humidity, setHumidity] = useState('42.0');
  const [windSpeed, setWindSpeed] = useState('3.2');
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Load sites from backend
  useEffect(() => {
    let active = true;
    const loadSites = async () => {
      try {
        const res = await fetchSites();
        if (active && res?.success && res.sites?.length) {
          setSites(res.sites);
        }
      } catch {
        // Fallback to defaults
      }
    };
    if (isBackendConnected) {
      loadSites();
    }
    return () => { active = false; };
  }, [isBackendConnected]);

  // Sync state if parent changes currentSite or currentTimestamp
  useEffect(() => {
    if (currentSite?.id && currentSite.id !== selectedSiteId) {
      setSelectedSiteId(currentSite.id);
    }
  }, [currentSite]);

  useEffect(() => {
    if (currentTimestamp && currentTimestamp !== timestamp) {
      setTimestamp(currentTimestamp);
    }
  }, [currentTimestamp]);

  // Auto-fetch telemetry values when site or timestamp changes
  const autoPopulateValues = async (siteId, ts) => {
    const s = sites.find((x) => x.id === siteId) || sites[0];
    if (!s || !ts || !isBackendConnected) return;

    setIsAutoLoading(true);
    try {
      const data = await fetchDatasetValues(s.campusKey, s.siteKey, ts);
      if (data?.success && data.values) {
        const v = data.values;
        if (v.SolarGeneration !== undefined) setActualPower(String(v.SolarGeneration));
        if (v.AirTemperature !== undefined) setAirTemp(String(v.AirTemperature));
        if (v.RelativeHumidity !== undefined) setHumidity(String(v.RelativeHumidity));
        if (v.WindSpeed !== undefined) setWindSpeed(String(v.WindSpeed));
      }
    } catch {
      // Keep existing manual inputs if dataset values not found
    } finally {
      setIsAutoLoading(false);
    }
  };

  const handleSiteChange = (e) => {
    const newId = e.target.value;
    setSelectedSiteId(newId);
    const chosen = sites.find((s) => s.id === newId);
    if (onSiteOrDateChange && chosen) {
      onSiteOrDateChange(chosen, timestamp);
    }
    autoPopulateValues(newId, timestamp);
  };

  const handleTimestampChange = (e) => {
    const newTs = e.target.value;
    setTimestamp(newTs);
    const chosen = sites.find((s) => s.id === selectedSiteId);
    if (onSiteOrDateChange && chosen) {
      onSiteOrDateChange(chosen, newTs);
    }
    autoPopulateValues(selectedSiteId, newTs);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const siteObj = sites.find((s) => s.id === selectedSiteId) || sites[0];
    const payload = {
      site: siteObj.id,
      campusKey: siteObj.campusKey,
      siteKey: siteObj.siteKey,
      capacity: parseFloat(siteObj.capacity) || 25.0,
      panels: parseInt(siteObj.panels, 10) || 100,
      timestamp: timestamp,
      SolarGeneration: parseFloat(actualPower) || 0.0,
      AirTemperature: parseFloat(airTemp) || 25.0,
      RelativeHumidity: parseFloat(humidity) || 50.0,
      WindSpeed: parseFloat(windSpeed) || 2.0,
    };
    onAnalyze(payload);
  };

  return (
    <section className="hero-strip" aria-label="Solar input analysis row">
      {/* Subtle Sun Motif (inline SVG, low opacity) */}
      <div className="sun-motif" aria-hidden="true">
        <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="300" cy="300" r="140" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.45" />
          <circle cx="300" cy="300" r="210" stroke="currentColor" strokeWidth="1" strokeDasharray="8 6" opacity="0.3" />
          <circle cx="300" cy="300" r="280" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
          <path d="M300 40 V100 M300 500 V560 M40 300 H100 M500 300 H560" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
          <path d="M116 116 L158 158 M442 442 L484 484 M484 116 L442 158 M116 484 L158 442" stroke="currentColor" strokeWidth="1" opacity="0.25" />
        </svg>
      </div>

      <div className="hero-content">
        <div className="hero-header-row">
          <h2 className="hero-title">Your panels</h2>
          <span className="hero-badge">{isAutoLoading ? 'Syncing...' : 'Live entry'}</span>
        </div>

        <form onSubmit={handleSubmit} className="hero-form">
          {/* Row 1: Site, Date and time */}
          <div className="hero-row hero-row-1">
            <div className="input-unit">
              <label htmlFor="site-select" className="input-label">Site</label>
              <select
                id="site-select"
                className="compact-select"
                value={selectedSiteId}
                onChange={handleSiteChange}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.capacity} kWp)
                  </option>
                ))}
              </select>
            </div>

            <div className="input-unit">
              <label htmlFor="timestamp-input" className="input-label">Date and time</label>
              <input
                id="timestamp-input"
                type="datetime-local"
                className="compact-input"
                value={timestamp}
                min="2020-01-01T00:00"
                max="2022-12-31T23:59"
                onChange={handleTimestampChange}
                required
              />
            </div>
          </div>

          {/* Row 2: Actual power, Temp, Humidity, Wind, Analyze Button */}
          <div className="hero-row hero-row-2">
            <div className="input-unit">
              <div className="label-with-tip">
                <label htmlFor="actual-power-input" className="input-label">Power now</label>
                <div
                  className="tooltip-anchor"
                  onMouseEnter={() => setTooltipVisible(true)}
                  onMouseLeave={() => setTooltipVisible(false)}
                  onFocus={() => setTooltipVisible(true)}
                  onBlur={() => setTooltipVisible(false)}
                  tabIndex={0}
                  role="tooltip"
                  aria-label="Power now tooltip"
                >
                  <span className="tip-trigger">?</span>
                  {tooltipVisible && (
                    <div className="tip-popover" role="tooltip">
                      Current generation reading from the site inverter in kW.
                    </div>
                  )}
                </div>
              </div>
              <div className="input-with-affix">
                <input
                  id="actual-power-input"
                  type="number"
                  step="0.1"
                  min="0"
                  className="compact-input"
                  value={actualPower}
                  onChange={(e) => setActualPower(e.target.value)}
                  placeholder="0.0"
                  required
                />
                <span className="affix">kW</span>
              </div>
            </div>

            <div className="input-unit">
              <label htmlFor="air-temp-input" className="input-label">Temp</label>
              <div className="input-with-affix">
                <input
                  id="air-temp-input"
                  type="number"
                  step="0.5"
                  className="compact-input"
                  value={airTemp}
                  onChange={(e) => setAirTemp(e.target.value)}
                  placeholder="25.0"
                  required
                />
                <span className="affix">°C</span>
              </div>
            </div>

            <div className="input-unit">
              <label htmlFor="humidity-input" className="input-label">Humidity</label>
              <div className="input-with-affix">
                <input
                  id="humidity-input"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  className="compact-input"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  placeholder="50"
                  required
                />
                <span className="affix">%</span>
              </div>
            </div>

            <div className="input-unit">
              <label htmlFor="wind-input" className="input-label">Wind</label>
              <div className="input-with-affix">
                <input
                  id="wind-input"
                  type="number"
                  step="0.1"
                  min="0"
                  className="compact-input"
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(e.target.value)}
                  placeholder="2.0"
                  required
                />
                <span className="affix">m/s</span>
              </div>
            </div>

            <div className="input-unit btn-unit">
              <button
                type="submit"
                id="analyze-solar-btn"
                className="btn-analyze"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <span>Analyze</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
