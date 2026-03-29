import { supabase } from '../lib/supabase';

export const getMe = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, email, role')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return { data };
};

export const updateMe = async ({ nickname }) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { data, error } = await supabase
    .from('users')
    .update({ nickname })
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return { data };
};

export const logout = async () => {
  await supabase.auth.signOut();
  return { data: { message: 'Logged out' } };
};
