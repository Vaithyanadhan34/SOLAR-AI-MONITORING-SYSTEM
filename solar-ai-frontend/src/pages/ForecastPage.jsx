import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSolar, getDefaultTimestampForSite } from '../context/SolarContext';
import ForecastHero from '../components/ForecastHero';
import { fetchAnomalies } from '../services/api';

export default function ForecastPage() {
  const {
    selectedSite,
    setSelectedSite,
    isBackendConnected,
    sites,
    mode,
    setMode,
  } = useSolar();

  // Requirement 1: Default date = the latest date with data (site end_date)
  const defaultDate = selectedSite?.end_date || '2020-08-19';
  const [calendarDate, setCalendarDate] = useState(defaultDate);
  const [historicalTimestamp, setHistoricalTimestamp] = useState(() => `${defaultDate}T12:00`);
  const [liveIssueTime, setLiveIssueTime] = useState(null);
  const [dateError, setDateError] = useState(null);

  const [anomalies, setAnomalies] = useState([]);
  const [loadingAnomalies, setLoadingAnomalies] = useState(true);
  const [anomalyError, setAnomalyError] = useState(null);

  const siteId = selectedSite?.id || 'site-1';
  const siteName = selectedSite?.name || 'Site';

  // Keep calendar date snapped to latest valid date when site changes or mounts
  useEffect(() => {
    if (selectedSite?.end_date) {
      setCalendarDate(selectedSite.end_date);
      setHistoricalTimestamp(`${selectedSite.end_date}T12:00`);
      setDateError(null);
    }
  }, [selectedSite?.id, selectedSite?.end_date]);

  // Requirement 1: Calendar allows only dates that have data (historical or uploaded)
  const handleCalendarChange = (val) => {
    const avail = selectedSite?.available_dates;
    if (avail && avail.length > 0 && !avail.includes(val)) {
      setDateError(`Date disabled: No historical or uploaded telemetry recorded for ${val}. Available range: ${selectedSite.start_date} to ${selectedSite.end_date}.`);
      return;
    }
    setDateError(null);
    setCalendarDate(val);
    setHistoricalTimestamp(`${val}T12:00`);
  };

  // Snap historical date into range when site changes if needed
  const handleSiteChange = (s) => {
    if (!s) return;
    setSelectedSite(s);
  };

  // Load anomaly timeline for historical mode
  useEffect(() => {
    let active = true;
    const loadTimeline = async () => {
      setLoadingAnomalies(true);
      setAnomalyError(null);
      try {
        const res = await fetchAnomalies(siteId, historicalTimestamp, 14);
        if (!active) return;
        setAnomalies(res?.anomalies || []);
      } catch (err) {
        if (active) setAnomalyError(err.message || 'Unable to load anomaly timeline');
      } finally {
        if (active) setLoadingAnomalies(false);
      }
    };

    if (isBackendConnected) {
      loadTimeline();
    }
    return () => { active = false; };
  }, [siteId, historicalTimestamp, isBackendConnected]);

  // Format date string e.g. "18 Aug 2020"
  const formattedHistoricalDate = (() => {
    try {
      const parts = (historicalTimestamp || '').slice(0, 10).split('-');
      if (parts.length === 3) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const m = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${monthNames[m]} ${parts[0]}`;
      }
    } catch {}
    return historicalTimestamp?.slice(0, 10) || '';
  })();

  // Active source under title
  const activeSourceLabel = mode === 'historical'
    ? `Historical backtest: ${siteName}, ${formattedHistoricalDate}`
    : `Live forecast for ${siteName}`;

  return (
    <div className="forecast-page-container">
      {/* Top Header Strip with Title, Active Source, Segmented Mode Control, and Context Filters */}
      <div className="page-header-strip">
        <div className="title-row-with-site">
          <div>
            <h1 className="page-main-title">Solar Generation Forecast</h1>
            <p className="page-caption active-source-caption">
              <span className="source-dot" style={{ backgroundColor: mode === 'live' ? '#10B981' : '#F2A413' }} />
              <strong>{activeSourceLabel}</strong>
              <span className="caption-subtext"> — Recursive multi-step projection with tree uncertainty & typical baselines</span>
            </p>
          </div>

          {/* Top Controls: Mode Segmented Control + Site & Date Picker */}
          <div className="forecast-controls-row">
            <div className="forecast-mode-segment-wrapper" role="radiogroup" aria-label="Forecast data source mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'historical'}
                className={`forecast-segment-btn ${mode === 'historical' ? 'active' : ''}`}
                onClick={() => setMode('historical')}
              >
                Historical
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'live'}
                className={`forecast-segment-btn ${mode === 'live' ? 'active' : ''}`}
                onClick={() => setMode('live')}
              >
                Live
              </button>
            </div>

            {/* Quick Context Bar */}
            <div className="context-site-pill">
              <span className="context-label">Site:</span>
              <select
                className="context-select"
                value={selectedSite?.id || 'site-1'}
                onChange={(e) => {
                  const s = sites.find((x) => x.id === e.target.value);
                  if (s) handleSiteChange(s);
                }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.capacity} kWp)
                  </option>
                ))}
              </select>

              <span className="context-divider">•</span>
              <label htmlFor="forecast-calendar-input" className="sr-only">Forecast calendar date</label>
              <input
                id="forecast-calendar-input"
                type="date"
                className="context-date-input"
                value={calendarDate}
                min={selectedSite?.start_date || '2020-01-01'}
                max={selectedSite?.end_date || '2026-12-31'}
                onChange={(e) => handleCalendarChange(e.target.value)}
                title="Select forecast date (only dates with historical or uploaded data are enabled)"
              />
            </div>
          </div>
        </div>
        {dateError && (
          <div style={{ padding: '6px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '0.8rem', marginTop: '6px' }} role="alert">
            {dateError}
          </div>
        )}
      </div>

      {/* Main Forecast Hero */}
      <ForecastHero
        selectedSite={selectedSite}
        timestamp={historicalTimestamp}
        isBackendConnected={isBackendConnected}
        forecastMode={mode}
        onSwitchToHistorical={() => setMode('historical')}
        onLiveIssueTime={(time) => setLiveIssueTime(time)}
      />

      {/* Anomaly Timeline Section (preceding historical window) */}
      <div className="chart-card anomaly-timeline-card">
        <div className="chart-card-header">
          <div>
            <h2 className="chart-title">Operational Anomaly Timeline</h2>
            <p className="chart-caption">
              Flagged generation deficits and behavioral anomalies detected over the preceding 14-day window.
            </p>
          </div>
          <span className="counter-pill">
            {anomalies.length} {anomalies.length === 1 ? 'event' : 'events'} recorded
          </span>
        </div>

        <div className="anomaly-timeline-body">
          {loadingAnomalies ? (
            <div className="chart-skeleton"><div className="skeleton-shimmer" /></div>
          ) : anomalyError ? (
            <div className="chart-error-state"><p>{anomalyError}</p></div>
          ) : anomalies.length === 0 ? (
            <div className="chart-empty-state">
              <p>No operational anomalies detected for {siteName} in this 14-day window. Generation matches nominal unsoiled baselines.</p>
            </div>
          ) : (
            <div className="timeline-items-list">
              {anomalies.map((item, idx) => {
                const isHigh = item.severity === 'High';
                return (
                  <div key={idx} className={`timeline-event-row ${isHigh ? 'event-high' : 'event-med'}`}>
                    <div className="event-time-col">
                      <span className="event-date">{item.date}</span>
                      <span className="event-time">{item.time}</span>
                    </div>

                    <div className="event-indicator-col">
                      <span className={`event-status-pill ${item.status === 'Inspection' ? 'pill-inspection' : 'pill-review'}`}>
                        {item.status}
                      </span>
                      {item.source && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: item.source === 'Uploaded' ? '#DCFCE7' : '#F1F5F9',
                            color: item.source === 'Uploaded' ? '#166534' : '#475569',
                            fontWeight: 600,
                            display: 'inline-block',
                            marginTop: '2px',
                          }}
                        >
                          {item.source}
                        </span>
                      )}
                    </div>

                    <div className="event-metrics-col">
                      <span className="metric-shortfall">-{item.loss_percent}%</span>
                      <span className="metric-powers">
                        {item.actual_kW} kW actual vs {item.expected_kW} kW expected
                      </span>
                    </div>

                    <div className="event-hint-col">
                      <p className="event-hint-text">{item.hint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transparency footnote link */}
      <div className="page-footnote-strip">
        <Link to="/data" className="quick-action-link muted-link">
          How are forecasts and anomaly scores estimated? View model transparency & diurnal assumptions →
        </Link>
      </div>
    </div>
  );
}
