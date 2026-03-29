import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const { session, user, initializing } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userMode, setUserMode] = useState('login'); // 'login' | 'signup'
  const [signupDone, setSignupDone] = useState(false);

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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: nickname, role: 'user' } },
      });
      if (signUpError) throw signUpError;
      setSignupDone(true);
    } catch (err) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900">제이미 정기납부 메이트</h1>
          <p className="text-slate-500 text-sm">정기결제 자동이체 관리 서비스</p>
        </div>

        {/* 일반 회원 카드 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <div className="flex gap-2 border-b border-slate-100 pb-3">
            <button
              onClick={() => { setUserMode('login'); setError(''); setSignupDone(false); }}
              className={`flex-1 text-sm font-semibold py-1.5 rounded-lg transition ${userMode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              로그인
            </button>
            <button
              onClick={() => { setUserMode('signup'); setError(''); setSignupDone(false); }}
              className={`flex-1 text-sm font-semibold py-1.5 rounded-lg transition ${userMode === 'signup' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              회원가입
            </button>
          </div>

          {userMode === 'login' && (
            <>
              <button onClick={handleKakaoLogin}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition">
                카카오로 로그인
              </button>
              <div className="flex items-center gap-2">
                <hr className="flex-1 border-slate-200" />
                <span className="text-xs text-slate-400">또는</span>
                <hr className="flex-1 border-slate-200" />
              </div>
              <form onSubmit={handleEmailLogin} className="space-y-2">
                <input type="email" placeholder="이메일" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input type="password" placeholder="비밀번호" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50">
                  {loading ? '로그인 중...' : '이메일로 로그인'}
                </button>
              </form>
            </>
          )}

          {userMode === 'signup' && !signupDone && (
            <form onSubmit={handleEmailSignup} className="space-y-2">
              <input type="text" placeholder="닉네임" required value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input type="email" placeholder="이메일" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input type="password" placeholder="비밀번호 (6자 이상)" required minLength={6} value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50">
                {loading ? '가입 중...' : '회원가입'}
              </button>
            </form>
          )}

          {userMode === 'signup' && signupDone && (
            <div className="text-center space-y-2 py-2">
              <p className="text-emerald-600 font-semibold text-sm">가입 완료!</p>
              <p className="text-slate-500 text-xs">이메일을 확인하고 인증 링크를 클릭해주세요.</p>
              <button onClick={() => { setUserMode('login'); setSignupDone(false); }}
                className="text-sm text-blue-500 underline">로그인하러 가기</button>
            </div>
          )}
        </div>

        {/* 관리자 / 업체 로그인 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">관리자 / 업체 로그인</p>
          <form onSubmit={handleEmailLogin} className="space-y-2">
            <input type="email" placeholder="example@jamie.com" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <input type="password" placeholder="비밀번호" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <button type="submit" disabled={loading}
              className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
