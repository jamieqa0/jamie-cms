import api from './client';
export const getProducts = () => api.get('/products');
export const getProduct = (id) => api.get(`/products/${id}`);
