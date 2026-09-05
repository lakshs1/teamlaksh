import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

let rawUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api/v1';

rawUrl = rawUrl.trim().replace(/\/+$/, '');
if (!rawUrl.endsWith('/api/v1')) {
  if (rawUrl.endsWith('/api')) {
    rawUrl = `${rawUrl}/v1`;
  } else {
    rawUrl = `${rawUrl}/api/v1`;
  }
}
const BASE_URL = rawUrl;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
});

/* ---------- Request Interceptor ---------- */
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

/* ---------- Response Interceptor ---------- */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      console.warn('⚠️ Network request timed out over remote tunnel:', err.config?.url);
      err.message = 'The server took longer than expected to respond over the database tunnel. Please retry.';
    }
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
