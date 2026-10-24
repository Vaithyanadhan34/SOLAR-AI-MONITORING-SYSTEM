import React from 'react';

export default function AboutSection() {
  return (
    <section className="about-section" aria-label="About and Methodology">
      <details className="about-details">
        <summary className="about-summary">
          <span className="summary-title">About this system</span>
          <span className="summary-chevron" aria-hidden="true">▾</span>
        </summary>
        <div className="about-content">
          <div className="about-grid">
            <div className="about-block">
              <h4>Baseline & Expected Power</h4>
              <p>
                Calculates the generation expected from clean panels given current solar elevation, temperature, humidity, and site capacity. It operates independently of past dirty readings to prevent concealing soiling loss.
              </p>
            </div>

            <div className="about-block">
              <h4>Diagnosis & Maintenance</h4>
              <p>
                Gradual drops below 15% indicate possible dirt; check the surface before cleaning. Sudden sharp drops indicate potential electrical, inverter, or shading issues requiring visual inspection.
              </p>
            </div>

            <div className="about-block">
              <h4>Multi-step Forecasting</h4>
              <p>
                Next 6h and 24h forecasts use recursive models with local diurnal weather cycles. The 7-day projection aggregates multi-step estimates and is labeled as a rough estimate.
              </p>
            </div>

            <div className="about-block">
              <h4>Environmental Benchmarks</h4>
              <p>
                Grid emission reductions are estimated at 0.716 kg CO₂ per kWh based on CEA India baseline data. Water conservation reflects thermal power plant cooling savings.
              </p>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
