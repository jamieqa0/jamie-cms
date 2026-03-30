import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const INACTIVITY_MS = 10 * 60 * 1000; // 10분
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];

let inactivityTimer = null;

const clearInactivity = () => clearTimeout(inactivityTimer);

const resetInactivity = () => {
  clearInactivity();
  if (useAuthStore.getState().session) {
    inactivityTimer = setTimeout(async () => {
      await supabase.auth.signOut();
    }, INACTIVITY_MS);
  }
};

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  initializing: true,
  setUser: (user) => set({ user }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    useAuthStore.setState({ session });

    // 비활동 타이머 시작
    ACTIVITY_EVENTS.forEach(e =>
      window.addEventListener(e, resetInactivity, { passive: true })
    );
    resetInactivity();

    // setTimeout(0): Supabase 내부 잠금 해제 후 DB 쿼리 실행 (데드락 방지)
    setTimeout(async () => {
      // 쿼리 실행 중 세션이 다른 유저로 교체됐으면 결과를 무시 (signUp → setSession 레이스 컨디션 방지)
      if (useAuthStore.getState().session?.user?.id !== session.user.id) return;
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id, nickname, email, role')
          .eq('id', session.user.id)
          .single();
        if (useAuthStore.getState().session?.user?.id !== session.user.id) return;
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
        if (useAuthStore.getState().session?.user?.id !== session.user.id) return;
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
    // 세션 종료 시 타이머 및 리스너 정리
    clearInactivity();
    ACTIVITY_EVENTS.forEach(e =>
      window.removeEventListener(e, resetInactivity)
    );
    useAuthStore.setState({ session: null, user: null, initializing: false });
  }
});
