import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkBackend, fetchSites } from '../services/api';

const DEFAULT_SITE = {
  id: 'site-1',
  name: 'Site 1 (Campus 2)',
  campusKey: 2,
  siteKey: 1,
  capacity: '25.0',
  panels: '100',
  start_date: '2020-01-01',
  end_date: '2020-08-19',
  start_timestamp: '2020-01-01 08:15:00',
  end_timestamp: '2020-08-19 09:00:00',
};

const SolarContext = createContext(null);

export function getDefaultTimestampForSite(site) {
  if (!site) return '2020-08-18T12:00';
  const endDate = site.end_date || site.dateRange?.end || '2020-08-19';
  const endTs = site.end_timestamp || site.dateRange?.end_timestamp || '';

  if (endTs && (endTs.includes(' ') || endTs.includes('T'))) {
    const timePart = endTs.includes(' ') ? endTs.split(' ')[1] : endTs.split('T')[1];
    const hour = parseInt(timePart.slice(0, 2), 10);
    // If latest record is in the morning before midday (e.g. 09:00:00), pick midday from previous day
    if (!isNaN(hour) && hour < 12) {
      try {
        const d = new Date(endDate);
        d.setDate(d.getDate() - 1);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00`;
      } catch {
        return `${endDate}T12:00`;
      }
    }
  }
  return `${endDate}T12:00`;
}

export function SolarProvider({ children }) {
  // Requirement 1: One global mode kept in context and localStorage (default: 'historical')
  const [mode, setModeState] = useState(() => {
    try {
      const saved = localStorage.getItem('solar_mode');
      return saved === 'live' ? 'live' : 'historical';
    } catch {
      return 'historical';
    }
  });

  const setMode = (newMode) => {
    const m = newMode === 'live' ? 'live' : 'historical';
    setModeState(m);
    try {
      localStorage.setItem('solar_mode', m);
      window.dispatchEvent(new CustomEvent('solar-mode-changed', { detail: m }));
    } catch {}
  };

  const [selectedSite, setSelectedSite] = useState(DEFAULT_SITE);
  const [selectedTimestamp, setSelectedTimestamp] = useState(() => getDefaultTimestampForSite(DEFAULT_SITE));
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [sites, setSites] = useState([DEFAULT_SITE]);

  const verifyConnection = async () => {
    try {
      const res = await checkBackend();
      setIsBackendConnected(Boolean(res?.connected));
    } catch {
      setIsBackendConnected(false);
    }
  };

  useEffect(() => {
    verifyConnection();
    const interval = setInterval(verifyConnection, 20000);
    return () => clearInterval(interval);
  }, []);

  const [dataVersion, setDataVersion] = useState(0);

  const loadSites = async () => {
    try {
      const res = await fetchSites();
      if (res?.success && res.sites?.length) {
        setSites(res.sites);
        setSelectedSite((prev) => {
          const match = res.sites.find((x) => x.id === prev?.id);
          return match || res.sites[0];
        });
      }
    } catch {
      // Fallback
    }
  };

  const refreshSites = async () => {
    await loadSites();
    setDataVersion((v) => v + 1);
    try {
      window.dispatchEvent(new CustomEvent('solar-data-updated'));
    } catch {}
  };

  useEffect(() => {
    if (isBackendConnected) {
      loadSites();
    }
  }, [isBackendConnected]);

  const siteMinDate = selectedSite?.start_date || selectedSite?.dateRange?.start || '2020-01-01';
  const siteMaxDate = selectedSite?.end_date || selectedSite?.dateRange?.end || '2022-04-23';
  const siteMinTimestamp = (selectedSite?.start_timestamp || `${siteMinDate} 00:00:00`).replace(' ', 'T').slice(0, 16);
  const siteMaxTimestamp = (selectedSite?.end_timestamp || `${siteMaxDate} 23:59:00`).replace(' ', 'T').slice(0, 16);

  const updateSelectedSite = (siteOrId) => {
    let siteObj = typeof siteOrId === 'string' ? sites.find((s) => s.id === siteOrId) : siteOrId;
    if (!siteObj) return;
    setSelectedSite(siteObj);

    // Rule 3: Snap date into site's real range when site changes
    const sMin = siteObj.start_date || siteObj.dateRange?.start || '2020-01-01';
    const sMax = siteObj.end_date || siteObj.dateRange?.end || '2022-04-23';
    const curDate = (selectedTimestamp || '').slice(0, 10);
    if (!curDate || curDate < sMin || curDate > sMax) {
      setSelectedTimestamp(getDefaultTimestampForSite(siteObj));
    }
  };

  const dataSource = 'Historical data';

  return (
    <SolarContext.Provider
      value={{
        mode,
        setMode,
        dataSource,
        selectedSite,
        setSelectedSite: updateSelectedSite,
        selectedTimestamp,
        setSelectedTimestamp,
        analysisResult,
        setAnalysisResult,
        isBackendConnected,
        sites,
        siteMinDate,
        siteMaxDate,
        siteMinTimestamp,
        siteMaxTimestamp,
        getDefaultTimestampForSite,
        refreshSites,
        dataVersion,
      }}
    >
      {children}
    </SolarContext.Provider>
  );
}

export function useSolar() {
  const context = useContext(SolarContext);
  if (!context) {
    throw new Error('useSolar must be used within a SolarProvider');
  }
  return context;
}

export default SolarContext;
