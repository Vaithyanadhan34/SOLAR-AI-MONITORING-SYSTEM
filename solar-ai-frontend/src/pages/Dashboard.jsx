import React, { useState, useEffect } from 'react';
import { checkBackend, analyzeSolarData } from '../services/api';
import Header from '../components/Header';
import ProjectOverview from '../components/ProjectOverview';
import SolarInputForm from '../components/SolarInputForm';
import BatchAnalysis from '../components/BatchAnalysis';
import PredictionCards from '../components/PredictionCards';
import AnomalyCard from '../components/AnomalyCard';
import MaintenanceCard from '../components/MaintenanceCard';
import PerformanceChart from '../components/PerformanceChart';
import CleaningCostBenefit from '../components/CleaningCostBenefit';
import EnvironmentalBenefits from '../components/EnvironmentalBenefits';
import { AlertCircle, RefreshCw, Layers, UploadCloud } from 'lucide-react';

export default function Dashboard() {
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [activeMode, setActiveMode] = useState('single'); // 'single' | 'batch'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const verifyBackend = async () => {
    setIsCheckingBackend(true);
    try {
      const status = await checkBackend();
      setIsBackendConnected(status.connected);
      if (!status.connected) {
        setErrorMessage('Backend inference API is unreachable. Ensure the Flask server is running at http://127.0.0.1:5000.');
      } else {
        setErrorMessage(null);
      }
    } catch (err) {
      setIsBackendConnected(false);
      setErrorMessage('Backend inference API is unreachable. Ensure the Flask server is running at http://127.0.0.1:5000.');
    } finally {
      setIsCheckingBackend(false);
    }
  };

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (formData) => {
    setIsLoading(true);
    setErrorMessage(null);
    setBatchData(null);
    try {
      const result = await analyzeSolarData(formData);
      if (result && result.success) {
        setAnalysisResult({ ...result });
      } else {
        setErrorMessage(result?.error || 'Unable to complete the analysis. Please check entered parameters.');
      }
    } catch (err) {
      console.error('Analysis execution error:', err);
      setErrorMessage(
        !isBackendConnected
          ? 'Backend service is offline. Start Flask server (py app.py) to run model inference.'
          : (err.message || 'Unable to complete analysis. Verify that date falls within the 2020-01-01 to 2022-04-23 monitored period.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchComplete = (batch) => {
    setBatchData(batch);
    setErrorMessage(null);
  };

  return (
    <div className="app-container">
      {/* Top Application Header with Connection Status */}
      <Header
        isConnected={isBackendConnected}
        isChecking={isCheckingBackend}
        onRetry={verifyBackend}
      />

      <main className="main-content">
        {/* Offline / Error Alert Bar */}
        {errorMessage && (
          <div className="notice-bar error" role="alert" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span className="notice-text">{errorMessage}</span>
            <button
              onClick={verifyBackend}
              className="retry-btn"
              disabled={isCheckingBackend}
              aria-label="Retry connection"
            >
              <RefreshCw size={13} className={isCheckingBackend ? 'spin' : ''} aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Section A: Project Problem Statement & Scope Overview */}
        <ProjectOverview />

        {/* Mode Selector Tabs (Requirement 6: Two Modes) */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          margin: '1.25rem 0 1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.5rem'
        }}>
          <button
            type="button"
            onClick={() => setActiveMode('single')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeMode === 'single' ? 'var(--brand-primary)' : 'transparent',
              color: activeMode === 'single' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={15} />
            <span>Mode 1: Single Observation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('batch')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeMode === 'batch' ? 'var(--brand-primary)' : 'transparent',
              color: activeMode === 'batch' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <UploadCloud size={15} />
            <span>Mode 2: Batch CSV Upload</span>
          </button>
        </div>

        {/* 2-Column Operational Intelligence Workspace */}
        <div className="dashboard-grid">
          {/* Input Column: Mode 1 (Single) or Mode 2 (Batch) */}
          <div className="input-column">
            {activeMode === 'single' ? (
              <SolarInputForm
                onAnalyze={handleAnalyze}
                isLoading={isLoading}
                isBackendConnected={isBackendConnected}
              />
            ) : (
              <BatchAnalysis
                onBatchResult={handleBatchComplete}
                isBackendConnected={isBackendConnected}
              />
            )}
          </div>

          {/* Results Column */}
          <div className="results-column">
            {activeMode === 'batch' && batchData ? (
              <div className="results-container">
                {/* Performance Chart with Batch Timeline Curve */}
                <PerformanceChart timeline={batchData.timeline} />

                {/* Batch Cost-Benefit Summary */}
                <CleaningCostBenefit
                  lossPercent={15.0}
                  lostKwh={batchData.metrics?.total_lost_kwh}
                  capacityKwp={25.0}
                />
              </div>
            ) : analysisResult ? (
              <div className="results-container">
                {/* Section C: Generation Prediction Cards */}
                <PredictionCards
                  prediction={analysisResult.prediction}
                  performance={analysisResult.performance}
                  maintenance={analysisResult.maintenance}
                  previousDataUsed={analysisResult.previous_data_used}
                  predictionInterval={analysisResult.prediction_interval}
                  lostKwh={analysisResult.lost_kwh}
                  lostCo2Kg={analysisResult.lost_co2_kg}
                  co2Label={analysisResult.co2_label}
                  expectedGen={analysisResult.expected_generation}
                />

                {/* Section F: Actual vs Expected Comparison Chart */}
                <PerformanceChart prediction={analysisResult.prediction} />

                {/* Interactive Cleaning Cost-Benefit Analysis */}
                <CleaningCostBenefit
                  lossPercent={analysisResult.performance?.loss_percent}
                  lostKwh={analysisResult.lost_kwh}
                  capacityKwp={analysisResult.metadata?.installed_capacity_kwp}
                />

                {/* Section E: Condition-Based Maintenance Action */}
                <MaintenanceCard maintenance={analysisResult.maintenance} />

                {/* Section D: Behavioral Anomaly Detection & Explainability */}
                <AnomalyCard
                  anomaly={analysisResult.anomaly}
                  explainability={analysisResult.explainability}
                  driftWarnings={analysisResult.drift_warnings}
                />
              </div>
            ) : (
              <div className="empty-overview">
                <div className="empty-title">Solar Performance & Health Monitor</div>
                <p className="empty-text">
                  This platform applies machine learning to monitor solar PV operations:
                </p>
                <ul className="empty-checklist">
                  <li><strong>History Lookup:</strong> Automatically retrieves preceding operational data (15m, 30m, 1h, 2h lags) from the indexed database.</li>
                  <li><strong>Physical Baseline:</strong> Compares measured output against an unsoiled expected generation model to prevent circular soiling masking.</li>
                  <li><strong>Random Forest:</strong> Estimates short-term nowcast generation with tree spread prediction range.</li>
                  <li><strong>Isolation Forest:</strong> Flags unusual operational dynamics and statistical inverter/string anomalies.</li>
                  <li><strong>Decision Layer:</strong> Recommends condition-based actions: Normal, Cleaning Review, or Physical Inspection.</li>
                </ul>
                <div className="empty-hint">
                  {activeMode === 'single'
                    ? 'To evaluate an operating state, choose a site and timestamp on the left, then click Analyze Solar Performance.'
                    : 'To evaluate multi-interval operational trends, upload a CSV file on the left and click Run Batch Analysis.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section G: Environmental & Resource Conservation Benefits */}
        <div className="environmental-wrapper">
          <EnvironmentalBenefits />
        </div>
      </main>

      {/* Clean, Professional Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <p>Solar AI Monitoring System — AI-Powered PV Generation Forecasting & Condition-Based Maintenance.</p>
          <p className="footer-sub">Software-only monitoring platform using Random Forest Regressor & Isolation Forest.</p>
        </div>
      </footer>
    </div>
  );
}
