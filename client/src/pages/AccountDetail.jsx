import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccount, deposit, withdraw, deleteAccount } from '../api/accounts';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';
import InvoiceModal from '../components/InvoiceModal';
import ReceiptModal from '../components/ReceiptModal';

function groupByDate(transactions) {
  const groups = {};
  (transactions || []).forEach(t => {
    const d = new Date(t.created_at || t.executed_at || Date.now());
    const key = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups);
}

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [invoiceMap, setInvoiceMap] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const load = () => getAccount(id).then(r => setAccount(r.data));
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(list => {
      const map = {};
      list.forEach(inv => { map[inv.id] = inv; });
      setInvoiceMap(map);
    }).catch(() => {});
  }, [user?.id]);

  const handleDeposit = async () => {
    if (!amount) return;
    setLoading(true);
    await deposit(id, Number(amount));
    setAmount('');
    await load();
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      await withdraw(id, Number(amount));
      setAmount('');
      await load();
    } catch (e) {
      alert(e.response?.data?.error || '출금 실패');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('계좌를 삭제할까요?')) return;
    try {
      await deleteAccount(id);
      navigate('/accounts');
    } catch (e) {
      alert(e.response?.data?.error || '삭제 실패');
    }
  };

  if (!account) return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">로딩 중...</div>
  );

  const grouped = groupByDate(account.transactions);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{account.name}</h1>
        <button onClick={handleDelete} className="text-xs text-slate-400 hover:text-red-500 transition">계좌 삭제</button>
      </div>

      {/* 잔액 카드 */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">잔액</p>
        <p className="text-4xl font-extrabold mt-1 tabular-nums">
          {Number(account.balance).toLocaleString()}
          <span className="text-xl font-semibold text-blue-200 ml-1">원</span>
        </p>
      </div>

      {/* 입출금 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-bold text-slate-900">입출금</h2>
        <input
          type="number"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="금액 입력"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={handleDeposit} disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition disabled:opacity-50">
            + 입금
          </button>
          <button onClick={handleWithdraw} disabled={loading}
            className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-slate-900 active:scale-95 transition disabled:opacity-50">
            - 출금
          </button>
        </div>
      </div>

      {/* 거래내역 - 날짜 그룹핑 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">거래 내역</h2>
        </div>
        {account.transactions?.length === 0 ? (
          <p className="text-slate-400 text-sm px-5 py-8 text-center">거래 내역이 없어요.</p>
        ) : (
          <div>
            {grouped.map(([date, txns]) => (
              <div key={date}>
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400">{date}</p>
                </div>
                <ul>
                  {txns.map(t => {
                    const invoice = t.invoice_id ? invoiceMap[t.invoice_id] : null;
                    const isDeposit = t.type === 'deposit';
                    return (
                      <li key={t.id} className="flex justify-between items-center px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${isDeposit ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
                            {isDeposit ? '↓' : '↑'}
                          </div>
                          <div>
                            <p className="text-slate-800 font-semibold text-sm">
                              {t.description || (isDeposit ? '입금' : '출금')}
                            </p>
                            {invoice?.company_name && (
                              <p className="text-slate-400 text-xs mt-0.5">{invoice.company_name}</p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-1">
                            {invoice && (
                              <button
                                onClick={() => setSelectedInvoice(invoice)}
                                className="text-slate-300 hover:text-emerald-500 transition text-sm"
                                title="청구서 보기"
                              >📄</button>
                            )}
                            {invoice?.status === 'paid' && (
                              <button
                                onClick={() => setSelectedReceipt(invoice)}
                                className="text-slate-300 hover:text-blue-500 transition text-sm"
                                title="영수증 보기"
                              >🧾</button>
                            )}
                          </div>
                        </div>
                        <span className={`text-sm font-extrabold tabular-nums ${isDeposit ? 'text-blue-600' : 'text-red-500'}`}>
                          {isDeposit ? '+' : '-'}{Number(t.amount).toLocaleString()}원
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
      {selectedReceipt && (
        <ReceiptModal invoice={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
}
