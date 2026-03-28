import { supabase } from '../lib/supabase';

export const getProducts = async () => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  return { data };
};

export const getProduct = async (id) => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  return { data };
};
