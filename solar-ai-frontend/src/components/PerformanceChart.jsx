import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  Legend,
} from 'recharts';
import { BarChart3, Activity } from 'lucide-react';

export default function PerformanceChart({ prediction, timeline }) {
  // If batch timeline is supplied, render the operational actual vs expected timeseries curve
  if (timeline && Array.isArray(timeline) && timeline.length > 0) {
    const chartData = timeline.map((pt, idx) => ({
      time: pt.timestamp ? pt.timestamp.split(' ')[1] || pt.timestamp : `Pt ${idx + 1}`,
      actual: Number(pt.actual_kw) || 0,
      expected: Number(pt.expected_kw) || 0,
      isAnomaly: Boolean(pt.is_anomaly),
    }));

    return (
      <div className="section-block chart-block">
        <div className="chart-header">
          <div>
            <h3 className="section-block-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={16} style={{ color: 'var(--brand-primary)' }} />
              <span>Batch Operational Profile (Actual vs. Expected Baseline)</span>
            </h3>
            <p className="section-block-subtitle">
              Continuous timeseries curve comparing monitored generation with physical expected baseline
            </p>
          </div>
          <div className="chart-legend-compact">
            <span className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#15803d' }}></span>
              Actual Generation
            </span>
            <span className="legend-item">
              <span className="legend-color-dot" style={{ backgroundColor: '#0284c7' }}></span>
              Physical Baseline
            </span>
          </div>
        </div>

        <div className="chart-container-inner" style={{ height: '220px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" kW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual (kW)"
                stroke="#15803d"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="expected"
                name="Expected (kW)"
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Single observation mode
  if (!prediction || prediction.actual_generation === undefined || (prediction.predicted_generation === undefined && prediction.expected_generation === undefined)) {
    return (
      <div className="section-block chart-empty-block">
        <div className="section-header-compact">
          <h3 className="section-block-title">Generation Comparison (kW)</h3>
          <p className="section-block-subtitle">Direct comparison between measured output and physical expected baseline</p>
        </div>
        <div className="empty-chart-state">
          <BarChart3 size={32} className="empty-chart-icon" aria-hidden="true" />
          <p className="empty-chart-text">No prediction data available. Run an analysis on the left to view the generation comparison.</p>
        </div>
      </div>
    );
  }

  const actualGen = Number(prediction.actual_generation) || 0;
  const expectedGen = Number(prediction.expected_generation ?? prediction.predicted_generation) || 0;

  const chartData = [
    {
      name: 'Actual Measured',
      label: 'Actual Generation (Monitored)',
      value: actualGen,
      fill: '#15803d',
    },
    {
      name: 'Expected Baseline',
      label: 'Physical Expected Baseline',
      value: expectedGen,
      fill: '#0284c7',
    },
  ];

  const maxVal = Math.max(actualGen, expectedGen, 5);
  const xDomainMax = Math.ceil(maxVal * 1.25);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip-box">
          <div className="tooltip-label">{data.label}</div>
          <div className="tooltip-value" style={{ color: data.fill }}>
            {data.value.toFixed(2)} kW
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="section-block chart-block">
      <div className="chart-header">
        <div>
          <h3 className="section-block-title">Generation Comparison (kW)</h3>
          <p className="section-block-subtitle">Comparison between measured generation and physical expected baseline</p>
        </div>
        <div className="chart-legend-compact">
          <span className="legend-item">
            <span className="legend-color-dot dot-actual"></span>
            Actual: <strong>{actualGen.toFixed(2)} kW</strong>
          </span>
          <span className="legend-item">
            <span className="legend-color-dot" style={{ backgroundColor: '#0284c7' }}></span>
            Expected: <strong>{expectedGen.toFixed(2)} kW</strong>
          </span>
        </div>
      </div>

      <div className="chart-container-inner" style={{ height: '170px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 65, left: 15, bottom: 5 }}
            barSize={22}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              domain={[0, xDomainMax]}
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              unit=" kW"
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#475569"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              width={125}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(val) => `${Number(val).toFixed(2)} kW`}
                style={{ fontSize: '11px', fontWeight: 600, fill: '#334155' }}
              />
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
