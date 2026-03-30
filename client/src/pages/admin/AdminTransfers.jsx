import { useEffect, useState } from 'react';
import { getAdminTransfers } from '../../api/admin';

export default function AdminTransfers() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { getAdminTransfers().then(r => setLogs(r.data)); }, []);

  const StatusBadge = ({ status }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full ${status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
      {status === 'success' ? '성공' : '실패'}
    </span>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">자동이체 실행 내역</h1>

      {/* 데스크탑 테이블 */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">회원</th>
                <th className="px-4 py-3 text-left">상품 / 업체</th>
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
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{l.product_name}</p>
                    {l.company_name && <p className="text-slate-400 text-xs mt-0.5">{l.company_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{Number(l.amount).toLocaleString()}원</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={l.status} /></td>
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

      {/* 모바일 카드 */}
      <div className="sm:hidden space-y-2">
        {logs.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-100 text-sm">실행 내역이 없어요.</div>
        )}
        {logs.map(l => (
          <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{l.nickname}</p>
                <p className="text-slate-500 text-xs mt-0.5">{l.product_name}{l.company_name ? ` · ${l.company_name}` : ''}</p>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="font-bold text-slate-900 tabular-nums">{Number(l.amount).toLocaleString()}원</p>
              <p className="text-slate-400 text-xs">{new Date(l.executed_at).toLocaleDateString('ko-KR')}</p>
            </div>
            {l.reason && (
              <p className="text-red-500 text-xs mt-1.5 pt-1.5 border-t border-slate-50">{l.reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
