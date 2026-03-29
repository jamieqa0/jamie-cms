import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyTransfers, getCompanyInvoices } from '../../api/company';
import InvoiceModal from '../../components/InvoiceModal';

export default function CompanyTransfers() {
  const { user } = useAuthStore();
  const [transfers, setTransfers] = useState([]);
  const [invoiceMap, setInvoiceMap] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyTransfers(user.id).then(setTransfers).catch(() => {});
    getCompanyInvoices(user.id).then(list => {
      const map = {};
      list.forEach(inv => { if (inv.billing_log_id) map[inv.billing_log_id] = inv; });
      setInvoiceMap(map);
    }).catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">수납 내역</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">날짜</th>
              <th className="px-5 py-3 font-medium">고객</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">수납 내역이 없습니다.</td></tr>
            )}
            {transfers.map(t => {
              const invoice = invoiceMap[t.id];
              return (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-500">{new Date(t.executed_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-5 py-3 text-slate-700">{t.user_nickname}</td>
                  <td className="px-5 py-3 text-slate-700">{t.product_name}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{Number(t.amount).toLocaleString()}원</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.status === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}>
                      {t.status === 'success' ? '성공' : '실패'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {invoice && (
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-200 transition"
                      >
                        청구서
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
