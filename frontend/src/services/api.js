import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ==========================================
// CSRF Token Management (Double-Submit Cookie)
// ==========================================
const SAFE_METHODS = new Set(['get', 'head', 'options']);
let csrfToken = null;

const fetchCsrfToken = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/auth/csrf-token`, { withCredentials: true });
    csrfToken = res.data.csrfToken;
  } catch (e) {
    console.warn('[CSRF] Failed to fetch token:', e.message);
  }
};

// Fetch CSRF token eagerly on page load
fetchCsrfToken();

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!SAFE_METHODS.has(method)) {
    // Fetch token if we don't have one yet
    if (!csrfToken) await fetchCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});


// ==========================================
// Response interceptor: handle onboarding redirects + CSRF refresh
// ==========================================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Auto-refresh CSRF token on 403 CSRF errors and retry once
    if (
      error.response?.status === 403 &&
      error.response?.data?.error?.toLowerCase().includes('csrf') &&
      !originalRequest._csrfRetried
    ) {
      originalRequest._csrfRetried = true;
      csrfToken = null; // clear stale token
      await fetchCsrfToken();
      if (csrfToken) {
        originalRequest.headers['X-CSRF-Token'] = csrfToken;
      }
      return api(originalRequest); // retry
    }

    if (error.response?.status === 401) {
      const isAuthPath = [
        '/',
        '/welcome',
        '/login',
        '/register',
        '/email-verify',
        '/force-change-password',
        '/setup-2fa',
        '/reset-password'
      ].includes(window.location.pathname);

      if (!isAuthPath) {
        window.location.href = '/login';
      }
    }

    if (error.response?.status === 403 && error.response?.data?.onboardingRequired) {
      const { mustChangePassword, mustSetup2FA, pendingApproval, scope } = error.response.data;
      if (pendingApproval) {
        window.location.href = '/pending-approval';
      } else if (mustChangePassword) {
        window.location.href = '/force-change-password';
      } else if (mustSetup2FA) {
        window.location.href = '/setup-2fa';
      } else if (scope) {
        // If they have a scoped token but no specific onboarding flag, force logout
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
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
  verifyMfa: (data) => api.post('/auth/verify-mfa', data),
  logout: async () => {
    try {
      // Call backend to invalidate token
      const response = await api.post('/auth/logout');
      console.log('[Logout API] Backend logout successful');

      // Clear CSRF token cache on frontend
      csrfToken = null;

      // Clear auth cookie as backup (backend should handle with Set-Cookie)
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      document.cookie = 'token=; path=/; domain=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';

      console.log('[Logout API] Frontend cleanup complete');
      return response;
    } catch (err) {
      console.error('[Logout API Error]', err.message);
      // Still clear local CSRF and cookie even if request fails
      csrfToken = null;
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      document.cookie = 'token=; path=/; domain=; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
      // Don't throw - proceed with logout anyway
      return { success: true };
    }
  },
  getProfile: () => api.get('/auth/profile'),

  // 2FA
  setup2FA: () => api.post('/auth/2fa/setup', {}, { withCredentials: true }).catch(err => {
    throw err;
  }),
  verifySetup2FA: (data) => api.post('/auth/2fa/verify-setup', data, { withCredentials: true }),
  restartSetup2FA: () => api.post('/auth/2fa/restart-setup', {}, { withCredentials: true }),
  disable2FA: (data) => api.post('/auth/2fa/disable', data, { withCredentials: true }),

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

  // Profile picture
  uploadProfilePicture: (formData, onUploadProgress) => api.put('/auth/profile-picture', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress
  }),
  deleteProfilePicture: () => api.delete('/auth/profile-picture'),

  // Recovery Codes
  getRecoveryCodeCount: () => api.get('/auth/2fa/recovery-codes/count'),
  regenerateRecoveryCodes: (data) => api.post('/auth/2fa/recovery-codes/regenerate', data),
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
  create: (data) => api.post('/transactions', data),
  batchCreate: (transactions) => api.post('/transactions/batch', { transactions }),
  getBudgetSummary: (params) => api.get('/transactions/budget-summary', { params }),
  archive: (id) => api.put(`/transactions/${id}/archive`),
  unarchive: (id) => api.put(`/transactions/${id}/unarchive`),
  batchAction: (ids, action, data = {}) => api.put('/transactions/batch-action', { ids, action, ...data })
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

export const feedbacksAPI = {
  getAll: (params) => api.get('/feedbacks', { params }),
  getAkismetStatus: () => api.get('/feedbacks/akismet-status'),
  cleanupSpam: (data) => api.post('/feedbacks/cleanup-spam', data),
  create: (data) => api.post('/feedbacks', data),
  update: (id, data) => api.put(`/feedbacks/${id}`, data),
  delete: (id) => api.delete(`/feedbacks/${id}`),
  approveAction: (id) => api.put(`/feedbacks/${id}/approve`),
  rejectAction: (id) => api.put(`/feedbacks/${id}/reject`),
  addReply: (id, data) => api.post(`/feedbacks/${id}/replies`, data),
  updateReply: (id, replyId, data) => api.put(`/feedbacks/${id}/replies/${replyId}`, data),
  deleteReply: (id, replyId) => api.delete(`/feedbacks/${id}/replies/${replyId}`),
  approveReplyAction: (id, replyId) => api.put(`/feedbacks/${id}/replies/${replyId}/approve`),
  rejectReplyAction: (id, replyId) => api.put(`/feedbacks/${id}/replies/${replyId}/reject`)
};

export default api;

export const budgetProposalsAPI = {
  editReview: (id, data) => api.patch(`/budget-proposals/${id}/review`, data),
  access: () => api.get('/budget-proposals/access'),
  list: params => api.get('/budget-proposals', { params }),
  get: id => api.get(`/budget-proposals/${id}`),
  create: data => api.post('/budget-proposals', data),
  save: (id, data) => api.patch(`/budget-proposals/${id}`, data),
  action: (id, action, data) => api.post(`/budget-proposals/${id}/${action}`, data),
  upload: (id, files, revision) => {
    const data = new FormData(); data.append('revision', revision);
    files.forEach(file => data.append('documents', file));
    return api.post(`/budget-proposals/${id}/documents`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  remove: (id, fileId, revision) => api.delete(`/budget-proposals/${id}/documents/${fileId}`, { data: { revision } }),
  download: (id, fileId) => api.get(`/budget-proposals/${id}/documents/${fileId}`, { responseType: 'blob' }),
  assign: (id, data) => api.put(`/budget-proposals/assignments/${id}`, data)
};

export const expendituresAPI = {
  previewEvidence: (id, expenseId, fileId, signal) => api.get(`/approved-budgets/${id}/expenditures/${expenseId}/evidence/${fileId}`, { params: { preview: 'true' }, responseType: 'blob', signal }),
  template: () => api.get('/transactions/template', { responseType: 'blob' }),
  previewCsv: (id, data) => api.post(`/approved-budgets/${id}/expenditures/preview-csv`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importCsv: (id, data, onUploadProgress) => api.post(`/approved-budgets/${id}/expenditures/import-csv`, data, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress }),
  access: () => api.get('/approved-budgets/access'),
  list: () => api.get('/approved-budgets'),
  get: id => api.get(`/approved-budgets/${id}`),
  submit: (id, data, onUploadProgress) => api.post(`/approved-budgets/${id}/expenditures`, data, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress }),
  uploadAuditEvidence: (id, expenseId, data) => api.post(`/approved-budgets/${id}/expenditures/${expenseId}/audit-evidence`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadAuditEvidence: (id, expenseId, fileId) => api.get(`/approved-budgets/${id}/expenditures/${expenseId}/audit-evidence/${fileId}`, { responseType: 'blob' }),
  correct: (id, expenseId, data) => api.post(`/approved-budgets/${id}/expenditures/${expenseId}/evidence`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  review: (id, expenseId, data) => api.post(`/approved-budgets/${id}/expenditures/${expenseId}/review`, data),
  download: (id, expenseId, fileId) => api.get(`/approved-budgets/${id}/expenditures/${expenseId}/evidence/${fileId}`, { responseType: 'blob' })
};

export const reportsAPI = {
  access: signal => api.get('/reports/access', { signal }),
  options: (params, signal) => api.get('/reports/options', { params, signal }),
  preview: (filters, signal) => api.post('/reports/preview', filters, { signal })
};
