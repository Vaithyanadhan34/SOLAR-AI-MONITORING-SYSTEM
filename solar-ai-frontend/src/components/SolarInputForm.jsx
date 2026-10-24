import React, { useState } from 'react';
import { Database, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchDatasetValues } from '../services/api';

const SOLAR_SITES = [
  { id: 'site-1', name: 'Site 1 (Campus 2 — 25 kWp)', campusKey: 2, siteKey: 1, capacity: '25.0', panels: '100' },
  { id: 'site-2', name: 'Site 2 (Campus 2 — 20 kWp)', campusKey: 2, siteKey: 2, capacity: '20.0', panels: '80' },
  { id: 'site-3', name: 'Site 3 (Campus 2 — 15 kWp)', campusKey: 2, siteKey: 3, capacity: '15.0', panels: '60' },
  { id: 'site-4', name: 'Site 11 (Campus 3 — 100 kWp)', campusKey: 3, siteKey: 11, capacity: '100.0', panels: '400' },
  { id: 'site-5', name: 'Site 27 (Campus 1 — 100 kWp)', campusKey: 1, siteKey: 27, capacity: '100.0', panels: '400' },
];

const SCENARIOS = [
  {
    id: 'normal',
    name: 'Normal Day',
    siteId: 'site-1',
    data: {
      timestamp: '2021-06-15T13:30',
      SolarGeneration: '8.81',
      AirTemperature: '27.5',
      RelativeHumidity: '50',
      WindSpeed: '3.2',
    },
  },
  {
    id: 'soiling',
    name: 'Possible Soiling',
    siteId: 'site-1',
    data: {
      timestamp: '2020-01-01T10:15',
      SolarGeneration: '11.5',
      AirTemperature: '28.0',
      RelativeHumidity: '45',
      WindSpeed: '2.5',
    },
  },
  {
    id: 'fault',
    name: 'Equipment Anomaly / Sudden Drop',
    siteId: 'site-1',
    data: {
      timestamp: '2020-01-04T15:15',
      SolarGeneration: '3.96',
      AirTemperature: '26.0',
      RelativeHumidity: '50',
      WindSpeed: '2.5',
    },
  },
];

export default function SolarInputForm({ onAnalyze, isLoading, isBackendConnected }) {
  const [selectedSiteId, setSelectedSiteId] = useState('site-1');
  const [selectedScenario, setSelectedScenario] = useState('normal');
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillMessage, setAutoFillMessage] = useState(null);

  // User enters only current data as strings for seamless typing
  const [inputs, setInputs] = useState({
    timestamp: '2021-06-15T13:30',
    SolarGeneration: '8.81',
    AirTemperature: '27.5',
    RelativeHumidity: '50',
    WindSpeed: '3.2',
  });

  const [formErrors, setFormErrors] = useState({});

  const handleScenarioChange = (e) => {
    const scenarioId = e.target.value;
    setSelectedScenario(scenarioId);
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (scenario) {
      setSelectedSiteId(scenario.siteId);
      setInputs({ ...scenario.data });
      setFormErrors({});
      setAutoFillMessage(null);
    }
  };

  const handleSiteChange = (e) => {
    setSelectedSiteId(e.target.value);
    setAutoFillMessage(null);
  };

  const handleInputChange = (field, value) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
    setAutoFillMessage(null);
  };

  const handleUseDatasetValues = async () => {
    const site = SOLAR_SITES.find((s) => s.id === selectedSiteId) || SOLAR_SITES[0];
    if (!inputs.timestamp) {
      setFormErrors((prev) => ({ ...prev, timestamp: 'Select a timestamp first.' }));
      return;
    }

    setIsAutoFilling(true);
    setAutoFillMessage(null);

    try {
      const data = await fetchDatasetValues(site.campusKey, site.siteKey, inputs.timestamp);
      if (data && data.success && data.found) {
        setInputs((prev) => ({
          ...prev,
          SolarGeneration: String(data.SolarGeneration || data.actual_generation || ''),
          AirTemperature: String(data.AirTemperature || ''),
          RelativeHumidity: String(data.RelativeHumidity || ''),
          WindSpeed: String(data.WindSpeed || ''),
        }));
        setAutoFillMessage({
          type: 'success',
          text: `Retrieved historical telemetry for ${site.name} at ${data.timestamp}.`,
        });
        setFormErrors({});
      } else {
        setAutoFillMessage({
          type: 'error',
          text: data?.error || 'No historical telemetry found for this timestamp.',
        });
      }
    } catch (err) {
      setAutoFillMessage({
        type: 'error',
        text: err.message || 'No historical records found for this time. Monitored records: 2020-01-01 to 2022-04-23.',
      });
    } finally {
      setIsAutoFilling(false);
    }
  };

  const validate = () => {
    const errors = {};
    const isInvalid = (val) => val === undefined || val === null || String(val).trim() === '' || isNaN(Number(val));

    if (isInvalid(inputs.SolarGeneration) || Number(inputs.SolarGeneration) < 0) {
      errors.SolarGeneration = 'Enter current generation (>= 0 kW).';
    }
    if (isInvalid(inputs.AirTemperature)) {
      errors.AirTemperature = 'Enter air temperature (°C).';
    }
    if (isInvalid(inputs.RelativeHumidity) || Number(inputs.RelativeHumidity) < 0 || Number(inputs.RelativeHumidity) > 100) {
      errors.RelativeHumidity = 'Enter humidity (0–100%).';
    }
    if (isInvalid(inputs.WindSpeed) || Number(inputs.WindSpeed) < 0) {
      errors.WindSpeed = 'Enter wind speed (>= 0 m/s).';
    }
    if (!inputs.timestamp || inputs.timestamp.trim() === '') {
      errors.timestamp = 'Please select a date and time.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const site = SOLAR_SITES.find((s) => s.id === selectedSiteId) || SOLAR_SITES[0];

    // Submit ONLY current data. Backend automatically retrieves previous generation and lags.
    const payload = {
      siteId: site.id,
      CampusKey: site.campusKey,
      SiteKey: site.siteKey,
      kWp: parseFloat(site.capacity),
      'Number of panels': parseInt(site.panels, 10),
      timestamp: inputs.timestamp,
      SolarGeneration: parseFloat(inputs.SolarGeneration),
      AirTemperature: parseFloat(inputs.AirTemperature),
      RelativeHumidity: parseFloat(inputs.RelativeHumidity),
      WindSpeed: parseFloat(inputs.WindSpeed),
    };

    onAnalyze(payload);
  };

  const currentSite = SOLAR_SITES.find((s) => s.id === selectedSiteId) || SOLAR_SITES[0];

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Operational Data Input</h2>
        <p className="panel-subtitle">
          Enter only current observations. The system automatically retrieves historical lags and baseline telemetry.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form" noValidate>
        {/* Preset Scenarios Selector */}
        <div className="scenario-selector">
          <label htmlFor="scenario-select" className="scenario-label">
            Sample Scenario:
          </label>
          <select
            id="scenario-select"
            value={selectedScenario}
            onChange={handleScenarioChange}
            className="select-field"
            disabled={isLoading}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 1. Solar Site Selection */}
        <div className="form-section">
          <div className="form-section-title">1. Monitored Solar Array</div>
          <div className="field-group">
            <label htmlFor="site-select" className="field-label">
              Select Solar Site
            </label>
            <select
              id="site-select"
              value={selectedSiteId}
              onChange={handleSiteChange}
              className="select-field"
              disabled={isLoading}
            >
              {SOLAR_SITES.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          <div className="site-info-badge" style={{
            fontSize: '0.75rem',
            padding: '0.4rem 0.65rem',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem'
          }}>
            Capacity: <strong>{currentSite.capacity} kWp</strong> • Array: <strong>{currentSite.panels} panels</strong> • Campus {currentSite.campusKey}, Site {currentSite.siteKey}
          </div>
        </div>

        {/* 2. Date & Time Selection with Auto-fill button */}
        <div className="form-section">
          <div className="form-section-title">2. Observation Timestamp</div>
          <div className="field-group">
            <label htmlFor="timestamp" className="field-label">
              Date & Time (Local)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="timestamp"
                type="datetime-local"
                className={`input-field ${formErrors.timestamp ? 'error' : ''}`}
                value={inputs.timestamp}
                onChange={(e) => handleInputChange('timestamp', e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleUseDatasetValues}
                disabled={isLoading || isAutoFilling || !isBackendConnected}
                className="btn-secondary"
                title="Auto-fill actual generation and weather from historical dataset"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.775rem',
                  fontWeight: 600
                }}
              >
                <Sparkles size={13} aria-hidden="true" />
                <span>{isAutoFilling ? 'Fetching...' : 'Use dataset values'}</span>
              </button>
            </div>
            {formErrors.timestamp && (
              <span className="field-error-text" role="alert">
                {formErrors.timestamp}
              </span>
            )}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Monitored operational history coverage: 2020-01-01 to 2022-04-23.
            </div>

            {autoFillMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.4rem',
                  fontSize: '0.75rem',
                  color: autoFillMessage.type === 'success' ? 'var(--status-good-text)' : 'var(--status-danger-text)',
                }}
              >
                {autoFillMessage.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{autoFillMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Current Monitored Values (Typed inputs only) */}
        <div className="form-section">
          <div className="form-section-title">3. Current Monitored Parameters</div>
          
          {/* Actual Generation Now */}
          <div className="field-group">
            <label htmlFor="SolarGeneration" className="field-label">
              Actual Generation Now (kW)
            </label>
            <div className="input-container">
              <input
                id="SolarGeneration"
                type="text"
                inputMode="decimal"
                className={`input-field has-unit ${formErrors.SolarGeneration ? 'error' : ''}`}
                value={inputs.SolarGeneration}
                onChange={(e) => handleInputChange('SolarGeneration', e.target.value)}
                placeholder="e.g. 8.8"
                disabled={isLoading}
              />
              <span className="input-unit-label" aria-hidden="true">
                kW
              </span>
            </div>
            {formErrors.SolarGeneration && (
              <span className="field-error-text" role="alert">
                {formErrors.SolarGeneration}
              </span>
            )}
          </div>

          {/* Weather Fields: Air Temperature, Humidity, Wind Speed */}
          <div className="field-grid-3">
            <div className="field-group">
              <label htmlFor="AirTemperature" className="field-label">
                Air Temp (°C)
              </label>
              <div className="input-container">
                <input
                  id="AirTemperature"
                  type="text"
                  inputMode="decimal"
                  className={`input-field has-unit ${formErrors.AirTemperature ? 'error' : ''}`}
                  value={inputs.AirTemperature}
                  onChange={(e) => handleInputChange('AirTemperature', e.target.value)}
                  placeholder="27.5"
                  disabled={isLoading}
                />
                <span className="input-unit-label" aria-hidden="true">
                  °C
                </span>
              </div>
              {formErrors.AirTemperature && (
                <span className="field-error-text" role="alert">
                  {formErrors.AirTemperature}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="RelativeHumidity" className="field-label">
                Humidity (%)
              </label>
              <div className="input-container">
                <input
                  id="RelativeHumidity"
                  type="text"
                  inputMode="decimal"
                  className={`input-field has-unit ${formErrors.RelativeHumidity ? 'error' : ''}`}
                  value={inputs.RelativeHumidity}
                  onChange={(e) => handleInputChange('RelativeHumidity', e.target.value)}
                  placeholder="50"
                  disabled={isLoading}
                />
                <span className="input-unit-label" aria-hidden="true">
                  %
                </span>
              </div>
              {formErrors.RelativeHumidity && (
                <span className="field-error-text" role="alert">
                  {formErrors.RelativeHumidity}
                </span>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="WindSpeed" className="field-label">
                Wind (m/s)
              </label>
              <div className="input-container">
                <input
                  id="WindSpeed"
                  type="text"
                  inputMode="decimal"
                  className={`input-field has-unit ${formErrors.WindSpeed ? 'error' : ''}`}
                  value={inputs.WindSpeed}
                  onChange={(e) => handleInputChange('WindSpeed', e.target.value)}
                  placeholder="3.2"
                  disabled={isLoading}
                />
                <span className="input-unit-label" aria-hidden="true">
                  m/s
                </span>
              </div>
              {formErrors.WindSpeed && (
                <span className="field-error-text" role="alert">
                  {formErrors.WindSpeed}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Automatic History Retrieval Notice */}
        <div style={{
          padding: '0.65rem 0.75rem',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <Database size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <span>
            <strong>Automatic History Lookup:</strong> Preceding generation (15m prior) and lags (30m, 1h, 2h) are retrieved automatically from the operational database.
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-button"
          disabled={isLoading || !isBackendConnected}
        >
          {isLoading ? 'Running Inference...' : 'Analyze Solar Performance'}
        </button>
      </form>
    </div>
  );
}
