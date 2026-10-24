import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { fetchHistory, fetchDailySummary } from '../services/api';

export default function PastCompareSection({
  selectedSite,
  timestamp,
  isBackendConnected,
}) {
  const [activeSubTab, setActiveSubTab] = useState('past24'); // 'past24' | 'today_vs_usual' | 'last7d'
  const [historyList, setHistoryList] = useState([]);
  const [hourlyProfiles, setHourlyProfiles] = useState([]);
  const [dailySummaries, setDailySummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!isBackendConnected || !selectedSite || !timestamp) return;

    let isMounted = true;
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [histRes, dailyRes] = await Promise.allSettled([
          fetchHistory(selectedSite.id || selectedSite.siteKey, timestamp, 24),
          fetchDailySummary(selectedSite.id || selectedSite.siteKey, timestamp, 7),
        ]);

        if (!isMounted) return;

        if (histRes.status === 'fulfilled' && histRes.value?.success) {
          setHistoryList(histRes.value.history || []);
          setHourlyProfiles(histRes.value.hourly_profiles || []);
        } else {
          setHistoryList([]);
          setHourlyProfiles([]);
        }

        if (dailyRes.status === 'fulfilled' && dailyRes.value?.success) {
          setDailySummaries(dailyRes.value.daily || []);
        } else {
          setDailySummaries([]);
        }

        if (histRes.status === 'rejected' && dailyRes.status === 'rejected') {
          setErrorMessage('Unable to load operational records for this date.');
        }
      } catch (err) {
        if (isMounted) setErrorMessage(err.message || 'Error fetching records.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedSite, timestamp, isBackendConnected]);

  // Format short hour label
  const formatHourMin = (ts) => {
    if (!ts) return '';
    if (ts.includes(' ')) {
      const parts = ts.split(' ')[1].split(':');
      return `${parts[0]}:${parts[1]}`;
    }
    return ts;
  };

  const formatDateShort = (dStr) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = parseInt(parts[1], 10) - 1;
        return `${monthNames[m]} ${parseInt(parts[2], 10)}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  const past24ChartData = useMemo(() => {
    return historyList.map((item) => ({
      ...item,
      timeLabel: formatHourMin(item.timestamp),
    }));
  }, [historyList]);

  const usualDayChartData = useMemo(() => {
    return hourlyProfiles.map((item) => ({
      ...item,
      hourLabel: `${String(item.hour).padStart(2, '0')}:00`,
    }));
  }, [hourlyProfiles]);

  const last7dChartData = useMemo(() => {
    return dailySummaries.map((item) => ({
      ...item,
      dateLabel: formatDateShort(item.date),
    }));
  }, [dailySummaries]);

  // Tooltips
  const CustomPastTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="chart-tooltip-glass">
          <p className="tooltip-time">{label || d.timestamp}</p>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot slate-dot" />
            <span className="tooltip-name">Actual:</span>
            <span className="tooltip-val">{d.actual_kW} kW</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot amber-dot" />
            <span className="tooltip-name">Expected:</span>
            <span className="tooltip-val">{d.expected_kW} kW</span>
          </div>
          {typeof d.diff_kW === 'number' && (
            <div className="tooltip-row subtle-row">
              <span className="tooltip-name">Difference:</span>
              <span className="tooltip-val">{d.diff_kW > 0 ? `+${d.diff_kW}` : d.diff_kW} kW</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomCompareTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="chart-tooltip-glass">
          <p className="tooltip-time">{label}</p>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot slate-dot" />
            <span className="tooltip-name">Today:</span>
            <span className="tooltip-val">{d.today_avg_kW} kW</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot amber-dot" />
            <span className="tooltip-name">Usual average:</span>
            <span className="tooltip-val">{d.past_days_avg_kW} kW</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDailyTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="chart-tooltip-glass">
          <p className="tooltip-time">{label} ({d.date})</p>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot slate-dot" />
            <span className="tooltip-name">Actual:</span>
            <span className="tooltip-val">{d.actual_kWh} kWh</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot amber-dot" />
            <span className="tooltip-name">Expected:</span>
            <span className="tooltip-val">{d.expected_kWh} kWh</span>
          </div>
          <div className="tooltip-row subtle-row">
            <span className="tooltip-name">Lost energy:</span>
            <span className="tooltip-val">{d.lost_kWh} kWh</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="past-compare-section" aria-label="Past and Comparison Charts">
      {/* Header and selector */}
      <div className="past-compare-header">
        <h3 className="section-subheading">Past and Compare</h3>
        <div className="sub-switcher" role="tablist">
          <button
            id="tab-past-24h"
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'past24'}
            className={`sub-tab-btn ${activeSubTab === 'past24' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('past24')}
          >
            Past 24 h
          </button>
          <button
            id="tab-past-today-vs-usual"
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'today_vs_usual'}
            className={`sub-tab-btn ${activeSubTab === 'today_vs_usual' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('today_vs_usual')}
          >
            Today vs usual
          </button>
          <button
            id="tab-past-last-7d"
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'last7d'}
            className={`sub-tab-btn ${activeSubTab === 'last7d' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('last7d')}
          >
            Last 7 days
          </button>
        </div>
      </div>

      <div className="past-compare-body">
        {isLoading && (
          <div className="chart-loading-state" style={{ height: 260 }}>
            <span className="spinner-amber" />
          </div>
        )}

        {!isLoading && errorMessage && (
          <div className="chart-error-state" style={{ height: 200 }}>
            <p className="error-message-text">{errorMessage}</p>
          </div>
        )}

        {/* 1. Past 24h: Actual (dark slate #1B2A3A) vs Expected (amber #F2A413) */}
        {!isLoading && !errorMessage && activeSubTab === 'past24' && (
          <div className="chart-container" style={{ width: '100%', height: 280 }}>
            {past24ChartData.length === 0 ? (
              <div className="empty-chart-fallback">No 24-hour operational history found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={past24ChartData}
                  margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    interval={3}
                  />
                  <YAxis
                    unit=" kW"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    width={56}
                  />
                  <Tooltip content={<CustomPastTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 8, fontSize: 13 }}
                  />
                  <Line
                    type="monotone"
                    name="Actual power"
                    dataKey="actual_kW"
                    stroke="#1B2A3A"
                    strokeWidth={2.4}
                    dot={false}
                    activeDot={{ r: 5, fill: '#1B2A3A' }}
                    strokeLinejoin="round"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    name="Expected power"
                    dataKey="expected_kW"
                    stroke="#F2A413"
                    strokeWidth={2.4}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={{ r: 5, fill: '#F2A413' }}
                    strokeLinejoin="round"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* 2. Today vs Usual Day: today's curve against average of same hours over past days */}
        {!isLoading && !errorMessage && activeSubTab === 'today_vs_usual' && (
          <div className="chart-container" style={{ width: '100%', height: 280 }}>
            {usualDayChartData.length === 0 ? (
              <div className="empty-chart-fallback">No baseline comparison profiles available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={usualDayChartData}
                  margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="hourLabel"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                  />
                  <YAxis
                    unit=" kW"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    width={56}
                  />
                  <Tooltip content={<CustomCompareTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 8, fontSize: 13 }}
                  />
                  <Line
                    type="monotone"
                    name="Today"
                    dataKey="today_avg_kW"
                    stroke="#1B2A3A"
                    strokeWidth={2.6}
                    dot={{ r: 3, fill: '#1B2A3A' }}
                    activeDot={{ r: 5, fill: '#1B2A3A' }}
                    strokeLinejoin="round"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    name="Usual average"
                    dataKey="past_days_avg_kW"
                    stroke="#F2A413"
                    strokeWidth={2.4}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: '#F2A413' }}
                    activeDot={{ r: 5, fill: '#F2A413' }}
                    strokeLinejoin="round"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* 3. Last 7 Days: daily actual vs expected kWh bars, and lost-kWh bar chart */}
        {!isLoading && !errorMessage && activeSubTab === 'last7d' && (
          <div className="dual-charts-grid">
            <div className="subchart-card">
              <h4 className="subchart-title">Daily Energy (Actual vs Expected)</h4>
              <div style={{ width: '100%', height: 230 }}>
                {last7dChartData.length === 0 ? (
                  <div className="empty-chart-fallback">No daily energy records.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={last7dChartData}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fill: '#4A5B6D', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                        stroke="#D6D0C4"
                      />
                      <YAxis
                        unit=" kWh"
                        tick={{ fill: '#4A5B6D', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                        stroke="#D6D0C4"
                        width={58}
                      />
                      <Tooltip content={<CustomDailyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar name="Actual" dataKey="actual_kWh" fill="#1B2A3A" radius={[3, 3, 0, 0]} />
                      <Bar name="Expected" dataKey="expected_kWh" fill="#F2A413" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="subchart-card">
              <h4 className="subchart-title">Lost Energy by Day</h4>
              <div style={{ width: '100%', height: 230 }}>
                {last7dChartData.length === 0 ? (
                  <div className="empty-chart-fallback">No lost energy records.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={last7dChartData}
                      margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fill: '#4A5B6D', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                        stroke="#D6D0C4"
                      />
                      <YAxis
                        unit=" kWh"
                        tick={{ fill: '#4A5B6D', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                        stroke="#D6D0C4"
                        width={58}
                      />
                      <Tooltip content={<CustomDailyTooltip />} />
                      <Bar name="Lost kWh" dataKey="lost_kWh" fill="#C0392B" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
