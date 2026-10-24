import React from 'react';
import AnimatedNumber from './AnimatedNumber';

export default function EnvironmentalSection({ analysisResult }) {
  // Real calculations based on current generation or default baseline
  // CEA India emission factor: 0.716 kg CO2/kWh
  // Coal factor: ~0.40 kg coal/kWh
  // Thermal cooling water factor: ~2.0 L/kWh
  const currentGen = analysisResult?.current_generation ?? 18.5;
  const estimatedDailyKwh = currentGen * 5.2; // typical equivalent full sun hours
  const co2AvoidedKg = estimatedDailyKwh * 0.716;
  const coalSavedKg = estimatedDailyKwh * 0.40;
  const waterSavedL = estimatedDailyKwh * 2.0;

  return (
    <section className="environmental-section" aria-label="Environmental Impact Summary">
      <h3 className="section-subheading">Environmental impact</h3>
      <div className="env-metrics-grid">
        <div className="env-line-item">
          <span className="env-bullet" aria-hidden="true">•</span>
          <span className="env-label">Clean solar power:</span>
          <strong className="env-value">
            <AnimatedNumber value={estimatedDailyKwh} decimals={1} suffix=" kWh" /> produced.
          </strong>
        </div>

        <div className="env-line-item">
          <span className="env-bullet" aria-hidden="true">•</span>
          <span className="env-label">Carbon avoided:</span>
          <strong className="env-value">
            <AnimatedNumber value={co2AvoidedKg} decimals={1} suffix=" kg" /> CO₂ displaced.
          </strong>
        </div>

        <div className="env-line-item">
          <span className="env-bullet" aria-hidden="true">•</span>
          <span className="env-label">Coal offset:</span>
          <strong className="env-value">
            <AnimatedNumber value={coalSavedKg} decimals={1} suffix=" kg" /> coal avoided.
          </strong>
        </div>

        <div className="env-line-item">
          <span className="env-bullet" aria-hidden="true">•</span>
          <span className="env-label">Water saved:</span>
          <strong className="env-value">
            <AnimatedNumber value={waterSavedL} decimals={0} suffix=" L" /> thermal water conserved.
          </strong>
        </div>
      </div>
    </section>
  );
}
