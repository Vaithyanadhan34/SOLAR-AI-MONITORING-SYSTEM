import React from 'react';

export default function ResultPanel({
  result,
  isLoading,
  errorMessage,
}) {
  // 1. Error state (Never show fake results)
  if (errorMessage) {
    return (
      <div className="result-panel">
        <div className="error-banner" role="alert">
          <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Unable to complete check</div>
          <div>{errorMessage}</div>
          <div style={{ marginTop: '0.65rem', fontSize: '0.85rem' }}>
            Tip: Make sure the backend server is running: <code>py app.py</code> in your PowerShell terminal.
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading state
  if (isLoading) {
    return (
      <div className="result-panel">
        <div className="loading-result-state">
          <div className="spinner" />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Checking your solar panels...
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Comparing current reading with expected sunlight and temperature
          </div>
        </div>
      </div>
    );
  }

  // 3. Before analysis: friendly empty state
  if (!result) {
    return (
      <div className="result-panel">
        <div className="empty-result-state">
          <h2 className="empty-result-heading">Your result will appear here</h2>
          <p className="empty-result-desc">
            Complete the two steps on the left to check if your solar array is generating what it should.
          </p>
          <ul className="empty-steps-list">
            <li>
              <span className="step-number">1</span>
              <span>Select which solar site you are monitoring and choose a date and time</span>
            </li>
            <li>
              <span className="step-number">2</span>
              <span>Enter your current meter reading and outdoor weather</span>
            </li>
            <li>
              <span className="step-number">3</span>
              <span>Click &ldquo;Check my solar panels&rdquo; to see your status and recommended action</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // 4. Analysis Results (Top to bottom per user spec)
  const status = result.maintenance_status || 'Normal';
  const expectedKw = Number(result.expected_generation ?? result.prediction?.expected_generation ?? 0);
  const actualKw = Number(result.actual_generation ?? result.prediction?.actual_generation ?? 0);
  const diffKw = Math.abs(expectedKw - actualKw);
  const isDeficit = expectedKw > actualKw;
  const lossPct = Number(result.performance_loss_percent ?? result.performance?.loss_percent ?? 0);
  const lostKwh = Number(result.lost_kwh ?? result.performance?.lost_kwh ?? 0);
  const lostCo2 = Number(result.lost_co2_kg ?? result.performance?.lost_co2_kg ?? 0);
  const isUnusual = Boolean(result.anomaly_detected || result.anomaly?.detected);
  const prevUsed = result.previous_data_used;
  const interval = result.prediction_interval;
  const score = result.anomaly_score ?? result.anomaly?.score;

  // Status sentence and styling class
  let bannerClass = 'normal';
  let bannerTag = 'Normal';
  let bannerSentence = 'Your panels are producing normally. Output is within expected range.';

  if (status === 'Inspection' || isUnusual) {
    bannerClass = 'inspection';
    bannerTag = 'Inspection Recommended';
    bannerSentence = 'Sudden power drop detected. A technician should inspect the equipment.';
  } else if (status === 'Cleaning Review' || lossPct >= 15.0) {
    bannerClass = 'cleaning';
    bannerTag = 'Cleaning Review';
    bannerSentence = `Your panels are producing ${lossPct.toFixed(0)}% less than expected. Consider checking for dirt.`;
  }

  // Action lines (cautious, plain English)
  let actionLines = [
    'No action needed right now.',
    'Continue monitoring your panels as part of your normal routine.',
  ];

  if (status === 'Inspection' || isUnusual) {
    actionLines = [
      'Have a qualified technician inspect the inverter, electrical cables, and DC disconnects.',
      'Check inverter fault lights or event logs for sudden disconnections.',
      'Do not climb onto roof panels or touch wiring without safety training.',
    ];
  } else if (status === 'Cleaning Review' || lossPct >= 15.0) {
    actionLines = [
      'Possible dirt: check the panel surface first to verify if dust or grime has gathered.',
      'Clean panels only if dirt is clearly visible on the glass surface.',
      'Wash panels early in the morning or in the evening when glass is cool to avoid heat shock.',
    ];
  }

  return (
    <div className="result-panel">
      {/* 1. Big Status Banner */}
      <div className={`big-status-banner ${bannerClass}`} role="status">
        <span className="status-badge-tag">{bannerTag}</span>
        <div className="status-sentence">{bannerSentence}</div>
      </div>

      {/* 2. Two Big Numbers Side-by-Side */}
      <div className="numbers-comparison-row">
        <div className="number-card">
          <div className="number-label">Expected power</div>
          <div className="number-value">
            {expectedKw.toFixed(2)}
            <span className="number-unit">kW</span>
          </div>
          <div className="number-sub">What clean panels should produce now</div>
        </div>

        <div className="number-card">
          <div className="number-label">Actual power</div>
          <div className="number-value">
            {actualKw.toFixed(2)}
            <span className="number-unit">kW</span>
          </div>
          <div className="number-sub">
            {isDeficit && diffKw > 0.05
              ? `${diffKw.toFixed(2)} kW below expected`
              : 'Matches expected output'}
          </div>
        </div>
      </div>

      {/* 3. What should I do? */}
      <div className="action-box">
        <div className="action-heading">What should I do?</div>
        <ul className="action-lines">
          {actionLines.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>

      {/* 4. Is anything unusual? */}
      <div className="unusual-section">
        <div className="unusual-heading">Is anything unusual?</div>
        <div className="unusual-answer">
          {isUnusual ? 'Yes — unusual drop flagged' : 'No — operating pattern looks normal'}
        </div>
        <div className="unusual-reason">
          {isUnusual
            ? 'Power fell significantly faster than standard weather changes explain.'
            : 'Power output follows typical daylight and temperature conditions.'}
        </div>
      </div>

      {/* 5. Small Estimated Energy Lost & CO2 */}
      <div className="estimates-inline-row">
        <div className="estimate-item">
          <span>Estimated energy lost today: </span>
          <strong>{lostKwh > 0 ? lostKwh.toFixed(1) : '0.0'} kWh</strong>
          <span className="estimate-tag">(estimate)</span>
        </div>
        <div className="estimate-item">
          <span>Estimated CO₂ impact: </span>
          <strong>{lostCo2 > 0 ? lostCo2.toFixed(1) : '0.0'} kg</strong>
          <span className="estimate-tag">(estimate)</span>
        </div>
      </div>

      {/* 6. Collapsed Details Section */}
      <details className="details-disclosure">
        <summary className="details-summary">Technical details</summary>
        <div className="details-content">
          {prevUsed && (
            <div>
              <strong>Previous reading used:</strong> {prevUsed.value} kW at {prevUsed.timestamp}
              {prevUsed.lags && (
                <div style={{ marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                  Earlier readings: 30m ({prevUsed.lags.lag_30min} kW) • 1h ({prevUsed.lags.lag_1hour} kW) • 2h ({prevUsed.lags.lag_2hour} kW)
                </div>
              )}
            </div>
          )}
          {interval?.lower_bound !== undefined && (
            <div>
              <strong>Estimated normal range:</strong> {interval.lower_bound} to {interval.upper_bound} kW
            </div>
          )}
          {score !== undefined && (
            <div>
              <strong>Statistical score:</strong> {Number(score).toFixed(3)} (values &gt; 0 indicate normal operating density)
            </div>
          )}
          <div>
            <strong>Emissions standard:</strong> 0.716 kg CO₂/kWh (Central Electricity Authority India, Ver. 19)
          </div>
        </div>
      </details>
    </div>
  );
}
