import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getAdminTransfers, getAdminStats, runAdminScheduler } from '../../api/admin';
import { supabase } from '../../lib/supabase';
import { buildMonthlyTransferChart } from '../../utils/chartUtils';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ companies: 0, transfers: 0 });
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [targetDay, setTargetDay] = useState(1);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'company'),
      getAdminTransfers(),
    ]).then(([companyRes, t]) => {
      setCounts({ companies: companyRes.count ?? 0, transfers: t.data?.length ?? 0 });
      setTransfers(t.data || []);
    }).catch(console.error);
    getAdminStats().then(r => setStats(r.data)).catch(console.error);
  }, []);

  const handleRunScheduler = async () => {
    if (!confirm(`${targetDay}일 자동이체를 실행할까요?`)) return;
    setRunning(true);
    try {
      await runAdminScheduler(targetDay);
      alert('자동이체 실행 완료!');
      getAdminStats().then(r => setStats(r.data)).catch(console.error);
    } catch (e) {
      alert(e.response?.data?.error || '실행 실패');
    } finally {
      setRunning(false);
    }
  };

  const chartData = buildMonthlyTransferChart(transfers);
  const hasChartData = chartData.some(d => d.amount > 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">어드민 대시보드</h1>

      {/* 핵심 수치 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/admin/companies"
          className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 transition">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">등록 업체</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">{counts.companies}</p>
          <p className="text-slate-400 text-xs mt-1">개</p>
        </Link>
        <Link to="/admin/transfers"
          className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 transition">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">자동이체 기록</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">{counts.transfers}</p>
          <p className="text-slate-400 text-xs mt-1">건</p>
        </Link>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <p className="text-emerald-600 text-xs font-medium uppercase tracking-wide">이달 수납률</p>
          <p className="text-3xl font-extrabold text-emerald-700 mt-1 tabular-nums">
            {stats ? `${stats.successRate}` : '-'}
            <span className="text-base font-semibold ml-0.5">%</span>
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="text-blue-600 text-xs font-medium uppercase tracking-wide">총 수납액</p>
          <p className="text-2xl font-extrabold text-blue-700 mt-1 tabular-nums">
            {stats ? Number(stats.totalAmount).toLocaleString() : '-'}
            <span className="text-sm font-semibold ml-0.5">원</span>
          </p>
        </div>
      </div>

      {/* 미수납 알림 */}
      {stats && stats.failCount > 0 && (
        <Link to="/admin/unpaid"
          className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-5 hover:border-red-400 transition">
          <div>
            <p className="text-red-500 text-xs font-semibold uppercase tracking-wide">⚠ 미수납 내역</p>
            <p className="text-2xl font-extrabold text-red-700 mt-1 tabular-nums">{stats.failCount}건 미처리</p>
          </div>
          <span className="text-red-400 text-xl">→</span>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 월별 수납 추이 차트 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-900 mb-4">월별 수납 추이</h2>
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} barSize={24}>
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => [`${Number(v).toLocaleString()}원`, '수납액']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.current ? '#2563eb' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">수납 데이터가 없어요.</p>
          )}
        </div>

        {/* 자동이체 시연 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h2 className="font-bold text-slate-900">자동이체 시연</h2>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium">청구일 (1~28)</label>
            <input
              type="number"
              min={1}
              max={28}
              value={targetDay}
              onChange={e => setTargetDay(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleRunScheduler}
            disabled={running}
            className="w-full bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 active:scale-95 transition disabled:opacity-50">
            {running ? '실행 중...' : '▶ 자동이체 실행'}
          </button>
          <p className="text-xs text-slate-400 text-center">해당 날짜 구독자에게 자동이체를 실행합니다</p>
        </div>
      </div>
    </div>
  );
}
