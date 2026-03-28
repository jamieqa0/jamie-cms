import { useEffect, useState } from 'react';
import { getAdminTransfers } from '../../api/admin';

export default function AdminTransfers() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { getAdminTransfers().then(r => setLogs(r.data)); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">자동이체 실행 내역</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">회원</th>
              <th className="px-4 py-3 text-left">상품</th>
              <th className="px-4 py-3 text-right">금액</th>
              <th className="px-4 py-3 text-center">결과</th>
              <th className="px-4 py-3 text-left">사유</th>
              <th className="px-4 py-3 text-right">실행일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{l.nickname}</td>
                <td className="px-4 py-3 text-slate-700">{l.product_name}</td>
                <td className="px-4 py-3 text-right font-medium">{Number(l.amount).toLocaleString()}원</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {l.status === 'success' ? '성공' : '실패'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{l.reason || '-'}</td>
                <td className="px-4 py-3 text-right text-slate-400">
                  {new Date(l.executed_at).toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {logs.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">실행 내역이 없어요.</p>
        )}
      </div>
    </div>
  );
}
