import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccount, deposit, withdraw, deleteAccount } from '../api/accounts';
import { getInvoiceById } from '../api/invoices';
import InvoiceModal from '../components/InvoiceModal';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const load = () => getAccount(id).then(r => setAccount(r.data));
  useEffect(() => { load(); }, [id]);

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

  const handleOpenInvoice = async (invoiceId) => {
    try {
      const inv = await getInvoiceById(invoiceId);
      setSelectedInvoice(inv);
    } catch {
      alert('청구서를 불러올 수 없습니다.');
    }
  };

  if (!account) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
        <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">계좌 삭제</button>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <p className="text-slate-500 text-sm">잔액</p>
        <p className="text-4xl font-bold text-slate-900 mt-1">{Number(account.balance).toLocaleString()}원</p>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-semibold text-slate-900">입출금</h2>
        <input
          type="number"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="금액 입력"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={handleDeposit} disabled={loading}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition">
            입금
          </button>
          <button onClick={handleWithdraw} disabled={loading}
            className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition">
            출금
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-4">거래 내역</h2>
        {account.transactions?.length === 0 ? (
          <p className="text-slate-400 text-sm">거래 내역이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {account.transactions?.map(t => (
              <li key={t.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-sm">{t.description || t.type}</span>
                  {t.invoice_id && (
                    <button
                      onClick={() => handleOpenInvoice(t.invoice_id)}
                      className="text-slate-400 hover:text-emerald-600 transition text-base leading-none"
                      title="청구서 보기"
                    >
                      📄
                    </button>
                  )}
                </div>
                <span className={`text-sm font-medium ${t.type === 'deposit' ? 'text-blue-600' : 'text-red-500'}`}>
                  {t.type === 'deposit' ? '+' : '-'}{Number(t.amount).toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
