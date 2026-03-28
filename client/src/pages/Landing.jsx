import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const { session } = useAuthStore();
  const navigate = useNavigate();
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devError, setDevError] = useState('');
  const [showDev, setShowDev] = useState(false);

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'profile_nickname profile_image',
        queryParams: { scope: 'profile_nickname profile_image' },
      },
    });
  };

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setDevError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    });
    if (error) setDevError(error.message);
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

        {/* 개발자 로그인 */}
        <div>
          <button
            onClick={() => setShowDev(v => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            개발자 로그인
          </button>
          {showDev && (
            <form onSubmit={handleDevLogin} className="mt-3 space-y-2 w-64 mx-auto">
              <input
                type="email"
                placeholder="이메일"
                value={devEmail}
                onChange={e => setDevEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={devPassword}
                onChange={e => setDevPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              {devError && <p className="text-red-500 text-xs">{devError}</p>}
              <button
                type="submit"
                className="w-full bg-slate-700 text-white rounded-lg py-2 text-sm hover:bg-slate-800 transition"
              >
                로그인
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
