import { supabase } from '../lib/supabase';

export const getAccounts = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'personal')
    .order('created_at');
  return { data };
};

export const createAccount = async (name) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('accounts')
    .insert({ user_id: user.id, name, type: 'personal' })
    .select()
    .single();
  return { data };
};

export const getAccount = async (id) => {
  const { data } = await supabase
    .from('accounts')
    .select('*, transactions(id, type, amount, description, created_at)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'transactions', ascending: false })
    .single();
  return { data };
};

export const deposit = async (id, amount) => {
  const { data, error } = await supabase.rpc('account_deposit', { account_id: id, amount: Number(amount) });
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};

export const withdraw = async (id, amount) => {
  const { data, error } = await supabase.rpc('account_withdraw', { account_id: id, amount: Number(amount) });
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};

export const deleteAccount = async (id) => {
  const { data } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);
  return { data };
};
