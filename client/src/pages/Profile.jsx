import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMe, updateMe, withdrawUser } from '../api/auth';
import { getAccounts } from '../api/accounts';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const { user, session, setUser } = useAuthStore();
  const navigate = useNavigate();
  const isKakao = session?.user?.app_metadata?.provider === 'kakao';
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [withdrawStep, setWithdrawStep] = useState(0); // 0: 숨김 1: 경고 2: 처리중
  const [withdrawError, setWithdrawError] = useState('');

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '');
    } else {
      getMe().then(res => {
        if (res.data) { setUser(res.data); setNickname(res.data.nickname || ''); }
      }).catch(() => {});
    }
  }, [user, setUser]);

  useEffect(() => {
    getAccounts().then(r => setAccounts(r.data ?? [])).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateMe({ nickname });
    setUser({ ...user, nickname: res.data.nickname });
    setSaving(false);
    alert('저장되었어요!');
  };

  const handleWithdraw = async () => {
    setWithdrawStep(2);
    setWithdrawError('');
    try {
      await withdrawUser();
      // RPC가 auth.users를 삭제하므로 세션이 무효화됨
      // 클라이언트 로컬 상태도 정리
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      setWithdrawError(err.message || '탈퇴 처리 중 오류가 발생했습니다.');
      setWithdrawStep(1);
    }
  };

  const personalAccounts = accounts.filter(a => a.type === 'personal');
  const totalBalance = personalAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">프로필</h1>

      {/* 사용자 정보 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-bold text-slate-900 mb-5">사용자 정보</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">닉네임</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={nickname} onChange={e => setNickname(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">이메일</label>
            <div className="flex items-center gap-2">
              <p className="text-slate-500 text-sm">{user?.email || '이메일 없음'}</p>
              {isKakao && <span className="text-[10px] bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">Kakao</span>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">권한</label>
            <p className="text-slate-500 text-sm capitalize">{user?.role}</p>
          </div>
          <div className="pt-2">
            <button type="submit" disabled={saving}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-700 active:scale-95 transition disabled:opacity-50">
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      </div>

      {/* 내 계좌 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-slate-900">내 계좌</h2>
          <Link to="/accounts" className="text-blue-500 text-xs font-medium hover:underline">계좌 관리 →</Link>
        </div>
        {personalAccounts.length === 0 ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-slate-400 text-sm">등록된 계좌가 없어요.</p>
            <Link to="/accounts" className="inline-block bg-slate-800 text-white text-sm px-5 py-2 rounded-xl hover:bg-slate-700 transition font-bold">
              계좌 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Balance</p>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalBalance.toLocaleString()}<span className="text-sm font-normal ml-1">원</span></p>
            </div>
            <ul className="pt-4 border-t border-slate-50 space-y-2.5">
              {personalAccounts.map(a => (
                <li key={a.id} className="flex justify-between items-center text-sm">
                  <Link to={`/accounts/${a.id}`} className="text-slate-600 hover:text-blue-500 font-medium transition">{a.name}</Link>
                  <span className="text-slate-900 font-bold tabular-nums">{Number(a.balance).toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {/* 회원 탈퇴 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-bold text-slate-900 mb-1">회원 탈퇴</h2>
        <p className="text-slate-400 text-xs mb-4">탈퇴 후에도 결제 내역은 보관되며, 동일한 이메일로 재가입할 수 있습니다.</p>

        {withdrawStep === 0 && (
          <button
            onClick={() => setWithdrawStep(1)}
            className="text-sm text-red-500 hover:text-red-700 font-medium underline underline-offset-2 transition"
          >
            탈퇴하기
          </button>
        )}

        {withdrawStep >= 1 && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-red-700">정말 탈퇴하시겠습니까?</p>
            <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
              <li>활성 구독은 더 이상 자동 결제되지 않습니다.</li>
              <li>기존 결제 내역과 데이터는 삭제되지 않고 보관됩니다.</li>
              <li>탈퇴 후 동일한 이메일로 재가입할 수 있습니다.</li>
            </ul>
            {withdrawError && (
              <p className="text-xs text-red-700 font-medium">{withdrawError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleWithdraw}
                disabled={withdrawStep === 2}
                className="flex-1 bg-red-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {withdrawStep === 2 ? '처리 중...' : '탈퇴 확인'}
              </button>
              <button
                onClick={() => { setWithdrawStep(0); setWithdrawError(''); }}
                disabled={withdrawStep === 2}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
