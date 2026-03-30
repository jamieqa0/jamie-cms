import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, initializing } = useAuthStore();

  // 코드 교환만 처리 — 리다이렉트는 authStore가 준비되면 아래 useEffect가 담당
  useEffect(() => {
    const exchangeCode = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) { navigate('/'); return; }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) navigate('/');
        // 성공 시 onAuthStateChange → authStore 업데이트 → 아래 useEffect가 navigate
      }
    };
    exchangeCode();
  }, [navigate]);

  // authStore user가 준비되면 role 기반 리다이렉트
  useEffect(() => {
    if (initializing || !user) return;

    const consentToken = sessionStorage.getItem('consentToken');
    if (consentToken) {
      sessionStorage.removeItem('consentToken');
      navigate(`/consent/${consentToken}`, { replace: true, state: { fromAuth: true } });
      return;
    }

    if (user.role === 'admin') navigate('/admin', { replace: true });
    else if (user.role === 'company') navigate('/company', { replace: true });
    else navigate('/dashboard', { replace: true });
  }, [initializing, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">로그인 중...</p>
    </div>
  );
}
