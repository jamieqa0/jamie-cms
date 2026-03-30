import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getSubscriptions } from '../api/subscriptions';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';
import { buildMonthlyChart } from '../utils/chartUtils';

const INV_STATUS_COLOR = { issued: 'text-amber-700 bg-amber-50 border-amber-200', paid: 'text-emerald-700 bg-emerald-50 border-emerald-200', failed: 'text-red-700 bg-red-50 border-red-200' };
const INV_STATUS_LABEL = { issued: '미납', paid: '납부완료', failed: '실패' };

export default function Dashboard() {
  const { user } = useAuthStore();
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    getSubscriptions().then(r => setSubscriptions(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(setInvoices).catch(console.error);
  }, [user?.id]);

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const totalMonthly = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + Number(s.amount), 0);
  const recentInvoices = invoices.slice(0, 3);
  const unpaidCount = invoices.filter(i => i.status === 'issued').length;
  const chartData = buildMonthlyChart(invoices);
  const hasChartData = chartData.some(d => d.amount > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.nickname}님 👋</h1>
        <p className="text-slate-400 text-sm mt-0.5">정기납부 현황을 확인하세요</p>
      </div>

      {/* 핵심 수치 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">월 납부액</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {Number(totalMonthly).toLocaleString()}
            <span className="text-base font-semibold text-slate-500 ml-0.5">원</span>
          </p>
          <p className="text-slate-400 text-xs mt-1">활성 구독 {activeCount}개</p>
        </div>
        <Link to="/invoices"
          className={`rounded-2xl p-5 shadow-sm border transition ${unpaidCount > 0 ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${unpaidCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>미납 청구서</p>
          <p className={`text-3xl font-extrabold mt-1 tabular-nums ${unpaidCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {unpaidCount}
            <span className="text-base font-semibold ml-0.5">건</span>
          </p>
          <p className={`text-xs mt-1 ${unpaidCount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {unpaidCount > 0 ? '확인 필요 →' : '모두 납부 완료'}
          </p>
        </Link>
      </div>

      {/* 월별 납부 추이 차트 */}
      {hasChartData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-900 mb-4">월별 납부 추이</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={24}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => [`${Number(v).toLocaleString()}원`, '납부액']}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.current ? '#2563eb' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 최근 청구서 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">최근 청구서</h2>
          <Link to="/invoices" className="text-blue-500 text-xs font-semibold">전체 보기 →</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-6 text-center">청구서가 없어요.</p>
        ) : (
          <ul>
            {recentInvoices.map(inv => (
              <li key={inv.id} className="flex justify-between items-center px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
                <div>
                  <p className="text-slate-900 font-semibold text-sm">{inv.product_name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{inv.company_name} · {new Date(inv.issued_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-slate-900 font-bold text-sm tabular-nums">{Number(inv.amount).toLocaleString()}원</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${INV_STATUS_COLOR[inv.status]}`}>
                    {INV_STATUS_LABEL[inv.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 구독 중인 상품 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">구독 중인 상품</h2>
          <Link to="/subscriptions" className="text-blue-500 text-xs font-semibold">전체 보기 →</Link>
        </div>
        {activeCount === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-6 text-center">
            구독 중인 상품이 없어요.{' '}
            <Link to="/products" className="text-blue-500 font-semibold">상품 둘러보기 →</Link>
          </p>
        ) : (
          <ul>
            {subscriptions.filter(s => s.status === 'active').map(s => (
              <li key={s.id} className="flex justify-between items-center px-5 py-3.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-slate-900 font-semibold text-sm">{s.product_name}</p>
                  {s.company_name && <p className="text-slate-400 text-xs mt-0.5">{s.company_name}</p>}
                </div>
                <div className="text-right">
                  <p className="text-slate-900 font-bold text-sm tabular-nums">{Number(s.amount).toLocaleString()}원</p>
                  <p className="text-slate-400 text-xs mt-0.5">매월 {s.billing_day}일</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
