import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

let csrfToken = null; // Store token in memory

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Skip CSRF for safe methods
  if (['get', 'head', 'options'].includes(config.method.toLowerCase())) {
    return config;
  }

  // Fetch CSRF token if not present
  if (!csrfToken) {
    try {
      // Use a separate axios instance or the same one but ensure we don't loop
      // Since this is a GET request, it won't recursively try to fetch CSRF token again due to the check above
      const response = await api.get('/csrf-token');
      csrfToken = response.data.csrfToken;
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
  }

  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

export const alertsAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  update: (id, data) => api.patch(`/alerts/${id}`, data),
  getStats: () => api.get('/alerts/stats')
};

export const documentsAPI = {
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  verify: (data) => api.post('/documents/verify', data)
};

export const casesAPI = {
  getAll: (params) => api.get('/cases', { params }),
  getById: (id) => api.get(`/cases/${id}`),
  create: (data) => api.post('/cases', data),
  addNote: (id, note) => api.post(`/cases/${id}/notes`, note)
};

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
  resendOtp: () => api.post('/auth/resend-otp')
};

export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data)
};

export const evaluationAPI = {
  getMetrics: (params) => api.get('/evaluation/metrics', { params }),
  getPerformance: (params) => api.get('/evaluation/performance', { params })
};

export const blockchainAPI = {
  getStatus: () => api.get('/blockchain/status'),
  verify: (txHash) => api.post('/blockchain/verify', { txHash }),
  getBlockNumber: () => api.get('/blockchain/block-number')
};

export const dataGovPhAPI = {
  scan: (data) => api.post('/datagovph/scan', data),
  search: (params) => api.get('/datagovph/search', { params })
};

export default api;