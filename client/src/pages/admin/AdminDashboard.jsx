import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminTransfers, getAdminStats, runAdminScheduler } from '../../api/admin';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ companies: 0, transfers: 0 });
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [targetDay, setTargetDay] = useState(1);

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'company'),
      getAdminTransfers(),
    ]).then(([companyRes, t]) => {
      setCounts({ companies: companyRes.count ?? 0, transfers: t.data?.length ?? 0 });
    }).catch(() => {});
    getAdminStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const handleRunScheduler = async () => {
    if (!confirm(`${targetDay}일 자동이체를 실행할까요?`)) return;
    setRunning(true);
    try {
      await runAdminScheduler(targetDay);
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
              { label: '등록 업체', value: counts.companies, to: '/admin/companies' },
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
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">청구일 (1~28)</label>
              <input
                type="number"
                min={1}
                max={28}
                value={targetDay}
                onChange={e => setTargetDay(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-center font-semibold"
              />
            </div>
            <button
              onClick={handleRunScheduler}
              disabled={running}
              className="flex-[2] bg-violet-600 text-white py-3 rounded-2xl font-semibold hover:bg-violet-700 transition disabled:opacity-50 mt-4">
              {running ? '실행 중...' : '▶ 자동이체 실행 (시연)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
