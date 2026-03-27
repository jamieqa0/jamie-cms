import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from '../api/products';
import { getAccounts } from '../api/accounts';
import { createSubscription } from '../api/subscriptions';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProduct(id).then(r => setProduct(r.data));
    getAccounts().then(r => setAccounts(r.data));
  }, [id]);

  const handleSubscribe = async () => {
    if (!selectedAccount) { alert('계좌를 선택해주세요'); return; }
    setLoading(true);
    try {
      await createSubscription(id, selectedAccount);
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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-semibold text-slate-900">결제 계좌 선택</h2>
        <select
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          value={selectedAccount}
          onChange={e => setSelectedAccount(e.target.value)}
        >
          <option value="">계좌를 선택하세요</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name} ({Number(a.balance).toLocaleString()}원)
            </option>
          ))}
        </select>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition"
        >
          구독 신청
        </button>
      </div>
    </div>
  );
}
