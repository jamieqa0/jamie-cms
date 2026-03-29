import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getConsentRequest, acceptConsent } from '../api/company';
import { supabase } from '../lib/supabase';

export default function ConsentPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, session, initializing } = useAuthStore();
  const [request, setRequest] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('account');
  const [done, setDone] = useState(false);

  // 동의 요청 정보 로드 (로그인 여부 무관)
  useEffect(() => {
    if (initializing) return;
    getConsentRequest(token)
      .then(setRequest)
      .catch(() => setError('유효하지 않은 동의 요청입니다.'))
      .finally(() => setLoading(false));
  }, [initializing, token]);

  // 로그인 후 계좌 목록 로드
  useEffect(() => {
    if (!session || !user) return;
    supabase
      .from('accounts')
      .select('id, name, balance')
      .eq('user_id', user.id)
      .eq('type', 'personal')
      .then(({ data }) => {
        setAccounts(data ?? []);
        if (data?.length > 0) setSelectedAccount(data[0].id);
      });
  }, [session, user]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleKakaoLogin = () => {
    sessionStorage.setItem('consentToken', token);
    supabase.auth.signInWithOAuth({
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
    setLoginError('');
    setLoginLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setLoginError(signInError.message);
    setLoginLoading(false);
  };

  const handleAccept = async () => {
    if (!selectedAccount) { setError('출금 계좌를 선택해주세요.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await acceptConsent(token, selectedAccount);
      setDone(true);
    } catch (err) {
      setError(err.message || '동의 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing || loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">로딩 중...</div>;
  }

  if (error && !request) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;
  }

  if (request?.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">이미 처리된 동의 요청입니다.</p>
      </div>
    );
  }

  if (request?.expires_at && new Date(request.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2 p-8 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full mx-4">
          <p className="text-2xl">⏰</p>
          <p className="font-bold text-slate-900">만료된 링크입니다</p>
          <p className="text-slate-500 text-sm">동의 링크의 유효기간(30일)이 지났습니다.<br/>업체에 새 링크를 요청해주세요.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 p-8 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full mx-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-slate-900">동의 완료</h2>
          <p className="text-slate-500 text-sm">자동이체 구독이 시작되었습니다.</p>
          <button
            onClick={() => navigate('/subscriptions')}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
          >
            구독 내역 보기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">

        {/* 동의 정보 카드 — 로그인 여부 무관하게 항상 표시 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
          <h1 className="text-lg font-bold text-slate-900">자동이체 동의 요청</h1>
          <div className="text-sm divide-y divide-slate-50">
            <div className="flex justify-between py-2">
              <span className="text-slate-500">업체명</span>
              <span className="font-medium text-slate-900">{request?.users?.nickname}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">상품명</span>
              <span className="font-medium text-slate-900">{request?.products?.name}</span>
            </div>
            {request?.products?.description && (
              <div className="flex flex-col py-2 gap-1">
                <span className="text-slate-500">상품 설명</span>
                <span className="text-slate-700 whitespace-pre-wrap">{request.products.description}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-slate-500">결제 금액</span>
              <span className="font-bold text-slate-900">{Number(request?.products?.amount).toLocaleString()}원</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">결제일</span>
              <span className="font-medium text-slate-900">매월 {request?.products?.billing_day}일</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">청구서 발송예정일</span>
              <span className="font-medium text-slate-900">
                {request?.products?.invoice_day ? `매월 ${request.products.invoice_day}일` : '자동이체 실행일과 동일'}
              </span>
            </div>
          </div>
        </div>

        {/* 비로그인: 로그인 유도 */}
        {!session && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <p className="text-sm text-slate-600 text-center font-medium">동의하려면 먼저 로그인해주세요.</p>
            <button
              onClick={handleKakaoLogin}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              카카오로 로그인
            </button>
            <div className="flex items-center gap-2">
              <hr className="flex-1 border-slate-200" />
              <span className="text-xs text-slate-400">또는</span>
              <hr className="flex-1 border-slate-200" />
            </div>
            <form onSubmit={handleEmailLogin} className="space-y-2">
              <input
                type="email"
                placeholder="이메일"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="password"
                placeholder="비밀번호"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-slate-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-900 transition disabled:opacity-50"
              >
                {loginLoading ? '로그인 중...' : '이메일로 로그인'}
              </button>
            </form>
          </div>
        )}

        {/* 로그인 후: 결제수단 선택 + 동의 버튼 */}
        {session && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <p className="text-sm font-bold text-slate-800">결제수단 선택</p>

            {/* 결제수단 타입 탭 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'account', label: '계좌이체', icon: '🏦' },
                { key: 'card',    label: '카드',     icon: '💳' },
                { key: 'phone',   label: '휴대폰결제', icon: '📱' },
                { key: 'pay',     label: '간편페이',  icon: '⚡' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                    paymentMethod === m.key
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                  {m.key !== 'account' && (
                    <span className="ml-auto text-xs text-slate-300">준비중</span>
                  )}
                </button>
              ))}
            </div>

            {/* 계좌이체 선택 시 */}
            {paymentMethod === 'account' && (
              accounts.length === 0 ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-red-500">등록된 계좌가 없습니다.</p>
                  <a href="/accounts"
                    className="inline-block w-full bg-slate-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-700 transition text-center">
                    계좌 등록하러 가기 →
                  </a>
                </div>
              ) : (
                <select
                  value={selectedAccount}
                  onChange={e => setSelectedAccount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({Number(a.balance).toLocaleString()}원)
                    </option>
                  ))}
                </select>
              )
            )}

            {/* 준비중 결제수단 선택 시 */}
            {paymentMethod !== 'account' && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-center text-sm text-slate-400">
                해당 결제수단은 현재 준비 중입니다.
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleAccept}
              disabled={submitting || paymentMethod !== 'account' || accounts.length === 0}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '동의하고 구독 시작'}
            </button>
            <p className="text-xs text-slate-400 text-center">
              동의 시 매월 {request?.products?.billing_day}일에 자동이체가 실행됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
