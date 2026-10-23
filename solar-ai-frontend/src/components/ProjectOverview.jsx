import React from 'react';
import { Sun, AlertTriangle, ShieldCheck, Droplet } from 'lucide-react';

export default function ProjectOverview() {
  return (
    <section className="overview-section" aria-labelledby="project-overview-heading">
      <div className="overview-header">
        <h2 id="project-overview-heading" className="overview-title">
          Intelligent Solar PV Performance Monitoring & Maintenance
        </h2>
        <p className="overview-description">
          Solar photovoltaic panels lose efficiency over time due to dust accumulation, environmental conditions, and physical faults. Traditional calendar-based maintenance often leads to unnecessary cleanings—wasting water and labor—or allows severe performance drops to persist undetected. This software platform leverages machine learning to forecast expected solar generation, detect operational anomalies, and provide explainable condition-based maintenance guidance.
        </p>
      </div>

      <div className="overview-grid">
        <div className="overview-card">
          <div className="overview-card-icon solar-icon">
            <Sun size={18} aria-hidden="true" />
          </div>
          <div className="overview-card-content">
            <h3 className="overview-card-title">Generation Forecasting</h3>
            <p className="overview-card-text">
              Random Forest regression predicts instantaneous solar power output (kW) based on ambient conditions, time of day, and recent operating history.
            </p>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-icon anomaly-icon">
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          <div className="overview-card-content">
            <h3 className="overview-card-title">Behavioral Anomaly Detection</h3>
            <p className="overview-card-text">
              Isolation Forest validates operating dynamics to flag statistical deviations and sudden power drops before energy yields are compromised.
            </p>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-icon maintenance-icon">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="overview-card-content">
            <h3 className="overview-card-title">Condition-Based Maintenance</h3>
            <p className="overview-card-text">
              Rule-based intelligence categorizes plant status into Normal, Cleaning Review, or Physical Inspection to target maintenance resources efficiently.
            </p>
          </div>
        </div>

        <div className="overview-card">
          <div className="overview-card-icon eco-icon">
            <Droplet size={18} aria-hidden="true" />
          </div>
          <div className="overview-card-content">
            <h3 className="overview-card-title">Resource Conservation</h3>
            <p className="overview-card-text">
              Eliminating premature cleanings conserves critical water supplies in arid solar regions and lowers unnecessary operational labor costs.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
