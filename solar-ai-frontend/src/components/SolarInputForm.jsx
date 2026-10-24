import React, { useState } from 'react';
import { fetchDatasetValues } from '../services/api';

const SOLAR_SITES = [
  { id: 'site-1', name: 'Site 1 (Campus 2)', campusKey: 2, siteKey: 1, capacity: '25.0', panels: '100' },
  { id: 'site-2', name: 'Site 2 (Campus 2)', campusKey: 2, siteKey: 2, capacity: '20.0', panels: '80' },
  { id: 'site-3', name: 'Site 3 (Campus 2)', campusKey: 2, siteKey: 3, capacity: '15.0', panels: '60' },
  { id: 'site-4', name: 'Site 11 (Campus 3)', campusKey: 3, siteKey: 11, capacity: '100.0', panels: '400' },
  { id: 'site-5', name: 'Site 27 (Campus 1)', campusKey: 1, siteKey: 27, capacity: '100.0', panels: '400' },
];

export default function SolarInputForm({
  onAnalyze,
  isLoading,
  isBackendConnected,
  onOpenBatchModal,
  dateRange,
  onSiteOrDateChange,
}) {
  const [selectedSiteId, setSelectedSiteId] = useState('site-1');
  const [isFetchingExample, setIsFetchingExample] = useState(false);

  // Four typed fields kept as strings while typing
  const [inputs, setInputs] = useState({
    timestamp: '2020-06-15T13:30',
    SolarGeneration: '8.8',
    AirTemperature: '27.5',
    RelativeHumidity: '50',
    WindSpeed: '3.2',
  });

  const [formErrors, setFormErrors] = useState({});

  const currentSite = SOLAR_SITES.find((s) => s.id === selectedSiteId) || SOLAR_SITES[0];

  const handleSiteChange = (newSiteId) => {
    setSelectedSiteId(newSiteId);
    const siteObj = SOLAR_SITES.find((s) => s.id === newSiteId) || SOLAR_SITES[0];
    if (onSiteOrDateChange) {
      onSiteOrDateChange(siteObj, inputs.timestamp);
    }
  };

  const handleInputChange = (field, value) => {
    setInputs((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'timestamp' && onSiteOrDateChange) {
        onSiteOrDateChange(currentSite, value);
      }
      return next;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // One dropdown-free "Fill example values" button
  const handleFillExampleValues = async () => {
    setIsFetchingExample(true);
    try {
      if (isBackendConnected && inputs.timestamp) {
        const data = await fetchDatasetValues(currentSite.campusKey, currentSite.siteKey, inputs.timestamp);
        if (data && data.success && data.found) {
          setInputs((prev) => ({
            ...prev,
            SolarGeneration: String(data.SolarGeneration || data.actual_generation || '8.8'),
            AirTemperature: String(data.AirTemperature || '27.5'),
            RelativeHumidity: String(data.RelativeHumidity || '50'),
            WindSpeed: String(data.WindSpeed || '3.2'),
          }));
          setFormErrors({});
          return;
        }
      }
      // Fallback clean example values
      setInputs({
        timestamp: '2021-06-15T13:30',
        SolarGeneration: '8.8',
        AirTemperature: '27.5',
        RelativeHumidity: '50',
        WindSpeed: '3.2',
      });
      setFormErrors({});
    } catch {
      setInputs({
        timestamp: '2021-06-15T13:30',
        SolarGeneration: '8.8',
        AirTemperature: '27.5',
        RelativeHumidity: '50',
        WindSpeed: '3.2',
      });
      setFormErrors({});
    } finally {
      setIsFetchingExample(false);
    }
  };

  const validate = () => {
    const errors = {};
    const isInvalid = (val) => val === undefined || val === null || String(val).trim() === '' || isNaN(Number(val));

    if (!inputs.timestamp || inputs.timestamp.trim() === '') {
      errors.timestamp = 'Please choose a date and time.';
    }
    if (isInvalid(inputs.SolarGeneration) || Number(inputs.SolarGeneration) < 0) {
      errors.SolarGeneration = 'Please enter actual power (0 or higher).';
    }
    if (isInvalid(inputs.AirTemperature)) {
      errors.AirTemperature = 'Please enter the air temperature.';
    }
    if (isInvalid(inputs.RelativeHumidity) || Number(inputs.RelativeHumidity) < 0 || Number(inputs.RelativeHumidity) > 100) {
      errors.RelativeHumidity = 'Humidity must be between 0 and 100.';
    }
    if (isInvalid(inputs.WindSpeed) || Number(inputs.WindSpeed) < 0) {
      errors.WindSpeed = 'Wind speed must be 0 or higher.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      siteId: currentSite.id,
      CampusKey: currentSite.campusKey,
      SiteKey: currentSite.siteKey,
      kWp: parseFloat(currentSite.capacity),
      'Number of panels': parseInt(currentSite.panels, 10),
      timestamp: inputs.timestamp,
      SolarGeneration: parseFloat(inputs.SolarGeneration),
      AirTemperature: parseFloat(inputs.AirTemperature),
      RelativeHumidity: parseFloat(inputs.RelativeHumidity),
      WindSpeed: parseFloat(inputs.WindSpeed),
    };

    onAnalyze(payload);
  };

  return (
    <div className="form-panel">
      <form onSubmit={handleSubmit} noValidate>
        {/* Step 1: Choose site and time */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h2 className="form-step-title">
            <span>1</span> Choose site and time
          </h2>

          <div className="form-group">
            <div className="field-label-row">
              <label htmlFor="site-select" className="field-label">
                Solar site
              </label>
            </div>
            <select
              id="site-select"
              value={selectedSiteId}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="form-select"
              disabled={isLoading}
            >
              {SOLAR_SITES.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <div className="site-meta-text">
              {currentSite.capacity} kW capacity, {currentSite.panels} panels
            </div>
          </div>

          <div className="form-group">
            <div className="field-label-row">
              <label htmlFor="timestamp-input" className="field-label">
                Date and time
              </label>
            </div>
            <input
              id="timestamp-input"
              type="datetime-local"
              value={inputs.timestamp}
              min={dateRange?.min ? `${dateRange.min}T00:00` : (dateRange?.start ? `${dateRange.start}T00:00` : undefined)}
              max={dateRange?.max ? `${dateRange.max}T23:59` : (dateRange?.end ? `${dateRange.end}T23:59` : undefined)}
              onChange={(e) => handleInputChange('timestamp', e.target.value)}
              className={`form-input ${formErrors.timestamp ? 'error' : ''}`}
              disabled={isLoading}
            />
            {formErrors.timestamp && (
              <div className="field-error-msg">{formErrors.timestamp}</div>
            )}
            <div className="field-helper">
              {dateRange
                ? `Records available from ${dateRange.start || dateRange.min} to ${dateRange.end || dateRange.max}`
                : 'Records available from Jan 2020 to Apr 2022'}
            </div>
          </div>
        </div>

        {/* Step 2: Enter today's readings */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 className="form-step-title">
            <span>2</span> Enter today's readings
          </h2>

          {/* Quick fill button */}
          <button
            type="button"
            onClick={handleFillExampleValues}
            disabled={isLoading || isFetchingExample}
            className="btn-fill-example"
            title="Fill in standard example numbers for this site and time"
          >
            <span>{isFetchingExample ? 'Loading...' : 'Fill example values'}</span>
          </button>

          {/* Field 1: Actual power now */}
          <div className="form-group">
            <div className="field-label-row">
              <label htmlFor="actual-power-input" className="field-label">
                <span>Actual power now</span>
                <span
                  className="tooltip-trigger"
                  title="The reading from your solar meter or inverter right now"
                  tabIndex={0}
                  aria-label="Help: The reading from your solar meter or inverter right now"
                >
                  ?
                </span>
              </label>
            </div>
            <div className="input-with-unit">
              <input
                id="actual-power-input"
                type="text"
                inputMode="decimal"
                value={inputs.SolarGeneration}
                onChange={(e) => handleInputChange('SolarGeneration', e.target.value)}
                placeholder="e.g. 8.8"
                className={`form-input ${formErrors.SolarGeneration ? 'error' : ''}`}
                disabled={isLoading}
              />
              <span className="unit-tag">kW</span>
            </div>
            {formErrors.SolarGeneration && (
              <div className="field-error-msg">{formErrors.SolarGeneration}</div>
            )}
            <div className="field-helper">The reading from your solar meter or inverter right now</div>
          </div>

          {/* Field 2: Air temperature */}
          <div className="form-group">
            <div className="field-label-row">
              <label htmlFor="air-temp-input" className="field-label">
                <span>Air temperature</span>
                <span
                  className="tooltip-trigger"
                  title="Outdoor temperature around the panels in degrees Celsius"
                  tabIndex={0}
                  aria-label="Help: Outdoor temperature around the panels in degrees Celsius"
                >
                  ?
                </span>
              </label>
            </div>
            <div className="input-with-unit">
              <input
                id="air-temp-input"
                type="text"
                inputMode="decimal"
                value={inputs.AirTemperature}
                onChange={(e) => handleInputChange('AirTemperature', e.target.value)}
                placeholder="e.g. 27.5"
                className={`form-input ${formErrors.AirTemperature ? 'error' : ''}`}
                disabled={isLoading}
              />
              <span className="unit-tag">°C</span>
            </div>
            {formErrors.AirTemperature && (
              <div className="field-error-msg">{formErrors.AirTemperature}</div>
            )}
            <div className="field-helper">Outdoor temperature around the panels</div>
          </div>

          {/* Field 3: Humidity */}
          <div className="form-group">
            <div className="field-label-row">
              <label htmlFor="humidity-input" className="field-label">
                <span>Humidity</span>
                <span
                  className="tooltip-trigger"
                  title="Moisture percentage in the air between 0 and 100"
                  tabIndex={0}
                  aria-label="Help: Moisture percentage in the air between 0 and 100"
                >
                  ?
                </span>
              </label>
            </div>
            <div className="input-with-unit">
              <input
                id="humidity-input"
                type="text"
                inputMode="decimal"
                value={inputs.RelativeHumidity}
                onChange={(e) => handleInputChange('RelativeHumidity', e.target.value)}
                placeholder="e.g. 50"
                className={`form-input ${formErrors.RelativeHumidity ? 'error' : ''}`}
                disabled={isLoading}
              />
              <span className="unit-tag">%</span>
            </div>
            {formErrors.RelativeHumidity && (
              <div className="field-error-msg">{formErrors.RelativeHumidity}</div>
            )}
            <div className="field-helper">Moisture in the air (0 to 100)</div>
          </div>

          {/* Field 4: Wind speed */}
          <div className="form-group">
            <div className="field-label-row">
              <label htmlFor="wind-input" className="field-label">
                <span>Wind speed</span>
                <span
                  className="tooltip-trigger"
                  title="Wind speed at your site in meters per second"
                  tabIndex={0}
                  aria-label="Help: Wind speed at your site in meters per second"
                >
                  ?
                </span>
              </label>
            </div>
            <div className="input-with-unit">
              <input
                id="wind-input"
                type="text"
                inputMode="decimal"
                value={inputs.WindSpeed}
                onChange={(e) => handleInputChange('WindSpeed', e.target.value)}
                placeholder="e.g. 3.2"
                className={`form-input ${formErrors.WindSpeed ? 'error' : ''}`}
                disabled={isLoading}
              />
              <span className="unit-tag">m/s</span>
            </div>
            {formErrors.WindSpeed && (
              <div className="field-error-msg">{formErrors.WindSpeed}</div>
            )}
            <div className="field-helper">Wind speed at your site</div>
          </div>
        </div>

        {/* Large Primary Action Button */}
        <button
          type="submit"
          className="btn-primary-check"
          disabled={isLoading || !isBackendConnected}
        >
          {isLoading ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              <span>Checking...</span>
            </>
          ) : (
            <span>Check my solar panels</span>
          )}
        </button>

        {/* Beginner Glossary Line */}
        <div className="form-glossary-note">
          kW = power right now • kWh = energy over time
        </div>

        {/* Secondary CSV Upload Link */}
        <div className="batch-link-container">
          <button
            type="button"
            onClick={onOpenBatchModal}
            className="btn-secondary-link"
          >
            Have many readings? Upload a CSV
          </button>
        </div>
      </form>
    </div>
  );
}
