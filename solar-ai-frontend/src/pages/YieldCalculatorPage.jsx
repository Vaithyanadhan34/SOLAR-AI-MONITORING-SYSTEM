import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  BarChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { useSolar } from '../context/SolarContext';
import { fetchYieldEstimate } from '../services/api';
import {
  STANDARD_CHART_MARGIN,
  getYAxisProps,
  StandardChartLegend,
} from '../utils/chartConfig';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function YieldCalculatorPage() {
  const { selectedSite, sites, setSelectedSite } = useSolar();

  const siteId = selectedSite?.id || 'site-1';
  const siteName = selectedSite?.name || 'Site 1';
  const defaultCapacity = selectedSite?.capacity || 25.0;
  const defaultPanels = selectedSite?.panels || 100;

  // Form inputs
  const [kwp, setKwp] = useState(defaultCapacity);
  const [panelCount, setPanelCount] = useState(defaultPanels);
  const [month, setMonth] = useState(6); // Default June

  // Yield estimation results state
  const [loading, setLoading] = useState(true);
  const [yieldData, setYieldData] = useState(null);
  const [error, setError] = useState(null);

  // Synchronize when selected site changes
  useEffect(() => {
    if (selectedSite) {
      setKwp(selectedSite.capacity);
      setPanelCount(selectedSite.panels);
    }
  }, [selectedSite]);

  // When kWp changes, update panel count proportionally (~4 panels per kWp for 250Wp modules)
  const handleKwpChange = (val) => {
    const num = Math.max(1, Number(val));
    setKwp(num);
    setPanelCount(Math.round(num * 4));
  };

  const handlePanelChange = (val) => {
    const num = Math.max(4, Number(val));
    setPanelCount(num);
    setKwp(Number((num / 4).toFixed(1)));
  };

  // Fetch yield estimate from backend
  useEffect(() => {
    let active = true;
    const calculateYield = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = {
          site: siteId,
          kWp: Number(kwp),
          panels: Number(panelCount),
          month: Number(month),
        };
        const res = await fetchYieldEstimate(payload);
        if (!active) return;
        setYieldData(res);
      } catch (err) {
        if (active) setError(err.message || 'Failed to calculate yield estimate');
      } finally {
        if (active) setLoading(false);
      }
    };

    calculateYield();
    return () => { active = false; };
  }, [siteId, kwp, panelCount, month]);

  return (
    <div className="yield-page-container">
      {/* Short Title and One-line Caption */}
      <div className="page-header-strip">
        <h1 className="page-main-title">Solar Yield Calculator</h1>
        <p className="page-caption">Physical baseline and empirical generation estimates for plant sizing and monthly planning.</p>
      </div>

      {/* Sizing & Location Form Strip */}
      <div className="yield-calculator-form-card">
        <div className="form-grid-row">
          <div className="form-field-group">
            <label className="form-label">Plant Location & Reference Site</label>
            <select
              className="form-select-input"
              value={siteId}
              onChange={(e) => {
                const s = sites.find((x) => x.id === e.target.value);
                if (s) setSelectedSite(s);
              }}
            >
              {sites.map((s) => {
                const label = s.name.includes('kWp') ? s.name : `${s.name} (${s.capacity} kWp reference)`;
                return (
                  <option key={s.id} value={s.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-field-group">
            <label className="form-label">System Capacity (kWp)</label>
            <div className="input-with-unit">
              <input
                type="number"
                step="0.5"
                min="1"
                max="500"
                className="form-number-input"
                value={kwp}
                onChange={(e) => handleKwpChange(e.target.value)}
              />
              <span className="unit-label">kWp</span>
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-label">Panel Count (approx. 250Wp)</label>
            <div className="input-with-unit">
              <input
                type="number"
                step="1"
                min="4"
                max="2000"
                className="form-number-input"
                value={panelCount}
                onChange={(e) => handlePanelChange(e.target.value)}
              />
              <span className="unit-label">panels</span>
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-label">Calendar Month</label>
            <select
              className="form-select-input"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((mName, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {mName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Estimated KPI Metrics Row */}
      <div className="yield-kpi-grid">
        <div className="yield-kpi-card">
          <span className="kpi-tag">Estimated Daily Generation</span>
          <div className="kpi-val-row">
            <span className="kpi-number">{yieldData?.daily_expected_kWh ?? '--'}</span>
            <span className="kpi-unit">kWh / day</span>
          </div>
          <span className="kpi-subtext">Typical average day in {MONTH_NAMES[month - 1]} (estimate)</span>
        </div>

        <div className="yield-kpi-card">
          <span className="kpi-tag">Estimated Monthly Energy</span>
          <div className="kpi-val-row">
            <span className="kpi-number">{yieldData?.monthly_expected_kWh ? yieldData.monthly_expected_kWh.toLocaleString() : '--'}</span>
            <span className="kpi-unit">kWh / month</span>
          </div>
          <span className="kpi-subtext">Total expected energy for {MONTH_NAMES[month - 1]} (estimate)</span>
        </div>

        <div className="yield-kpi-card">
          <span className="kpi-tag">Specific Daily Yield</span>
          <div className="kpi-val-row">
            <span className="kpi-number">{yieldData?.specific_yield_kWh_per_kWp ?? '--'}</span>
            <span className="kpi-unit">kWh / kWp / day</span>
          </div>
          <span className="kpi-subtext">Peak sun hours equivalent for this location (estimate)</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="yield-charts-grid">
        {/* Chart 1: Typical Daily Generation Curve */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Typical Daily Generation Curve ({MONTH_NAMES[month - 1]})</h2>
              <p className="chart-caption">Hourly power profile (kW) with 25th–75th percentile empirical insolation band (estimate).</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320 }}>
            {loading ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : error ? (
              <div className="chart-error-state"><p>{error}</p></div>
            ) : !yieldData?.typical_day_curve?.length ? (
              <div className="chart-empty-state"><p>No typical generation curve available for this selection.</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Expected power (clean baseline)', color: '#F2A413', type: 'line' },
                    { label: 'Typical 25-75% band (2020-2022)', color: 'rgba(27, 42, 58, 0.16)', type: 'band' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={yieldData.typical_day_curve} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      interval={2}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Expected Power (kW)', width: 64 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name) => [`${Number(val).toFixed(2)} kW`, name]}
                    />

                    {/* Typical 25-75 Percentile Band */}
                    <Area
                      type="monotone"
                      dataKey="p75_kW"
                      stroke="none"
                      fill="#1B2A3A"
                      fillOpacity={0.16}
                      name="Typical 25-75% band (2020-2022)"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expected_kW"
                      stroke="#F2A413"
                      strokeWidth={2.5}
                      dot={false}
                      name="Expected power (clean baseline)"
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>

        {/* Chart 2: 12-Month Generation Projections */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">12-Month Energy Generation (kWh)</h2>
              <p className="chart-caption">Annual generation profile showing seasonality across the calendar year (estimate).</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320 }}>
            {loading ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : error ? (
              <div className="chart-error-state"><p>{error}</p></div>
            ) : !yieldData?.monthly_projections?.length ? (
              <div className="chart-empty-state"><p>No monthly projections available.</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Monthly energy (kWh)', color: '#1B2A3A', type: 'bar' },
                    { label: 'Selected month', color: '#F2A413', type: 'bar' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yieldData.monthly_projections} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="month_name"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Energy (kWh)', width: 66 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name, item) => [
                        `${Number(val).toLocaleString()} kWh (${item.payload.daily_avg_kWh} kWh/day)`,
                        item.payload.full_name,
                      ]}
                    />

                    <Bar dataKey="expected_kWh" name="Monthly Energy (kWh)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {yieldData.monthly_projections.map((entry, idx) => (
                        <Cell
                          key={`month-cell-${idx}`}
                          fill={entry.month === month ? '#F2A413' : '#1B2A3A'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>

        {/* Chart 3: Fleet Specific Yield Comparison */}
        <div className="chart-card chart-card-wide">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Specific Yield Comparison Across Monitored Sites ({MONTH_NAMES[month - 1]})</h2>
              <p className="chart-caption">Comparison of normalized specific yield (kWh / kWp / day) to evaluate relative plant performance (estimate).</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 280 }}>
            {loading ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : error ? (
              <div className="chart-error-state"><p>{error}</p></div>
            ) : !yieldData?.fleet_comparison?.length ? (
              <div className="chart-empty-state"><p>No fleet comparison data available.</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Monitored campus sites', color: '#4A5B6D', type: 'bar' },
                    { label: 'Current selected site', color: '#F2A413', type: 'bar' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yieldData.fleet_comparison} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="site_name"
                      tick={{ fill: '#1B2A3A', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Specific Yield (kWh/kWp/day)', domain: [0, 6], width: 64 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name, item) => [
                        `${val} kWh / kWp / day (${item.payload.capacity_kWp} kWp capacity)`,
                        'Specific Yield',
                      ]}
                    />

                    <Bar dataKey="specific_yield_kWh_per_kWp" name="Specific Yield (kWh/kWp/day)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {yieldData.fleet_comparison.map((entry, idx) => (
                        <Cell
                          key={`fleet-cell-${idx}`}
                          fill={entry.is_selected ? '#F2A413' : '#4A5B6D'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimers & Assumptions Footnote */}
      <div className="page-footnote-strip">
        <p className="footer-disclaimer-text">
          {yieldData?.disclaimer || 'All yield values are empirical baseline estimates based on historical irradiance and capacity scaling.'}
        </p>
      </div>
    </div>
  );
}
