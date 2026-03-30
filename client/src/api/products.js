import { supabase } from '../lib/supabase';

export const getProducts = async () => {
  const { data } = await supabase
    .from('products')
    .select('*, company:users!company_id(nickname)')
    .eq('is_active', true)
    .order('created_at');
  return { data };
};

export const getProduct = async (id) => {
  const { data } = await supabase
    .from('products')
    .select('*, company:users!company_id(nickname)')
    .eq('id', id)
    .single();
  return { data };
};
