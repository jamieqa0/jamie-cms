import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

function StatementModal({ inv, companyName, onClose }) {
  if (!inv) return null;
  const invoiceNo = inv.month.replace('-', '') + '01';

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm print:shadow-none print:rounded-none">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">수수료 명세서</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none print:hidden">✕</button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">명세서 번호</span>
            <span className="font-mono text-sm font-semibold text-slate-700">{invoiceNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">청구 월</span>
            <span className="text-sm text-slate-800">{inv.month}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">업체명</span>
            <span className="text-sm text-slate-800">{companyName}</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          <div className="flex justify-between">
            <span className="text-xs text-slate-400">총 결제 건수</span>
            <span className="text-sm text-slate-800">{inv.count}건</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">총 결제액</span>
            <span className="text-sm text-slate-800">{inv.totalAmount.toLocaleString()}원</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          <div className="flex justify-between">
            <span className="text-xs text-slate-400">수수료율</span>
            <span className="text-sm text-slate-800">{inv.rate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">공급가액</span>
            <span className="text-sm text-slate-800">{inv.supply.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-slate-400">부가세 (10%)</span>
            <span className="text-sm text-slate-800">{inv.vat.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between font-bold">
            <span className="text-sm text-slate-900">수수료 합계</span>
            <span className="text-base text-slate-900">{inv.commission.toLocaleString()}원</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          <div className="flex justify-between">
            <span className="text-xs text-slate-400">발급 상태</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">발급 완료</span>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-2 print:hidden">
          <button onClick={handlePrint}
            className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
            인쇄 / PDF
          </button>
          <button onClick={onClose}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyTaxInvoices() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function loadData() {
      const { data: companyData } = await supabase
        .from('companies')
        .select('commission_rate')
        .eq('user_id', user.id)
        .single();

      const { data: userData } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .single();

      const rate = companyData?.commission_rate ?? 0;
      setCompanyInfo({ rate, nickname: userData?.nickname || '' });

      const { data } = await supabase
        .from('billing_logs')
        .select('amount, executed_at, products!inner(company_id)')
        .eq('status', 'success')
        .eq('products.company_id', user.id);

      const monthlyData = {};
      (data || []).forEach(log => {
        const d = new Date(log.executed_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { totalAmount: 0, count: 0 };
        monthlyData[key].totalAmount += Number(log.amount);
        monthlyData[key].count += 1;
      });

      const list = Object.keys(monthlyData).sort().reverse().map(monthKey => {
        const { totalAmount, count } = monthlyData[monthKey];
        const totalCommission = Math.floor(totalAmount * (rate / 100));
        const supply = Math.floor(totalCommission / 1.1);
        const vat = totalCommission - supply;
        return { month: monthKey, count, totalAmount, commission: totalCommission, supply, vat, rate, status: '발급 완료' };
      });

      setInvoices(list);
      setLoading(false);
    }

    if (user) loadData();
  }, [user]);

  if (loading) return <div className="text-center py-12 text-slate-500">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">수수료 세금계산서</h1>
          <p className="text-slate-500 mt-1">제이미 정기납부 메이트 이용 수수료에 대한 매입 세금계산서 발급 내역입니다.</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium">
          적용 수수료율: {companyInfo?.rate}%
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center text-slate-500">
          발급된 세금계산서가 없습니다.<br />(결제 내역이 발생하면 익월 10일에 자동 발급됩니다)
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold">청구 월</th>
                <th className="px-6 py-4 font-semibold text-right">총 결제액 (건수)</th>
                <th className="px-6 py-4 font-semibold text-right">수수료 총액 (VAT 포함)</th>
                <th className="px-6 py-4 font-semibold text-right">공급가액 / 부가세</th>
                <th className="px-6 py-4 font-semibold">상태</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv.month} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-900">{inv.month}</td>
                  <td className="px-6 py-4 text-right">
                    {inv.totalAmount.toLocaleString()}원 <span className="text-slate-400 text-xs">({inv.count}건)</span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{inv.commission.toLocaleString()}원</td>
                  <td className="px-6 py-4 text-right text-slate-500 text-xs">
                    {inv.supply.toLocaleString()}원 / {inv.vat.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-semibold">{inv.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelected(inv)}
                      className="text-emerald-600 hover:text-emerald-800 text-xs font-medium border border-emerald-200 hover:border-emerald-300 rounded px-3 py-1.5 transition"
                    >
                      명세서 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <StatementModal inv={selected} companyName={companyInfo?.nickname} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
