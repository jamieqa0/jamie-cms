import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMe, updateMe } from '../api/auth';
import { getAccounts } from '../api/accounts';

export default function Profile() {
  const { user, session, setUser } = useAuthStore();
  const isKakao = session?.user?.app_metadata?.provider === 'kakao';
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);

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

  const personalAccounts = accounts.filter(a => a.type === 'personal');
  const totalBalance = personalAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">프로필</h1>

      {/* 사용자 정보 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-5">사용자 정보</h2>
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
          <h2 className="font-semibold text-slate-900">내 계좌</h2>
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
    </div>
  );
}
