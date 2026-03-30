import { supabase } from '../lib/supabase';

export const getAdminUsers = async () => {
  const { data } = await supabase.rpc('get_admin_users');
  return { data };
};

export const getAdminTransfers = async () => {
  const { data, error } = await supabase.rpc('get_admin_transfers');
  if (error) throw error;
  return { data };
};

export const getAdminProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { data };
};

export const getAdminProduct = async (id) => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  return { data };
};

export const createProduct = async (productData) => {
  const { data } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single();
  return { data };
};

export const updateProduct = async (id, productData) => {
  const { data } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)
    .select()
    .single();
  return { data };
};

export const deleteProduct = async (id) => {
  const { data } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  return { data };
};

export const getAdminStats = async () => {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw error;
  return { data };
};

export const getUnpaid = async () => {
  const { data } = await supabase.rpc('get_unpaid_list');
  return { data };
};

export const retryBilling = async (id) => {
  const { data, error } = await supabase.rpc('retry_billing', { log_id: id });
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};

export const retryBillingBulk = async (ids) => {
  const { data, error } = await supabase.rpc('retry_billing_bulk', { log_ids: ids });
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};

export const getCollectionStats = async (month = null) => {
  const params = month ? { p_month: month } : {};
  const { data } = await supabase.rpc('get_collection_stats', params);
  return { data };
};

export const runAdminScheduler = async (day) => {
  const { data, error } = await supabase.functions.invoke('auto-debit', {
    body: { targetDay: day },
  });
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};
