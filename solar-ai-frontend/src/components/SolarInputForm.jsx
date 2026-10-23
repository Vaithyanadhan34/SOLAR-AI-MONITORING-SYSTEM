import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const SOLAR_SITES = [
  { id: 'site-1', name: 'Site 1 (Campus 2 — 25 kWp)', campusKey: 2, siteKey: 1, capacity: '25.0', panels: '100' },
  { id: 'site-2', name: 'Site 2 (Campus 1 — 50 kWp)', campusKey: 1, siteKey: 2, capacity: '50.0', panels: '200' },
  { id: 'site-3', name: 'Site 3 (Campus 2 — 10 kWp)', campusKey: 2, siteKey: 3, capacity: '10.0', panels: '40' },
];

const SCENARIOS = [
  {
    id: 'normal',
    name: 'Normal Day',
    siteId: 'site-1',
    data: {
      SolarGeneration: '38.5',
      PreviousGeneration: '39.0',
      AirTemperature: '27.5',
      RelativeHumidity: '50',
      WindSpeed: '3.2',
      timestamp: '2024-06-15T13:30',
      kWp: '25.0',
      'Number of panels': '100',
      WindDirection: '180',
      DewPointTemperature: '16.0',
      Generation_30min_Ago: '38.0',
      Generation_1hour_Ago: '35.5',
      Generation_2hour_Ago: '31.0',
    },
  },
  {
    id: 'soiling',
    name: 'Possible Soiling',
    siteId: 'site-1',
    data: {
      SolarGeneration: '20.0',
      PreviousGeneration: '26.5',
      AirTemperature: '32.0',
      RelativeHumidity: '38',
      WindSpeed: '2.1',
      timestamp: '2024-06-15T13:30',
      kWp: '25.0',
      'Number of panels': '100',
      WindDirection: '190',
      DewPointTemperature: '14.0',
      Generation_30min_Ago: '27.5',
      Generation_1hour_Ago: '28.5',
      Generation_2hour_Ago: '29.0',
    },
  },
  {
    id: 'drop',
    name: 'Performance Drop',
    siteId: 'site-1',
    data: {
      SolarGeneration: '33.0',
      PreviousGeneration: '37.0',
      AirTemperature: '28.0',
      RelativeHumidity: '55',
      WindSpeed: '3.0',
      timestamp: '2024-06-15T13:30',
      kWp: '25.0',
      'Number of panels': '100',
      WindDirection: '175',
      DewPointTemperature: '16.5',
      Generation_30min_Ago: '36.0',
      Generation_1hour_Ago: '34.0',
      Generation_2hour_Ago: '30.0',
    },
  },
  {
    id: 'abnormal',
    name: 'Sudden Abnormal Condition',
    siteId: 'site-1',
    data: {
      SolarGeneration: '3.0',
      PreviousGeneration: '42.0',
      AirTemperature: '30.5',
      RelativeHumidity: '45',
      WindSpeed: '2.8',
      timestamp: '2024-06-15T13:30',
      kWp: '25.0',
      'Number of panels': '100',
      WindDirection: '180',
      DewPointTemperature: '15.0',
      Generation_30min_Ago: '40.5',
      Generation_1hour_Ago: '38.0',
      Generation_2hour_Ago: '34.0',
    },
  },
];

export default function SolarInputForm({ onAnalyze, isLoading, isBackendConnected }) {
  const [selectedSiteId, setSelectedSiteId] = useState('site-1');
  const [selectedScenario, setSelectedScenario] = useState('normal');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Store all inputs as strings to allow normal typing, deleting, and editing without 0 prefix bugs
  const [inputs, setInputs] = useState({
    SolarGeneration: '38.5',
    PreviousGeneration: '39.0',
    AirTemperature: '27.5',
    RelativeHumidity: '50',
    WindSpeed: '3.2',
    timestamp: '2024-06-15T13:30',
    kWp: '25.0',
    'Number of panels': '100',
    WindDirection: '180',
    DewPointTemperature: '16.0',
    Generation_30min_Ago: '38.0',
    Generation_1hour_Ago: '35.5',
    Generation_2hour_Ago: '31.0',
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
    }
  };

  const handleSiteChange = (e) => {
    const siteId = e.target.value;
    setSelectedSiteId(siteId);
    const site = SOLAR_SITES.find((s) => s.id === siteId);
    if (site) {
      setInputs((prev) => ({
        ...prev,
        kWp: site.capacity,
        'Number of panels': site.panels,
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setInputs((prev) => {
      const updated = { ...prev, [field]: value };

      // If user typed a new previous generation number, update lag estimates
      if (field === 'PreviousGeneration') {
        const num = parseFloat(value);
        if (!isNaN(num) && value.trim() !== '') {
          updated.Generation_30min_Ago = (num * 0.98).toFixed(1);
          updated.Generation_1hour_Ago = (num * 0.95).toFixed(1);
          updated.Generation_2hour_Ago = (num * 0.90).toFixed(1);
        }
      }

      // If user typed new temperature or humidity, update dew point estimate
      if (field === 'AirTemperature' || field === 'RelativeHumidity') {
        const temp = parseFloat(field === 'AirTemperature' ? value : updated.AirTemperature);
        const hum = parseFloat(field === 'RelativeHumidity' ? value : updated.RelativeHumidity);
        if (!isNaN(temp) && !isNaN(hum)) {
          updated.DewPointTemperature = (temp - (100 - hum) / 5).toFixed(1);
        }
      }

      return updated;
    });

    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    const isInvalid = (val) => val === undefined || val === null || String(val).trim() === '' || isNaN(Number(val));

    if (isInvalid(inputs.SolarGeneration) || Number(inputs.SolarGeneration) < 0) {
      errors.SolarGeneration = 'Please enter this value.';
    }
    if (isInvalid(inputs.PreviousGeneration) || Number(inputs.PreviousGeneration) < 0) {
      errors.PreviousGeneration = 'Please enter this value.';
    }
    if (isInvalid(inputs.AirTemperature)) {
      errors.AirTemperature = 'Please enter this value.';
    }
    if (isInvalid(inputs.RelativeHumidity) || Number(inputs.RelativeHumidity) < 0 || Number(inputs.RelativeHumidity) > 100) {
      errors.RelativeHumidity = 'Enter humidity (0–100%).';
    }
    if (isInvalid(inputs.WindSpeed) || Number(inputs.WindSpeed) < 0) {
      errors.WindSpeed = 'Enter wind speed (>= 0).';
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

    const actualGen = parseFloat(inputs.SolarGeneration);
    const prevGen = parseFloat(inputs.PreviousGeneration);
    const gen30m = inputs.Generation_30min_Ago && !isNaN(Number(inputs.Generation_30min_Ago))
      ? parseFloat(inputs.Generation_30min_Ago)
      : prevGen * 0.98;
    const gen1h = inputs.Generation_1hour_Ago && !isNaN(Number(inputs.Generation_1hour_Ago))
      ? parseFloat(inputs.Generation_1hour_Ago)
      : prevGen * 0.95;
    const gen2h = inputs.Generation_2hour_Ago && !isNaN(Number(inputs.Generation_2hour_Ago))
      ? parseFloat(inputs.Generation_2hour_Ago)
      : prevGen * 0.90;
    const airTemp = parseFloat(inputs.AirTemperature);
    const humidity = parseFloat(inputs.RelativeHumidity);
    const windSpeed = parseFloat(inputs.WindSpeed);
    const windDir = inputs.WindDirection && !isNaN(Number(inputs.WindDirection))
      ? parseFloat(inputs.WindDirection)
      : 180.0;
    const dewPoint = inputs.DewPointTemperature && !isNaN(Number(inputs.DewPointTemperature))
      ? parseFloat(inputs.DewPointTemperature)
      : airTemp - (100 - humidity) / 5;
    const kwp = inputs.kWp && !isNaN(Number(inputs.kWp))
      ? parseFloat(inputs.kWp)
      : parseFloat(site.capacity);
    const panels = inputs['Number of panels'] && !isNaN(Number(inputs['Number of panels']))
      ? parseInt(inputs['Number of panels'], 10)
      : parseInt(site.panels, 10);

    const payload = {
      CampusKey: site.campusKey,
      SiteKey: site.siteKey,
      kWp: kwp,
      'Number of panels': panels,
      SolarGeneration: actualGen,
      PreviousGeneration: prevGen,
      Generation_30min_Ago: gen30m,
      Generation_1hour_Ago: gen1h,
      Generation_2hour_Ago: gen2h,
      AirTemperature: airTemp,
      ApparentTemperature: airTemp + 1.0,
      DewPointTemperature: dewPoint,
      RelativeHumidity: humidity,
      WindSpeed: windSpeed,
      WindDirection: windDir,
      timestamp: inputs.timestamp,
    };

    onAnalyze(payload);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Quick Analysis</h2>
        <p className="panel-subtitle">Enter operational data to evaluate current performance</p>
      </div>

      {/* Scenario Dropdown */}
      <div className="scenario-selector">
        <span className="scenario-label">Demo scenario:</span>
        <select
          className="scenario-select"
          value={selectedScenario}
          onChange={handleScenarioChange}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 1. Solar Site */}
        <div className="form-section">
          <div className="form-section-title">Solar Site</div>
          <div className="field-group">
            <select
              className="select-field"
              value={selectedSiteId}
              onChange={handleSiteChange}
            >
              {SOLAR_SITES.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Current Performance */}
        <div className="form-section">
          <div className="form-section-title">Current Performance</div>
          <div className="field-grid-2">
            <div className="field-group">
              <label className="field-label">Current Generation</label>
              <div className="input-container">
                <input
                  type="text"
                  inputMode="decimal"
                  className="input-field has-unit"
                  value={inputs.SolarGeneration}
                  onChange={(e) => handleInputChange('SolarGeneration', e.target.value)}
                  placeholder="e.g. 38.5"
                />
                <span className="input-unit-label">kW</span>
              </div>
              {formErrors.SolarGeneration && (
                <span style={{ fontSize: '0.725rem', color: 'var(--status-danger-text)' }}>
                  {formErrors.SolarGeneration}
                </span>
              )}
            </div>

            <div className="field-group">
              <label className="field-label">Previous Generation</label>
              <div className="input-container">
                <input
                  type="text"
                  inputMode="decimal"
                  className="input-field has-unit"
                  value={inputs.PreviousGeneration}
                  onChange={(e) => handleInputChange('PreviousGeneration', e.target.value)}
                  placeholder="e.g. 39.0"
                />
                <span className="input-unit-label">kW</span>
              </div>
              {formErrors.PreviousGeneration && (
                <span style={{ fontSize: '0.725rem', color: 'var(--status-danger-text)' }}>
                  {formErrors.PreviousGeneration}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Weather Conditions */}
        <div className="form-section">
          <div className="form-section-title">Weather</div>
          <div className="field-grid-3">
            <div className="field-group">
              <label className="field-label">Temperature</label>
              <div className="input-container">
                <input
                  type="text"
                  inputMode="decimal"
                  className="input-field has-unit"
                  value={inputs.AirTemperature}
                  onChange={(e) => handleInputChange('AirTemperature', e.target.value)}
                  placeholder="e.g. 27.5"
                />
                <span className="input-unit-label">°C</span>
              </div>
              {formErrors.AirTemperature && (
                <span style={{ fontSize: '0.725rem', color: 'var(--status-danger-text)' }}>
                  {formErrors.AirTemperature}
                </span>
              )}
            </div>

            <div className="field-group">
              <label className="field-label">Humidity</label>
              <div className="input-container">
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field has-unit"
                  value={inputs.RelativeHumidity}
                  onChange={(e) => handleInputChange('RelativeHumidity', e.target.value)}
                  placeholder="e.g. 50"
                />
                <span className="input-unit-label">%</span>
              </div>
              {formErrors.RelativeHumidity && (
                <span style={{ fontSize: '0.725rem', color: 'var(--status-danger-text)' }}>
                  {formErrors.RelativeHumidity}
                </span>
              )}
            </div>

            <div className="field-group">
              <label className="field-label">Wind Speed</label>
              <div className="input-container">
                <input
                  type="text"
                  inputMode="decimal"
                  className="input-field has-unit"
                  value={inputs.WindSpeed}
                  onChange={(e) => handleInputChange('WindSpeed', e.target.value)}
                  placeholder="e.g. 3.2"
                />
                <span className="input-unit-label">m/s</span>
              </div>
              {formErrors.WindSpeed && (
                <span style={{ fontSize: '0.725rem', color: 'var(--status-danger-text)' }}>
                  {formErrors.WindSpeed}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Measurement Time */}
        <div className="form-section">
          <div className="form-section-title">Measurement Time</div>
          <div className="field-group">
            <input
              type="datetime-local"
              className="input-field"
              value={inputs.timestamp}
              onChange={(e) => handleInputChange('timestamp', e.target.value)}
            />
            {formErrors.timestamp && (
              <span style={{ fontSize: '0.725rem', color: 'var(--status-danger-text)' }}>
                {formErrors.timestamp}
              </span>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Inputs */}
        <div>
          <button
            type="button"
            className="advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Advanced inputs</span>
          </button>

          {showAdvanced && (
            <div className="advanced-box">
              <div className="field-grid-2">
                <div className="field-group">
                  <label className="field-label">Panel Capacity</label>
                  <div className="input-container">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-field has-unit"
                      value={inputs.kWp}
                      onChange={(e) => handleInputChange('kWp', e.target.value)}
                    />
                    <span className="input-unit-label">kWp</span>
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Number of Panels</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input-field"
                    value={inputs['Number of panels']}
                    onChange={(e) => handleInputChange('Number of panels', e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Wind Direction</label>
                  <div className="input-container">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-field has-unit"
                      value={inputs.WindDirection}
                      onChange={(e) => handleInputChange('WindDirection', e.target.value)}
                    />
                    <span className="input-unit-label">deg</span>
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Dew Point</label>
                  <div className="input-container">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-field has-unit"
                      value={inputs.DewPointTemperature}
                      onChange={(e) => handleInputChange('DewPointTemperature', e.target.value)}
                    />
                    <span className="input-unit-label">°C</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading || !isBackendConnected}
        >
          {isLoading ? (
            <>
              <div className="spinner-sm" />
              <span>Analyzing...</span>
            </>
          ) : (
            <span>Analyze Performance</span>
          )}
        </button>
      </form>
    </div>
  );
}
