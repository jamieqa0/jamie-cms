import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AuthCallback() {
  const { session } = useAuthStore();
  const navigate = useNavigate();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (session) {
      redirected.current = true;
      navigate('/dashboard');
    }
  }, [session, navigate]);

  // 세션이 없는 채로 5초 경과 시 홈으로
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!redirected.current) navigate('/');
    }, 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">로그인 중...</p>
    </div>
  );
}
