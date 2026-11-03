import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  fetchDataInfo,
  fetchEvaluationStatus,
  uploadLiveCsv,
  fetchLiveStats,
  fetchBatches,
  deleteBatch,
} from '../services/api';
import { useSolar } from '../context/SolarContext';
import { StandardChartLegend } from '../utils/chartConfig';

export default function DataAssumptionsPage() {
  const { refreshSites } = useSolar();
  const [loading, setLoading] = useState(true);
  const [dataInfo, setDataInfo] = useState(null);
  const [error, setError] = useState(null);

  // 2026 Out-of-time evaluation progress
  const [evalSite, setEvalSite] = useState('site-1');
  const [evalStatus, setEvalStatus] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);

  // CSV upload state
  const [uploadSite, setUploadSite] = useState('site-1');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [batches, setBatches] = useState([]);

  const loadInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDataInfo();
      setDataInfo(res);
    } catch (err) {
      setError(err.message || 'Unable to load dataset metadata and assumptions');
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluation = async (siteId) => {
    setEvalLoading(true);
    try {
      const res = await fetchEvaluationStatus(siteId);
      setEvalStatus(res);
    } catch {
      setEvalStatus(null);
    } finally {
      setEvalLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const res = await fetchBatches();
      if (res?.success) {
        setBatches(res.batches || []);
      }
    } catch {
      setBatches([]);
    }
  };

  useEffect(() => {
    loadInfo();
    loadBatches();
  }, []);

  useEffect(() => {
    loadEvaluation(evalSite);
  }, [evalSite]);

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadResult(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('site', uploadSite);

    try {
      const res = await uploadLiveCsv(formData);
      if (res?.success) {
        setUploadResult(res);
        await loadEvaluation(evalSite);
        await loadInfo();
        await loadBatches();
        if (refreshSites) await refreshSites();
      } else {
        setUploadError(res?.error || 'CSV upload rejected');
      }
    } catch (err) {
      setUploadError(err.message || 'Error uploading CSV');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm(`Delete batch ${batchId}? This will remove its rows from the local database.`)) return;
    try {
      await deleteBatch(batchId);
      await loadBatches();
      await loadInfo();
      await loadEvaluation(evalSite);
      if (refreshSites) await refreshSites();
    } catch (err) {
      alert(err.message || 'Failed to delete batch');
    }
  };

  // Format coverage data for horizontal bar chart with yearly breakdown
  const coverageData = dataInfo?.site_coverage?.map((s) => ({
    name: s.name.split(' (')[0],
    fullName: s.name,
    row_count: s.row_count,
    capacity_kWp: s.capacity_kWp,
    start_date: s.start_date,
    end_date: s.end_date,
    '2020': s.yearly_counts?.['2020'] || 0,
    '2021': s.yearly_counts?.['2021'] || 0,
    '2022': s.yearly_counts?.['2022'] || 0,
  })) || [];

  return (
    <div className="data-page-container">
      {/* Short Title and One-line Caption */}
      <div className="page-header-strip">
        <h1 className="page-main-title">Data & Assumptions</h1>
        <p className="page-caption">Telemetry provenance, machine learning architectures, documented assumptions, and physical limits.</p>
      </div>

      {/* Collapsible: How is this calculated? */}
      <details
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2DACB',
          borderRadius: '10px',
          padding: '0.9rem 1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', color: '#1B2A3A' }}>
          How is this calculated?
        </summary>
        <ul style={{ margin: '0.75rem 0 0 0', paddingLeft: '1.25rem', color: '#334155', fontSize: '0.88rem', lineHeight: '1.6' }}>
          <li>Expected power generated from the machine learning model based on weather and diurnal conditions.</li>
          <li>Performance ratio calculated as actual generation divided by expected generation.</li>
          <li>Grading evaluated against the site's own historical percentile distribution.</li>
          <li>Lost energy computed strictly when output is below expected baseline (no penalty for surplus generation).</li>
          <li>Cleaning recommendation economically weighs the financial value of accumulated lost energy against wash costs.</li>
        </ul>
      </details>

      {/* Part 6 - Data Sources Strip */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2DACB',
        borderRadius: '10px',
        padding: '0.8rem 1.2rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
          <span style={{ fontSize: '0.85rem', color: '#1B2A3A' }}>
            Weather API: <strong>{dataInfo?.data_sources_strip?.weather_api || 'Open-Meteo Live API (Free, zero-cost)'}</strong>
          </span>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#4A5B6D' }}>
          Last Fetch: <strong>{dataInfo?.data_sources_strip?.last_fetch_time || 'Real-time'}</strong>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#4A5B6D' }}>
          Saved 2026 Readings: <strong>{dataInfo?.data_sources_strip?.live_readings_count ?? 0} rows</strong> (backend/data/uploads)
        </div>
        <div style={{ fontSize: '0.82rem', color: '#4A5B6D' }}>
          Training Data Range: <strong>2020-01-01 to 2022-04-23</strong> (training data only)
        </div>
      </div>

      {loading ? (
        <div className="data-skeleton-container">
          <div className="skeleton-card"><div className="skeleton-shimmer" /></div>
          <div className="skeleton-card"><div className="skeleton-shimmer" /></div>
        </div>
      ) : error ? (
        <div className="chart-error-state"><p>{error}</p></div>
      ) : (
        <>
          {/* Part 4 - 2026 Real Data Out-of-Time Evaluation Card */}
          <div className="section-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #F2A413' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="section-heading" style={{ margin: 0 }}>2026 Data Collection & Out-of-Time Evaluation</h2>
                <p className="section-subtext" style={{ margin: '4px 0 0 0' }}>
                  Progress towards 14 days of saved daytime readings required for honest out-of-time model validation.
                </p>
                <div style={{ marginTop: '6px', display: 'inline-block', padding: '3px 8px', borderRadius: '4px', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155', fontSize: '0.8rem', fontWeight: 600 }}>
                  Saved to local files in backend/data/uploads
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', color: '#4A5B6D', fontWeight: 600 }}>Site:</label>
                <select
                  value={evalSite}
                  onChange={(e) => setEvalSite(e.target.value)}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                >
                  <option value="site-1">Site 1 (Campus 2)</option>
                  <option value="site-2">Site 2 (Campus 2)</option>
                  <option value="site-3">Site 3 (Campus 2)</option>
                  <option value="site-4">Site 4 (Campus 1)</option>
                  <option value="site-5">Site 5 (Campus 3)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>{evalStatus?.message || `Collecting data: ${evalStatus?.days_collected || 0} of 14 days`}</span>
                <span>{Math.round(((evalStatus?.days_collected || 0) / 14) * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.round(((evalStatus?.days_collected || 0) / 14) * 100))}%`,
                    height: '100%',
                    backgroundColor: '#F2A413',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: '#6B7A8A', marginTop: '8px' }}>
                Daytime readings logged: <strong>{evalStatus?.total_daytime_readings || 0}</strong>. When 14 complete days exist, <code>backend/evaluate_recent.py</code> produces the out-of-time error report in <code>backend/recent_data_report.txt</code>. Uploaded data seamlessly feeds every page across the platform.
              </p>
            </div>
          </div>

          {/* Telemetry & Model Summary Cards */}
          <div className="telemetry-summary-grid">
            <div className="telemetry-stat-card">
              <span className="stat-label">Historical Training Dataset</span>
              <span className="stat-code-name">{dataInfo?.data_file || 'Precomputed Profiles (Zero-Cost Runtime)'}</span>
              <span className="stat-detail">
                {dataInfo?.row_count ? `${dataInfo.row_count.toLocaleString()} total telemetry records` : 'Historical solar telemetry'}
              </span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label">Data Span</span>
              <span className="stat-main-text">
                {dataInfo?.date_range ? `${dataInfo.date_range.start} to ${dataInfo.date_range.end}` : '2020-01-01 to 2022-04-23'}
              </span>
              <span className="stat-detail">Combined historical training records + local uploads</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label">Fleet Coverage</span>
              <span className="stat-main-text">{dataInfo?.sites_count ?? 5} Monitored Solar Plants</span>
              <span className="stat-detail">Campus 1, Campus 2 & Campus 3 (15 – 100 kWp)</span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label">Uploaded 2026 Records</span>
              <span className="stat-main-text">
                {dataInfo?.uploaded_2026_rows != null ? `${dataInfo.uploaded_2026_rows.toLocaleString()} rows` : '0 rows'}
              </span>
              <span className="stat-detail">
                {dataInfo?.total_uploaded_rows ? `${dataInfo.total_uploaded_rows.toLocaleString()} total local rows in backend/data/uploads` : 'Stored in backend/data/uploads'}
              </span>
            </div>

            <div className="telemetry-stat-card">
              <span className="stat-label">Data Quality & Completeness</span>
              <span className="stat-main-text">0 Missing Critical Telemetry Values</span>
              <span className="stat-detail">Validated solar generation, temperature, humidity, and wind speed</span>
            </div>
          </div>

          {/* Model Deployment Architectures */}
          <div className="section-card">
            <h2 className="section-heading">Active Machine Learning Architectures</h2>
            <p className="section-subtext">Three specialized models loaded directly into memory at backend startup.</p>
            <div className="models-list-grid">
              {dataInfo?.models_loaded?.map((modelName, idx) => (
                <div key={idx} className="model-info-pill">
                  <span className="model-dot" />
                  <span className="model-name-text">{modelName}</span>
                </div>
              ))}
            </div>
            <div className="split-dates-bar">
              <span><strong>Training Period:</strong> {dataInfo?.split_dates?.training_period}</span>
              <span className="split-sep">•</span>
              <span><strong>Holdout Testing Period:</strong> {dataInfo?.split_dates?.testing_holdout_period}</span>
            </div>
          </div>

          {/* Site Dataset Cards (Extents & Uploaded Row Tracking) */}
          <div className="section-card">
            <h2 className="section-heading">Monitored Plant Datasets & Telemetry Extents</h2>
            <p className="section-subtext">Historical baseline records and integrated local upload data per solar installation.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {dataInfo?.site_coverage?.map((s) => (
                <div key={s.id} className="telemetry-stat-card" style={{ padding: '1rem', border: '1px solid #E2DACB', borderRadius: '8px', background: '#FFFFFF' }}>
                  <span className="stat-label">{s.name}</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A3A', margin: '4px 0' }}>
                    {s.capacity_kWp} kWp Capacity
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4A5B6D' }}>
                    Total: <strong>{s.row_count?.toLocaleString()} rows</strong> ({s.start_date} to {s.end_date})
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #E2DACB', fontSize: '0.8rem', fontWeight: 600, color: s.uploaded_rows > 0 ? '#059669' : '#6B7A8A' }}>
                    {s.uploaded_rows > 0
                      ? `Uploaded: ${s.uploaded_rows.toLocaleString()} rows (${s.uploaded_range || `${s.uploaded_date_min || s.start_date} to ${s.uploaded_date_max || s.end_date}`})`
                      : 'No uploaded data'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart of Data Coverage per Site */}
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h2 className="chart-title">Telemetry Record Coverage per Site</h2>
                <p className="chart-caption">Distribution of logged 30-minute operational intervals across sites by calendar year.</p>
              </div>
            </div>
            <div className="chart-body" style={{ height: 300 }}>
              <StandardChartLegend
                items={[
                  { label: '2020 Telemetry', color: '#1B2A3A', type: 'bar' },
                  { label: '2021 Telemetry', color: '#4A5B6D', type: 'bar' },
                  { label: '2022 Telemetry', color: '#F2A413', type: 'bar' },
                ]}
              />
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={coverageData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 30, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2DACB" opacity={0.6} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#4A5B6D', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#D9D0C1' }}
                    label={{ value: 'Telemetry Readings (30-min intervals)', position: 'insideBottom', offset: -10, fill: '#1B2A3A', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#1B2A3A', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#D9D0C1' }}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FDFBF7', borderColor: '#E2DACB', borderRadius: 8 }}
                    formatter={(val, name, item) => [
                      `${Number(val).toLocaleString()} readings in ${name} (Active: ${item.payload.start_date} → ${item.payload.end_date})`,
                      `Year ${name}`,
                    ]}
                  />
                  <Bar dataKey="2020" name="2020 Telemetry" stackId="a" fill="#1B2A3A" isAnimationActive={false} />
                  <Bar dataKey="2021" name="2021 Telemetry" stackId="a" fill="#4A5B6D" isAnimationActive={false} />
                  <Bar dataKey="2022" name="2022 Telemetry" stackId="a" fill="#F2A413" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Empirical PR Cutoffs per Site Table (Part 6) */}
          <div className="section-card">
            <h2 className="section-heading">Empirical Performance Ratio (PR) Cutoffs & Grading Rules</h2>
            <p className="section-subtext">
              Cutoffs derived strictly from the unsoiled daytime training period (2020-01-01 to 2021-10-15) using Model A (lag-free physical baseline, PR = Actual / Expected).
            </p>
            <div className="table-responsive-wrapper">
              <table className="assumptions-table">
                <thead>
                  <tr>
                    <th>Monitored Site</th>
                    <th>25th %ile (p25)</th>
                    <th>Median (p50)</th>
                    <th>75th %ile (p75)</th>
                    <th>Bias Calibration Factor</th>
                    <th>Very Good Tier</th>
                    <th>Normal Tier</th>
                    <th>Bad / Alert Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dataInfo?.grade_cutoffs || {})
                    .filter(([k]) => k.startsWith('site-'))
                    .map(([siteKey, item]) => (
                      <tr key={siteKey}>
                        <td className="param-cell">
                          <strong>{item.siteId.toUpperCase()}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#6B7A8A' }}>
                            Campus {item.campusKey}, Site {item.siteKey}
                          </span>
                        </td>
                        <td className="value-cell">
                          <span className="val-badge" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                            {Number(item.p25).toFixed(3)}
                          </span>
                        </td>
                        <td className="value-cell">
                          <span className="val-badge">
                            {Number(item.p50).toFixed(3)}
                          </span>
                        </td>
                        <td className="value-cell">
                          <span className="val-badge" style={{ backgroundColor: '#E8F8F0', color: '#059669' }}>
                            {Number(item.p75).toFixed(3)}
                          </span>
                        </td>
                        <td className="value-cell">
                          <span className="val-badge" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>
                            {item.bias_factor != null ? Number(item.bias_factor).toFixed(3) : '1.000'}
                          </span>
                        </td>
                        <td className="cite-cell" style={{ fontSize: '0.8rem' }}>
                          PR &ge; {Number(item.p75).toFixed(2)}: Performing above usual level.
                        </td>
                        <td className="cite-cell" style={{ fontSize: '0.8rem' }}>
                          {Number(item.p25).toFixed(2)} &le; PR &lt; {Number(item.p75).toFixed(2)}: Performing as expected.
                        </td>
                        <td className="cite-cell" style={{ fontSize: '0.8rem' }}>
                          PR &lt; {Number(item.p25).toFixed(2)} or anomaly: Cleaning Review / Inspection.
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assumptions Table with Citations */}
          <div className="section-card">
            <h2 className="section-heading">Documented Engineering Assumptions & References</h2>
            <p className="section-subtext">All parameters used for calculations, baselines, and scenario evaluations.</p>
            <div className="table-responsive-wrapper">
              <table className="assumptions-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Adopted Value</th>
                    <th>Documented Source / Citation</th>
                  </tr>
                </thead>
                <tbody>
                  {dataInfo?.assumptions?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="param-cell"><strong>{item.parameter}</strong></td>
                      <td className="value-cell"><span className="val-badge">{item.value}</span></td>
                      <td className="cite-cell">{item.citation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transparent Physical Limitations List */}
          <div className="section-card limitations-card">
            <h2 className="section-heading">Model & Data Limitations</h2>
            <p className="section-subtext">Scientific boundaries and operational caveats for field deployment.</p>
            <ul className="limitations-list">
              {dataInfo?.limitations?.map((limitation, idx) => (
                <li key={idx} className="limitation-item">
                  <span className="limitation-bullet" aria-hidden="true">•</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Model Validation Link Section */}
          <div className="section-card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>Model Validation</h2>
              <p className="section-subtext" style={{ margin: '4px 0 0 0' }}>
                Backtest and performance metrics on 85,000+ historical records.
              </p>
            </div>
            <Link
              to="/validation"
              className="btn-primary"
              style={{
                textDecoration: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: '#1B2A3A',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>Open validation backtest</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Upload Readings CSV Section */}
          <div className="section-card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-heading">Upload Readings CSV</h2>
            <p className="section-subtext" style={{ margin: '4px 0 0 0' }}>
              Saved to local files in backend/data/uploads
            </p>
            <form onSubmit={handleCsvUpload} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5B6D', marginBottom: '4px' }}>Target Site</label>
                <select
                  value={uploadSite}
                  onChange={(e) => setUploadSite(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                >
                  <option value="site-1">Site 1 (Campus 2)</option>
                  <option value="site-2">Site 2 (Campus 2)</option>
                  <option value="site-3">Site 3 (Campus 2)</option>
                  <option value="site-4">Site 4 (Campus 1)</option>
                  <option value="site-5">Site 5 (Campus 3)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4A5B6D', marginBottom: '4px' }}>CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  required
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  style={{
                    padding: '7px 16px',
                    backgroundColor: '#1B2A3A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: uploadLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploadLoading ? 'Validating...' : 'Upload & Validate CSV'}
                </button>
              </div>
            </form>

            {uploadResult && (
              <div style={{ marginTop: '1rem', padding: '12px 16px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '0.85rem', color: '#065F46' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {uploadResult.accepted ?? 0} rows saved, {uploadResult.rejected ?? 0} rejected
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                  Accepted: <strong>{uploadResult.accepted ?? uploadResult.imported_rows ?? 0}</strong> rows • Rejected: <strong>{uploadResult.rejected ?? uploadResult.skipped_rows ?? 0}</strong> rows
                  {uploadResult.date_range?.min && (
                    <span> • Span: {uploadResult.date_range.min} to {uploadResult.date_range.max}</span>
                  )}
                </div>
                {uploadResult.row_errors?.length > 0 && (
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#9A3412' }}>
                      View {uploadResult.row_errors.length} rejected row errors
                    </summary>
                    <ul style={{ marginTop: '8px', maxHeight: '160px', overflowY: 'auto', paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#991B1B' }}>
                      {uploadResult.row_errors.map((err, i) => (
                        <li key={i} style={{ marginBottom: '3px' }}>
                          Row {err.row}: {err.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {uploadError && (
              <div style={{ marginTop: '1rem', padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '0.85rem', color: '#991B1B' }}>
                {uploadError}
              </div>
            )}

            {/* Uploaded Batches List with Delete Button & Test Data Tag */}
            {batches.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1B2A3A', marginBottom: '8px' }}>
                  Uploaded Telemetry Batches ({batches.length})
                </h3>
                <div className="table-responsive-wrapper">
                  <table className="assumptions-table">
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>Filename</th>
                        <th>Site</th>
                        <th>Uploaded At</th>
                        <th>Rows</th>
                        <th>Date Range</th>
                        <th>Type</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.batch_id}>
                          <td className="param-cell"><code style={{ fontSize: '0.75rem' }}>{b.batch_id}</code></td>
                          <td style={{ fontSize: '0.85rem' }}>{b.filename}</td>
                          <td><strong>{b.site?.toUpperCase()}</strong></td>
                          <td style={{ fontSize: '0.8rem' }}>{b.uploaded_at?.replace('T', ' ')}</td>
                          <td><span className="val-badge">{b.rows_ok}</span></td>
                          <td style={{ fontSize: '0.75rem' }}>{b.date_min} to {b.date_max}</td>
                          <td>
                            {b.is_synthetic ? (
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontSize: '0.75rem', fontWeight: 700 }}>
                                Test data
                              </span>
                            ) : (
                              <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', fontWeight: 600 }}>
                                Real telemetry
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(b.batch_id)}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
