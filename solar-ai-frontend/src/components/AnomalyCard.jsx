import React from 'react';
import { Activity, CheckCircle, AlertTriangle, Cpu, AlertOctagon } from 'lucide-react';

export default function AnomalyCard({ anomaly, explainability, driftWarnings }) {
  if (!anomaly) return null;

  const { status, score, label, detected, explanation } = anomaly;
  const isAnomaly = detected === true || status === 'Anomaly' || label === -1;

  const topFeatures = explainability?.top_features || [];
  const anomalyReason = explainability?.anomaly_reason || explanation;

  return (
    <div className="section-block anomaly-block">
      <div className="section-header-compact">
        <h3 className="section-block-title">Behavioral Anomaly & Model Explainability</h3>
        <p className="section-block-subtitle">
          Isolation Forest validation of power dynamics and top feature drivers
        </p>
      </div>

      <div className="anomaly-content">
        <div className={`anomaly-status-badge ${isAnomaly ? 'status-anomaly' : 'status-normal'}`}>
          {isAnomaly ? (
            <>
              <AlertTriangle size={18} className="status-icon" aria-hidden="true" />
              <span>Unusual Operating Pattern Flagged (Anomaly)</span>
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
              ? 'The system observed an abnormal generation level relative to concurrent ambient conditions and preceding time intervals.'
              : 'The operational generation profile aligns with standard statistical solar operating curves.'}
          </span>
        </div>

        <div className="info-row">
          <span className="info-key">Explainable Reason:</span>
          <span className="info-val interpretation-text">
            {anomalyReason || (isAnomaly
              ? 'Isolation Forest flagged a statistical deviation in power dynamics.'
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

        {/* Top 3 Feature Drivers */}
        {topFeatures.length > 0 && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
              <Cpu size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>Top 3 Feature Drivers:</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.4rem' }}>
              {topFeatures.map((tf, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.4rem 0.55rem',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.725rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tf.feature}</div>
                  <div style={{ color: 'var(--brand-primary)', fontWeight: 500 }}>Val: {tf.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drift Warnings if any */}
        {driftWarnings && driftWarnings.length > 0 && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.65rem',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.725rem',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--status-warning-text)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
              <AlertOctagon size={13} />
              <span>Input Range Note:</span>
            </div>
            {driftWarnings.map((dw, idx) => (
              <div key={idx}>{dw}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
