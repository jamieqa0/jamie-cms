import api from './client';
export const getSubscriptions = () => api.get('/subscriptions');
export const createSubscription = (product_id, account_id) =>
  api.post('/subscriptions', { product_id, account_id });
export const updateSubscription = (id, status) =>
  api.put(`/subscriptions/${id}`, { status });
export const cancelSubscription = (id) => api.delete(`/subscriptions/${id}`);
