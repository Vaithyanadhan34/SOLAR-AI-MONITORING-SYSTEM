import React, { useState, useEffect } from 'react';
import { checkBackend, analyzeSolarData } from '../services/api';
import Header from '../components/Header';
import ProjectOverview from '../components/ProjectOverview';
import SolarInputForm from '../components/SolarInputForm';
import PredictionCards from '../components/PredictionCards';
import AnomalyCard from '../components/AnomalyCard';
import MaintenanceCard from '../components/MaintenanceCard';
import PerformanceChart from '../components/PerformanceChart';
import EnvironmentalBenefits from '../components/EnvironmentalBenefits';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
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
    try {
      const result = await analyzeSolarData(formData);

      if (result && result.success) {
        // Update state with actual validated prediction from Flask model
        setAnalysisResult({ ...result });
      } else {
        setErrorMessage(result?.error || 'Unable to complete the analysis. Please check the entered parameters.');
      }
    } catch (err) {
      console.error('Analysis execution error:', err);
      setErrorMessage(
        !isBackendConnected
          ? 'Backend service is offline. Start the Flask server (py app.py) to run model inference.'
          : (err.message || 'Unable to complete the analysis. Please verify your inputs.')
      );
    } finally {
      setIsLoading(false);
    }
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
          <div className="notice-bar error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
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

        {/* 2-Column Operational Intelligence Workspace */}
        <div className="dashboard-grid">
          {/* Section B: Solar Data Input Form */}
          <div className="input-column">
            <SolarInputForm
              onAnalyze={handleAnalyze}
              isLoading={isLoading}
              isBackendConnected={isBackendConnected}
            />
          </div>

          {/* Results Column: Sections C, D, E, F */}
          <div className="results-column">
            {analysisResult ? (
              <div className="results-container">
                {/* Section C: Generation Prediction Cards */}
                <PredictionCards
                  prediction={analysisResult.prediction}
                  performance={analysisResult.performance}
                  maintenance={analysisResult.maintenance}
                />

                {/* Section F: Actual vs Predicted Comparison Chart */}
                <PerformanceChart prediction={analysisResult.prediction} />

                {/* Section E: Maintenance Recommendation Layer */}
                <MaintenanceCard maintenance={analysisResult.maintenance} />

                {/* Section D: Behavioral Anomaly Detection */}
                <AnomalyCard anomaly={analysisResult.anomaly} />
              </div>
            ) : (
              <div className="empty-overview">
                <div className="empty-title">Solar Performance & Health Monitor</div>
                <p className="empty-text">
                  This platform applies machine learning to monitor solar PV operations:
                </p>
                <ul className="empty-checklist">
                  <li><strong>Random Forest:</strong> Forecasts expected generation capacity (kW) under current weather conditions.</li>
                  <li><strong>Isolation Forest:</strong> Flags unusual operational fluctuations and statistical power anomalies.</li>
                  <li><strong>Decision Layer:</strong> Recommends condition-based actions: Normal, Cleaning Review, or Physical Inspection.</li>
                </ul>
                <div className="empty-hint">
                  To evaluate an operating state, choose a preset scenario or customize conditions on the left, then click <strong>Analyze Solar Performance</strong>.
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
