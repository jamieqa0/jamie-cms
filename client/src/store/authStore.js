import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

// Supabase 세션 변경 구독 (앱 전체에서 자동 갱신)
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    // users 테이블에서 role 포함 유저 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('id, nickname, email, role')
      .eq('id', session.user.id)
      .single();
    useAuthStore.setState({ session, user: userData });
  } else {
    useAuthStore.setState({ session: null, user: null });
  }
});
