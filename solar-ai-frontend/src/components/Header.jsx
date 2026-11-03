import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSolar } from '../context/SolarContext';

export default function Header() {
  const { isBackendConnected } = useSolar();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Check' },
    { to: '/forecast', label: 'Forecast' },
    { to: '/yield', label: 'Yield' },
    { to: '/planner', label: 'Planner' },
    { to: '/simulation', label: 'Simulation' },
    { to: '/insights', label: 'Insights' },
    { to: '/data', label: 'Data' },
  ];

  const connectionStatusText = isBackendConnected ? 'Backend connected' : 'Backend not connected';

  return (
    <header className="slim-top-bar" role="banner">
      <div className="slim-bar-inner">
        <div className="brand-group">
          <NavLink to="/" className="brand-link">
            <span
              className="brand-icon"
              style={{
                color: isBackendConnected ? '#10B981' : '#EF4444',
                transition: 'color 0.25s ease',
              }}
              title={connectionStatusText}
              aria-label={connectionStatusText}
            >
              ☀
            </span>
            <span className="brand-title">Solar AI</span>
          </NavLink>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Header Right Group: Mobile toggle */}
        <div className="header-right-group">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <nav className="mobile-nav" aria-label="Mobile Navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
