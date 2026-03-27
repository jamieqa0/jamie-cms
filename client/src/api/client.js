import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      try {
        const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        setTokens(res.data.accessToken, refreshToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return api(original);
      } catch {
        logout();
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
