import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

import Footer from '../components/Footer';

export default function Landing() {
  const { session, user, initializing } = useAuthStore();
  const navigate = useNavigate();
  
  const [mainTab, setMainTab] = useState('user'); // 'user' | 'admin'
  const [userMode, setUserMode] = useState('login'); // 'login' | 'signup'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  useEffect(() => {
    if (initializing || !session || !user) return;
    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'company') navigate('/company');
    else navigate('/dashboard');
  }, [initializing, session, user, navigate]);

  // Reset states when switching main tabs
  useEffect(() => {
    setError('');
    setEmail('');
    setPassword('');
    setNickname('');
    setLoading(false);
    if (mainTab === 'admin') {
      setUserMode('login');
      setSignupDone(false);
    }
  }, [mainTab]);

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
    <div className="min-h-screen bg-[#f2f4f6] font-sans selection:bg-blue-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-[400px] flex flex-col items-center">
          
          {/* Title Area */}
          <div className="text-center space-y-2 mb-8 w-full mt-4">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Jamie</h1>
            <p className="text-gray-500 text-sm font-medium">정기결제 자동이체 관리 서비스</p>
          </div>

          {/* Main Card */}
          <div className="bg-white w-full rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 space-y-6 transition-all">
            
            {/* Main Tabs (User vs Admin) - Toss Style Pill */}
            <div className="bg-[#f2f4f6] p-1 rounded-2xl flex w-full">
              <button
                onClick={() => setMainTab('user')}
                className={`flex-1 py-2.5 text-[15px] font-semibold rounded-xl transition-all duration-200 ${
                  mainTab === 'user'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                개인 고객
              </button>
              <button
                onClick={() => setMainTab('admin')}
                className={`flex-1 py-2.5 text-[15px] font-semibold rounded-xl transition-all duration-200 ${
                  mainTab === 'admin'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                업체/관리자
              </button>
            </div>

            {mainTab === 'user' ? (
              <div className="space-y-6">
                {/* User Login / Signup Sub Tabs */}
                <div className="flex gap-4 border-b border-gray-100 pb-1">
                  <button
                    onClick={() => { setUserMode('login'); setError(''); setSignupDone(false); }}
                    className={`pb-3 text-[15px] font-semibold transition-all relative ${
                      userMode === 'login' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    로그인
                    {userMode === 'login' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-900 rounded-t-md" />
                    )}
                  </button>
                  <button
                    onClick={() => { setUserMode('signup'); setError(''); setSignupDone(false); }}
                    className={`pb-3 text-[15px] font-semibold transition-all relative ${
                      userMode === 'signup' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    회원가입
                    {userMode === 'signup' && (
                      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-900 rounded-t-md" />
                    )}
                  </button>
                </div>

                {userMode === 'login' && (
                  <div className="space-y-5">
                    <button onClick={handleKakaoLogin}
                      className="w-full bg-[#FEE500] hover:bg-[#FDD800] text-gray-900 font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3C6.477 3 2 6.545 2 10.916c0 2.84 1.838 5.334 4.545 6.711l-1.155 4.314c-.05.185.166.33.32.22l5.053-3.328c.404.041.815.063 1.237.063 5.523 0 10-3.545 10-7.916S17.523 3 12 3z"/>
                      </svg>
                      카카오로 시작하기
                    </button>

                    <div className="flex items-center gap-3">
                      <hr className="flex-1 border-gray-100" />
                      <span className="text-xs text-gray-400 font-medium">이메일로 로그인</span>
                      <hr className="flex-1 border-gray-100" />
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-3">
                      <input type="email" placeholder="이메일" required value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                      <input type="password" placeholder="비밀번호" required value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                      {error && <p className="text-red-500 text-[13px] ml-1">{error}</p>}
                      <button type="submit" disabled={loading}
                        className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-[15px] font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-2">
                        {loading ? '로그인 중...' : '로그인'}
                      </button>
                    </form>
                  </div>
                )}

                {userMode === 'signup' && !signupDone && (
                  <form onSubmit={handleEmailSignup} className="space-y-3">
                    <input type="text" placeholder="닉네임" required value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                    <input type="email" placeholder="이메일" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                    <input type="password" placeholder="비밀번호 (6자 이상)" required minLength={6} value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                    {error && <p className="text-red-500 text-[13px] ml-1">{error}</p>}
                    <button type="submit" disabled={loading}
                      className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-[15px] font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-2">
                      {loading ? '가입 중...' : '회원가입'}
                    </button>
                  </form>
                )}

                {userMode === 'signup' && signupDone && (
                  <div className="text-center space-y-3 py-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">회원가입 완료!</h3>
                    <p className="text-gray-500 text-[15px]">이메일을 확인하고 인증 링크를 클릭해주세요.</p>
                    <button onClick={() => { setUserMode('login'); setSignupDone(false); }}
                      className="text-[15px] font-semibold text-blue-600 hover:text-blue-700 pt-4">
                      로그인으로 돌아가기
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="pb-2">
                  <h2 className="text-lg font-bold text-gray-900">비즈니스 로그인</h2>
                  <p className="text-gray-500 text-[14px] mt-1">업체 및 관리자 전용 채널입니다.</p>
                </div>
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <input type="email" placeholder="이메일 주소" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                  <input type="password" placeholder="비밀번호" required value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[#f2f4f6] text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all border border-transparent focus:border-blue-500" />
                  {error && <p className="text-red-500 text-[13px] ml-1">{error}</p>}
                  <button type="submit" disabled={loading}
                    className="w-full bg-gray-900 text-white rounded-xl py-3.5 text-[15px] font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 mt-2">
                    {loading ? '로그인 중...' : '비즈니스 로그인'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
