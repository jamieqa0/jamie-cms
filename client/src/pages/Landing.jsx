import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const { session, user, initializing } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initializing || !session || !user) return;
    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'company') navigate('/company');
    else navigate('/dashboard');
  }, [initializing, session, user, navigate]);

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

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); return; }
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();
      if (userData?.role === 'admin') navigate('/admin');
      else if (userData?.role === 'company') navigate('/company');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">Jamie CMS</h1>
          <p className="text-slate-500 text-sm">정기결제 자동이체 관리 서비스</p>
        </div>

        {/* 일반 유저: 카카오 로그인 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">일반 회원</p>
          <button
            onClick={handleKakaoLogin}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            카카오로 로그인
          </button>
        </div>

        {/* 관리자 / 업체: 이메일 로그인 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">계정 로그인</p>
          <form onSubmit={handleEmailLogin} className="space-y-2">
            <input
              type="email"
              placeholder="example@jamie.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              type="password"
              placeholder="비밀번호"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
