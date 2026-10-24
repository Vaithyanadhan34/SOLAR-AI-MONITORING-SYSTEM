import React, { useState, useRef } from 'react';
import { analyzeBatch } from '../services/api';

export default function BatchAnalysis({ onBatchResult, isBackendConnected, onClose }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.name.toLowerCase().endsWith('.csv')) {
        setFile(dropped);
        setErrorMessage(null);
      } else {
        setErrorMessage('Please upload a file ending with .csv');
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
    link.setAttribute('download', 'solar_readings_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please choose a CSV file first.');
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
        setErrorMessage(data?.error || 'Unable to process CSV file. Please check column headers.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error processing CSV file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
        If you have readings recorded over several hours, upload your CSV file to check them together and view the timeline chart.
      </p>

      <form onSubmit={handleSubmit}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.75rem 1rem',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: 'var(--bg-subtle)',
            marginBottom: '1rem',
          }}
        >
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {file ? file.name : 'Click to choose a CSV file, or drag and drop it here'}
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Columns expected: Timestamp, SolarGeneration, AirTemperature, RelativeHumidity, WindSpeed
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={downloadSampleCsv}
            className="btn-fill-example"
            style={{ margin: 0 }}
          >
            Download sample CSV
          </button>

          <button
            type="submit"
            className="btn-primary-check"
            style={{ width: 'auto', padding: '0.65rem 1.25rem', fontSize: '0.95rem' }}
            disabled={!file || isUploading || !isBackendConnected}
          >
            {isUploading ? 'Checking readings...' : 'Check readings'}
          </button>
        </div>

        {errorMessage && (
          <div className="error-banner" style={{ marginBottom: '1rem' }} role="alert">
            {errorMessage}
          </div>
        )}
      </form>

      {batchResult && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Batch Check Complete: {batchResult.processed_rows} readings processed
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total power recorded</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {batchResult.metrics?.total_actual_kwh?.toFixed(1) || '0.0'} kWh
              </div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated energy lost</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--amber-700)' }}>
                {batchResult.metrics?.total_lost_kwh?.toFixed(1) || '0.0'} kWh
              </div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unusual readings</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {batchResult.metrics?.anomaly_count || 0}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-fill-example"
              style={{ margin: 0 }}
            >
              Close and view timeline chart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
