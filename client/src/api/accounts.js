import api from './client';
export const getAccounts = () => api.get('/accounts');
export const createAccount = (name) => api.post('/accounts', { name });
export const getAccount = (id) => api.get(`/accounts/${id}`);
export const deposit = (id, amount) => api.post(`/accounts/${id}/deposit`, { amount });
export const withdraw = (id, amount) => api.post(`/accounts/${id}/withdraw`, { amount });
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);
