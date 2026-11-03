import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  Cell,
} from 'recharts';

/**
 * SimpleForecastBar
 * A simple, glanceable horizontal forecast comparison chart for the home screen.
 * Displays Actual vs Expected generation with vibrant rounded bars, right-aligned value labels,
 * and vertical insolation gridlines.
 */
export default function SimpleForecastBar({
  actualKw,
  expectedKw,
  plantCapacity = 25,
  isLoading = false,
  siteName = '',
}) {
  const act = typeof actualKw === 'number' && !isNaN(actualKw) ? Math.max(0, actualKw) : null;
  const exp = typeof expectedKw === 'number' && !isNaN(expectedKw) ? Math.max(0, expectedKw) : null;

  const hasData = act !== null && exp !== null;

  // Calculate clean domain upper bound and nice tick intervals
  const rawMax = Math.max(act || 0, exp || 0, Number(plantCapacity) || 25);
  // Round maxAxis up to nice multiple (e.g., 25, 30, 40, 50)
  const maxAxis = rawMax <= 20 ? 20 : rawMax <= 30 ? 30 : rawMax <= 45 ? 45 : Math.ceil(rawMax / 10) * 10;
  
  // Custom nice ticks matching reference image style (0 kW, 15 kW, 30 kW...)
  const ticks = useMemo(() => {
    if (maxAxis <= 20) return [0, 5, 10, 15, 20];
    if (maxAxis <= 35) return [0, 8, 16, 24, maxAxis];
    if (maxAxis <= 55) return [0, 15, 30, 45, maxAxis];
    const step = Math.ceil(maxAxis / 4 / 5) * 5;
    const list = [0, step, step * 2, step * 3, maxAxis];
    return [...new Set(list)].sort((a, b) => a - b);
  }, [maxAxis]);

  const chartData = useMemo(() => {
    if (!hasData) return [];
    return [
      {
        name: 'Actual power',
        value: Number(act.toFixed(1)),
        fill: '#1B2A3A', // Deep navy
      },
      {
        name: 'Expected power (clean baseline)',
        value: Number(exp.toFixed(1)),
        fill: '#F2A413', // Solar amber
      },
    ];
  }, [act, exp, hasData]);

  // Insight summary line
  const diff = hasData ? Number((act - exp).toFixed(1)) : 0;
  const diffPct = hasData && exp > 0 ? Number(((act - exp) / exp * 100).toFixed(0)) : 0;

  return (
    <div className="simple-forecast-card" aria-label="Simple Power Forecast Comparison">
      <div className="simple-forecast-header">
        <div className="simple-forecast-title-group">
          <h3 className="simple-forecast-title">Simple Generation Forecast</h3>
          <p className="simple-forecast-caption">
            Measured actual output vs clean physical model prediction {siteName ? `for ${siteName}` : ''}.
          </p>
        </div>

        {hasData && (
          <div className="simple-forecast-badge-pill">
            {diff >= 0 ? (
              <span className="forecast-diff-tag diff-positive">
                +{diff} kW ({diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`}) vs baseline
              </span>
            ) : (
              <span className="forecast-diff-tag diff-negative">
                {diff} kW ({diffPct}%) shortfall vs baseline
              </span>
            )}
          </div>
        )}
      </div>

      <div className={`simple-forecast-body ${isLoading ? 'is-loading' : ''}`}>
        {isLoading && !hasData ? (
          <div className="chart-skeleton" style={{ height: 150 }}>
            <div className="skeleton-shimmer" />
          </div>
        ) : !hasData ? (
          <div className="simple-forecast-empty">
            <p>Click <strong>Analyze</strong> above to generate the instant power forecast comparison.</p>
          </div>
        ) : (
          <div className="simple-forecast-chart-wrapper" style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 12, right: 80, left: 12, bottom: 16 }}
                barCategoryGap={28}
                barSize={24}
              >
                <CartesianGrid
                  strokeDasharray="2 3"
                  stroke="#CBD5E1"
                  horizontal={false}
                  vertical={true}
                  opacity={0.65}
                />
                <XAxis
                  type="number"
                  domain={[0, maxAxis]}
                  ticks={ticks}
                  tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  tickFormatter={(v) => `${v} kW`}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 13, fontWeight: 500, fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Bar
                  dataKey="value"
                  radius={[999, 999, 999, 999]}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    offset={12}
                    formatter={(val) => `${Number(val).toFixed(1)} kW`}
                    style={{
                      fill: '#1E293B',
                      fontWeight: 700,
                      fontSize: 13,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  />
                  {chartData.map((entry, index) => (
                    <Cell key={`simple-bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
