import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyUnpaid } from '../../api/company';
import { retryBilling } from '../../api/admin';

export default function CompanyUnpaid() {
  const { user } = useAuthStore();
  const [unpaid, setUnpaid] = useState([]);
  const [retrying, setRetrying] = useState(null);

  const load = () => {
    if (!user?.id) return;
    getCompanyUnpaid(user.id).then(setUnpaid).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const handleRetry = async (id) => {
    if (!confirm('재청구를 실행할까요?')) return;
    setRetrying(id);
    try {
      await retryBilling(id);
      alert('재청구 완료!');
      load();
    } catch (e) {
      alert(e.response?.data?.error || '재청구 실패');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">미수납 관리</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">날짜</th>
              <th className="px-5 py-3 font-medium">고객</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">실패 사유</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {unpaid.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">미수납 내역이 없습니다.</td></tr>
            )}
            {unpaid.map(u => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{new Date(u.billed_at).toLocaleDateString('ko-KR')}</td>
                <td className="px-5 py-3 text-slate-700">{u.user_nickname}</td>
                <td className="px-5 py-3 text-slate-700">{u.product_name}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{Number(u.amount).toLocaleString()}원</td>
                <td className="px-5 py-3 text-red-500 text-xs">{u.reason || '-'}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRetry(u.id)}
                    disabled={retrying === u.id}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                  >
                    {retrying === u.id ? '재청구 중...' : '재청구'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
