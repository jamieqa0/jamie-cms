import { useEffect, useState } from 'react';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';
import InvoiceModal from '../components/InvoiceModal';
import ReceiptModal from '../components/ReceiptModal';

const INV_STATUS_LABEL = { issued: '발행됨', paid: '납부완료', failed: '실패' };
const INV_STATUS_COLOR = { issued: 'text-yellow-600 bg-yellow-50', paid: 'text-green-600 bg-green-50', failed: 'text-red-600 bg-red-50' };

export default function Invoices() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(setInvoices).catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">내 청구서</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">청구일</th>
              <th className="px-5 py-3 font-medium">업체</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">청구서가 없습니다.</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{new Date(inv.issued_at).toLocaleDateString('ko-KR')}</td>
                <td className="px-5 py-3 text-slate-700">{inv.company_name}</td>
                <td className="px-5 py-3 text-slate-700">{inv.product_name}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{Number(inv.amount).toLocaleString()}원</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INV_STATUS_COLOR[inv.status]}`}>
                    {INV_STATUS_LABEL[inv.status]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedInvoice(inv)}
                      className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-200 transition">
                      청구서
                    </button>
                    {inv.status === 'paid' && (
                      <button onClick={() => setSelectedReceipt(inv)}
                        className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg hover:bg-emerald-100 transition">
                        영수증
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedInvoice && <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      {selectedReceipt && <ReceiptModal invoice={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
}
