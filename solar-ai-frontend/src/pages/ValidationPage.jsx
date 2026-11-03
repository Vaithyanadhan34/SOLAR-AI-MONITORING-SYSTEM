import React, { useState, useEffect } from 'react';
import { useSolar } from '../context/SolarContext';
import { fetchValidationData } from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, AreaChart, Area
} from 'recharts';
import {
  STANDARD_CHART_MARGIN,
  getYAxisProps,
  StandardChartLegend,
} from '../utils/chartConfig';

export default function ValidationPage() {
  const { sites, selectedSite, setSelectedSite } = useSolar();
  const [siteId, setSiteId] = useState('site-1');
  const [loading, setLoading] = useState(true);
  const [valData, setValData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('timeseries'); // 'timeseries' | 'hourly_error' | 'typical_band'

  useEffect(() => {
    if (selectedSite?.id) {
      setSiteId(selectedSite.id);
    }
  }, [selectedSite]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchValidationData(siteId)
      .then((data) => {
        if (isMounted) {
          if (data && data.success) {
            setValData(data);
          } else {
            setError(data?.error || 'Failed to load validation data');
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load validation backtest');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [siteId]);

  return (
    <div className="page-container validation-page">
      {/* Prominent Historical Disclaimer Banner (Rule / Part 2) */}
      <div className="validation-disclaimer-banner" role="alert">
        <div className="banner-tag-badge">Historical Benchmark</div>
        <div className="banner-content">
          <div className="banner-title">Backtest on held-out historical data (2020-2022). Not current.</div>
          <div className="banner-subtitle">
            This page provides transparent scientific verification of model accuracy against past ground-truth measurements.
            For live operational monitoring and current 2026 conditions, visit the Check, Forecast, or Insights pages.
          </div>
        </div>
      </div>

      {/* Header & Site Selector */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Model Validation & Historical Backtest</h1>
          <p className="page-subtitle">
            Evaluation of the lag-free physical expected model on chronological test records ({valData?.validation_period?.start || '2022-01-16'} to {valData?.validation_period?.end || '2022-04-23'})
          </p>
        </div>

        <div className="site-select-group">
          <label htmlFor="val-site-select">Select Site:</label>
          <select
            id="val-site-select"
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              const found = sites.find(s => s.id === e.target.value);
              if (found) setSelectedSite(found);
            }}
            className="clean-select"
          >
            {sites.map(s => {
              const label = s.name.includes('kWp') ? s.name : `${s.name} (${s.capacity} kWp)`;
              return (
                <option key={s.id} value={s.id}>{label}</option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Navigation tabs between views */}
      <div className="validation-tabs">
        <button
          type="button"
          className={`val-tab-btn ${activeTab === 'timeseries' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeseries')}
        >
          Forecast vs Actual (Test Period)
        </button>
        <button
          type="button"
          className={`val-tab-btn ${activeTab === 'hourly_error' ? 'active' : ''}`}
          onClick={() => setActiveTab('hourly_error')}
        >
          Error by Hour of Day
        </button>
        <button
          type="button"
          className={`val-tab-btn ${activeTab === 'typical_band' ? 'active' : ''}`}
          onClick={() => setActiveTab('typical_band')}
        >
          Typical Day Reference Band
        </button>
      </div>

      {loading && (
        <div className="loading-card">
          <div className="spinner" />
          <p>Loading historical validation benchmarks...</p>
        </div>
      )}

      {error && !loading && (
        <div className="error-card">
          <p>Error loading validation: {error}</p>
        </div>
      )}

      {!loading && !error && valData && (
        <div className="val-content-section">
          {activeTab === 'timeseries' && (
            <div className="card-box">
              <div className="card-header">
                <h3>Historical Test Window: Actual vs Expected Generation</h3>
                <span className="badge-tag">{valData.records_count} chronological intervals</span>
              </div>
              <p className="chart-note">
                Navy line indicates monitored telemetry; amber dashed line indicates lag-free physical RF baseline.
              </p>
              <StandardChartLegend
                items={[
                  { label: 'Actual telemetry (kW)', color: '#1B2A3A', type: 'line' },
                  { label: 'Expected RF baseline (clean baseline)', color: '#F2A413', type: 'dashed' },
                ]}
              />
              <div style={{ width: '100%', height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={valData.timeseries} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(ts) => ts.slice(5, 16)}
                      angle={-20}
                      textAnchor="end"
                      tick={{ fill: '#4A5B6D', fontSize: 11 }}
                      minTickGap={20}
                    />
                    <YAxis
                      {...getYAxisProps({ title: 'Power (kW)', width: 62 })}
                    />
                    <Tooltip
                      formatter={(val, name) => [`${val} kW`, name === 'actual_kW' ? 'Actual Generation' : 'Expected Baseline']}
                      labelFormatter={(l) => `Timestamp: ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual_kW"
                      name="Actual telemetry"
                      stroke="#1B2A3A"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expected_kW"
                      name="Expected RF baseline"
                      stroke="#F2A413"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'hourly_error' && (
            <div className="card-box">
              <div className="card-header">
                <h3>Model Residual Error by Hour of Day</h3>
                <span className="badge-tag">Diurnal Variance Analysis</span>
              </div>
              <p className="chart-note">
                Mean Absolute Error (MAE in kW) across solar daylight hours (06:00 to 18:00). Shows model stability across sun elevation angles.
              </p>
              <StandardChartLegend
                items={[
                  { label: 'Mean absolute error (MAE in kW)', color: '#F2A413', type: 'bar' },
                ]}
              />
              <div style={{ width: '100%', height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valData.hourly_error} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fill: '#4A5B6D', fontSize: 11 }} minTickGap={20} />
                    <YAxis
                      {...getYAxisProps({ title: 'Mean Absolute Error (kW)', width: 66 })}
                    />
                    <Tooltip formatter={(val) => [`${val} kW`, 'MAE']} labelFormatter={(h) => `Hour: ${h}:00`} />
                    <Bar dataKey="mae_kW" name="Mean Absolute Error (kW)" fill="#F2A413" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'typical_band' && (
            <div className="card-box">
              <div className="card-header">
                <h3>Typical-Day 25th-75th Percentile Reference Band</h3>
                <span className="badge-tag">2020-2022 Reference</span>
              </div>
              <p className="chart-note">
                Median expected power and interquartile range (25th to 75th percentile) calculated across all daylight training records for this site.
              </p>
              <StandardChartLegend
                items={[
                  { label: 'Median generation (clean baseline)', color: '#F2A413', type: 'line' },
                  { label: 'Typical 25-75% band (2020-2022)', color: 'rgba(27, 42, 58, 0.16)', type: 'band' },
                ]}
              />
              <div style={{ width: '100%', height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valData.typical_day_bands} margin={STANDARD_CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="time" tick={{ fill: '#4A5B6D', fontSize: 11 }} minTickGap={20} />
                    <YAxis
                      {...getYAxisProps({ title: 'Power (kW)', width: 62 })}
                    />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="p75_kW"
                      stroke="none"
                      fill="#1B2A3A"
                      fillOpacity={0.16}
                      name="Typical 25-75% band (2020-2022)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="p25_kW"
                      stroke="none"
                      fill="#FFFFFF"
                      name="Lower 25th Percentile"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="median_kW"
                      stroke="#F2A413"
                      strokeWidth={2}
                      dot={false}
                      name="Median generation (clean baseline)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Quantitative Verification Table (Collapsible, no prominent metric cards) */}
          <details className="validation-report-details">
            <summary className="report-summary-heading">
              <span>View Quantitative Backtest Report vs Baselines & Cross-Validation</span>
              <span className="summary-tag">Click to expand</span>
            </summary>
            <div className="report-body-text">
              <p><strong>Evaluation Protocol:</strong> Trained on 794,987 chronological rows (2020-01-01 to 2021-10-15), tuned with TimeSeriesSplit on validation (170,355 rows), and evaluated on held-out test data (170,355 rows, 2022-01-16 to 2022-04-23) on daylight records only.</p>
              
              <div className="table-responsive-wrapper">
                <table className="validation-metrics-table">
                  <thead>
                    <tr>
                      <th>Model / Baseline</th>
                      <th>Test MAE (kW)</th>
                      <th>Test RMSE (kW)</th>
                      <th>Test R²</th>
                      <th>Test WAPE (%)</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="highlight-row">
                      <td><strong>Model A (No-Lags Random Forest)</strong></td>
                      <td>3.35</td>
                      <td>6.80</td>
                      <td>0.6917</td>
                      <td>41.37%</td>
                      <td>Primary expected physical baseline</td>
                    </tr>
                    <tr>
                      <td>HistGradientBoostingRegressor</td>
                      <td>3.16</td>
                      <td>6.04</td>
                      <td>0.7565</td>
                      <td>38.95%</td>
                      <td>Gradient boosted comparison candidate</td>
                    </tr>
                    <tr>
                      <td>Persistence Baseline</td>
                      <td>1.09</td>
                      <td>3.05</td>
                      <td>0.9378</td>
                      <td>13.43%</td>
                      <td>Uses recent lags (nowcasting only)</td>
                    </tr>
                    <tr>
                      <td>Hour-of-Day Mean Baseline</td>
                      <td>3.39</td>
                      <td>6.88</td>
                      <td>0.6842</td>
                      <td>41.85%</td>
                      <td>Site-specific diurnal average</td>
                    </tr>
                    <tr>
                      <td>Same-Time-Yesterday Baseline</td>
                      <td>4.79</td>
                      <td>9.87</td>
                      <td>0.3465</td>
                      <td>59.07%</td>
                      <td>Previous-day 24h lag</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="cv-summary-grid">
                <div className="cv-stat-box">
                  <span className="cv-stat-label">TimeSeriesSplit 5-Fold Cross-Validation</span>
                  <span className="cv-stat-val">R² = 0.2956 &plusmn; 0.1148</span>
                  <span className="cv-stat-sub">Daylight folds with 1-day embargo gap</span>
                </div>
                <div className="cv-stat-box">
                  <span className="cv-stat-label">Leave-One-Site-Out Cross-Validation</span>
                  <span className="cv-stat-val">R² = 0.5689 | MAE = 3.24 kW</span>
                  <span className="cv-stat-sub">Evaluates generalization to unseen plant layouts</span>
                </div>
              </div>

              <p className="footnote-text">Source: Real numbers computed directly by <code>backend/train_models.py</code> on the full 1.195M row telemetry dataset. Preserved in <code>backend/model_evaluation_report.txt</code>.</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
