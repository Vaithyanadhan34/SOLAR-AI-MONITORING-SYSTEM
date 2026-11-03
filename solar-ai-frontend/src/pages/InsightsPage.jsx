import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useSolar } from '../context/SolarContext';
import {
  fetchHistoryBands,
  fetchHistory,
  fetchTrend,
  fetchDailySummary,
  fetchSiteRanking,
} from '../services/api';
import {
  STANDARD_CHART_MARGIN,
  getYAxisProps,
  StandardChartLegend,
  CHART_PALETTE,
} from '../utils/chartConfig';

export default function InsightsPage() {
  const {
    selectedSite,
    setSelectedSite,
    selectedTimestamp,
    setSelectedTimestamp,
    sites,
    siteMinDate,
    siteMaxDate,
    siteMinTimestamp,
    siteMaxTimestamp,
    isBackendConnected,
  } = useSolar();

  // Range for trend chart: 30, 60, or 90 days
  const [trendDays, setTrendDays] = useState(60);

  // Loading and error states
  const [loadingUsual, setLoadingUsual] = useState(true);
  const [usualData, setUsualData] = useState([]);
  const [usualError, setUsualError] = useState(null);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [historyError, setHistoryError] = useState(null);

  const [loadingTrend, setLoadingTrend] = useState(true);
  const [trendData, setTrendData] = useState([]);
  const [trendError, setTrendError] = useState(null);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryData, setSummaryData] = useState([]);
  const [summaryError, setSummaryError] = useState(null);

  const [loadingRanking, setLoadingRanking] = useState(true);
  const [rankingData, setRankingData] = useState([]);
  const [rankingError, setRankingError] = useState(null);

  const siteId = selectedSite?.id || 'site-1';
  const siteName = selectedSite?.name || 'Site';
  const emptyRangeMsg = 'No historical telemetry records found for this window.';

  const renderEmptyState = (msg) => (
    <div className="chart-empty-state">
      <div className="empty-state-badge">No Historical Records</div>
      <p className="empty-state-msg">{msg || emptyRangeMsg}</p>
    </div>
  );

  // 1. Fetch Today vs Usual Day data (bands + recent 24h history)
  useEffect(() => {
    let active = true;
    const loadUsualDay = async () => {
      setLoadingUsual(true);
      setUsualError(null);
      try {
        const [bandsRes, histRes] = await Promise.all([
          fetchHistoryBands(siteId, selectedTimestamp, 24),
          fetchHistory(siteId, selectedTimestamp, 24),
        ]);

        if (!active) return;

        const bands = Array.isArray(bandsRes?.bands) ? bandsRes.bands : [];
        const histReadings = Array.isArray(histRes?.readings)
          ? histRes.readings
          : (Array.isArray(histRes?.history) ? histRes.history : []);

        // Build a lookup for today's actual generation by hour/time
        const todayMap = {};
        histReadings.forEach((r) => {
          if (r.timestamp) {
            const timePart = r.timestamp.slice(11, 16);
            todayMap[timePart] = r.actual_generation ?? r.actual_kW;
          }
        });

        // Merge bands with today's readings
        const merged = bands.map((b) => {
          const t = b.time || b.time_of_day;
          const act = todayMap[t] !== undefined ? todayMap[t] : null;
          return {
            time: t,
            median_kW: b.median_kW,
            p25_kW: b.p25_kW,
            p75_kW: b.p75_kW,
            band_diff: Math.max(0, (b.p75_kW ?? 0) - (b.p25_kW ?? 0)),
            today_kW: act,
          };
        });

        setUsualData(merged);
      } catch (err) {
        if (active) setUsualError(err.message || 'Unable to load typical-day historical comparison');
      } finally {
        if (active) setLoadingUsual(false);
      }
    };

    loadUsualDay();
    return () => { active = false; };
  }, [siteId, selectedTimestamp]);

  // 2. Fetch 48-Hour Actual vs Expected curve
  useEffect(() => {
    let active = true;
    const load48h = async () => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const res = await fetchHistory(siteId, selectedTimestamp, 48);
        if (!active) return;
        const readings = Array.isArray(res?.readings)
          ? res.readings
          : (Array.isArray(res?.history) ? res.history : []);
        const mapped = readings.map((r) => {
          const act = r.actual_generation ?? r.actual_kW ?? 0;
          const exp = r.expected_generation ?? r.expected_kW ?? 0;
          const loss = Math.max(0, Number((exp - act).toFixed(2)));
          return {
            time: r.timestamp ? r.timestamp.slice(5, 16).replace('T', ' ') : '',
            actual_kW: act,
            expected_kW: exp,
            loss_kW: loss,
          };
        });
        setHistoryData(mapped);
      } catch (err) {
        if (active) setHistoryError(err.message || 'Unable to load 48-hour historical comparison');
      } finally {
        if (active) setLoadingHistory(false);
      }
    };

    load48h();
    return () => { active = false; };
  }, [siteId, selectedTimestamp]);

  // 3. Fetch Soiling Trend with classification markers
  useEffect(() => {
    let active = true;
    const loadTrend = async () => {
      setLoadingTrend(true);
      setTrendError(null);
      try {
        const res = await fetchTrend(siteId, trendDays, selectedTimestamp);
        if (!active) return;
        const series = Array.isArray(res?.trend)
          ? res.trend
          : (Array.isArray(res?.trend_series) ? res.trend_series : []);
        const mapped = series.map((item) => ({
          ...item,
          pr_pct: Number((item.performance_ratio * 100).toFixed(1)),
          // Custom flag markers for Recharts
          isSlowDecline: item.flag === 'slow_decline' ? item.performance_ratio * 100 : null,
          isSuddenDrop: item.flag === 'sudden_drop' ? item.performance_ratio * 100 : null,
          isRecovery: item.flag === 'recovery' ? item.performance_ratio * 100 : null,
        }));
        setTrendData(mapped);
      } catch (err) {
        if (active) setTrendError(err.message || 'Unable to load daily soiling trend');
      } finally {
        if (active) setLoadingTrend(false);
      }
    };

    loadTrend();
    return () => { active = false; };
  }, [siteId, trendDays, selectedTimestamp]);

  // 4. Fetch Daily Energy Lost Summary (14 days)
  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const res = await fetchDailySummary(siteId, selectedTimestamp, 14);
        if (!active) return;
        const days = Array.isArray(res?.days)
          ? res.days
          : (Array.isArray(res?.daily) ? res.daily : []);
        const mapped = days.map((d) => ({
          date: d.date ? d.date.slice(5) : '',
          actual_kWh: d.actual_generation_kWh ?? d.actual_kWh ?? 0,
          expected_kWh: d.expected_generation_kWh ?? d.expected_kWh ?? 0,
          lost_kWh: d.lost_generation_kWh ?? d.lost_kWh ?? 0,
        }));
        setSummaryData(mapped);
      } catch (err) {
        if (active) setSummaryError(err.message || 'Unable to load daily energy shortfall summary');
      } finally {
        if (active) setLoadingSummary(false);
      }
    };

    loadSummary();
    return () => { active = false; };
  }, [siteId, selectedTimestamp]);

  // 5. Fetch Fleet Site Ranking
  useEffect(() => {
    let active = true;
    const loadRanking = async () => {
      setLoadingRanking(true);
      setRankingError(null);
      try {
        const res = await fetchSiteRanking();
        if (!active) return;
        setRankingData(res?.rankings || []);
      } catch (err) {
        if (active) setRankingError(err.message || 'Unable to load site rankings');
      } finally {
        if (active) setLoadingRanking(false);
      }
    };

    loadRanking();
    return () => { active = false; };
  }, []);

  // Custom Dot for Soiling Trend chart
  const renderTrendDot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;
    if (payload.flag === 'slow_decline') {
      return (
        <circle cx={cx} cy={cy} r={5} fill="#D98A00" stroke="#FFFFFF" strokeWidth={2} key={`dot-${payload.date}`} />
      );
    }
    if (payload.flag === 'sudden_drop') {
      return (
        <rect x={cx - 5} y={cy - 5} width={10} height={10} fill="#C0392B" stroke="#FFFFFF" strokeWidth={2} key={`dot-${payload.date}`} />
      );
    }
    if (payload.flag === 'recovery') {
      return (
        <polygon points={`${cx},${cy - 6} ${cx + 6},${cy + 5} ${cx - 6},${cy + 5}`} fill="#2F8F5B" stroke="#FFFFFF" strokeWidth={1.5} key={`dot-${payload.date}`} />
      );
    }
    return null;
  };

  return (
    <div className="insights-page-container">
      {/* Short Title and One-line Caption */}
      <div className="page-header-strip">
        <div className="title-row-with-site">
          <div>
            <h1 className="page-main-title">Operational Insights</h1>
            <p className="page-caption">Longer-term performance patterns, soiling trends, and fleet health.</p>
          </div>

          {/* Quick Context Bar */}
          <div className="context-site-pill">
            <span className="context-label">Site:</span>
            <select
              className="context-select"
              value={selectedSite?.id || 'site-1'}
              onChange={(e) => {
                const s = sites.find((x) => x.id === e.target.value);
                if (s) setSelectedSite(s);
              }}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.capacity} kWp)
                </option>
              ))}
            </select>
            <span className="context-divider">•</span>
            <input
              type="datetime-local"
              className="context-date-input"
              value={selectedTimestamp}
              min={siteMinTimestamp}
              max={siteMaxTimestamp}
              onChange={(e) => setSelectedTimestamp(e.target.value)}
              title={`Pick a date between ${siteMinTimestamp} and ${siteMaxTimestamp}`}
            />
          </div>
        </div>
      </div>

      {/* Grid of Visualizations */}
      <div className="insights-charts-grid">
        {/* Chart 1: Today vs Usual Day */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Today vs Usual Day</h2>
              <p className="chart-caption">Historical replay, 2020-2022 telemetry over reference percentile band and median curve.</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320 }}>
            {loadingUsual ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : usualError ? (
              <div className="chart-error-state"><p>{usualError}</p></div>
            ) : usualData.length === 0 ? (
              <div className="chart-empty-state"><p>{emptyRangeMsg}</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Actual power (Historical replay)', color: '#1B2A3A', type: 'line' },
                    { label: 'Expected median baseline', color: '#F2A413', type: 'dashed' },
                    { label: 'Typical 25-75% band (2020-2022)', color: 'rgba(27, 42, 58, 0.16)', type: 'band' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={usualData} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      interval={3}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Power (kW)', width: 62 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name) => {
                        if (val === null || val === undefined) return ['--', name];
                        const labels = {
                          today_kW: "Today's Monitored Power",
                          median_kW: '2020-2022 Reference Median',
                          p75_kW: '2020-2022 Upper 75th',
                          p25_kW: '2020-2022 Lower 25th',
                        };
                        return [`${Number(val).toFixed(2)} kW`, labels[name] || name];
                      }}
                    />

                    {/* Typical Day Band: Semi-transparent fill at 16% opacity */}
                    <Area
                      type="monotone"
                      dataKey="p75_kW"
                      stroke="none"
                      fill="#1B2A3A"
                      fillOpacity={0.16}
                      name="Typical 25-75% band (2020-2022)"
                      isAnimationActive={false}
                    />
                    {/* Historical Median: Dashed Amber Line */}
                    <Line
                      type="monotone"
                      dataKey="median_kW"
                      stroke="#F2A413"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Expected median baseline"
                      isAnimationActive={false}
                    />
                    {/* Today's Power: Bold Navy Line */}
                    <Line
                      type="monotone"
                      dataKey="today_kW"
                      stroke="#1B2A3A"
                      strokeWidth={2.5}
                      dot={false}
                      name="Actual power"
                      connectNulls
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>

        {/* Chart 2: 48-Hour Actual vs Expected with Loss Area */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">48-Hour Operational Curve</h2>
              <p className="chart-caption">Actual generation vs unsoiled expected baseline, highlighting generation shortfall area.</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320 }}>
            {loadingHistory ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : historyError ? (
              <div className="chart-error-state"><p>{historyError}</p></div>
            ) : historyData.length === 0 ? (
              renderEmptyState(emptyRangeMsg)
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Actual power', color: '#1B2A3A', type: 'line' },
                    { label: 'Expected power (clean baseline)', color: '#F2A413', type: 'dashed' },
                    { label: 'Shortfall', color: 'rgba(192, 57, 43, 0.20)', type: 'band', borderColor: '#C0392B' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={STANDARD_CHART_MARGIN}>
                    <defs>
                      <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C0392B" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#C0392B" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      interval={7}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Power (kW)', width: 62 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name) => {
                        const labels = {
                          expected_kW: 'Expected Baseline',
                          actual_kW: 'Actual Inverter Power',
                          loss_kW: 'Generation Shortfall',
                        };
                        return [`${Number(val).toFixed(2)} kW`, labels[name] || name];
                      }}
                    />

                    {/* Expected line: Amber dashed */}
                    <Line
                      type="monotone"
                      dataKey="expected_kW"
                      stroke="#F2A413"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Expected power (clean baseline)"
                      isAnimationActive={false}
                    />
                    {/* Actual line: Navy solid */}
                    <Line
                      type="monotone"
                      dataKey="actual_kW"
                      stroke="#1B2A3A"
                      strokeWidth={2.2}
                      dot={false}
                      name="Actual power"
                      isAnimationActive={false}
                    />
                    {/* Shaded Shortfall Area */}
                    <Area
                      type="monotone"
                      dataKey="loss_kW"
                      stroke="#C0392B"
                      strokeWidth={1}
                      fill="url(#lossGradient)"
                      name="Shortfall"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>

        {/* Chart 3: Soiling Trend with Cause Classifier Markers */}
        <div className="chart-card chart-card-wide">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Soiling & Performance Ratio Trend</h2>
              <p className="chart-caption">Daily performance ratio with rolling trajectory and cautious cause classification markers.</p>
            </div>
            <div className="range-switcher">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`range-pill-btn ${trendDays === d ? 'active' : ''}`}
                  onClick={() => setTrendDays(d)}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>
          <div className="chart-body" style={{ height: 340 }}>
            {loadingTrend ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : trendError ? (
              <div className="chart-error-state"><p>{trendError}</p></div>
            ) : trendData.length === 0 ? (
              renderEmptyState(emptyRangeMsg)
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Daily Performance Ratio (%)', color: '#1B2A3A', type: 'line' },
                    { label: 'Target threshold (95%)', color: '#2F8F5B', type: 'dashed' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      interval={Math.ceil(trendData.length / 8)}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Performance Ratio (%)', domain: [40, 115], width: 62 })}
                    />
                    <ReferenceLine y={95} stroke="#2F8F5B" strokeDasharray="3 3" label={{ value: 'Target 95%', fill: '#2F8F5B', fontSize: 10, position: 'right' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload;
                        const flagLabels = {
                          slow_decline: 'Slow decline (possible dust/soiling accumulation)',
                          sudden_drop: 'Sudden drop (possible equipment fault or shading)',
                          recovery: 'Recovery (possible natural cleaning or rain)',
                          normal: 'Nominal variation',
                        };
                        return (
                          <div className="custom-chart-tooltip">
                            <p className="tooltip-date"><strong>{item.date}</strong></p>
                            <p className="tooltip-line">Performance Ratio: <strong>{item.pr_pct}%</strong></p>
                            <p className="tooltip-line">Actual: {item.actual_kWh} kWh | Expected: {item.expected_kWh} kWh</p>
                            <p className="tooltip-line">Rolling Slope: {item.rolling_slope ? Number(item.rolling_slope).toFixed(3) : '0.000'}</p>
                            {item.flag && item.flag !== 'normal' && (
                              <p className="tooltip-hint" style={{ color: item.flag === 'sudden_drop' ? '#C0392B' : '#D98A00' }}>
                                Notice: {flagLabels[item.flag] || item.hint}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="pr_pct"
                      stroke="#1B2A3A"
                      strokeWidth={2}
                      dot={renderTrendDot}
                      name="Daily Performance Ratio (%)"
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
          {/* Visual Legend for classifier markers */}
          <div className="trend-markers-legend">
            <span className="legend-marker-item">
              <span className="marker-dot amber-dot" /> Slow decline (possible soiling, verify by inspection)
            </span>
            <span className="legend-marker-item">
              <span className="marker-dot red-sq" /> Sudden drop (possible fault/shading)
            </span>
            <span className="legend-marker-item">
              <span className="marker-dot green-tri" /> Recovery (possible natural rain)
            </span>
          </div>
        </div>

        {/* Chart 4: Daily Energy Lost Bars */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Daily Energy Shortfall (Past 14 Days)</h2>
              <p className="chart-caption">Kilowatt-hours lost each day compared to unsoiled operational expectation.</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320 }}>
            {loadingSummary ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : summaryError ? (
              <div className="chart-error-state"><p>{summaryError}</p></div>
            ) : summaryData.length === 0 ? (
              renderEmptyState(emptyRangeMsg)
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Energy shortfall lost', color: '#C0392B', type: 'bar' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryData} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Energy Lost (kWh)', width: 64 })}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name) => {
                        const labels = {
                          lost_kWh: 'Lost Energy',
                          actual_kWh: 'Actual Energy',
                          expected_kWh: 'Expected Baseline',
                        };
                        return [`${Number(val).toFixed(1)} kWh`, labels[name] || name];
                      }}
                    />

                    <Bar dataKey="lost_kWh" fill="#C0392B" opacity={0.85} radius={[4, 4, 0, 0]} name="Energy Lost (kWh)" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>

        {/* Chart 5: Site Ranking Horizontal Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h2 className="chart-title">Fleet Site Health Ranking</h2>
              <p className="chart-caption">Overall health score (0–100) combining performance ratio, anomaly rate, and stability.</p>
            </div>
          </div>
          <div className="chart-body" style={{ height: 320 }}>
            {loadingRanking ? (
              <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
            ) : rankingError ? (
              <div className="chart-error-state"><p>{rankingError}</p></div>
            ) : rankingData.length === 0 ? (
              <div className="chart-empty-state"><p>No site rankings available.</p></div>
            ) : (
              <>
                <StandardChartLegend
                  items={[
                    { label: 'Health Score (0-100)', color: '#2F8F5B', type: 'bar' },
                  ]}
                />
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rankingData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 24, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      label={{ value: 'Health Score (0–100)', position: 'insideBottom', offset: -10, fill: '#1B2A3A', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#1B2A3A', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#D9D0C1' }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                      formatter={(val, name, item) => [
                        `${val}/100 (${item.payload.status})`,
                        'Health Score',
                      ]}
                    />

                    <Bar dataKey="health_score" name="Health Score" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {rankingData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.status_color || (entry.status === 'Normal' ? '#2F8F5B' : '#D98A00')}
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
    </div>
  );
}
