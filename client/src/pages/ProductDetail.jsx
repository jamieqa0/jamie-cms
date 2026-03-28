import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from '../api/products';
import { getAccounts } from '../api/accounts';
import { createSubscription } from '../api/subscriptions';

const PAYMENT_METHODS = [
  { value: 'account', label: '계좌이체', available: true },
  { value: 'card', label: '신용카드', available: false },
  { value: 'phone', label: '휴대폰 결제', available: false },
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('account');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProduct(id).then(r => setProduct(r.data));
    getAccounts().then(r => setAccounts(r.data));
  }, [id]);

  const handleSubscribe = async () => {
    if (paymentMethod === 'account' && !selectedAccount) {
      alert('출금 계좌를 선택해주세요');
      return;
    }
    setLoading(true);
    try {
      await createSubscription({ productId: id, accountId: selectedAccount, paymentMethod });
      alert('구독이 완료되었어요!');
      navigate('/subscriptions');
    } catch (e) {
      alert(e.response?.data?.error || '구독 실패');
    }
    setLoading(false);
  };

  if (!product) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-500">월 결제금액</span>
          <span className="font-bold text-slate-900">{Number(product.amount).toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">결제일</span>
          <span className="font-bold text-slate-900">매월 {product.billing_day}일</span>
        </div>
        {product.description && (
          <p className="text-slate-500 text-sm pt-2 border-t border-slate-100">{product.description}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
        <h2 className="font-semibold text-slate-900">결제수단 선택</h2>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => m.available && setPaymentMethod(m.value)}
              disabled={!m.available}
              className={`py-2.5 rounded-lg text-sm font-medium border transition
                ${!m.available
                  ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                  : paymentMethod === m.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
            >
              {m.label}
              {!m.available && <span className="block text-xs font-normal">준비 중</span>}
            </button>
          ))}
        </div>

        {paymentMethod === 'account' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">출금 계좌</p>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
            >
              <option value="">계좌를 선택하세요</option>
              {accounts.filter(a => a.type !== 'collection').map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({Number(a.balance).toLocaleString()}원)
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50"
        >
          {loading ? '처리 중...' : '구독 신청'}
        </button>
      </div>
    </div>
  );
}
