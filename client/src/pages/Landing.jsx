import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const { session } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'profile_nickname profile_image',
        queryParams: {
          scope: 'profile_nickname profile_image',
        },
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Jamie CMS</h1>
        <p className="text-slate-500">정기결제 자동이체 관리 서비스</p>
        <button
          onClick={handleKakaoLogin}
          className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold px-8 py-3 rounded-xl flex items-center gap-2 mx-auto transition"
        >
          카카오로 로그인
        </button>
      </div>
    </div>
  );
}
