import React, { useState } from 'react';
import { IndianRupee, Droplet, DollarSign, Calculator, Info } from 'lucide-react';

export default function CleaningCostBenefit({ lossPercent, lostKwh, capacityKwp }) {
  const [tariff, setTariff] = useState('7.50'); // INR per kWh
  const [cleaningCost, setCleaningCost] = useState('600'); // INR per wash cycle
  const [waterPerWash, setWaterPerWash] = useState('250'); // Liters per wash cycle

  const tariffNum = parseFloat(tariff) || 0;
  const costNum = parseFloat(cleaningCost) || 0;
  const waterNum = parseFloat(waterPerWash) || 0;
  const cap = parseFloat(capacityKwp) || 25.0;

  // Daily recoverable energy estimate based on current loss percentage:
  // Typical daily peak hours = ~4.5 peak sun hours.
  // Daily generation = cap * 4.5 kWh.
  // Recoverable daily energy = daily generation * (lossPercent / 100)
  const lossPct = parseFloat(lossPercent) || 0;
  const dailyGenTotal = cap * 4.5;
  const dailyRecoverableKwh = (dailyGenTotal * (lossPct / 100));
  const monthlyRecoverableKwh = dailyRecoverableKwh * 30;

  const monthlyRevenueGain = monthlyRecoverableKwh * tariffNum;
  const netMonthlyBenefit = monthlyRevenueGain - costNum;

  // Water saved scenario estimate:
  // Condition-based cleaning eliminates unneeded fixed-schedule wash cycles (e.g., 2 redundant washes saved per month)
  const redundantWashesAvoided = 2;
  const estimatedWaterSaved = waterNum * redundantWashesAvoided;

  return (
    <div className="section-block" style={{ marginTop: '1rem' }}>
      <div className="section-header-compact">
        <h3 className="section-block-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calculator size={15} style={{ color: 'var(--brand-primary)' }} />
          <span>Cleaning Cost-Benefit & Resource Analysis</span>
        </h3>
        <p className="section-block-subtitle">
          Interactive economic feasibility model comparing tariff revenues with panel wash expenses
        </p>
      </div>

      {/* Inputs Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem', margin: '0.75rem 0' }}>
        <div className="field-group" style={{ margin: 0 }}>
          <label className="field-label" style={{ fontSize: '0.75rem' }}>
            Grid Tariff (₹/kWh)
          </label>
          <input
            type="number"
            step="0.1"
            className="input-field"
            value={tariff}
            onChange={(e) => setTariff(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
          />
        </div>

        <div className="field-group" style={{ margin: 0 }}>
          <label className="field-label" style={{ fontSize: '0.75rem' }}>
            Wash Cost (₹/cycle)
          </label>
          <input
            type="number"
            step="50"
            className="input-field"
            value={cleaningCost}
            onChange={(e) => setCleaningCost(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
          />
        </div>

        <div className="field-group" style={{ margin: 0 }}>
          <label className="field-label" style={{ fontSize: '0.75rem' }}>
            Water Usage (L/wash)
          </label>
          <input
            type="number"
            step="25"
            className="input-field"
            value={waterPerWash}
            onChange={(e) => setWaterPerWash(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Calculated Outcomes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.65rem',
        padding: '0.75rem',
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Recoverable Yield</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
            {monthlyRecoverableKwh.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>kWh/mo</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Monthly Gross Gain</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ₹{monthlyRevenueGain.toFixed(0)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Net Economic Benefit</div>
          <div style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: netMonthlyBenefit >= 0 ? 'var(--status-good-text)' : 'var(--status-danger-text)',
          }}>
            {netMonthlyBenefit >= 0 ? `+₹${netMonthlyBenefit.toFixed(0)}` : `-₹${Math.abs(netMonthlyBenefit).toFixed(0)}`}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Water Conserved</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
            ~{estimatedWaterSaved} <span style={{ fontSize: '0.75rem' }}>L/mo</span>
          </div>
        </div>
      </div>

      {/* Scenario Assumptions Labeling (Requirement: Stated Assumptions) */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.4rem',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        marginTop: '0.5rem',
        lineHeight: 1.4,
      }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--brand-primary)' }} />
        <span>
          <strong>Scenario Estimate Assumptions:</strong> Yield calculations assume 4.5 peak sun hours/day for a {cap} kWp array. Water conservation estimates assume AI condition-based scheduling prevents an average of 2 unnecessary washes per month compared to weekly timer-based cleaning.
        </span>
      </div>
    </div>
  );
}
