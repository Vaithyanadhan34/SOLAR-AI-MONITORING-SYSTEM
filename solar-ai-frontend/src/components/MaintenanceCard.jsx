import React from 'react';
import { CheckCircle2, AlertCircle, Wrench } from 'lucide-react';

export default function MaintenanceCard({ maintenance }) {
  if (!maintenance) return null;

  const {
    status = 'Normal',
    recommendation = 'NORMAL',
    action_title,
    possible_cause = 'No Significant Abnormal Cause',
    reason = 'Performance is within acceptable limits.',
    guidance
  } = maintenance;

  // Normalize status into one of: 'Normal', 'Cleaning Review', or 'Inspection'
  let normalizedStatus = status;
  if (recommendation.includes('CLEANING') || status.toLowerCase().includes('clean')) {
    normalizedStatus = 'Cleaning Review';
  } else if (recommendation.includes('INSPECTION') || status.toLowerCase().includes('inspect')) {
    normalizedStatus = 'Inspection';
  } else {
    normalizedStatus = 'Normal';
  }

  const getStatusConfig = (st) => {
    switch (st) {
      case 'Normal':
        return {
          icon: <CheckCircle2 size={18} className="text-good" />,
          badgeClass: 'good',
          title: 'Normal Operation',
          actionText: 'System operating within expected threshold. Continue standard automated monitoring.'
        };
      case 'Cleaning Review':
        return {
          icon: <AlertCircle size={18} className="text-warning" />,
          badgeClass: 'warning',
          title: 'Cleaning Review Recommended',
          actionText: 'Inspect panel surfaces for dust, pollen, or soiling. Clean panels with demineralized water if a surface layer is visually confirmed.'
        };
      case 'Inspection':
        return {
          icon: <Wrench size={18} className="text-danger" />,
          badgeClass: 'danger',
          title: 'Physical Inspection Recommended',
          actionText: 'Schedule qualified technician to inspect inverters, DC wiring, array balance, and examine for possible shading or electrical faults.'
        };
      default:
        return {
          icon: <CheckCircle2 size={18} className="text-good" />,
          badgeClass: 'good',
          title: 'Normal Operation',
          actionText: 'Continue standard automated monitoring.'
        };
    }
  };

  const config = getStatusConfig(normalizedStatus);

  return (
    <div className="section-block maintenance-block">
      <div className="section-header-compact">
        <h3 className="section-block-title">Maintenance Recommendation</h3>
        <p className="section-block-subtitle">Condition-based operational guidance derived from model forecast and variance</p>
      </div>

      {/* Main Status Callout */}
      <div className={`action-callout ${config.badgeClass}`}>
        <div className="action-callout-header">
          {config.icon}
          <div className="action-label">Recommendation Category</div>
        </div>
        <div className="action-value">{normalizedStatus}</div>
        <div className="action-subtext">{action_title || config.title}</div>
      </div>

      <div className="maintenance-details-list">
        <div className="info-row">
          <span className="info-key">Identified Possible Cause:</span>
          <span className="info-val">{possible_cause}</span>
        </div>

        <div className="info-row">
          <span className="info-key">Decision Rationale:</span>
          <span className="info-val">{reason}</span>
        </div>

        <div className="info-row guidance-row">
          <span className="info-key">Actionable Guidance:</span>
          <span className="info-val guidance-text">{guidance || config.actionText}</span>
        </div>
      </div>
    </div>
  );
}
