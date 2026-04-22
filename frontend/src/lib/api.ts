import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const stored = sessionStorage.getItem('auth-store');
  const token = stored ? JSON.parse(stored)?.state?.accessToken : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const stored = sessionStorage.getItem('auth-store');
      const refresh = stored ? JSON.parse(stored)?.state?.refreshToken : null;
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh });
          // Update the token in sessionStorage and retry
          const current = JSON.parse(sessionStorage.getItem('auth-store') ?? '{}');
          current.state.accessToken = data.accessToken;
          sessionStorage.setItem('auth-store', JSON.stringify(current));
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(originalRequest);
        } catch {
          sessionStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
