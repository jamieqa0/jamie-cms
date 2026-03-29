import { useEffect, useState } from 'react';
import { cancelSubscription, updateSubscription, getSubscriptions } from '../api/subscriptions';

const STATUS_LABEL = { active: '활성', paused: '일시정지', cancelled: '해지' };
const STATUS_COLOR = { active: 'text-green-600 bg-green-50', paused: 'text-yellow-600 bg-yellow-50', cancelled: 'text-slate-400 bg-slate-100' };

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);

  const load = () => getSubscriptions().then(r => setSubscriptions(r.data));
  useEffect(() => { load(); }, []);

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
    </div>
  );
}
