import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cancelSubscription, updateSubscription, getSubscriptions } from '../api/subscriptions';

const STATUS_LABEL = { active: '활성', paused: '일시정지', cancelled: '해지' };
const STATUS_COLOR = {
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  paused: 'text-amber-700 bg-amber-50 border-amber-200',
  cancelled: 'text-slate-400 bg-slate-100 border-slate-200',
};

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);

  const load = () => getSubscriptions().then(r => setSubscriptions(r.data));
  useEffect(() => { load(); }, []);

  const handleToggle = async (s) => {
    const newStatus = s.status === 'active' ? 'paused' : 'active';
    await updateSubscription(s.id, newStatus);
    load();
  };

  const handleCancel = async (id) => {
    try {
      await cancelSubscription(id);
      toast.success('구독이 해지되었습니다.');
      setCancelTarget(null);
      load();
    } catch {
      toast.error('해지 처리 중 오류가 발생했습니다.');
    }
  };

  const active = subscriptions.filter(s => s.status === 'active');
  const others = subscriptions.filter(s => s.status !== 'active');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">내 구독</h1>
        {active.length > 0 && (
          <p className="text-slate-400 text-sm mt-0.5">
            월 {active.reduce((s, sub) => s + Number(sub.amount), 0).toLocaleString()}원 납부 중
          </p>
        )}
      </div>

      {subscriptions.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-slate-400 text-sm">구독 중인 상품이 없어요.</p>
          <Link to="/products" className="inline-block text-sm text-blue-500 font-semibold hover:underline">
            상품 둘러보기 →
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(s => (
            <SubscriptionCard key={s.id} s={s} onToggle={handleToggle} onCancel={handleCancel} cancelTarget={cancelTarget} setCancelTarget={setCancelTarget} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">비활성</p>
          <div className="space-y-2">
            {others.map(s => (
              <SubscriptionCard key={s.id} s={s} onToggle={handleToggle} onCancel={handleCancel} cancelTarget={cancelTarget} setCancelTarget={setCancelTarget} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionCard({ s, onToggle, onCancel, cancelTarget, setCancelTarget }) {
  const STATUS_COLOR_MAP = {
    active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    paused: 'text-amber-700 bg-amber-50 border-amber-200',
    cancelled: 'text-slate-400 bg-slate-100 border-slate-200',
  };
  const isConfirming = cancelTarget === s.id;

  return (
    <div className={`bg-white rounded-2xl p-5 border transition ${s.status === 'cancelled' ? 'border-slate-100 opacity-60' : 'border-slate-100 shadow-sm'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 truncate">{s.product_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${STATUS_COLOR_MAP[s.status]}`}>
              {STATUS_LABEL[s.status]}
            </span>
          </div>
          {s.company_name && <p className="text-slate-400 text-xs mt-0.5">{s.company_name}</p>}
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <p className="text-sm font-bold text-slate-900 tabular-nums">{Number(s.amount).toLocaleString()}원</p>
          <p className="text-slate-400 text-xs mt-0.5">매월 {s.billing_day}일</p>
        </div>
      </div>
      {s.status !== 'cancelled' && !isConfirming && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
          <button onClick={() => onToggle(s)}
            className="text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition font-medium">
            {s.status === 'active' ? '일시정지' : '재개'}
          </button>
          <button onClick={() => setCancelTarget(s.id)}
            className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition font-medium">
            해지
          </button>
        </div>
      )}
      {isConfirming && (
        <div className="mt-3 pt-3 border-t border-red-100 space-y-2">
          <p className="text-xs font-semibold text-red-600">정말 구독을 해지할까요?</p>
          <div className="flex gap-2">
            <button onClick={() => onCancel(s.id)}
              className="flex-1 bg-red-600 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-red-700 transition">
              해지 확인
            </button>
            <button onClick={() => setCancelTarget(null)}
              className="flex-1 border border-slate-200 text-slate-600 text-xs font-medium py-1.5 rounded-lg hover:bg-slate-50 transition">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
