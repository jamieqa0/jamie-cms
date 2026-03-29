import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyUnpaid } from '../../api/company';
import { retryBilling, retryBillingBulk } from '../../api/admin';

export default function CompanyUnpaid() {
  const { user } = useAuthStore();
  const [unpaid, setUnpaid] = useState([]);
  const [retrying, setRetrying] = useState(null);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const load = () => {
    if (!user?.id) return;
    getCompanyUnpaid(user.id).then(data => {
      setUnpaid(data);
      setSelected(new Set());
    }).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const allIds = unpaid.map(u => u.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  const handleBulkRetry = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 일괄 재청구할까요?`)) return;
    setBulkRetrying(true);
    try {
      const result = await retryBillingBulk(Array.from(selected));
      const { success, failed, failures } = result.data;
      if (failed > 0) {
        const reasons = failures.map(f => f.reason).join('\n');
        alert(`완료: 성공 ${success}건, 실패 ${failed}건\n\n실패 사유:\n${reasons}`);
      } else {
        alert(`${success}건 재청구 완료!`);
      }
      load();
    } catch (e) {
      alert(e.response?.data?.error || '일괄 재청구 실패');
    } finally {
      setBulkRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">미수납 관리</h1>
        {selected.size > 0 && (
          <button
            onClick={handleBulkRetry}
            disabled={bulkRetrying}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            {bulkRetrying ? '재청구 중...' : `선택 ${selected.size}건 일괄 재청구`}
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
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
              <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">미수납 내역이 없습니다.</td></tr>
            )}
            {unpaid.map(u => (
              <tr key={u.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 ${selected.has(u.id) ? 'bg-red-50/30' : ''}`}>
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-5 py-3 text-slate-500">{new Date(u.executed_at).toLocaleDateString('ko-KR')}</td>
                <td className="px-5 py-3 text-slate-700">{u.user_nickname}</td>
                <td className="px-5 py-3 text-slate-700">{u.product_name}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{Number(u.amount).toLocaleString()}원</td>
                <td className="px-5 py-3 text-red-500 text-xs">{u.reason || '-'}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRetry(u.id)}
                    disabled={retrying === u.id || bulkRetrying}
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
