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

export const withdrawUser = async () => {
  const { error } = await supabase.rpc('withdraw_user');
  if (error) throw error;
};

export const ensureUserExists = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // users 테이블에 해당 유저가 있는지 확인하고, 없으면 생성 시도 (Fail-safe)
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existing) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        nickname: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '사용자',
        email: user.email,
        role: 'user'
      })
      .select()
      .single();
    return { data, error };
  }
  return { data: existing };
};
