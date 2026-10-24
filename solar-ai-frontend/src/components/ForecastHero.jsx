import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { fetchForecast } from '../services/api';
import AnimatedNumber from './AnimatedNumber';

export default function ForecastHero({
  selectedSite,
  timestamp,
  isBackendConnected,
}) {
  const [rangeTab, setRangeTab] = useState('24h'); // '6h' | '24h' | '7d'
  const [forecastPayload, setForecastPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Load forecast data when site, timestamp, or range tab changes
  useEffect(() => {
    if (!isBackendConnected || !selectedSite || !timestamp) {
      return;
    }

    let isMounted = true;
    const fetchRangeForecast = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      // 6h needs 6 hours, 24h needs 24 hours, 7d needs 168 hours
      const horizonHours = rangeTab === '6h' ? 6 : rangeTab === '7d' ? 168 : 24;

      try {
        const res = await fetchForecast({
          site: selectedSite.id || selectedSite.siteKey,
          campusKey: selectedSite.campusKey,
          siteKey: selectedSite.siteKey,
          timestamp: timestamp,
          horizon_hours: horizonHours,
        });

        if (!isMounted) return;

        if (res && res.success) {
          setForecastPayload(res);
        } else {
          setErrorMessage(res?.error || 'Forecast data unavailable for this date range.');
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Forecast request failed. Please check network.');
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
  }, [selectedSite, timestamp, rangeTab, isBackendConnected, retryCount]);

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

  // Format timestamp helper
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
    return list.map((item) => ({
      ...item,
      timeLabel: formatHourMin(item.timestamp),
      rangeBand: [item.lower_kW, item.upper_kW],
      diffRange: Math.max(0, item.upper_kW - item.lower_kW),
    }));
  }, [forecastPayload]);

  const dailyChartData = useMemo(() => {
    const list = forecastPayload?.daily_forecast || [];
    return list.map((item) => ({
      ...item,
      dateLabel: formatDateShort(item.date),
      uncertainty: Math.round(item.upper_kWh - item.lower_kWh),
    }));
  }, [forecastPayload]);

  const peakTimeFormatted = nextPeak.timestamp ? formatHourMin(nextPeak.timestamp) : '--:--';

  // Custom tooltips
  const CustomStepTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip-glass">
          <p className="tooltip-time">{label || data.timestamp}</p>
          <div className="tooltip-row">
            <span className="tooltip-legend-dot amber-dot" />
            <span className="tooltip-name">Predicted:</span>
            <span className="tooltip-val">{data.predicted_kW} kW</span>
          </div>
          <div className="tooltip-row subtle-row">
            <span className="tooltip-name">Expected range:</span>
            <span className="tooltip-val">{data.lower_kW} – {data.upper_kW} kW</span>
          </div>
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
            <span className="tooltip-name">Daily Total:</span>
            <span className="tooltip-val">{data.predicted_kWh} kWh</span>
          </div>
          <div className="tooltip-row subtle-row">
            <span className="tooltip-name">Uncertainty range:</span>
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
      {/* Top row: Section title, Next Peak badge, and Time-range switcher */}
      <div className="forecast-header">
        <div className="forecast-title-group">
          <h2 className="section-heading">Forecast</h2>
          {rangeTab === '7d' && (
            <span className="rough-estimate-tag">rough estimate</span>
          )}
        </div>

        {/* Next peak badge */}
        <div className="next-peak-badge" title="Predicted maximum generation and time">
          <span className="peak-label">Next peak</span>
          <span className="peak-value">
            <AnimatedNumber value={nextPeak.peak_kW || 0} decimals={1} suffix=" kW" />
          </span>
          <span className="peak-time">at {peakTimeFormatted}</span>
        </div>

        {/* Range switcher tabs */}
        <div className="range-switcher" role="tablist" aria-label="Forecast Range">
          <button
            id="tab-range-6h"
            type="button"
            role="tab"
            aria-selected={rangeTab === '6h'}
            className={`range-tab-btn ${rangeTab === '6h' ? 'active' : ''}`}
            onClick={() => setRangeTab('6h')}
          >
            Next 6 hours
          </button>
          <button
            id="tab-range-24h"
            type="button"
            role="tab"
            aria-selected={rangeTab === '24h'}
            className={`range-tab-btn ${rangeTab === '24h' ? 'active' : ''}`}
            onClick={() => setRangeTab('24h')}
          >
            Next 24 hours
          </button>
          <button
            id="tab-range-7d"
            type="button"
            role="tab"
            aria-selected={rangeTab === '7d'}
            className={`range-tab-btn ${rangeTab === '7d' ? 'active' : ''}`}
            onClick={() => setRangeTab('7d')}
          >
            Next 7 days
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

        {/* Error banner with retry */}
        {!isLoading && errorMessage && (
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

        {/* 1. Next 6 Hours: Line chart with shaded range */}
        {!isLoading && !errorMessage && rangeTab === '6h' && (
          <div className="chart-container" style={{ width: '100%', height: 340 }}>
            {stepChartData.length === 0 ? (
              <div className="empty-chart-fallback">No 6-hour forecast data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stepChartData}
                  margin={{ top: 20, right: 24, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="rangeShading6h" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F2A413" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#F2A413" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="skyGrad6h" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(224, 242, 254, 0.45)" />
                      <stop offset="100%" stopColor="rgba(224, 242, 254, 0.05)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    dy={6}
                  />
                  <YAxis
                    unit=" kW"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    width={58}
                  />
                  <Tooltip content={<CustomStepTooltip />} />
                  {/* Shaded confidence interval band */}
                  <Area
                    type="monotone"
                    dataKey="upper_kW"
                    stroke="none"
                    fill="url(#rangeShading6h)"
                    fillOpacity={1}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted_kW"
                    stroke="#F2A413"
                    strokeWidth={2.8}
                    dot={{ r: 3, fill: '#F2A413', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#D88F0C', stroke: '#FFFFFF', strokeWidth: 2 }}
                    strokeLinejoin="round"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* 2. Next 24 Hours: Area chart with shaded range and "Now" marker */}
        {!isLoading && !errorMessage && rangeTab === '24h' && (
          <div className="chart-container" style={{ width: '100%', height: 340 }}>
            {stepChartData.length === 0 ? (
              <div className="empty-chart-fallback">No 24-hour forecast data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stepChartData}
                  margin={{ top: 20, right: 24, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="areaAmberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F2A413" stopOpacity={0.42} />
                      <stop offset="60%" stopColor="#F2A413" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#F2A413" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="upperBandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B2A3A" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#1B2A3A" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EBE6DC" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    interval={3}
                    dy={6}
                  />
                  <YAxis
                    unit=" kW"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    width={58}
                  />
                  <Tooltip content={<CustomStepTooltip />} />
                  <ReferenceLine
                    x={stepChartData[0]?.timeLabel}
                    stroke="#1B2A3A"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'Now',
                      position: 'top',
                      fill: '#1B2A3A',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  {/* Upper range band */}
                  <Area
                    type="monotone"
                    dataKey="upper_kW"
                    stroke="none"
                    fill="url(#upperBandGrad)"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  {/* Predicted Generation curve */}
                  <Area
                    type="monotone"
                    dataKey="predicted_kW"
                    stroke="#F2A413"
                    strokeWidth={2.6}
                    fill="url(#areaAmberGrad)"
                    strokeLinejoin="round"
                    isAnimationActive={true}
                    animationDuration={500}
                    activeDot={{ r: 6, fill: '#D88F0C', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* 3. Next 7 Days: Bars of predicted daily energy (kWh) with error range */}
        {!isLoading && !errorMessage && rangeTab === '7d' && (
          <div className="chart-container" style={{ width: '100%', height: 340 }}>
            {dailyChartData.length === 0 ? (
              <div className="empty-chart-fallback">No 7-day forecast data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyChartData}
                  margin={{ top: 20, right: 24, left: 0, bottom: 8 }}
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
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    dy={6}
                  />
                  <YAxis
                    unit=" kWh"
                    tick={{ fill: '#4A5B6D', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                    stroke="#D6D0C4"
                    width={66}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Bar
                    dataKey="predicted_kWh"
                    fill="url(#barAmberGrad)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={48}
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Mandatory one-line caption under forecast charts */}
      <p className="forecast-caption">
        Estimate using typical weather.
      </p>
    </section>
  );
}
