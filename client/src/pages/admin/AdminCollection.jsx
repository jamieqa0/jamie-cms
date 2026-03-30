import { useEffect, useState } from 'react';
import { getCollectionStats } from '../../api/admin';

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = -5; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    options.push({ value, label });
  }
  return options.reverse();
}

export default function AdminCollection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    setLoading(true);
    getCollectionStats(month)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  if (loading) return <p className="text-slate-400 text-sm">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">집금 계좌 현황</h1>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* 집금 계좌 잔액 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <p className="text-slate-500 text-sm">집금 계좌 현재 잔액</p>
        <p className="text-4xl font-bold text-slate-900 mt-1">
          {data ? `${Number(data.collectionBalance).toLocaleString()}원` : '-'}
        </p>
        <p className="text-slate-400 text-xs mt-1">자동이체 수납 후 정산 전 금액이 남아 있습니다</p>
      </div>

      {/* 업체별 정산 내역 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">업체별 {monthOptions.find(o => o.value === month)?.label} 정산 현황</h2>
        </div>
        {!data?.settlements?.length ? (
          <p className="text-slate-400 text-sm p-6">정산 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">업체명</th>
                  <th className="px-5 py-3 text-right font-medium">수수료율</th>
                  <th className="px-5 py-3 text-right font-medium">수납 건수</th>
                  <th className="px-5 py-3 text-right font-medium">총 수납액</th>
                  <th className="px-5 py-3 text-right font-medium">수수료 수익</th>
                  <th className="px-5 py-3 text-right font-medium">업체 정산액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.settlements.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 font-medium text-slate-800">{s.company_name}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{s.commission_rate}%</td>
                    <td className="px-5 py-3 text-right text-slate-700">{s.success_count}건</td>
                    <td className="px-5 py-3 text-right text-slate-700">
                      {Number(s.total_collected).toLocaleString()}원
                    </td>
                    <td className="px-5 py-3 text-right text-violet-600 font-medium">
                      {Number(s.total_commission).toLocaleString()}원
                    </td>
                    <td className="px-5 py-3 text-right text-emerald-600 font-medium">
                      {Number(s.total_settled).toLocaleString()}원
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-5 py-3 font-semibold text-slate-700" colSpan={3}>합계</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {Number(data.settlements.reduce((s, r) => s + Number(r.total_collected), 0)).toLocaleString()}원
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-violet-700">
                    {Number(data.settlements.reduce((s, r) => s + Number(r.total_commission), 0)).toLocaleString()}원
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                    {Number(data.settlements.reduce((s, r) => s + Number(r.total_settled), 0)).toLocaleString()}원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
