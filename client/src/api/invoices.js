import { supabase } from '../lib/supabase';

export const getUserInvoices = async (userId) => {
  const { data, error } = await supabase.rpc('get_user_invoices', { p_user_id: userId });
  if (error) throw error;
  return data;
};

export const getInvoiceById = async (invoiceId) => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, subscriptions(id, products(name, company_id, users!products_company_id_fkey(nickname)))')
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return data;
};
