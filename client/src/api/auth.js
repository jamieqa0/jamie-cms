import { supabase } from '../lib/supabase';

export const getMe = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('users')
    .select('id, nickname, email, role')
    .eq('id', user.id)
    .single();
  return { data };
};

export const updateMe = async ({ nickname }) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('users')
    .update({ nickname })
    .eq('id', user.id)
    .select()
    .single();
  return { data };
};

export const logout = async () => {
  await supabase.auth.signOut();
  return { data: { message: 'Logged out' } };
};
