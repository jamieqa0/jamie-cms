import { supabase } from '../lib/supabase';

export const getUserInvoices = async (userId) => {
  const { data, error } = await supabase.rpc('get_user_invoices', { p_user_id: userId });
  if (error) throw error;
  return data;
};

export const getInvoiceById = async (invoiceId) => {
  const { data: { user } } = await supabase.auth.getUser();
  const invoices = await getUserInvoices(user.id);
  const inv = invoices?.find(i => i.id === invoiceId);
  if (!inv) throw new Error('청구서를 찾을 수 없습니다.');
  return inv;
};
