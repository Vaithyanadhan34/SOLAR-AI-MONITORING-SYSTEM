import React from 'react';

/**
 * Standardized Chart Design System Tokens & Configuration
 * Ensures unified palette, axis typography, non-overlapping titles, and consistent legends across all Recharts.
 */

export const CHART_PALETTE = {
  actual: '#1B2A3A',          // Deep Navy: actual telemetry
  expected: '#F2A413',        // Solar Amber: clean expected baseline
  forecast: '#F2A413',        // Dashed Amber: live prediction
  forecastRange: 'rgba(242, 164, 19, 0.20)', // Amber light shaded range
  typicalBand: 'rgba(27, 42, 58, 0.16)',     // Slate/Navy 16% opacity typical 25-75% band
  shortfall: 'rgba(192, 57, 43, 0.20)',      // Red 20% shortfall area
  excess: 'rgba(5, 150, 105, 0.20)',         // Green 20% excess area
  cleanCondition: '#2F8F5B',  // Forest green condition-based policy
  fixedSchedule: '#64748B',   // Slate fixed 14-day schedule
  grid: '#E2DACB',
  axis: '#D9D0C1',
  textMuted: '#4A5B6D',
  textDark: '#1B2A3A',
};

/**
 * Standard margins: Left margin is at least 24px so rotated YAxis title never overlaps tick labels
 */
export const STANDARD_CHART_MARGIN = {
  top: 16,
  right: 24,
  left: 24,
  bottom: 24,
};

/**
 * YAxis props helper:
 * Plain numeric ticks (no units in ticks), domain starting at 0, rotated title with offset
 */
export const getYAxisProps = ({
  title = 'Power (kW)',
  domain = [0, 'auto'],
  width = 62,
  offset = 12,
} = {}) => ({
  domain,
  width: Math.max(56, width),
  tick: { fill: CHART_PALETTE.textMuted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART_PALETTE.axis },
  label: {
    value: title,
    angle: -90,
    position: 'insideLeft',
    offset,
    style: {
      textAnchor: 'middle',
      fill: CHART_PALETTE.textDark,
      fontSize: 11,
      fontWeight: 600,
    },
  },
});

/**
 * XAxis props helper:
 * Plain times or dates, minTickGap prevents tick label collisions
 */
export const getXAxisProps = ({
  dataKey = 'timestamp',
  minTickGap = 24,
  interval,
  tickFormatter,
  angle = 0,
  dy = 6,
} = {}) => ({
  dataKey,
  minTickGap,
  interval,
  tickFormatter,
  tick: { fill: CHART_PALETTE.textMuted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART_PALETTE.axis },
  angle,
  dy,
});

/**
 * Shared External Legend Bar for charts with 2+ series.
 * Placed outside the plot canvas so it never obscures data or overlaps axes.
 */
export function StandardChartLegend({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className="standard-chart-legend"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem',
        marginBottom: '0.75rem',
        fontSize: '0.82rem',
        color: CHART_PALETTE.textDark,
      }}
      aria-label="Chart Series Legend"
    >
      {items.map((item, idx) => {
        return (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            {item.type === 'band' ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 10,
                  backgroundColor: item.color || CHART_PALETTE.typicalBand,
                  border: item.borderColor ? `1px solid ${item.borderColor}` : 'none',
                  borderRadius: 2,
                }}
              />
            ) : item.type === 'dashed' ? (
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 2,
                  borderTop: `2px dashed ${item.color || CHART_PALETTE.forecast}`,
                }}
              />
            ) : (
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: item.type === 'bar' ? 10 : 3,
                  backgroundColor: item.color || CHART_PALETTE.actual,
                  borderRadius: item.type === 'bar' ? 2 : 1,
                }}
              />
            )}
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
