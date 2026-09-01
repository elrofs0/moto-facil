import axios from 'axios';

// Ponto único de acesso à API no frontend — todo componente consome a
// partir daqui, nunca chamando axios diretamente, para manter a base URL
// e o token de autenticação centralizados.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('motofacil_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  login: (email, password) => api.post('/admin/login', { email, password }),
};

export const rides = {
  active: () => api.get('/rides/active'),
  all: (params) => api.get('/rides', { params }),
  complete: (id) => api.post(`/rides/${id}/concluir`),
};

export const drivers = {
  list: (status) => api.get('/drivers', { params: status ? { status } : {} }),
  approve: (id) => api.post(`/drivers/${id}/aprovar`),
  updateStatus: (id, status) => api.patch(`/drivers/${id}/status`, { status }),
  adjustWallet: (id, amount, reason) => api.post(`/drivers/${id}/carteira/ajustar`, { amount, reason }),
  walletHistory: (id) => api.get(`/drivers/${id}/carteira/historico`),
};

export const users = {
  list: () => api.get('/users'),
  rideHistory: (id) => api.get(`/users/${id}/corridas`),
  toggleBlock: (id) => api.patch(`/users/${id}/bloquear`),
};

export const admin = {
  billing: (params) => api.get('/admin/faturamento', { params }),
};

export default api;
