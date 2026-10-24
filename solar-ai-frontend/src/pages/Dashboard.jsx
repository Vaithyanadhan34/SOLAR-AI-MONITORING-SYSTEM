import React, { useState, useEffect } from 'react';
import { checkBackend, analyzeSolarData, getModelInfo } from '../services/api';
import Header from '../components/Header';
import HeroInputStrip from '../components/HeroInputStrip';
import StatusBand from '../components/StatusBand';
import ForecastHero from '../components/ForecastHero';
import PastCompareSection from '../components/PastCompareSection';
import EnvironmentalSection from '../components/EnvironmentalSection';
import AboutSection from '../components/AboutSection';
import BatchAnalysis from '../components/BatchAnalysis';

const DEFAULT_SITE = {
  id: 'site-1',
  name: 'Site 1 (Campus 2)',
  campusKey: 2,
  siteKey: 1,
  capacity: '25.0',
  panels: '100',
};

export default function Dashboard() {
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Selected site and timestamp state
  const [selectedSite, setSelectedSite] = useState(DEFAULT_SITE);
  const [selectedTimestamp, setSelectedTimestamp] = useState('2020-06-15T13:30');

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
    const interval = setInterval(verifyBackend, 15000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="solar-dashboard-app">
      {/* 1. Slim top bar: the name and a connection dot */}
      <Header isConnected={isBackendConnected} />

      <main className="dashboard-main-content">
        {/* 2. Hero strip: compact input row (2 rows desktop, stacked mobile) with amber button */}
        <HeroInputStrip
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          isBackendConnected={isBackendConnected}
          onSiteOrDateChange={handleSiteOrDateChange}
          currentSite={selectedSite}
          currentTimestamp={selectedTimestamp}
        />

        {/* 3. Status band directly below: large status word, Expected vs Actual, loss %, short action line */}
        <StatusBand
          result={analysisResult}
          isLoading={isLoading}
          errorMessage={errorMessage}
        />

        {/* 4. Forecast section: full width, biggest area on page */}
        <ForecastHero
          selectedSite={selectedSite}
          timestamp={selectedTimestamp}
          isBackendConnected={isBackendConnected}
        />

        {/* 5. Past and Compare charts below forecast */}
        <PastCompareSection
          selectedSite={selectedSite}
          timestamp={selectedTimestamp}
          isBackendConnected={isBackendConnected}
        />

        {/* 6. Small Environmental section (4 short lines) */}
        <EnvironmentalSection analysisResult={analysisResult} />

        {/* Secondary utility: Batch CSV link */}
        <div className="batch-link-strip">
          <button
            type="button"
            className="btn-text-link"
            onClick={() => setIsBatchModalOpen(true)}
          >
            Upload readings CSV for batch audit
          </button>
        </div>

        {/* 7. Collapsed About section */}
        <AboutSection />
      </main>

      {/* Optional Batch CSV Modal */}
      {isBatchModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsBatchModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-modal-heading"
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="batch-modal-heading" className="modal-title">Upload readings CSV</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsBatchModalOpen(false)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>
            <BatchAnalysis
              isBackendConnected={isBackendConnected}
              onClose={() => setIsBatchModalOpen(false)}
              onBatchResult={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
