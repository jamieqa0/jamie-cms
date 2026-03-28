import { supabase } from '../lib/supabase';

export const getSubscriptions = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('subscriptions')
    .select('*, products(name, amount, billing_day)')
    .eq('user_id', user.id)
    .order('created_at');
  const flattened = (data || []).map(s => ({
    ...s,
    product_name: s.products?.name,
    amount: s.products?.amount,
    billing_day: s.products?.billing_day,
  }));
  return { data: flattened };
};

export const createSubscription = async ({ productId, accountId, paymentMethod = 'account' }) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: user.id,
      product_id: productId,
      account_id: accountId,
      payment_method: paymentMethod,
    })
    .select()
    .single();
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};

export const updateSubscription = async (id, status) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};

export const cancelSubscription = async (id) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};
