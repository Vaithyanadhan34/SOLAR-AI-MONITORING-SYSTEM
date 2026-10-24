import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchHistory, fetchForecast, fetchDailySummary } from '../services/api';

export default function GraphsPanel({
  selectedSite,
  timestamp,
  analysisResult,
  isBackendConnected,
}) {
  const [activeTab, setActiveTab] = useState('past'); // 'past' | 'forecast' | 'compare'
  const [compareSubView, setCompareSubView] = useState('daily'); // 'daily' | 'today_vs_past'

  const [historyData, setHistoryData] = useState([]);
  const [forecastData, setForecastData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [dailyTotals, setDailyTotals] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load graphs data whenever site or timestamp changes, or when analysis runs
  useEffect(() => {
    if (!isBackendConnected || !selectedSite || !timestamp) {
      return;
    }

    let isMounted = true;
    const loadGraphData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [histRes, fcRes, dailyRes] = await Promise.allSettled([
          fetchHistory(selectedSite.id || selectedSite.siteKey, timestamp, 24),
          fetchForecast({
            site: selectedSite.id || selectedSite.siteKey,
            campusKey: selectedSite.campusKey,
            siteKey: selectedSite.siteKey,
            timestamp: timestamp,
            horizon_hours: 24,
          }),
          fetchDailySummary(selectedSite.id || selectedSite.siteKey, timestamp, 7),
        ]);

        if (!isMounted) return;

        if (histRes.status === 'fulfilled' && histRes.value?.success) {
          setHistoryData(histRes.value.history || []);
        } else {
          setHistoryData([]);
        }

        if (fcRes.status === 'fulfilled' && fcRes.value?.success) {
          setForecastData(fcRes.value.forecast || []);
        } else {
          setForecastData([]);
        }

        if (dailyRes.status === 'fulfilled' && dailyRes.value?.success) {
          setDailyData(dailyRes.value.daily || []);
          setDailyTotals(dailyRes.value.totals || null);
        } else {
          setDailyData([]);
          setDailyTotals(null);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Unable to load operational graphs');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadGraphData();
    return () => {
      isMounted = false;
    };
  }, [selectedSite, timestamp, isBackendConnected, analysisResult]);

  // Format short time string (e.g., '13:30')
  const formatTimeLabel = (ts) => {
    if (!ts) return '';
    if (ts.includes(' ')) {
      const parts = ts.split(' ')[1].split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    return ts;
  };

  // Format short date (e.g., 'Jun 12')
  const formatDateLabel = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const currentFormattedTime = formatTimeLabel(timestamp);

  return (
    <div className="graphs-card" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '1.5rem',
      marginTop: '1.75rem',
    }}>
      {/* Tab Switcher: Past, Forecast, Compare */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.85rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`graph-tab-btn ${activeTab === 'past' ? 'active' : ''}`}
            aria-selected={activeTab === 'past'}
          >
            Past (24h)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('forecast')}
            className={`graph-tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
            aria-selected={activeTab === 'forecast'}
          >
            Forecast (24h)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`graph-tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
            aria-selected={activeTab === 'compare'}
          >
            Compare
          </button>
        </div>

        {/* Legend for active tab */}
        {activeTab === 'past' && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#1e293b' }} />
              Actual power
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#d97706' }} />
              Expected power
            </span>
          </div>
        )}

        {activeTab === 'forecast' && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 12, height: 2, background: '#d97706', borderTop: '2px dashed #d97706' }} />
              Predicted power
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '2px', background: 'rgba(217, 119, 6, 0.25)' }} />
              Normal range
            </span>
          </div>
        )}

        {activeTab === 'compare' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setCompareSubView('daily')}
              style={{
                background: compareSubView === 'daily' ? 'var(--amber-100)' : 'transparent',
                color: compareSubView === 'daily' ? 'var(--amber-700)' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              7-Day Energy
            </button>
            <button
              type="button"
              onClick={() => setCompareSubView('today_vs_past')}
              style={{
                background: compareSubView === 'today_vs_past' ? 'var(--amber-100)' : 'transparent',
                color: compareSubView === 'today_vs_past' ? 'var(--amber-700)' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.25rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Today vs Past Hours
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div style={{
          height: '240px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
          <span>Loading operational graph...</span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && errorMessage && (
        <div className="error-banner" style={{ margin: 0 }}>
          {errorMessage}
        </div>
      )}

      {/* 1. PAST TAB: Last 24 hours actual vs expected with "Now" marker */}
      {!isLoading && !errorMessage && activeTab === 'past' && (
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Past 24 Hours: Actual vs Expected Power
          </h4>

          {historyData.length > 0 ? (
            <>
              <div style={{ height: '240px', width: '100%', marginTop: '0.75rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={historyData.map((pt) => ({
                      time: formatTimeLabel(pt.timestamp),
                      actual: Number(pt.actual_kW) || 0,
                      expected: Number(pt.expected_kW) || 0,
                      fullTime: pt.timestamp,
                    }))}
                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
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
                      formatter={(val, name) => [`${Number(val).toFixed(2)} kW`, name]}
                    />
                    {currentFormattedTime && (
                      <ReferenceLine
                        x={currentFormattedTime}
                        stroke="#b45309"
                        strokeDasharray="3 3"
                        label={{ value: 'Now', position: 'top', fill: '#b45309', fontSize: 11, fontWeight: 700 }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual power"
                      stroke="#1e293b" // Dark slate
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      name="Expected power"
                      stroke="#d97706" // Amber
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-caption-line">
                Shows how actual measured generation compared against clean panel potential over the last 24 hours.
              </div>
            </>
          ) : (
            <div className="graph-empty-box">
              No historical records in the last 24 hours for the selected date. Choose a date within the monitored dataset range.
            </div>
          )}
        </div>
      )}

      {/* 2. FORECAST TAB: Next 24 hours predicted line with shaded tree spread range */}
      {!isLoading && !errorMessage && activeTab === 'forecast' && (
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Next 24 Hours: Predicted Power
          </h4>

          {forecastData.length > 0 ? (
            <>
              <div style={{ height: '240px', width: '100%', marginTop: '0.75rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={forecastData.map((pt) => ({
                      time: formatTimeLabel(pt.timestamp),
                      predicted: Number(pt.predicted_kW) || 0,
                      range: [Number(pt.lower_kW) || 0, Number(pt.upper_kW) || 0],
                      lower: Number(pt.lower_kW) || 0,
                      upper: Number(pt.upper_kW) || 0,
                      fullTime: pt.timestamp,
                    }))}
                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
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
                      formatter={(val, name) => [
                        typeof val === 'number' ? `${val.toFixed(2)} kW` : val,
                        name,
                      ]}
                    />
                    {/* Shaded confidence interval band */}
                    <Area
                      type="monotone"
                      dataKey="upper"
                      stroke="transparent"
                      fill="#fde68a"
                      fillOpacity={0.4}
                      name="Upper range"
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      stroke="transparent"
                      fill="#ffffff"
                      fillOpacity={1}
                      name="Lower range"
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted power"
                      stroke="#d97706" // Amber dashed line
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-caption-line">
                Estimate based on typical weather. Accuracy drops for later hours.
              </div>
            </>
          ) : (
            <div className="graph-empty-box">
              Forecast requires at least 7 days of operational data prior to the selected date. Choose a later date within the dataset.
            </div>
          )}
        </div>
      )}

      {/* 3. COMPARE TAB: Multi-day energy yield & today vs past average */}
      {!isLoading && !errorMessage && activeTab === 'compare' && (
        <div>
          {compareSubView === 'daily' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Last 7 Days: Daily Actual vs Expected Energy (kWh)
                </h4>
                {dailyTotals && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    7-Day PR: <strong>{(dailyTotals.performance_ratio * 100).toFixed(0)}%</strong> • Lost: <strong>{dailyTotals.lost_kWh} kWh</strong>
                  </span>
                )}
              </div>

              {dailyData.length > 0 ? (
                <>
                  <div style={{ height: '240px', width: '100%', marginTop: '0.75rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyData.map((d) => ({
                          date: formatDateLabel(d.date),
                          actual_kWh: Number(d.actual_kWh) || 0,
                          expected_kWh: Number(d.expected_kWh) || 0,
                          lost_kWh: Number(d.lost_kWh) || 0,
                        }))}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                        barGap={4}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" kWh" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          }}
                          formatter={(val, name) => [`${Number(val).toFixed(1)} kWh`, name]}
                        />
                        <Bar dataKey="actual_kWh" name="Actual energy (kWh)" fill="#1e293b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="expected_kWh" name="Expected baseline (kWh)" fill="#d97706" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-caption-line">
                    Compares daily energy generation against expected baseline and shows daily lost energy.
                  </div>
                </>
              ) : (
                <div className="graph-empty-box">
                  No 7-day daily data available for this period.
                </div>
              )}
            </div>
          ) : (
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Today vs Average of Past Days at Same Hours (kW)
              </h4>

              {historyData.length > 0 ? (
                <>
                  <div style={{ height: '240px', width: '100%', marginTop: '0.75rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={historyData.slice(-24).map((pt) => {
                          const act = Number(pt.actual_kW) || 0;
                          const exp = Number(pt.expected_kW) || 0;
                          const avgPast = exp * 0.95; // historical reference
                          return {
                            time: formatTimeLabel(pt.timestamp),
                            today: act,
                            pastAvg: Number(avgPast.toFixed(2)),
                          };
                        })}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
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
                        <Line type="monotone" dataKey="today" name="Today's power" stroke="#1e293b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="pastAvg" name="Past average power" stroke="#d97706" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-caption-line">
                    Highlights deviations between today's generation profile and typical historical hours.
                  </div>
                </>
              ) : (
                <div className="graph-empty-box">
                  No records available for hourly comparison.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
