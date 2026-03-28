import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  initializing: true, // onAuthStateChange 첫 응답 전까지 true
  setUser: (user) => set({ user }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    useAuthStore.setState({ session });
    // setTimeout(0): Supabase 내부 잠금 해제 후 DB 쿼리 실행 (데드락 방지)
    setTimeout(async () => {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id, nickname, email, role')
          .eq('id', session.user.id)
          .single();
        useAuthStore.setState({
          user: userData ?? {
            id: session.user.id,
            email: session.user.email,
            nickname: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '사용자',
            role: 'user',
          },
          initializing: false,
        });
      } catch {
        useAuthStore.setState({
          user: {
            id: session.user.id,
            email: session.user.email,
            nickname: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '사용자',
            role: 'user',
          },
          initializing: false,
        });
      }
    }, 0);
  } else {
    useAuthStore.setState({ session: null, user: null, initializing: false });
  }
});
