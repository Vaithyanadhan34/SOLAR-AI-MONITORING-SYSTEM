import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SolarProvider } from './context/SolarContext';
import Header from './components/Header';
import CheckPage from './pages/CheckPage';
import ForecastPage from './pages/ForecastPage';
import YieldCalculatorPage from './pages/YieldCalculatorPage';
import CleaningPlannerPage from './pages/CleaningPlannerPage';
import SimulationPage from './pages/SimulationPage';
import InsightsPage from './pages/InsightsPage';
import DataAssumptionsPage from './pages/DataAssumptionsPage';
import ValidationPage from './pages/ValidationPage';

export default function App() {
  return (
    <BrowserRouter>
      <SolarProvider>
        <div className="solar-app-shell">
          {/* Slim Top Navigation Bar */}
          <Header />

          {/* Main Application Routes */}
          <main className="app-main-content" role="main">
            <Routes>
              {/* Check (/) - Enter current readings and get operational status */}
              <Route path="/" element={<CheckPage />} />

              {/* Forecast (/forecast) - 6h / 24h / 7-day forecast with uncertainty bands */}
              <Route path="/forecast" element={<ForecastPage />} />
              <Route path="/predict" element={<Navigate to="/forecast" replace />} />

              {/* Solar Yield Calculator (/yield) - Daily & monthly solar energy estimates (kWh) */}
              <Route path="/yield" element={<YieldCalculatorPage />} />

              {/* Cleaning Planner (/planner) - Water-aware maintenance decisions & crossover chart */}
              <Route path="/planner" element={<CleaningPlannerPage />} />

              {/* Simulation (/simulation) - Replay fixed schedule vs condition-based rule */}
              <Route path="/simulation" element={<SimulationPage />} />

              {/* Operational Insights (/insights) - Operational performance ratio, 48h curve & fleet health */}
              <Route path="/insights" element={<InsightsPage />} />

              {/* Model Validation (/validation) - ONLY page displaying 2020-2022 historical backtest */}
              <Route path="/validation" element={<ValidationPage />} />

              {/* Data & Assumptions (/data) - Telemetry provenance, multi-year coverage & citations */}
              <Route path="/data" element={<DataAssumptionsPage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Minimal Footnote */}
          <footer className="slim-app-footer" role="contentinfo">
            <div className="footer-inner">
              <span className="footer-brand">Solar AI Monitoring System</span>
              <span className="footer-dot">•</span>
              <span className="footer-note">Forecast solar generation, detect anomalies, and recommend water-aware maintenance</span>
            </div>
          </footer>
        </div>
      </SolarProvider>
    </BrowserRouter>
  );
}
