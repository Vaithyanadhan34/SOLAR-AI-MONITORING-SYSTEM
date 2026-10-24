import React, { useState, useEffect } from 'react';
import { checkBackend, analyzeSolarData } from '../services/api';
import Header from '../components/Header';
import SolarInputForm from '../components/SolarInputForm';
import ResultPanel from '../components/ResultPanel';
import PerformanceChart from '../components/PerformanceChart';
import BatchAnalysis from '../components/BatchAnalysis';

export default function Dashboard() {
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const verifyBackend = async () => {
    try {
      const status = await checkBackend();
      setIsBackendConnected(Boolean(status?.connected));
    } catch {
      setIsBackendConnected(false);
    }
  };

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(verifyBackend, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (formData) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await analyzeSolarData(formData);
      if (result && result.success) {
        setAnalysisResult(result);
      } else {
        setErrorMessage(result?.error || 'Unable to check your panels. Please verify your readings.');
      }
    } catch (err) {
      setErrorMessage(
        !isBackendConnected
          ? 'Backend service is offline. Start the backend: py app.py in your terminal.'
          : (err.message || 'Unable to complete analysis. Please ensure the selected time falls within the 2020-2022 dataset range.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* 1. Header: app name and small connected/offline dot only */}
      <Header isConnected={isBackendConnected} />

      <main className="page-container">
        {/* 2. One-sentence intro */}
        <section className="intro-section">
          <p className="intro-text">
            Check if your solar panels are producing what they should, and find out whether they need cleaning or inspection.
          </p>
        </section>

        {/* 3. 3-step flow shown as numbers (guide, not a wizard) */}
        <section className="steps-guide" aria-label="System workflow guide">
          <div className="step-item">
            <span className="step-number">1</span>
            <span>Choose site and time</span>
          </div>
          <div className="step-item">
            <span className="step-number">2</span>
            <span>Enter today's readings</span>
          </div>
          <div className="step-item">
            <span className="step-number">3</span>
            <span>See result</span>
          </div>
        </section>

        {/* 4. Two columns on desktop: Form on left, Result on right. Stacks on mobile */}
        <div className="workspace-grid">
          <div className="form-column">
            <SolarInputForm
              onAnalyze={handleAnalyze}
              isLoading={isLoading}
              isBackendConnected={isBackendConnected}
              onOpenBatchModal={() => setIsBatchModalOpen(true)}
            />
          </div>

          <div className="result-column">
            <ResultPanel
              result={analysisResult}
              isLoading={isLoading}
              errorMessage={errorMessage}
            />

            {/* Actual vs Expected line chart below the result, only when real data exists (batch upload), otherwise simple empty state */}
            <PerformanceChart timeline={batchData?.timeline} />
          </div>
        </div>

        {/* 5. "How it works" (collapsed) and "Environmental benefits" (short, 4 lines) at the bottom */}
        <section style={{ marginTop: '2.5rem' }}>
          {/* Collapsed How it works */}
          <details className="how-it-works-panel">
            <summary className="how-it-works-summary">How it works</summary>
            <div className="how-it-works-body">
              <p style={{ marginBottom: '0.75rem' }}>
                This system checks whether your solar panels are operating at peak health by comparing what they are actually generating with what they are expected to generate under current weather conditions:
              </p>
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <li>
                  <strong>Baseline calculation:</strong> Using sunlight, air temperature, humidity, and panel capacity, the system calculates the power clean panels should produce.
                </li>
                <li>
                  <strong>Gradual loss detection:</strong> If actual generation steadily falls 15% or more below the expected level over time while weather is stable, it flags a cleaning review for possible dust or dirt.
                </li>
                <li>
                  <strong>Sudden drop detection:</strong> If power drops sharply without a corresponding weather shift, the system alerts you to request a technician inspection for inverter, cabling, or equipment issues.
                </li>
                <li>
                  <strong>Automated history lookup:</strong> When you pick a site and timestamp, the system retrieves previous readings automatically so you never have to calculate changes manually.
                </li>
              </ul>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Powered by machine learning models trained on 2+ years of verified campus solar telemetry data (2020–2022).
              </p>
            </div>
          </details>

          {/* Environmental benefits: short, 4 lines */}
          <div className="env-benefits-panel">
            <h2 className="env-heading">Environmental benefits</h2>
            <ul className="env-lines-list">
              <li>
                <strong>Water conservation:</strong> Clean panels only when performance loss confirms dirt buildup, saving water in dry regions.
              </li>
              <li>
                <strong>Maximum clean electricity:</strong> Keeping panels operating at peak output maximizes renewable energy displacing fossil fuels.
              </li>
              <li>
                <strong>Fewer wasted maintenance trips:</strong> Targeted alerts avoid unnecessary routine site visits and truck rolls.
              </li>
              <li>
                <strong>Longer panel life:</strong> Spotting electrical faults, hotspots, and inverter issues early protects solar assets from permanent damage.
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* Secondary Batch CSV Upload Modal */}
      {isBatchModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsBatchModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-modal-title"
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="batch-modal-title" className="modal-title">Upload readings CSV</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsBatchModalOpen(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <BatchAnalysis
              onBatchResult={(batch) => {
                setBatchData(batch);
              }}
              isBackendConnected={isBackendConnected}
              onClose={() => setIsBatchModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
