import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSolar } from '../context/SolarContext';
import { analyzeSolarData, fetchDatasetValues, saveLiveReading } from '../services/api';
import HeroInputStrip from '../components/HeroInputStrip';
import StatusBand from '../components/StatusBand';
import SimpleForecastBar from '../components/SimpleForecastBar';

export default function CheckPage() {
  const {
    selectedSite,
    setSelectedSite,
    selectedTimestamp,
    setSelectedTimestamp,
    analysisResult,
    setAnalysisResult,
    isBackendConnected,
  } = useSolar();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    document.title = 'Solar Energy Performance Prediction and Predictive Maintenance Using an Intelligent System';
  }, []);

  // Auto-analyze on initial mount so the user immediately sees the simple forecast comparison
  useEffect(() => {
    let active = true;
    if (isBackendConnected && !analysisResult && selectedSite) {
      const runInitialAnalyze = async () => {
        setIsLoading(true);
        try {
          const dsData = await fetchDatasetValues(
            selectedSite.campusKey,
            selectedSite.siteKey,
            selectedTimestamp
          );
          const vals = dsData?.values || dsData || {};
          const solarGen = vals.SolarGeneration !== undefined ? vals.SolarGeneration : (vals.actual_generation !== undefined ? vals.actual_generation : 18.5);
          const airTemp = vals.AirTemperature !== undefined ? vals.AirTemperature : 28.5;
          const humidity = vals.RelativeHumidity !== undefined ? vals.RelativeHumidity : 42.0;
          const wind = vals.WindSpeed !== undefined ? vals.WindSpeed : 3.2;

          const payload = {
            site: selectedSite.id,
            campusKey: selectedSite.campusKey,
            siteKey: selectedSite.siteKey,
            timestamp: selectedTimestamp,
            SolarGeneration: solarGen,
            AirTemperature: airTemp,
            RelativeHumidity: humidity,
            WindSpeed: wind,
          };
          const res = await analyzeSolarData(payload);
          if (active && res && res.success) {
            setAnalysisResult(res);
          }
        } catch {
          // Graceful fallback if dataset not indexed for timestamp
        } finally {
          if (active) setIsLoading(false);
        }
      };
      runInitialAnalyze();
    }
    return () => { active = false; };
  }, [isBackendConnected, selectedSite]);

  const handleSiteOrDateChange = (siteObj, ts) => {
    if (siteObj) setSelectedSite(siteObj);
    if (ts) setSelectedTimestamp(ts);
  };

  const handleAnalyze = async (formData) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await analyzeSolarData(formData);
      if (result && result.success) {
        setAnalysisResult(result);
        if (formData.timestamp) {
          setSelectedTimestamp(formData.timestamp);
        }
      } else {
        setErrorMessage(result?.error || 'Unable to check panels. Please verify inputs.');
      }
    } catch (err) {
      setErrorMessage(
        !isBackendConnected
          ? 'Backend offline. Please start Flask backend on port 5000.'
          : (err.message || 'Analysis failed. Check your connection or values.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Save current evaluated reading to SQLite live_data.db
  const handleSaveReading = async () => {
    if (!analysisResult) return;
    setSaveLoading(true);
    setSaveStatus(null);
    try {
      const readingData = {
        site: selectedSite?.id || 'site-1',
        timestamp: selectedTimestamp || new Date().toISOString(),
        actual_kW: actualKw ?? 0.0,
        expected_kW: expectedKw ?? 0.0,
        source: 'manual_reading',
        weather: {
          AirTemperature: analysisResult?.input_values?.AirTemperature ?? 28.0,
          RelativeHumidity: analysisResult?.input_values?.RelativeHumidity ?? 45.0,
          WindSpeed: analysisResult?.input_values?.WindSpeed ?? 3.0,
        },
      };
      const res = await saveLiveReading(readingData);
      if (res?.success) {
        setSaveStatus({ type: 'success', text: `Saved to 2026 live database (Reading #${res.id})` });
      } else {
        setSaveStatus({ type: 'error', text: res?.error || 'Failed to save reading' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', text: err.message || 'Error saving reading' });
    } finally {
      setSaveLoading(false);
    }
  };

  // Extract Actual and Expected kW for Simple Forecast Bar
  const actualKw = typeof analysisResult?.actual_generation === 'number'
    ? analysisResult.actual_generation
    : (typeof analysisResult?.current_generation === 'number' ? analysisResult.current_generation : null);

  const expectedKw = typeof analysisResult?.expected_generation === 'number'
    ? analysisResult.expected_generation
    : (typeof analysisResult?.predicted_generation === 'number' ? analysisResult.predicted_generation : null);

  return (
    <div className="check-page-container">
      {/* Short Title and One-line Caption */}
      <div className="page-header-strip">
        <h1 className="page-main-title">Solar Energy Performance Prediction and Predictive Maintenance Using an Intelligent System</h1>
        <p className="page-caption">Instant operational diagnosis comparing actual generation with clean baseline.</p>
      </div>

      {/* Hero input row: 2 desktop rows, stacked mobile */}
      <HeroInputStrip
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
        isBackendConnected={isBackendConnected}
        onSiteOrDateChange={handleSiteOrDateChange}
        currentSite={selectedSite}
        currentTimestamp={selectedTimestamp}
      />

      {/* Status Band: status word, Expected vs Actual kW, loss %, 1-2 action lines */}
      <StatusBand
        result={analysisResult}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />

      {/* Simple Generation Forecast Bar (Actual vs Expected Comparison) */}
      <SimpleForecastBar
        actualKw={actualKw}
        expectedKw={expectedKw}
        plantCapacity={selectedSite?.capacity || 25}
        isLoading={isLoading}
        siteName={selectedSite?.name || 'Site 1'}
      />

      {/* 2026 Live Reading Save Action */}
      {analysisResult && (
        <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveReading}
            disabled={saveLoading}
            style={{
              padding: '0.6rem 1.4rem',
              backgroundColor: '#1B2A3A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: saveLoading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{saveLoading ? 'Saving to Database...' : 'Save reading to 2026 Database'}</span>
          </button>
          {saveStatus && (
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: saveStatus.type === 'success' ? '#059669' : '#DC2626',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: saveStatus.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              }}
            >
              {saveStatus.text}
            </span>
          )}
        </div>
      )}

      {/* Quick Navigation Links */}
      <div className="check-quick-links-bar">
        <Link to="/forecast" className="quick-action-link amber-link">
          <span>See forecast</span>
          <span className="arrow" aria-hidden="true">→</span>
        </Link>
        <Link to="/insights" className="quick-action-link">
          <span>See insights</span>
          <span className="arrow" aria-hidden="true">→</span>
        </Link>
        <Link to="/planner" className="quick-action-link">
          <span>Cleaning planner</span>
          <span className="arrow" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
