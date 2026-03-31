import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getProduct } from '../api/products';
import { getAccounts } from '../api/accounts';
import { createSubscription, getSubscriptions } from '../api/subscriptions';

const PAYMENT_METHODS = [
  { value: 'account', label: '계좌이체', icon: '🏦', available: true },
  { value: 'card',    label: '카드',     icon: '💳', available: false },
  { value: 'phone',   label: '휴대폰결제', icon: '📱', available: false },
  { value: 'pay',     label: '간편페이',  icon: '⚡', available: false },
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('account');
  const [loading, setLoading] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    getProduct(id).then(r => setProduct(r.data));
    getAccounts().then(r => setAccounts(r.data));
    getSubscriptions().then(r => {
      const active = r.data.filter(s => s.status === 'active' || s.status === 'paused');
      setAlreadySubscribed(active.some(s => s.product_id === id));
    }).catch(console.error);
  }, [id]);

  const handleSubscribe = async () => {
    if (paymentMethod === 'account' && !selectedAccount) {
      toast.error('출금 계좌를 선택해주세요');
      return;
    }
    setLoading(true);
    try {
      await createSubscription({ productId: id, accountId: selectedAccount, paymentMethod });
      toast.success('구독이 완료되었어요!');
      navigate('/subscriptions');
    } catch (e) {
      toast.error(e.response?.data?.error || '구독 실패');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-700 transition flex items-center gap-1">
        ← 뒤로
      </button>
      <div className="space-y-1">
        {product.company?.nickname && (
          <p className="text-sm font-medium text-blue-600">{product.company.nickname}</p>
        )}
        <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
      </div>
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
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => m.available && setPaymentMethod(m.value)}
              disabled={!m.available}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                m.available && paymentMethod === m.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : m.available
                    ? 'border-slate-200 text-slate-500 hover:border-slate-300'
                    : 'border-slate-100 text-slate-300 cursor-not-allowed opacity-50'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
              {!m.available && (
                <span className="ml-auto text-xs">준비중</span>
              )}
            </button>
          ))}
        </div>

        {paymentMethod === 'account' && (
          accounts.length === 0 ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-500">등록된 계좌가 없습니다.</p>
              <Link to="/accounts"
                className="inline-block w-full bg-slate-800 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-700 transition text-center">
                계좌 등록하러 가기 →
              </Link>
            </div>
          ) : (
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
          )
        )}

        {paymentMethod !== 'account' && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-center text-sm text-slate-400">
            해당 결제수단은 현재 준비 중입니다.
          </div>
        )}

        {alreadySubscribed ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center space-y-1">
            <p className="text-sm font-semibold text-slate-600">이미 구독 중인 상품입니다</p>
            <button onClick={() => navigate('/subscriptions')} className="text-xs text-blue-500 hover:underline">
              구독 내역 보기 →
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              구독 신청 시{' '}
              <button onClick={() => alert('서비스 이용약관 준비 중입니다.')} className="underline underline-offset-2 hover:text-slate-600 transition">이용약관</button>
              {' '}및{' '}
              <button onClick={() => alert('개인정보 처리방침 준비 중입니다.')} className="underline underline-offset-2 hover:text-slate-600 transition">개인정보 처리방침</button>
              {' '}및{' '}
              <button onClick={() => alert('자동이체 출금 동의서 준비 중입니다.')} className="underline underline-offset-2 hover:text-slate-600 transition">자동이체 출금 동의서</button>
              에 동의한 것으로 간주합니다.{' '}
              <span className="text-slate-300">(준비중)</span>
            </p>
            <button
              onClick={handleSubscribe}
              disabled={loading || paymentMethod !== 'account' || accounts.length === 0}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? '처리 중...' : '구독 신청'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
