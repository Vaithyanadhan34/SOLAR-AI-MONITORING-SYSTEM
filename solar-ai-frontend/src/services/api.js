import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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

export default {
  checkBackend,
  getModelInfo,
  analyzeSolarData,
};
