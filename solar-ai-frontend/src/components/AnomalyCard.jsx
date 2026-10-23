import React from 'react';
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AnomalyCard({ anomaly }) {
  if (!anomaly) return null;

  const { status, score, label, detected, explanation } = anomaly;
  const isAnomaly = detected === true || status === 'Anomaly' || label === -1;

  return (
    <div className="section-block anomaly-block">
      <div className="section-header-compact">
        <h3 className="section-block-title">Behavioral Anomaly Detection</h3>
        <p className="section-block-subtitle">Isolation Forest validation of power dynamics and environmental operating pattern</p>
      </div>

      <div className="anomaly-content">
        <div className={`anomaly-status-badge ${isAnomaly ? 'status-anomaly' : 'status-normal'}`}>
          {isAnomaly ? (
            <>
              <AlertTriangle size={18} className="status-icon" aria-hidden="true" />
              <span>Unusual Operating Pattern Flagged</span>
            </>
          ) : (
            <>
              <CheckCircle size={18} className="status-icon" aria-hidden="true" />
              <span>Normal Operating Pattern</span>
            </>
          )}
        </div>

        <div className="info-row">
          <span className="info-key">Pattern Assessment:</span>
          <span className="info-val">
            {isAnomaly
              ? 'The system observed an unexpected generation level relative to concurrent ambient conditions and preceding time intervals.'
              : 'The generation profile aligns with standard statistical solar operating curves.'}
          </span>
        </div>

        <div className="info-row">
          <span className="info-key">Technical Interpretation:</span>
          <span className="info-val interpretation-text">
            {explanation || (isAnomaly
              ? 'Isolation Forest flagged a statistical deviation in power dynamics. This indicates abnormal curve behavior, which warrants reviewing system telemetry or checking for sudden drops.'
              : 'Isolation Forest decision score lies within nominal operating bounds. No statistical outlier detected.')}
          </span>
        </div>

        {score !== undefined && (
          <div className="info-row technical-row">
            <span className="info-key">Decision Score:</span>
            <span className="info-val mono-val">
              {score > 0 ? `+${score.toFixed(4)}` : score.toFixed(4)}
              <span className="score-note"> (&gt; 0 indicates normal density; &lt; 0 indicates statistical outlier)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
