import React from 'react';
import AnimatedNumber from './AnimatedNumber';

export default function StatusBand({ result, isLoading, errorMessage }) {
  if (errorMessage) {
    return (
      <section className="status-band status-error-band" role="alert">
        <div className="status-band-content">
          <span className="status-label-error">Notice</span>
          <p className="status-action-line">{errorMessage}</p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="status-band status-loading-band" aria-busy="true">
        <div className="skeleton-line shimmer-box" style={{ width: '180px', height: '38px', borderRadius: '6px' }} />
        <div className="skeleton-line shimmer-box" style={{ width: '280px', height: '24px', borderRadius: '4px' }} />
      </section>
    );
  }

  // Fallback default state before analysis or when initial state
  const status = result?.status || 'Normal';
  const expectedKw = typeof result?.predicted_generation === 'number'
    ? result.predicted_generation
    : (result?.baseline_generation || 22.4);
  const actualKw = typeof result?.current_generation === 'number'
    ? result.current_generation
    : 18.5;
  const lossPct = typeof result?.loss_percentage === 'number'
    ? Math.max(0, result.loss_percentage)
    : Math.max(0, ((expectedKw - actualKw) / (expectedKw || 1)) * 100);

  // Derive status theme and short action line (<= 12 words)
  let statusTheme = 'normal';
  let shortAction = 'Panels running smoothly. No maintenance needed.';

  const sUpper = status.toUpperCase();
  if (sUpper.includes('INSPECT')) {
    statusTheme = 'inspection';
    shortAction = 'Sudden power drop. Check wiring and inverters.';
  } else if (sUpper.includes('CLEAN')) {
    statusTheme = 'cleaning';
    shortAction = 'Possible dirt. Check and wash panel surface.';
  } else {
    statusTheme = 'normal';
    shortAction = 'Panels running smoothly. No maintenance needed.';
  }

  return (
    <section className={`status-band status-band-${statusTheme}`} aria-live="polite">
      <div className="status-band-inner">
        {/* Status header & primary metrics */}
        <div className="status-primary-row">
          <div className="status-word-wrapper">
            <span className={`status-badge-indicator ${statusTheme === 'inspection' ? 'pulse-inspection' : ''}`} />
            <h3 className="status-word">{status}</h3>
          </div>

          <div className="status-metrics-group">
            <div className="metric-pill">
              <span className="metric-tag">Expected</span>
              <span className="metric-val">
                <AnimatedNumber value={expectedKw} decimals={1} suffix=" kW" />
              </span>
            </div>

            <div className="metric-divider" aria-hidden="true">/</div>

            <div className="metric-pill">
              <span className="metric-tag">Actual</span>
              <span className="metric-val">
                <AnimatedNumber value={actualKw} decimals={1} suffix=" kW" />
              </span>
            </div>

            <div className="metric-divider" aria-hidden="true">•</div>

            <div className="metric-pill">
              <span className="metric-tag">Loss</span>
              <span className={`metric-val ${lossPct > 15 ? 'loss-highlight' : ''}`}>
                <AnimatedNumber value={lossPct} decimals={1} suffix="%" />
              </span>
            </div>
          </div>
        </div>

        {/* Cautious short action line (under 12 words) */}
        <p className="status-action-line">{shortAction}</p>
      </div>
    </section>
  );
}
