import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function PerformanceChart({ timeline }) {
  const hasTimeline = Array.isArray(timeline) && timeline.length > 0;

  return (
    <div className="chart-panel" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '1.5rem',
      marginTop: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Actual vs Expected Power Timeline
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {hasTimeline
              ? 'Comparison across your recorded readings'
              : 'Upload a CSV file with readings over time to view the comparison curve.'}
          </p>
        </div>

        {hasTimeline && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#166534' }} />
              Actual power
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706' }} />
              Expected power
            </span>
          </div>
        )}
      </div>

      {hasTimeline ? (
        <div style={{ height: '240px', width: '100%', marginTop: '0.5rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timeline.map((pt, idx) => ({
                time: pt.timestamp ? (pt.timestamp.includes(' ') ? pt.timestamp.split(' ')[1] : pt.timestamp) : `#${idx + 1}`,
                actual: Number(pt.actual_kw) || 0,
                expected: Number(pt.expected_kw) || 0,
              }))}
              margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" kW" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual (kW)"
                stroke="#166534"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="expected"
                name="Expected (kW)"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{
          height: '140px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--border-color)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          textAlign: 'center',
          padding: '1rem',
        }}>
          No timeline data yet. Once you upload a CSV file with readings, your power curve will appear here.
        </div>
      )}
    </div>
  );
}
