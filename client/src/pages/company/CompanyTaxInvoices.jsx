import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';

export default function CompanyTaxInvoices() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    async function loadData() {
      // 업체 정보 및 수수료율 로드
      const { data: companyData } = await supabase
        .from('companies')
        .select('commission_rate')
        .eq('user_id', user.id)
        .single();
      
      const rate = companyData?.commission_rate ?? 0;
      setCompanyInfo({ rate });

      // 이 업체의 모든 성공한 결제 내역 조회 (billing_logs)
      const { data } = await supabase
        .from('billing_logs')
        .select('amount, executed_at, products!inner(company_id)')
        .eq('status', 'success')
        .eq('products.company_id', user.id);

      // 월별(YYYY-MM) 매출 및 수수료 집계
      const monthlyData = {};
      (data || []).forEach(log => {
        const date = new Date(log.executed_at);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { totalAmount: 0, count: 0 };
        }
        monthlyData[monthKey].totalAmount += Number(log.amount);
        monthlyData[monthKey].count += 1;
      });

      // 세금계산서 리스트 생성
      const list = Object.keys(monthlyData).sort().reverse().map(monthKey => {
        const { totalAmount, count } = monthlyData[monthKey];
        // 총 수수료 = 총 결제액 * 수수료율
        const totalCommission = Math.floor(totalAmount * (rate / 100));
        const supply = Math.floor(totalCommission / 1.1);
        const vat = totalCommission - supply;

        return {
          month: monthKey,
          count,
          totalAmount,
          commission: totalCommission,
          supply,
          vat,
          status: '발급 완료', // 과제용 목업 상태
        };
      });

      setInvoices(list);
      setLoading(false);
    }

    if (user) loadData();
  }, [user]);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">불러오는 중...</div>;
  }

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
              {invoices.map((inv) => (
                <tr key={inv.month} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-900">{inv.month}</td>
                  <td className="px-6 py-4 text-right">
                    {inv.totalAmount.toLocaleString()}원 <span className="text-slate-400 text-xs">({inv.count}건)</span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {inv.commission.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500 text-xs">
                    {inv.supply.toLocaleString()}원 / {inv.vat.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-semibold">
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-emerald-600 hover:text-emerald-800 text-xs font-medium border border-emerald-200 hover:border-emerald-300 rounded px-3 py-1.5 transition">
                      명세서 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
