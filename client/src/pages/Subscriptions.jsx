import { useEffect, useState } from 'react';
import { cancelSubscription, updateSubscription, getSubscriptions } from '../api/subscriptions';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';
import InvoiceModal from '../components/InvoiceModal';

const STATUS_LABEL = { active: '활성', paused: '일시정지', cancelled: '해지' };
const STATUS_COLOR = { active: 'text-green-600 bg-green-50', paused: 'text-yellow-600 bg-yellow-50', cancelled: 'text-slate-400 bg-slate-100' };
const INV_STATUS_LABEL = { issued: '발행됨', paid: '납부완료', failed: '실패' };
const INV_STATUS_COLOR = { issued: 'text-yellow-600 bg-yellow-50', paid: 'text-green-600 bg-green-50', failed: 'text-red-600 bg-red-50' };

export default function Subscriptions() {
  const { user } = useAuthStore();
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const load = () => getSubscriptions().then(r => setSubscriptions(r.data));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(setInvoices).catch(() => {});
  }, [user?.id]);

  const handleToggle = async (s) => {
    const newStatus = s.status === 'active' ? 'paused' : 'active';
    await updateSubscription(s.id, newStatus);
    load();
  };

  const handleCancel = async (id) => {
    if (!confirm('구독을 해지할까요?')) return;
    await cancelSubscription(id);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">내 구독</h1>
      <div className="space-y-3">
        {subscriptions.map(s => (
          <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-slate-900">{s.product_name}</p>
                <p className="text-slate-500 text-sm">{Number(s.amount).toLocaleString()}원 / 매월 {s.billing_day}일</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[s.status]}`}>
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            {s.status !== 'cancelled' && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleToggle(s)}
                  className="text-sm text-slate-600 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 transition">
                  {s.status === 'active' ? '일시정지' : '재개'}
                </button>
                <button onClick={() => handleCancel(s.id)}
                  className="text-sm text-red-500 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 transition">
                  해지
                </button>
              </div>
            )}
          </div>
        ))}
        {subscriptions.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">구독 중인 상품이 없어요.</p>
        )}
      </div>

      {/* 청구서 내역 */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">청구서 내역</h2>
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
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-200 transition"
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
