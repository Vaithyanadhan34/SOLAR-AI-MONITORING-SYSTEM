import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Health check: verify connectivity to the Flask backend.
 */
export const checkBackend = async () => {
  try {
    const response = await apiClient.get('/');
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

export default {
  checkBackend,
  fetchSites,
  fetchDatasetValues,
  getModelInfo,
  analyzeSolarData,
  analyzeBatch,
};
