import React from 'react';
import { Droplet, Leaf, Clock, Zap } from 'lucide-react';

export default function EnvironmentalBenefits() {
  return (
    <section className="section-block environmental-section" aria-labelledby="environmental-heading">
      <div className="section-header-compact">
        <h3 id="environmental-heading" className="section-block-title">
          Environmental & Resource Conservation Benefits
        </h3>
        <p className="section-block-subtitle">
          Potential sustainability advantages enabled by condition-based solar monitoring
        </p>
      </div>

      <div className="benefits-grid">
        <div className="benefit-card">
          <div className="benefit-icon water">
            <Droplet size={20} aria-hidden="true" />
          </div>
          <div className="benefit-body">
            <h4 className="benefit-title">Water Conservation</h4>
            <p className="benefit-text">
              Solar panels are frequently installed in arid, water-stressed regions. By cleaning only when empirical performance loss warrants it, facilities can prevent premature washing cycles and avoid significant water waste.
            </p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon carbon">
            <Leaf size={20} aria-hidden="true" />
          </div>
          <div className="benefit-body">
            <h4 className="benefit-title">Clean Energy Maximization</h4>
            <p className="benefit-text">
              Promptly identifying true soiling and system faults restores optimal power generation efficiency, ensuring high clean energy yield and displacing fossil-fuel-generated grid power.
            </p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon labor">
            <Clock size={20} aria-hidden="true" />
          </div>
          <div className="benefit-body">
            <h4 className="benefit-title">Labor & Operational Efficiency</h4>
            <p className="benefit-text">
              Automated alerts eliminate routine visual panel sweeps across large utility or rooftop sites, directing maintenance personnel specifically to arrays requiring attention.
            </p>
          </div>
        </div>

        <div className="benefit-card">
          <div className="benefit-icon equipment">
            <Zap size={20} aria-hidden="true" />
          </div>
          <div className="benefit-body">
            <h4 className="benefit-title">Asset Longevity</h4>
            <p className="benefit-text">
              Early detection of abnormal hot spots, inverter tripping, or persistent shading mitigates long-term panel degradation, protecting capital investments in renewable infrastructure.
            </p>
          </div>
        </div>
      </div>

      <div className="environmental-disclaimer">
        <em>Note:</em> The points above represent potential operational and ecological benefits achievable through intelligent condition-based maintenance, rather than site-specific historical sensor measurements.
      </div>
    </section>
  );
}
