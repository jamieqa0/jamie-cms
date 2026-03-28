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
      .select('id, balance')
      .eq('user_id', user.id)
      .eq('type', 'personal')
      .then(({ data }) => {
        setAccounts(data ?? []);
        if (data?.length > 0) setSelectedAccount(data[0].id);
      });
  }, [session, user]);

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
            <div className="flex justify-between py-2">
              <span className="text-slate-500">결제 금액</span>
              <span className="font-bold text-slate-900">{Number(request?.products?.amount).toLocaleString()}원</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">결제일</span>
              <span className="font-medium text-slate-900">매월 {request?.products?.billing_day}일</span>
            </div>
          </div>
        </div>

        {/* 비로그인: 카카오 로그인 유도 */}
        {!session && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <p className="text-sm text-slate-600 text-center">동의하려면 먼저 로그인해주세요.</p>
            <button
              onClick={handleKakaoLogin}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              카카오로 로그인하고 동의하기
            </button>
          </div>
        )}

        {/* 로그인 후: 계좌 선택 + 동의 버튼 */}
        {session && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <p className="text-sm font-medium text-slate-700">출금 계좌 선택</p>
            {accounts.length === 0 ? (
              <p className="text-sm text-red-500">등록된 계좌가 없습니다. 먼저 계좌를 등록해주세요.</p>
            ) : (
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    계좌 ({Number(a.balance).toLocaleString()}원)
                  </option>
                ))}
              </select>
            )}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleAccept}
              disabled={submitting || accounts.length === 0}
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
