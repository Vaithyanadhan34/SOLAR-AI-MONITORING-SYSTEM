import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { analyzeBatch } from '../services/api';

export default function BatchAnalysis({ onBatchResult, isBackendConnected }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.name.endsWith('.csv')) {
        setFile(dropped);
        setErrorMessage(null);
      } else {
        setErrorMessage('Please upload a valid .csv file.');
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const downloadSampleCsv = () => {
    const sample = `Timestamp,SolarGeneration,kWp,Number of panels,AirTemperature,RelativeHumidity,WindSpeed
2021-06-15 10:00:00,5.5,25.0,100,27.0,55,3.0
2021-06-15 10:30:00,6.0,25.0,100,28.0,52,3.1
2021-06-15 11:00:00,6.5,25.0,100,29.0,50,3.2
2021-06-15 11:30:00,7.0,25.0,100,30.0,48,3.2
2021-06-15 12:00:00,7.5,25.0,100,31.0,45,3.0
2021-06-15 12:30:00,8.0,25.0,100,31.5,44,3.1
2021-06-15 13:00:00,8.5,25.0,100,32.0,42,3.2
2021-06-15 13:30:00,8.8,25.0,100,32.2,42,3.2
2021-06-15 14:00:00,8.2,25.0,100,31.8,45,3.0
2021-06-15 14:30:00,7.6,25.0,100,31.0,48,2.8
`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'solar_batch_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select or drag a CSV file first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await analyzeBatch(formData);
      if (data && data.success) {
        setBatchResult(data);
        if (onBatchResult) {
          onBatchResult(data);
        }
      } else {
        setErrorMessage(data?.error || 'Batch analysis failed.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error processing batch upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Batch Operational CSV Upload</h2>
        <p className="panel-subtitle">
          Upload multi-interval timeseries data to evaluate Performance Ratio (PR), anomaly timelines, and degradation trends.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="form">
        {/* Drag and Drop Box */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'var(--bg-subtle)',
            transition: 'border-color 0.15s ease',
            marginBottom: '0.75rem',
          }}
        >
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <UploadCloud size={32} style={{ color: 'var(--brand-primary)', margin: '0 auto 0.5rem' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {file ? file.name : 'Click to select or drag & drop CSV file'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Columns required: Timestamp, SolarGeneration (kWp, AirTemperature optional)
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              padding: '0.45rem 0.65rem',
            }}
          >
            <Download size={13} />
            <span>Download Sample CSV</span>
          </button>

          <button
            type="submit"
            className="submit-button"
            style={{ width: 'auto', padding: '0.45rem 1.25rem', margin: 0 }}
            disabled={!file || isUploading || !isBackendConnected}
          >
            {isUploading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RefreshCw size={13} className="spin" /> Processing...
              </span>
            ) : (
              'Run Batch Analysis'
            )}
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '0.65rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--status-danger-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-danger-text)',
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginBottom: '0.75rem',
            }}
          >
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>

      {/* Batch Results Summary Display */}
      {batchResult && batchResult.metrics && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-good-text)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={16} />
            <span>Batch Analysis Complete ({batchResult.processed_rows} intervals processed)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div className="metric-cell" style={{ padding: '0.6rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Daily Performance Ratio</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                {batchResult.metrics.performance_ratio?.toFixed(2)}
              </div>
            </div>

            <div className="metric-cell" style={{ padding: '0.6rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Generation</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {batchResult.metrics.total_actual_kwh?.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>kWh</span>
              </div>
            </div>

            <div className="metric-cell" style={{ padding: '0.6rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Lost Energy</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--status-warning-text)' }}>
                {batchResult.metrics.total_lost_kwh?.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>kWh</span>
              </div>
            </div>

            <div className="metric-cell" style={{ padding: '0.6rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avoided / Lost CO₂</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--status-good-text)' }}>
                {batchResult.metrics.total_lost_co2_kg?.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>kg</span>
              </div>
            </div>
          </div>

          {/* Trend & Anomaly Diagnosis */}
          <div style={{ padding: '0.65rem 0.8rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
              Trend Diagnosis: {batchResult.metrics.trend_diagnosis}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Rolling Loss Slope: <strong>{batchResult.metrics.rolling_loss_slope}</strong> • Anomalies Flagged: <strong>{batchResult.metrics.anomaly_count}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
