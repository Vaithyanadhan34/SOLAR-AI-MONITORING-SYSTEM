import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { fetchForecast, fetchHistoryBands } from '../services/api';
import AnimatedNumber from './AnimatedNumber';
import {
  STANDARD_CHART_MARGIN,
  getYAxisProps,
  StandardChartLegend,
} from '../utils/chartConfig';

export default function ForecastHero({
  selectedSite,
  timestamp,
  isBackendConnected,
  forecastMode = 'historical', // 'historical' | 'live'
  onSwitchToHistorical,
  onLiveIssueTime,
}) {
  const [rangeTab, setRangeTab] = useState('24h'); // '24h' (1 day) | '72h' (3 days) | '7d' (7 days)
  const [forecastPayload, setForecastPayload] = useState(null);
  const [historyBandsMap, setHistoryBandsMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLiveUnavailable, setIsLiveUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Load forecast data when site, timestamp, mode, or range tab changes
  useEffect(() => {
    if (!isBackendConnected || !selectedSite) {
      return;
    }

    let isMounted = true;
    const fetchRangeForecast = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setIsLiveUnavailable(false);

      const horizonHours = rangeTab === '72h' ? 72 : rangeTab === '7d' ? 168 : 24;

      try {
        const payload = {
          site: selectedSite.id || selectedSite.siteKey,
          campusKey: selectedSite.campusKey,
          siteKey: selectedSite.siteKey,
          horizon_hours: horizonHours,
          mode: forecastMode,
        };

        if (forecastMode === 'historical' && timestamp) {
          payload.timestamp = timestamp;
        }

        const [fcRes, bandsRes] = await Promise.allSettled([
          fetchForecast(payload),
          fetchHistoryBands(selectedSite.id || selectedSite.siteKey, timestamp, 24),
        ]);

        if (!isMounted) return;

        if (fcRes.status === 'fulfilled' && fcRes.value?.success) {
          setForecastPayload(fcRes.value);
          if (forecastMode === 'live' && fcRes.value?.issue_time && onLiveIssueTime) {
            onLiveIssueTime(fcRes.value.issue_time);
          }
        } else {
          const err = fcRes.status === 'fulfilled' ? fcRes.value?.error : fcRes.reason?.message;
          const isUnavailable = err && (err.includes('Live weather unavailable') || err.includes('503'));
          if (forecastMode === 'live' && isUnavailable) {
            setIsLiveUnavailable(true);
          } else {
            setErrorMessage(err || 'Forecast data unavailable for this date range.');
          }
        }

        if (bandsRes.status === 'fulfilled' && bandsRes.value?.success) {
          const bMap = {};
          (bandsRes.value.bands || []).forEach((b) => {
            bMap[b.time] = b;
          });
          setHistoryBandsMap(bMap);
        }
      } catch (err) {
        if (!isMounted) return;
        const msg = err.message || '';
        if (forecastMode === 'live' && (msg.includes('Live weather unavailable') || msg.includes('503'))) {
          setIsLiveUnavailable(true);
        } else {
          setErrorMessage(msg || 'Forecast request failed. Please check network.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRangeForecast();

    return () => {
      isMounted = false;
    };
  }, [selectedSite, timestamp, forecastMode, rangeTab, isBackendConnected, retryCount]);

  // Derived next peak
  const nextPeak = useMemo(() => {
    if (forecastPayload?.next_peak?.peak_kW) {
      return forecastPayload.next_peak;
    }
    const steps = forecastPayload?.forecast || [];
    if (!steps.length) return { peak_kW: 0, timestamp: null };

    let maxKw = 0;
    let maxTs = null;
    steps.forEach((s) => {
      if (s.predicted_kW > maxKw) {
        maxKw = s.predicted_kW;
        maxTs = s.timestamp;
      }
    });
    return { peak_kW: maxKw, timestamp: maxTs };
  }, [forecastPayload]);

  // Format timestamp helpers
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

  // Prepare chart series
  const stepChartData = useMemo(() => {
    const list = forecastPayload?.forecast || [];
    return list.map((item) => {
      const is3d = rangeTab === '72h';
      const tl = is3d
        ? `${formatDateShort(item.timestamp.slice(0, 10))} ${formatHourMin(item.timestamp)}`
        : formatHourMin(item.timestamp);
      const band = historyBandsMap[formatHourMin(item.timestamp)] || {};
      const isUploaded = item.actual_source === 'uploaded' || (forecastMode === 'live' && item.actual_kW !== null && item.actual_kW !== undefined);
      return {
        ...item,
        timeLabel: tl,
        rangeBand: [item.lower_kW, item.upper_kW],
        diffRange: Math.max(0, item.upper_kW - item.lower_kW),
        physics_estimate_kW: item.physics_estimate_kW ?? null,
        actual_kW: item.actual_kW !== undefined ? item.actual_kW : null,
        actual_uploaded_kW: (isUploaded && item.actual_kW !== null && item.actual_kW !== undefined) ? item.actual_kW : null,
        actual_historical_kW: (!isUploaded && item.actual_kW !== null && item.actual_kW !== undefined) ? item.actual_kW : null,
        hist_p75_kW: item.hist_p75_kW ?? band.p75_kW ?? null,
        hist_median_kW: item.hist_median_kW ?? band.median_kW ?? null,
        hist_p25_kW: item.hist_p25_kW ?? band.p25_kW ?? null,
      };
    });
  }, [forecastPayload, historyBandsMap, rangeTab, forecastMode]);

  const dailyChartData = useMemo(() => {
    const list = forecastPayload?.daily_forecast || [];
    return list.map((item) => ({
      ...item,
      dateLabel: formatDateShort(item.date),
      uncertainty: Math.round((item.upper_kWh || 0) - (item.lower_kWh || 0)),
      actual_kWh: item.actual_kWh !== undefined ? item.actual_kWh : null,
    }));
  }, [forecastPayload]);

  const peakTimeFormatted = nextPeak.timestamp ? formatHourMin(nextPeak.timestamp) : '--:--';
  const issueTime = forecastPayload?.issue_time || (forecastMode === 'live' ? 'Live forecast' : 'Historical replay');
  const weatherSource = forecastPayload?.weather_source || (forecastMode === 'live' ? 'Open-Meteo' : 'Dataset + uploads');
  const modeHeading = forecastMode === 'historical' ? 'Historical backtest (no live data)' : 'Live forecast estimate';

  const hasChartData = !isLoading && !errorMessage && !isLiveUnavailable && (
    rangeTab === '7d' ? dailyChartData.length > 0 : stepChartData.length > 0
  );

  // Custom tooltips
  const CustomStepTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip-glass">
          <p className="tooltip-time">{label || data.timestamp}</p>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot amber-dot" />
            <span className="tooltip-name">Forecast:</span>
            <span className="tooltip-val">{data.predicted_kW} kW</span>
          </div>
          {data.actual_uploaded_kW !== null && data.actual_uploaded_kW !== undefined && (
            <div className="tooltip-row">
              <span className="tooltip-legend-dot" style={{ backgroundColor: '#059669' }} />
              <span className="tooltip-name">Actual (uploaded):</span>
              <span className="tooltip-val">{data.actual_uploaded_kW} kW</span>
            </div>
          )}
          {data.actual_historical_kW !== null && data.actual_historical_kW !== undefined && (
            <div className="tooltip-row">
              <span className="tooltip-legend-dot" style={{ backgroundColor: '#1B2A3A' }} />
              <span className="tooltip-name">Actual measured:</span>
              <span className="tooltip-val">{data.actual_historical_kW} kW</span>
            </div>
          )}
          <div className="tooltip-row subtle-row">
            <span className="tooltip-name">Forecast range:</span>
            <span className="tooltip-val">{data.lower_kW} – {data.upper_kW} kW</span>
          </div>
          {data.physics_estimate_kW !== null && data.physics_estimate_kW !== undefined && (
            <div className="tooltip-row subtle-row">
              <span className="tooltip-legend-dot" style={{ backgroundColor: '#0284C7' }} />
              <span className="tooltip-name">Physics baseline:</span>
              <span className="tooltip-val">{data.physics_estimate_kW} kW</span>
            </div>
          )}
          {data.hist_median_kW !== null && data.hist_median_kW !== undefined && (
            <div className="tooltip-row subtle-row">
              <span className="tooltip-name">Typical 25-75% band:</span>
              <span className="tooltip-val">{data.hist_p25_kW} – {data.hist_p75_kW} kW</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomDailyTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip-glass">
          <p className="tooltip-time">{label} ({data.date})</p>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot amber-dot" />
            <span className="tooltip-name">Forecast:</span>
            <span className="tooltip-val">{data.predicted_kWh} kWh</span>
          </div>
          {data.actual_kWh !== null && data.actual_kWh !== undefined && data.actual_kWh > 0 && (
            <div className="tooltip-row">
              <span className="tooltip-legend-dot" style={{ backgroundColor: '#059669' }} />
              <span className="tooltip-name">Actual (uploaded):</span>
              <span className="tooltip-val">{data.actual_kWh} kWh</span>
            </div>
          )}
          <div className="tooltip-row subtle-row">
            <span className="tooltip-name">Forecast range:</span>
            <span className="tooltip-val">{data.lower_kWh} – {data.upper_kWh} kWh</span>
          </div>
          <div className="tooltip-row subtle-row">
            <span className="tooltip-name">Peak power:</span>
            <span className="tooltip-val">{data.peak_kW} kW</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="forecast-hero-section" aria-label="Solar Forecast Hero Section">
      {/* Top row: Section title, Mode badge, Next Peak, and Range switcher */}
      <div className="forecast-header">
        <div className="forecast-title-group">
          <h2 className="section-heading">
            {forecastMode === 'historical' ? 'Historical backtest' : 'Solar power forecast'}
          </h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: '#6B7A8A' }}>
            {forecastMode === 'historical'
              ? 'Model prediction compared with recorded data for the selected date.'
              : 'Forecast of solar power from the weather forecast for the selected date.'}
          </p>
        </div>

        {/* Next peak badge (hidden during error or empty state) */}
        {hasChartData && (
          <div className="next-peak-badge" title="Predicted maximum generation and time">
            <span className="peak-label">Next peak</span>
            <span className="peak-value">
              <AnimatedNumber value={nextPeak.peak_kW || 0} decimals={1} suffix=" kW" />
            </span>
            <span className="peak-time">at {peakTimeFormatted}</span>
          </div>
        )}

        {/* Range switcher tabs */}
        <div className="range-switcher" role="tablist" aria-label="Forecast Range">
          <button
            id="tab-range-24h"
            type="button"
            role="tab"
            aria-selected={rangeTab === '24h'}
            className={`range-tab-btn ${rangeTab === '24h' ? 'active' : ''}`}
            onClick={() => setRangeTab('24h')}
          >
            1 day
          </button>
          <button
            id="tab-range-72h"
            type="button"
            role="tab"
            aria-selected={rangeTab === '72h'}
            className={`range-tab-btn ${rangeTab === '72h' ? 'active' : ''}`}
            onClick={() => setRangeTab('72h')}
          >
            3 days
          </button>
          <button
            id="tab-range-7d"
            type="button"
            role="tab"
            aria-selected={rangeTab === '7d'}
            className={`range-tab-btn ${rangeTab === '7d' ? 'active' : ''}`}
            onClick={() => setRangeTab('7d')}
          >
            7 days
          </button>
        </div>
      </div>

      {/* Main Chart Stage */}
      <div className="forecast-chart-stage">
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="chart-loading-state" aria-busy="true">
            <div className="chart-skeleton-shimmer" />
            <div className="loading-spinner-wrapper">
              <span className="spinner-amber" />
              <p className="loading-caption">Calculating recursive solar projection...</p>
            </div>
          </div>
        )}

        {/* Friendly Live Weather Unavailable State (Rule 4) */}
        {!isLoading && isLiveUnavailable && forecastMode === 'live' && (
          <div className="live-weather-unavailable-box" role="alert">
            <div className="unavailable-icon-circle">☁</div>
            <h3 className="unavailable-title">Live weather unavailable</h3>
            <p className="unavailable-desc">
              Could not fetch real-time weather. The live forecast requires an active internet connection.
            </p>
            <div className="unavailable-actions">
              <button
                type="button"
                className="btn-switch-historical-action"
                onClick={onSwitchToHistorical}
              >
                Switch to Historical
              </button>
              <button
                type="button"
                className="btn-retry-action subtle"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                Retry Live Forecast
              </button>
            </div>
          </div>
        )}

        {/* Generic Error banner with retry */}
        {!isLoading && !isLiveUnavailable && errorMessage && (
          <div className="chart-error-state" role="alert">
            <div className="error-icon-circle">!</div>
            <p className="error-message-text">{errorMessage}</p>
            <button
              type="button"
              className="btn-retry-action"
              onClick={() => setRetryCount((c) => c + 1)}
            >
              Retry forecast
            </button>
          </div>
        )}

        {/* Standard Legend Placed Outside Chart Canvas (hidden during error/empty state) */}
        {hasChartData && (
          <StandardChartLegend
            items={
              rangeTab === '7d'
                ? [
                    { label: 'Forecast', color: '#F2A413', type: 'bar' },
                    { label: 'Forecast range', color: 'rgba(242, 164, 19, 0.20)', type: 'band' },
                    { label: 'Actual (uploaded)', color: '#059669', type: 'bar' },
                    ...(forecastMode === 'historical'
                      ? [{ label: 'Actual measured', color: '#1B2A3A', type: 'bar' }]
                      : []),
                  ]
                : [
                    { label: 'Forecast', color: '#F2A413', type: 'dashed' },
                    { label: 'Forecast range', color: 'rgba(242, 164, 19, 0.20)', type: 'band', borderColor: '#F2A413' },
                    { label: 'Actual (uploaded)', color: '#059669', type: 'line' },
                    ...(forecastMode === 'historical'
                      ? [{ label: 'Actual measured', color: '#1B2A3A', type: 'line' }]
                      : []),
                    { label: 'Typical 25-75% band', color: 'rgba(27, 42, 58, 0.16)', type: 'band' },
                    { label: 'Physics-model baseline', color: '#0284C7', type: 'dashed' },
                  ]
            }
          />
        )}

        {/* 1 & 2. 1 Day / 3 Days: Area chart with shaded range, forecast curve, and actual (uploaded) points */}
        {!isLoading && !errorMessage && !isLiveUnavailable && rangeTab !== '7d' && (
          <div className="chart-container" style={{ width: '100%', height: 340 }}>
            {stepChartData.length === 0 ? (
              <div className="empty-chart-fallback">No forecast data available for this range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stepChartData}
                  margin={STANDARD_CHART_MARGIN}
                >
                  <defs>
                    <linearGradient id="areaAmberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F2A413" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#F2A413" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#4A5B6D', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    dy={6}
                    minTickGap={rangeTab === '72h' ? 36 : 24}
                  />
                  <YAxis
                    {...getYAxisProps({ title: 'Power (kW)', width: 62 })}
                  />
                  <Tooltip content={<CustomStepTooltip />} />
                  {/* Typical Day History Band */}
                  <Area
                    type="monotone"
                    dataKey="hist_p75_kW"
                    stroke="none"
                    fill="rgba(27, 42, 58, 0.16)"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hist_median_kW"
                    stroke="#748596"
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Upper confidence band (Forecast range) */}
                  <Area
                    type="monotone"
                    dataKey="upper_kW"
                    stroke="none"
                    fill="rgba(242, 164, 19, 0.16)"
                    isAnimationActive={false}
                  />
                  {/* Physics baseline */}
                  <Line
                    type="monotone"
                    dataKey="physics_estimate_kW"
                    stroke="#0284C7"
                    strokeWidth={1.8}
                    strokeDasharray="4 2"
                    dot={false}
                    name="Physics-model baseline"
                    isAnimationActive={false}
                  />
                  {/* Predicted Generation curve */}
                  <Area
                    type="monotone"
                    dataKey="predicted_kW"
                    stroke="#F2A413"
                    strokeWidth={2.6}
                    strokeDasharray="4 4"
                    fill="url(#areaAmberGrad)"
                    strokeLinejoin="round"
                    isAnimationActive={false}
                    activeDot={{ r: 6, fill: '#D88F0C', stroke: '#FFFFFF', strokeWidth: 2 }}
                    name="Forecast"
                  />
                  {/* Historical measured generation (if present) */}
                  {forecastMode === 'historical' && (
                    <Line
                      type="monotone"
                      dataKey="actual_historical_kW"
                      stroke="#1B2A3A"
                      strokeWidth={2.0}
                      dot={{ r: 2.5, fill: '#1B2A3A' }}
                      name="Actual measured"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  )}
                  {/* Uploaded actuals as points over the forecast */}
                  <Line
                    type="monotone"
                    dataKey="actual_uploaded_kW"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 4.5, fill: '#059669', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 7, fill: '#047857', stroke: '#FFFFFF', strokeWidth: 2 }}
                    name="Actual (uploaded)"
                    connectNulls={true}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* 3. 7 Days: Bars of daily energy (kWh) comparing predicted vs actual */}
        {!isLoading && !errorMessage && !isLiveUnavailable && rangeTab === '7d' && (
          <div className="chart-container" style={{ width: '100%', height: 340 }}>
            {dailyChartData.length === 0 ? (
              <div className="empty-chart-fallback">No 7-day forecast data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyChartData}
                  margin={STANDARD_CHART_MARGIN}
                >
                  <defs>
                    <linearGradient id="barAmberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F2A413" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#D98A00" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: '#4A5B6D', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    dy={6}
                    minTickGap={20}
                  />
                  <YAxis
                    {...getYAxisProps({ title: 'Energy (kWh)', width: 66 })}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Bar
                    dataKey="predicted_kWh"
                    fill="url(#barAmberGrad)"
                    name="Forecast"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="actual_kWh"
                    fill="#059669"
                    name="Actual (uploaded)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
