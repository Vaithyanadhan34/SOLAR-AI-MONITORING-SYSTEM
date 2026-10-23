import React from 'react';
import SystemStatus from './SystemStatus';

export default function Header({ isConnected, isChecking, onRetry }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div>
          <h1 className="brand-title">Solar AI Monitoring System</h1>
          <p className="brand-subtitle">Solar performance and maintenance analysis</p>
        </div>

        <SystemStatus
          isConnected={isConnected}
          isChecking={isChecking}
          onRetry={onRetry}
        />
      </div>
    </header>
  );
}
