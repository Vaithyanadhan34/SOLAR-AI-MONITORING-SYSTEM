import React from 'react';
import { RotateCw } from 'lucide-react';

export default function SystemStatus({ isConnected, isChecking, onRetry }) {
  return (
    <div className="status-indicator">
      <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
      <span>{isConnected ? 'System Connected' : 'Backend Offline'}</span>
      {!isConnected && (
        <button
          onClick={onRetry}
          disabled={isChecking}
          title="Retry connection"
          style={{
            background: 'none',
            border: 'none',
            cursor: isChecking ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            marginLeft: '2px',
          }}
        >
          <RotateCw size={12} className={isChecking ? 'spinner-sm' : ''} />
        </button>
      )}
    </div>
  );
}
