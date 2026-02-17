import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});



api.interceptors.request.use(async (config) => {
  // Safe methods don't need CSRF headers (and we use strict cookies anyway)
  // We can keep this interceptor minimal or remove it if no other logic exists.
  // For now, minimizing it.
  return config;
}, (error) => {
  return Promise.reject(error);
});

// ==========================================
// Response interceptor: handle onboarding redirects
// ==========================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired or invalid
      // Optional: Store current path for redirect after login
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }

    if (error.response?.status === 403 && error.response?.data?.onboardingRequired) {
      // Redirect to onboarding
      const { mustChangePassword, mustSetup2FA } = error.response.data;
      if (mustChangePassword) {
        window.location.href = '/force-change-password';
      } else if (mustSetup2FA) {
        window.location.href = '/setup-2fa';
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// AUTH API
// ==========================================
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
  resendOtp: () => api.post('/auth/resend-otp'),
  resendLoginOtp: (data) => api.post('/auth/resend-login-otp', data),
  verifyLoginOtp: (data) => api.post('/auth/verify-login-otp', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),

  // 2FA
  setup2FA: () => api.post('/auth/2fa/setup'),
  verifySetup2FA: (data) => api.post('/auth/2fa/verify-setup', data),
  disable2FA: (data) => api.post('/auth/2fa/disable', data),

  // Onboarding
  forceChangePassword: (data) => api.post('/auth/force-change-password', data),

  // Forgot / Reset Password
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),

  // Email Change
  requestEmailChange: (data) => api.post('/auth/email-change/request', data),
  confirmEmailChange: (data) => api.post('/auth/email-change/confirm', data),

  // Profile & Password (existing)
  sendProfileOtp: () => api.post('/auth/send-profile-otp'),
  updateProfile: (data) => api.put('/auth/update-profile', data),
  sendPasswordOtp: () => api.post('/auth/send-password-otp'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

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