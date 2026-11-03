import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically append ?mode=historical|live to every outbound API request
apiClient.interceptors.request.use((config) => {
  let currentMode = 'historical';
  try {
    currentMode = localStorage.getItem('solar_mode') || 'historical';
  } catch {}
  config.params = { ...config.params, mode: currentMode };
  return config;
});

/**
 * Health check: verify connectivity to the Flask backend.
 */
export const checkBackend = async () => {
  try {
    const response = await apiClient.get('/', { timeout: 3000 });
    return {
      connected: response.status === 200 && response.data?.status === 'running',
      data: response.data,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message || 'Unable to connect to Flask backend',
    };
  }
};

/**
 * Fetch monitored sites with capacities and date ranges.
 */
export const fetchSites = async () => {
  try {
    const response = await apiClient.get('/api/sites');
    return response.data;
  } catch (error) {
    console.warn('Failed to load sites from backend, using defaults:', error);
    return { success: false, sites: [] };
  }
};

/**
 * Auto-fill weather and generation from dataset history.
 */
export const fetchDatasetValues = async (campusKey, siteKey, timestamp) => {
  try {
    const response = await apiClient.get('/api/dataset-values', {
      params: { campusKey, siteKey, timestamp },
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.error || error.message || 'No historical dataset values found for this time';
    throw new Error(message);
  }
};

/**
 * Fetch trained model metadata and feature definitions.
 */
export const getModelInfo = async () => {
  try {
    const response = await apiClient.get('/api/model-info');
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.error ||
      error.message ||
      'Failed to load model information'
    );
  }
};

/**
 * Submit solar operational data for energy prediction, anomaly detection,
 * loss calculation, and maintenance intelligence.
 * (Only current data is submitted; previous data and lags are automatically retrieved by backend)
 */
export const analyzeSolarData = async (payload) => {
  try {
    const response = await apiClient.post('/api/analyze', payload);
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Failed to analyze solar performance data';
    throw new Error(message);
  }
};

/**
 * Submit CSV file for batch operational analysis.
 */
export const analyzeBatch = async (formData) => {
  try {
    const response = await apiClient.post('/api/analyze-batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Batch CSV analysis failed';
    throw new Error(message);
  }
};

/**
 * Fetch 24-hour step forecast.
 */
export const fetchForecast = async (payload) => {
  try {
    let currentMode = 'historical';
    try {
      currentMode = localStorage.getItem('solar_mode') || 'historical';
    } catch {}
    const body = { mode: currentMode, ...payload };
    const response = await apiClient.post('/api/forecast', body);
    return response.data;
  } catch (error) {
    const errData = error.response?.data;
    const message = errData?.message || errData?.error || error.message || 'Forecast generation failed';
    throw new Error(message);
  }
};

/**
 * Save a single real 2026 reading into SQLite.
 */
export const saveLiveReading = async (readingData) => {
  try {
    const response = await apiClient.post('/api/live/readings', readingData);
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to save live reading');
  }
};

/**
 * Fetch saved 2026 readings from SQLite.
 */
export const fetchLiveReadings = async (site = 'site-1', start = null, end = null) => {
  try {
    const params = { site };
    if (start) params.start = start;
    if (end) params.end = end;
    const response = await apiClient.get('/api/live/readings', { params });
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to fetch live readings');
  }
};

/**
 * Upload a CSV of readings with row-level validation.
 */
export const uploadLiveCsv = async (formData) => {
  try {
    const response = await apiClient.post('/api/live/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to upload readings CSV');
  }
};

/**
 * Fetch uploaded telemetry batches.
 */
export const fetchBatches = async () => {
  try {
    const response = await apiClient.get('/api/live/batches');
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to fetch uploaded batches');
  }
};

/**
 * Delete an uploaded telemetry batch by ID.
 */
export const deleteBatch = async (batchId) => {
  try {
    const response = await apiClient.delete(`/api/live/batches/${batchId}`);
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to delete batch');
  }
};

/**
 * Fetch real recent weather history in 2026 from Open-Meteo archive.
 */
export const fetchLiveWeatherHistory = async (site = 'site-1', days = 7) => {
  try {
    const response = await apiClient.get('/api/live/weather-history', { params: { site, days } });
    return response.data;
  } catch (error) {
    throw formatError(error, 'Live weather history unavailable');
  }
};

/**
 * Fetch 2026 data collection stats per site.
 */
export const fetchLiveStats = async () => {
  try {
    const response = await apiClient.get('/api/live/stats');
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to fetch live collection stats');
  }
};

/**
 * Fetch 2026 out-of-time evaluation readiness (14 days progress).
 */
export const fetchEvaluationStatus = async (site = 'site-1') => {
  try {
    const response = await apiClient.get('/api/live/evaluate-status', { params: { site } });
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to fetch evaluation status');
  }
};

/**
 * Fetch historical 2020-2022 backtest data (Model Validation page ONLY).
 */
export const fetchValidationData = async (site = 'site-1') => {
  try {
    const response = await apiClient.get('/api/validation', { params: { site } });
    return response.data;
  } catch (error) {
    throw formatError(error, 'Failed to fetch validation backtest');
  }
};

/**
 * Formats API errors into clean, friendly messages without raw HTTP status prefixes.
 * Preserves technical status and details for collapsible UI elements.
 */
const formatError = (error, defaultMsg) => {
  const status = error.response?.status;
  const resData = error.response?.data;
  const msg = resData?.reason || resData?.error || resData?.message || (error.message && !error.message.includes('[HTTP') ? error.message : defaultMsg);
  const err = new Error(msg);
  err.status = status;
  err.details = status ? `HTTP ${status}: ${msg}` : (error.message || null);
  err.no_data = resData?.status === 'no_data';
  err.available_range = resData?.available_range || null;
  err.suggestions = Array.isArray(resData?.suggestions) ? resData.suggestions : [];
  err.rawError = error;
  return err;
};

/**
 * Fetch operational history (actual vs expected over specified hours).
 */
export const fetchHistory = async (site, end, hours = 48) => {
  try {
    const response = await apiClient.get('/api/history', {
      params: { site, end, hours },
    });
    const res = response.data || {};
    const historyList = Array.isArray(res.history) ? res.history : (Array.isArray(res.readings) ? res.readings : []);
    return {
      ...res,
      history: historyList,
      readings: historyList,
      no_data: res.status === 'no_data' || historyList.length === 0,
    };
  } catch (error) {
    throw formatError(error, 'No operational history available');
  }
};

/**
 * Fetch 7-day daily operational summary (actual_kWh, expected_kWh, lost_kWh, performance_ratio).
 */
export const fetchDailySummary = async (site, end, days = 7) => {
  try {
    const response = await apiClient.get('/api/daily-summary', {
      params: { site, end, days },
    });
    const res = response.data || {};
    const dailyList = Array.isArray(res.daily) ? res.daily : (Array.isArray(res.days) ? res.days : []);
    return {
      ...res,
      daily: dailyList,
      days: dailyList,
      days_count: typeof res.days === 'number' ? res.days : (res.days_count || dailyList.length),
      no_data: res.status === 'no_data' || dailyList.length === 0,
    };
  } catch (error) {
    throw formatError(error, 'No daily operational summary available');
  }
};
 
/**
 * Fetch water-aware economic cleaning decision.
 */
export const fetchCleaningDecision = async (payload, options = {}) => {
  try {
    const response = await apiClient.post('/api/cleaning-decision', payload, {
      signal: options.signal,
    });
    const res = response.data || {};
    const timeseries = Array.isArray(res.timeseries) ? res.timeseries : [];
    return {
      ...res,
      timeseries,
      no_data: res.status === 'no_data',
    };
  } catch (error) {
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      const cancelErr = new Error('Request canceled');
      cancelErr.isCanceled = true;
      throw cancelErr;
    }
    throw formatError(error, 'Cleaning decision evaluation unavailable');
  }
};

/**
 * Fetch policy comparison simulation (Fixed 14-day schedule vs Condition-based rule).
 */
export const fetchPolicyComparison = async (site = 'site-1') => {
  try {
    const response = await apiClient.get('/api/policy-comparison', {
      params: { site },
    });
    const res = response.data || {};
    const tsList = Array.isArray(res.timeseries) ? res.timeseries : (Array.isArray(res.daily_timeseries) ? res.daily_timeseries : []);
    const smartPolicy = res.smart_policy || res.condition_based_policy || null;
    const waterSaved = res.water_saved_scenario_L ?? res.comparison?.water_saved_scenario_L ?? 0;
    return {
      ...res,
      smart_policy: smartPolicy,
      condition_based_policy: smartPolicy,
      timeseries: tsList,
      daily_timeseries: tsList,
      water_saved_scenario_L: waterSaved,
    };
  } catch (error) {
    throw formatError(error, 'Failed to fetch policy comparison');
  }
};

/**
 * Fetch daily performance ratio trend with rolling slope and cause hints.
 */
export const fetchTrend = async (site = 'site-1', days = 30, end = null) => {
  try {
    const params = { site, days };
    if (end) params.end = end;
    const response = await apiClient.get('/api/trend', { params });
    const res = response.data || {};
    const trendList = Array.isArray(res.trend_series) ? res.trend_series : (Array.isArray(res.trend) ? res.trend : []);
    return {
      ...res,
      trend_series: trendList,
      trend: trendList,
    };
  } catch (error) {
    throw formatError(error, 'Failed to load performance ratio trend');
  }
};

/**
 * Fetch fleet-wide health scores and site ranking.
 */
export const fetchSiteRanking = async () => {
  try {
    const response = await apiClient.get('/api/site-ranking');
    const res = response.data || {};
    const rankingList = Array.isArray(res.rankings) ? res.rankings : [];
    return {
      ...res,
      rankings: rankingList,
    };
  } catch (error) {
    throw formatError(error, 'Failed to load site rankings');
  }
};

/**
 * Fetch typical-day percentile bands (median, 25th, 75th percentiles) for times of day.
 */
export const fetchHistoryBands = async (site = 'site-1', end = null, hours = 24) => {
  try {
    const params = { site, hours };
    if (end) params.end = end;
    const response = await apiClient.get('/api/history-bands', { params });
    const res = response.data || {};
    const bandsList = Array.isArray(res.bands) ? res.bands.map((b) => ({
      ...b,
      time: b.time || b.time_of_day || '',
      time_of_day: b.time_of_day || b.time || '',
    })) : [];
    return {
      ...res,
      bands: bandsList,
    };
  } catch (error) {
    throw formatError(error, 'Failed to fetch historical bands');
  }
};

/**
 * Fetch dataset transparency metadata, model definitions, assumptions, and limitations.
 */
export const fetchDataInfo = async () => {
  try {
    const response = await apiClient.get('/api/data-info');
    const res = response.data || {};
    return {
      ...res,
      site_coverage: Array.isArray(res.site_coverage) ? res.site_coverage : [],
      assumptions: Array.isArray(res.assumptions) ? res.assumptions : [],
      limitations: Array.isArray(res.limitations) ? res.limitations : [],
    };
  } catch (error) {
    throw formatError(error, 'Failed to load dataset transparency info');
  }
};

/**
 * Fetch dynamic what-if policy simulation (fixed schedule vs condition-based rule).
 */
export const fetchSimulate = async (payload, options = {}) => {
  try {
    const response = await apiClient.post('/api/simulate', payload, {
      signal: options.signal,
    });
    const res = response.data || {};
    const timeseries = Array.isArray(res.timeseries)
      ? res.timeseries
      : (Array.isArray(res.daily_timeseries) ? res.daily_timeseries : []);
    return {
      ...res,
      timeseries,
      daily_timeseries: timeseries,
      smart_policy: res.smart_policy || res.condition_based_policy || {},
      water_saved_scenario_L: res.water_saved_scenario_L ?? res.comparison?.water_saved_scenario_L ?? 0,
    };
  } catch (error) {
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      const cancelErr = new Error('Request canceled');
      cancelErr.isCanceled = true;
      throw cancelErr;
    }
    throw formatError(error, 'Simulation run failed');
  }
};

/**
 * Fetch solar yield estimate, typical-day curve, and monthly generation breakdown.
 */
export const fetchYieldEstimate = async (payload) => {
  try {
    const response = await apiClient.post('/api/yield-estimate', payload);
    const res = response.data || {};
    return {
      ...res,
      typical_day_curve: Array.isArray(res.typical_day_curve) ? res.typical_day_curve : [],
      monthly_projections: Array.isArray(res.monthly_projections) ? res.monthly_projections : [],
      fleet_comparison: Array.isArray(res.fleet_comparison) ? res.fleet_comparison : [],
    };
  } catch (error) {
    throw formatError(error, 'Failed to calculate yield estimate');
  }
};

/**
 * Fetch anomaly timeline events for Predict page.
 */
export const fetchAnomalies = async (site = 'site-1', end = null, days = 14) => {
  try {
    const params = { site, days };
    if (end) params.end = end;
    const response = await apiClient.get('/api/anomalies', { params });
    const res = response.data || {};
    return {
      ...res,
      anomalies: Array.isArray(res.anomalies) ? res.anomalies : [],
    };
  } catch (error) {
    throw formatError(error, 'Failed to fetch anomaly timeline');
  }
};

export default {
  checkBackend,
  fetchSites,
  fetchDatasetValues,
  getModelInfo,
  analyzeSolarData,
  analyzeBatch,
  fetchForecast,
  fetchHistory,
  fetchDailySummary,
  fetchCleaningDecision,
  fetchPolicyComparison,
  fetchSimulate,
  fetchYieldEstimate,
  fetchAnomalies,
  fetchTrend,
  fetchSiteRanking,
  fetchHistoryBands,
  fetchDataInfo,
};



