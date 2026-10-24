import React from 'react';

export default function Header({ isConnected }) {
  return (
    <header className="app-header">
      <div className="header-content">
        <h1 className="app-title">Solar Panel Monitor</h1>
        <div className="status-dot-wrapper" aria-label={`System status: ${isConnected ? 'Connected' : 'Offline'}`}>
          <span className={`status-dot ${isConnected ? 'connected' : 'offline'}`} />
          <span>{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
