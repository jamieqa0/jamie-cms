import { useEffect, useState } from 'react';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';
import InvoiceModal from '../components/InvoiceModal';
import ReceiptModal from '../components/ReceiptModal';

const INV_STATUS_LABEL = { issued: '미납', paid: '납부완료', failed: '실패' };
const INV_STATUS_COLOR = {
  issued: 'text-amber-700 bg-amber-50 border-amber-200',
  paid: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  failed: 'text-red-700 bg-red-50 border-red-200',
};

export default function Invoices() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(setInvoices).catch(() => {});
  }, [user?.id]);

  const unpaid = invoices.filter(i => i.status === 'issued');
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">내 청구서</h1>
        {invoices.length > 0 && (
          <p className="text-slate-400 text-sm mt-0.5">
            납부 완료 {totalPaid.toLocaleString()}원
            {unpaid.length > 0 && <span className="text-red-500 ml-2">· 미납 {unpaid.length}건</span>}
          </p>
        )}
      </div>

      {/* 미납 강조 */}
      {unpaid.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
          <p className="text-red-600 font-bold text-sm">미납 청구서 {unpaid.length}건</p>
          {unpaid.map(inv => (
            <div key={inv.id} className="flex justify-between items-center bg-white rounded-xl px-4 py-3 border border-red-100">
              <div>
                <p className="text-slate-900 font-semibold text-sm">{inv.product_name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{inv.company_name} · {new Date(inv.issued_at).toLocaleDateString('ko-KR')}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <p className="font-extrabold text-red-600 tabular-nums">{Number(inv.amount).toLocaleString()}원</p>
                <button onClick={() => setSelectedInvoice(inv)}
                  className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-lg hover:bg-red-200 transition">
                  청구서 보기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 전체 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">전체 내역</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-8 text-center">청구서가 없습니다.</p>
        ) : (
          <ul>
            {invoices.map(inv => (
              <li key={inv.id} className="flex justify-between items-center px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-slate-900 font-semibold text-sm truncate">{inv.product_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${INV_STATUS_COLOR[inv.status]}`}>
                      {INV_STATUS_LABEL[inv.status]}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{inv.company_name} · {new Date(inv.issued_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0 flex flex-col items-end gap-1">
                  <p className="font-bold text-slate-900 tabular-nums">{Number(inv.amount).toLocaleString()}원</p>
                  <div className="flex gap-1">
                    <button onClick={() => setSelectedInvoice(inv)}
                      className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg hover:bg-slate-200 transition">
                      청구서
                    </button>
                    {inv.status === 'paid' && (
                      <button onClick={() => setSelectedReceipt(inv)}
                        className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition">
                        영수증
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedInvoice && <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      {selectedReceipt && <ReceiptModal invoice={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
}
