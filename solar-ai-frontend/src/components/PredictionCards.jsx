import React from 'react';
import { Zap, TrendingDown, TrendingUp, Gauge, History, Clock, Leaf } from 'lucide-react';

export default function PredictionCards({
  prediction,
  performance,
  maintenance,
  previousDataUsed,
  predictionInterval,
  lostKwh,
  lostCo2Kg,
  co2Label,
  expectedGen,
}) {
  if (!prediction || !performance) return null;

  const predictedGen = Number(prediction.predicted_generation) || 0;
  const actualGen = Number(prediction.actual_generation) || 0;
  const expectedGeneration = Number(expectedGen ?? prediction.expected_generation ?? predictedGen);
  const genDiff = Number(prediction.generation_difference) || (expectedGeneration - actualGen);
  const lossPercent = Number(performance.loss_percent) || 0;
  const genChangePct = Number(performance.generation_change_percent) || 0;
  const unit = prediction.unit || 'kW';

  const kwhLost = Number(lostKwh ?? performance.lost_kwh ?? 0);
  const co2Lost = Number(lostCo2Kg ?? performance.lost_co2_kg ?? 0);

  let statusType = 'good';
  let statusTitle = 'Optimal Performance';
  let statusDesc = 'Current solar generation matches expected unsoiled output within nominal tolerance.';

  const rec = maintenance?.recommendation || '';
  const maintStatus = maintenance?.status || '';

  if (lossPercent >= 15.0 || rec === 'INSPECTION RECOMMENDED' || maintStatus === 'Inspection') {
    statusType = 'danger';
    statusTitle = maintStatus === 'Inspection' ? 'Physical Inspection Recommended' : 'Significant Performance Loss';
    statusDesc = maintenance?.reason || 'Measured power indicates severe deviation. Verify inverter and array.';
  } else if (lossPercent >= 8.0 || rec === 'CLEANING RECOMMENDED' || maintStatus === 'Cleaning Review') {
    statusType = 'warning';
    statusTitle = 'Panel Cleaning Review Recommended';
    statusDesc = maintenance?.reason || 'Performance deviation detected; possible soiling, verify by inspection.';
  }

  return (
    <div className="prediction-summary-container">
      {/* Performance Status Banner */}
      <div className={`status-banner ${statusType}`} role="status">
        <div className="status-banner-title">{statusTitle}</div>
        <div className="status-banner-desc">{statusDesc}</div>
      </div>

      {/* Primary Generation Metrics */}
      <div className="metrics-row">
        {/* Card 1: Expected Generation (Unsoiled Physical Baseline) */}
        <div className="metric-cell primary-cell">
          <div className="metric-header">
            <Zap size={14} className="metric-icon" aria-hidden="true" />
            <span className="metric-title">Expected Generation</span>
          </div>
          <div className="metric-num">
            {expectedGeneration.toFixed(2)} <span className="metric-unit-text">{unit}</span>
          </div>
          <div className="metric-sublabel">Unsoiled physical baseline</div>
        </div>

        {/* Card 2: Actual Measured Generation */}
        <div className="metric-cell">
          <div className="metric-header">
            <Gauge size={14} className="metric-icon" aria-hidden="true" />
            <span className="metric-title">Actual Monitored</span>
          </div>
          <div className="metric-num">
            {actualGen.toFixed(2)} <span className="metric-unit-text">{unit}</span>
          </div>
          <div className="metric-sublabel">Current instantaneous power</div>
        </div>

        {/* Card 3: Performance Loss */}
        <div className="metric-cell">
          <div className="metric-header">
            <TrendingDown size={14} className="metric-icon" aria-hidden="true" />
            <span className="metric-title">Performance Loss</span>
          </div>
          <div
            className="metric-num"
            style={{
              color:
                lossPercent >= 15
                  ? 'var(--status-danger-text)'
                  : lossPercent >= 8
                  ? 'var(--status-warning-text)'
                  : 'var(--status-good-text)',
            }}
          >
            {lossPercent.toFixed(1)} <span className="metric-unit-text">%</span>
          </div>
          <div className="metric-sublabel">
            {genDiff > 0 ? `-${genDiff.toFixed(2)} ${unit} vs. expected` : 'Within nominal range'}
          </div>
        </div>

        {/* Card 4: Short-term Nowcast Prediction & Spread */}
        <div className="metric-cell">
          <div className="metric-header">
            <TrendingUp size={14} className="metric-icon" aria-hidden="true" />
            <span className="metric-title">Short-Term Estimate</span>
          </div>
          <div className="metric-num">
            {predictedGen.toFixed(2)} <span className="metric-unit-text">{unit}</span>
          </div>
          <div className="metric-sublabel">
            {predictionInterval?.lower_bound !== undefined ? (
              <span>Range: [{predictionInterval.lower_bound} – {predictionInterval.upper_bound} kW]</span>
            ) : (
              <span>RF nowcast estimate</span>
            )}
          </div>
        </div>
      </div>

      {/* Energy & Environmental Loss Summary */}
      {(kwhLost > 0 || co2Lost > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          margin: '0.75rem 0',
        }}>
          <div style={{
            padding: '0.65rem 0.85rem',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Lost Energy (15-min interval)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-warning-text)' }}>
              {kwhLost.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>kWh</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Avoidable generation deficit
            </div>
          </div>

          <div style={{
            padding: '0.65rem 0.85rem',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Leaf size={12} style={{ color: 'var(--status-good-text)' }} />
              <span>Emissions Impact</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {co2Lost.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>kg CO₂</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {co2Label || 'estimated avoided or lost emissions'}
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Previous Data Used (Auto-retrieved from history — Requirement 5) */}
      {previousDataUsed && (
        <div style={{
          margin: '0.75rem 0 0 0',
          padding: '0.75rem 0.9rem',
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.4rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.775rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
              <History size={14} />
              <span>Historical Telemetry Automatically Used</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <Clock size={12} />
              <span>Preceding: {previousDataUsed.timestamp}</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.775rem',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Previous reading: <strong>{previousDataUsed.value} kW</strong>
            </span>
            <span style={{ color: 'var(--border-color)' }}>•</span>
            <span style={{ color: 'var(--text-muted)' }}>Operational Lags:</span>
            <span style={{
              padding: '0.15rem 0.45rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              color: 'var(--text-primary)',
            }}>
              30m: <strong>{previousDataUsed.lags?.lag_30min} kW</strong>
            </span>
            <span style={{
              padding: '0.15rem 0.45rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              color: 'var(--text-primary)',
            }}>
              1h: <strong>{previousDataUsed.lags?.lag_1hour} kW</strong>
            </span>
            <span style={{
              padding: '0.15rem 0.45rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              color: 'var(--text-primary)',
            }}>
              2h: <strong>{previousDataUsed.lags?.lag_2hour} kW</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
