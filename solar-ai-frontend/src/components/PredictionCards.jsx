import React from 'react';
import { Zap, TrendingDown, TrendingUp, Gauge } from 'lucide-react';

export default function PredictionCards({ prediction, performance, maintenance }) {
  if (!prediction || !performance) return null;

  const predictedGen = Number(prediction.predicted_generation) || 0;
  const actualGen = Number(prediction.actual_generation) || 0;
  const genDiff = Number(prediction.generation_difference) || (predictedGen - actualGen);
  const lossPercent = Number(performance.loss_percent) || 0;
  const genChangePct = Number(performance.generation_change_percent) || 0;
  const unit = prediction.unit || 'kW';

  let statusType = 'good';
  let statusTitle = 'Optimal Performance';
  let statusDesc = 'Current solar generation closely matches the Random Forest expected output.';

  const rec = maintenance?.recommendation || '';
  const maintStatus = maintenance?.status || '';

  if (lossPercent >= 15.0 || rec === 'INSPECTION RECOMMENDED' || maintStatus === 'Inspection') {
    statusType = 'danger';
    statusTitle = 'Severe Performance Deficit';
    statusDesc = 'Measured power is significantly below expected capacity. Investigation required.';
  } else if (lossPercent >= 8.0 || rec === 'CLEANING RECOMMENDED' || maintStatus === 'Cleaning Review') {
    statusType = 'warning';
    statusTitle = 'Moderate Performance Loss';
    statusDesc = 'Measured generation is lower than model forecast, indicating potential panel soiling.';
  }

  return (
    <div className="prediction-summary-container">
      {/* Performance Status Banner */}
      <div className={`status-banner ${statusType}`} role="status">
        <div className="status-banner-title">{statusTitle}</div>
        <div className="status-banner-desc">{statusDesc}</div>
      </div>

      {/* Primary Generation Prediction & Measured Comparison Cards */}
      <div className="metrics-row">
        {/* Card 1: Forecasted Generation */}
        <div className="metric-cell primary-cell">
          <div className="metric-header">
            <Zap size={14} className="metric-icon" aria-hidden="true" />
            <span className="metric-title">Predicted Generation</span>
          </div>
          <div className="metric-num">
            {predictedGen.toFixed(2)} <span className="metric-unit-text">{unit}</span>
          </div>
          <div className="metric-sublabel">Random Forest model baseline</div>
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
            {genDiff > 0 ? `-${genDiff.toFixed(2)} ${unit} deficit` : `Nominal output`}
          </div>
        </div>

        {/* Card 4: Rate of Change */}
        <div className="metric-cell">
          <div className="metric-header">
            <TrendingUp size={14} className="metric-icon" aria-hidden="true" />
            <span className="metric-title">Generation Trend</span>
          </div>
          <div className="metric-num">
            {genChangePct >= 0 ? `+${genChangePct.toFixed(1)}` : genChangePct.toFixed(1)}
            <span className="metric-unit-text">%</span>
          </div>
          <div className="metric-sublabel">vs. preceding 15m reading</div>
        </div>
      </div>
    </div>
  );
}
