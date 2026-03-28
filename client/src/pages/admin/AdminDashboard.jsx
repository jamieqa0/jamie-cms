import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminUsers, getAdminProducts, getAdminTransfers, getAdminStats, runAdminScheduler } from '../../api/admin';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ users: 0, products: 0, transfers: 0 });
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([getAdminUsers(), getAdminProducts(), getAdminTransfers()]).then(
      ([u, p, t]) => setCounts({ users: u.data.length, products: p.data.length, transfers: t.data.length })
    ).catch(() => {});
    getAdminStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const handleRunScheduler = async () => {
    if (!confirm(`오늘(${new Date().getDate()}일) 자동이체를 실행할까요?`)) return;
    setRunning(true);
    try {
      const today = new Date().getDate();
      await runAdminScheduler(today);
      alert('자동이체 실행 완료!');
      getAdminStats().then(r => setStats(r.data)).catch(() => {});
    } catch (e) {
      alert(e.response?.data?.error || '실행 실패');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">어드민 대시보드</h1>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* 왼쪽: 기본 카드 + 미수납 바로가기 */}
        <div className="w-full md:flex-[2] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: '전체 회원', value: counts.users, to: '/admin/users' },
              { label: '등록 상품', value: counts.products, to: '/admin/products' },
              { label: '자동이체 기록', value: counts.transfers, to: '/admin/transfers' },
            ].map(item => (
              <Link key={item.label} to={item.to}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 transition">
                <p className="text-slate-500 text-sm">{item.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{item.value}</p>
              </Link>
            ))}
          </div>
          {stats && stats.failCount > 0 && (
            <Link to="/admin/unpaid"
              className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-5 hover:border-red-400 transition">
              <div>
                <p className="text-red-600 text-sm font-semibold">⚠ 미수납 내역</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{stats.failCount}건 미처리</p>
              </div>
              <span className="text-red-400 text-xl">→</span>
            </Link>
          )}
        </div>

        {/* 오른쪽: 통계 + 시연 버튼 */}
        <div className="w-full md:flex-1 space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-green-600 text-sm">이번 달 수납률</p>
            <p className="text-3xl font-bold text-green-700 mt-1">
              {stats ? `${stats.successRate}%` : '-'}
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
            <p className="text-blue-600 text-sm">총 수납액</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {stats ? `${Number(stats.totalAmount).toLocaleString()}원` : '-'}
            </p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-red-600 text-sm">실패 건수</p>
            <p className="text-3xl font-bold text-red-700 mt-1">
              {stats ? `${stats.failCount}건` : '-'}
            </p>
          </div>
          <button
            onClick={handleRunScheduler}
            disabled={running}
            className="w-full bg-violet-600 text-white py-3 rounded-2xl font-semibold hover:bg-violet-700 transition disabled:opacity-50">
            {running ? '실행 중...' : '▶ 자동이체 실행 (시연)'}
          </button>
        </div>
      </div>
    </div>
  );
}
