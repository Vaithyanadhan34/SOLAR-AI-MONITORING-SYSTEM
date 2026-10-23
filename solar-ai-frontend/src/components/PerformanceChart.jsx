import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { BarChart3 } from 'lucide-react';

export default function PerformanceChart({ prediction }) {
  if (!prediction || prediction.actual_generation === undefined || prediction.predicted_generation === undefined) {
    return (
      <div className="section-block chart-empty-block">
        <div className="section-header-compact">
          <h3 className="section-block-title">Generation Comparison (kW)</h3>
          <p className="section-block-subtitle">Direct comparison between measured output and Random Forest forecast</p>
        </div>
        <div className="empty-chart-state">
          <BarChart3 size={32} className="empty-chart-icon" aria-hidden="true" />
          <p className="empty-chart-text">No prediction data available. Run an analysis on the left to view the generation comparison.</p>
        </div>
      </div>
    );
  }

  const actualGen = Number(prediction.actual_generation) || 0;
  const predictedGen = Number(prediction.predicted_generation) || 0;

  const chartData = [
    {
      name: 'Actual Measured',
      label: 'Actual Generation (Monitored)',
      value: actualGen,
      fill: '#15803d', // Eco green
    },
    {
      name: 'Predicted Baseline',
      label: 'Random Forest Forecast (Expected)',
      value: predictedGen,
      fill: '#0369a1', // Precision slate blue
    },
  ];

  const maxVal = Math.max(actualGen, predictedGen, 5);
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
          <p className="section-block-subtitle">Direct comparison between measured output and Random Forest model forecast</p>
        </div>
        <div className="chart-legend-compact">
          <span className="legend-item">
            <span className="legend-color-dot dot-actual"></span>
            Actual: <strong>{actualGen.toFixed(1)} kW</strong>
          </span>
          <span className="legend-item">
            <span className="legend-color-dot dot-expected"></span>
            Predicted: <strong>{predictedGen.toFixed(1)} kW</strong>
          </span>
        </div>
      </div>

      <div className="chart-container-inner" style={{ height: '170px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%" key={`chart-${actualGen}-${predictedGen}`}>
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
