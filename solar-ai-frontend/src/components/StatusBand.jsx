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

  // Real fields from /api/analyze (backed by backend/decision.py)
  const hasResult = Boolean(result && (result.maintenance_status || result.status || result.performance_grade));

  if (!hasResult) {
    return (
      <section className="status-band status-neutral-band" aria-label="Awaiting analysis">
        <div className="status-band-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="status-badge-neutral">Ready for analysis</span>
            <p className="status-action-line" style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)' }}>
              Enter current inverter generation and ambient conditions above, then press <strong>Analyze</strong> to evaluate performance.
            </p>
          </div>
          <div className="status-ready-pill" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Physical RF Baseline &bull; Dynamic Drift Guard
          </div>
        </div>
      </section>
    );
  }

  const status = result?.maintenance_status || result?.status || 'Ready';
  
  const expectedKw = typeof result?.expected_generation === 'number'
    ? result.expected_generation
    : (typeof result?.predicted_generation === 'number' ? result.predicted_generation : null);
    
  const actualKw = typeof result?.actual_generation === 'number'
    ? result.actual_generation
    : (typeof result?.current_generation === 'number' ? result.current_generation : null);

  const deltaKw = typeof result?.delta_kW === 'number' 
    ? result.delta_kW 
    : (actualKw !== null && expectedKw !== null ? actualKw - expectedKw : 0);

  const shortfallKw = typeof result?.shortfall_kW === 'number'
    ? result.shortfall_kW
    : Math.max(0, -deltaKw);

  const excessKw = typeof result?.excess_kW === 'number'
    ? result.excess_kW
    : Math.max(0, deltaKw);

  const lostKwh = typeof result?.lost_kWh === 'number'
    ? result.lost_kWh
    : (typeof result?.lost_kwh === 'number' ? result.lost_kwh : shortfallKw * 0.5);

  const pr = typeof result?.performance_ratio === 'number' 
    ? result.performance_ratio 
    : (typeof result?.PR === 'number' ? result.PR : null);

  // Performance Grade & Cutoffs (Part 6 / Rule 3)
  const grade = result?.performance_grade || result?.grade || (status === 'Normal' ? 'Normal' : (status === 'Optimal' ? 'Very Good' : 'Bad'));

  const cutoffs = result?.grade_cutoffs || result?.cutoffs_used || {
    p25: 0.82,
    p50: 0.98,
    p75: 1.13
  };

  const p25 = Number(cutoffs.p25 ?? 0.82);
  const p50 = Number(cutoffs.p50 ?? 0.98);
  const p75 = Number(cutoffs.p75 ?? 1.13);

  // One-line grade reason strictly from backend reason field (Rule 7)
  const oneLineReason = result?.grade_reason || result?.reason || result?.action_guidance || result?.maintenance_reason || 
    (grade === 'Very Good' ? 'Performing above its usual level. No action needed.' : 
     (grade === 'Normal' ? 'Performing as expected. Continue monitoring.' : 
      'Performance below expected typical threshold. Inspection or cleaning review recommended.'));

  const directionText = result?.direction_text || (
    deltaKw > 0.05 && expectedKw > 0 ? `${((deltaKw / expectedKw) * 100).toFixed(1)}% above expected` :
    deltaKw < -0.05 && expectedKw > 0 ? `${((shortfallKw / expectedKw) * 100).toFixed(1)}% below expected` :
    'within the usual range'
  );

  // Derive status theme and badge styling
  let statusTheme = 'normal';
  let badgeClass = 'grade-badge-normal';

  if (hasResult) {
    if (grade === 'Very Good' || status === 'Optimal') {
      statusTheme = 'optimal';
      badgeClass = 'grade-badge-very-good';
    } else if (grade === 'Bad' || status === 'Inspection' || status === 'Cleaning Review') {
      if (status === 'Cleaning Review') {
        statusTheme = 'cleaning';
        badgeClass = 'grade-badge-bad-amber';
      } else {
        statusTheme = 'inspection';
        badgeClass = 'grade-badge-bad-red';
      }
    } else {
      statusTheme = 'normal';
      badgeClass = 'grade-badge-normal';
    }
  }

  // PR Gauge Scale (0 to maxScale)
  const maxScale = Math.max(1.6, (pr !== null ? pr + 0.3 : 1.5));
  const p25Pct = Math.min(100, Math.max(0, (p25 / maxScale) * 100));
  const p75Pct = Math.min(100, Math.max(0, (p75 / maxScale) * 100));
  const p50Pct = Math.min(100, Math.max(0, (p50 / maxScale) * 100));
  const prPct = pr !== null ? Math.min(100, Math.max(0, (pr / maxScale) * 100)) : null;
  const bandWidthPct = Math.max(0, p75Pct - p25Pct);

  return (
    <section className={`status-band status-band-${statusTheme}`} aria-live="polite">
      <div className="status-band-inner">
        {/* Status header & primary metrics */}
        <div className="status-primary-row">
          <div className="status-word-wrapper">
            <span className={`status-badge-indicator ${statusTheme === 'inspection' ? 'pulse-inspection' : ''}`} />
            <h3 className="status-word">{status}</h3>
            
            {/* Rule 3: Single Grade Badge */}
            {hasResult && (
              <span className={`performance-grade-badge ${badgeClass}`}>
                {grade === 'Very Good' && '✦ '}
                {grade === 'Normal' && '● '}
                {grade === 'Bad' && '▲ '}
                {grade}
              </span>
            )}
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
              <span className="metric-tag">PR</span>
              <span className="metric-val">
                {pr !== null ? pr.toFixed(2) : '--'}
              </span>
            </div>

            {/* Rule 7: Shortfall and Excess as separate items; Energy lost only when shortfall exists */}
            {shortfallKw > 0.05 ? (
              <>
                <div className="metric-divider" aria-hidden="true">•</div>
                <div className="metric-pill">
                  <span className="metric-tag">Shortfall</span>
                  <span className="metric-val loss-highlight">
                    <AnimatedNumber value={shortfallKw} decimals={1} suffix=" kW" />
                  </span>
                </div>
                <div className="metric-divider" aria-hidden="true">•</div>
                <div className="metric-pill">
                  <span className="metric-tag">Energy Lost</span>
                  <span className="metric-val loss-highlight">
                    <AnimatedNumber value={lostKwh} decimals={2} suffix=" kWh" />
                  </span>
                </div>
              </>
            ) : excessKw > 0.05 ? (
              <>
                <div className="metric-divider" aria-hidden="true">•</div>
                <div className="metric-pill">
                  <span className="metric-tag">Excess Power</span>
                  <span className="metric-val" style={{ color: '#059669' }}>
                    +<AnimatedNumber value={excessKw} decimals={1} suffix=" kW" />
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Rule 7: Plain words direction and cautious action line from backend reason */}
        <div className="status-reason-row" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
          {directionText && (
            <span 
              className="status-direction-tag"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: excessKw > 0 ? '#E8F8F0' : (shortfallKw > 0 ? '#FEE2E2' : '#F1F5F9'),
                color: excessKw > 0 ? '#059669' : (shortfallKw > 0 ? '#DC2626' : '#475569')
              }}
            >
              {directionText}
            </span>
          )}
          <p className="status-action-line" style={{ margin: 0 }}>{oneLineReason}</p>
        </div>

        {/* Small PR typical band chart (semi-transparent 25th-75th percentile) */}
        {hasResult && pr !== null && (
          <div className="pr-band-track-container" aria-label="Performance Ratio against site typical band">
            <div className="pr-band-track-header">
              <span className="pr-track-title">Today's Performance Ratio vs Historical Typical Band</span>
              <span className="pr-track-legend">
                <span className="legend-swatch band-swatch" /> Typical Band (25th–75th %ile: {p25.toFixed(2)} – {p75.toFixed(2)})
              </span>
            </div>

            <div className="pr-bar-track">
              {/* Semi-transparent 25th - 75th percentile band */}
              <div 
                className="pr-typical-band-rect"
                style={{
                  left: `${p25Pct}%`,
                  width: `${bandWidthPct}%`
                }}
                title={`Site Typical Band: ${p25.toFixed(2)} to ${p75.toFixed(2)}`}
              />

              {/* Median Line */}
              <div 
                className="pr-median-line" 
                style={{ left: `${p50Pct}%` }}
                title={`Historical Median PR: ${p50.toFixed(2)}`}
              />

              {/* Today's PR Indicator */}
              <div 
                className={`pr-marker-pin ${badgeClass}`} 
                style={{ left: `${prPct}%` }}
                title={`Today's PR: ${pr.toFixed(2)}`}
              >
                <div className="pr-pin-dot" />
                <div className="pr-pin-tooltip">PR {pr.toFixed(2)}</div>
              </div>
            </div>

            <div className="pr-bar-ticks">
              <span>0.0</span>
              <span style={{ position: 'absolute', left: `${p25Pct}%`, transform: 'translateX(-50%)' }}>
                p25 ({p25.toFixed(2)})
              </span>
              <span style={{ position: 'absolute', left: `${p50Pct}%`, transform: 'translateX(-50%)' }}>
                Med ({p50.toFixed(2)})
              </span>
              <span style={{ position: 'absolute', left: `${p75Pct}%`, transform: 'translateX(-50%)' }}>
                p75 ({p75.toFixed(2)})
              </span>
              <span style={{ marginLeft: 'auto' }}>{maxScale.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
