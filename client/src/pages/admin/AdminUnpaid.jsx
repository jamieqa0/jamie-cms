import { useEffect, useState } from 'react';
import { getUnpaid, retryBilling } from '../../api/admin';

export default function AdminUnpaid() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const fetchUnpaid = async () => {
    try {
      const res = await getUnpaid();
      setLogs(res.data);
    } catch {
      setError('미수납 내역을 불러오지 못했습니다.');
    }
  };

  useEffect(() => { fetchUnpaid(); }, []);

  const handleRetry = async (id) => {
    if (!confirm('이 건을 재청구 하시겠습니까?')) return;
    setRetrying(id);
    try {
      await retryBilling(id);
      alert('재청구 완료');
      fetchUnpaid();
    } catch (e) {
      alert(e.response?.data?.error || '재청구 실패');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">미수납 내역 관리</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {logs.length === 0 && !error ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-400 border border-slate-100">
          미수납 내역이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">날짜</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">회원</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">상품</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">금액</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">실패 사유</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(log.executed_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{log.nickname}</td>
                  <td className="px-4 py-3 text-slate-700">{log.product_name}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {Number(log.amount).toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-red-600 text-xs">{log.reason || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRetry(log.id)}
                      disabled={retrying === log.id}
                      className="px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
                    >
                      {retrying === log.id ? '처리 중...' : '재청구'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
