// client/src/http/index.ts
import axios from 'axios';
import type { InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { AuthResponse } from '../models/response/AuthResponse';

// бэкенд (используется на серверной стороне / SSR)
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// В браузере используем относительный /api (через next rewrites), на сервере — полный URL
export const API_URL = typeof window !== 'undefined' ? '/api' : `${BACKEND_ORIGIN}/api`;
export const BACKEND_URL = BACKEND_ORIGIN;

type ReqConfig = InternalAxiosRequestConfig & { _isRetry?: boolean };

const $api = axios.create({
  withCredentials: true,
  baseURL: API_URL,
});

// Request interceptor — добавляем access token
$api.interceptors.request.use(
  (config: ReqConfig) => {
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers = config.headers || {};
          (config.headers as any).Authorization = `Bearer ${token}`;
        } else {
          if (config.headers && (config.headers as any).Authorization) {
            delete (config.headers as any).Authorization;
          }
        }
      }
    } catch (e) { /* ignore */ }
    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor — при 401 сперва пробуем cookie-refresh (relative /api/refresh),
// затем fallback — refreshToken из localStorage, отправлённый в заголовке.
$api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError | any) => {
    const status = error?.response?.status ?? null;
    const originalRequest = error?.config as ReqConfig | undefined;

    if (status === 401 && originalRequest && !originalRequest._isRetry) {
      originalRequest._isRetry = true;

      // 1) попытка cookie-refresh через относительный путь
      try {
        if (typeof window !== 'undefined') {
          const cookieRefresh = await axios.get<AuthResponse>('/api/refresh', { withCredentials: true });
          const newToken = cookieRefresh?.data?.accessToken;
          const newRefresh = cookieRefresh?.data?.refreshToken;

          if (newToken) {
            try { localStorage.setItem('token', newToken); } catch {}
            $api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            originalRequest.headers = originalRequest.headers || {};
            (originalRequest.headers as any).Authorization = `Bearer ${newToken}`;
          }
          if (newRefresh) {
            try { localStorage.setItem('refreshToken', newRefresh); } catch {}
          }

          return $api.request(originalRequest);
        } else {
          // SSR: обращаемся напрямую к бэкенду
          const cookieRefresh = await axios.get<AuthResponse>(`${BACKEND_ORIGIN}/api/refresh`, { withCredentials: true });
          const newToken = cookieRefresh?.data?.accessToken;
          if (newToken) {
            originalRequest.headers = originalRequest.headers || {};
            (originalRequest.headers as any).Authorization = `Bearer ${newToken}`;
          }
          return $api.request(originalRequest);
        }
      } catch (cookieErr) {
        // cookie-refresh не удался — идём к fallback
      }

      // 2) fallback: refreshToken из localStorage (отправляем в заголовке)
      try {
        if (typeof window !== 'undefined') {
          const storedRefresh = localStorage.getItem('refreshToken');
          if (storedRefresh) {
            const headerRefresh = await axios.get<AuthResponse>('/api/refresh', {
              withCredentials: true,
              headers: { Authorization: `Bearer ${storedRefresh}` },
            });

            const newToken2 = headerRefresh?.data?.accessToken;
            const newRefresh2 = headerRefresh?.data?.refreshToken;

            if (newToken2) {
              try { localStorage.setItem('token', newToken2); } catch {}
              $api.defaults.headers.common['Authorization'] = `Bearer ${newToken2}`;
              originalRequest.headers = originalRequest.headers || {};
              (originalRequest.headers as any).Authorization = `Bearer ${newToken2}`;
            }
            if (newRefresh2) {
              try { localStorage.setItem('refreshToken', newRefresh2); } catch {}
            }

            return $api.request(originalRequest);
          }
        } else {
          // SSR fallback
          const storedRefresh = process.env.SERVER_REFRESH_TOKEN || null;
          if (storedRefresh) {
            const headerRefresh = await axios.get<AuthResponse>(`${BACKEND_ORIGIN}/api/refresh`, {
              withCredentials: true,
              headers: { Authorization: `Bearer ${storedRefresh}` },
            });
            const newToken2 = headerRefresh?.data?.accessToken;
            if (newToken2) {
              originalRequest.headers = originalRequest.headers || {};
              (originalRequest.headers as any).Authorization = `Bearer ${newToken2}`;
              return $api.request(originalRequest);
            }
          }
        }
      } catch (hdrErr) {
        // ничего — будем чистить токены ниже
      }

      // 3) если не удалось обновить — очищаем локальные токены
      try { localStorage.removeItem('token'); } catch {}
      try { localStorage.removeItem('refreshToken'); } catch {}
      try { delete $api.defaults.headers.common['Authorization']; } catch {}
    }

    return Promise.reject(error);
  }
);

export default $api;
