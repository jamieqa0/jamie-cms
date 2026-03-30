import { useEffect, useState } from 'react';
import { getAdminUsers } from '../../api/admin';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getAdminUsers().then(r => {
      setUsers((r.data ?? []).filter(u => u.role === 'user'));
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">일반 회원</h1>
        <span className="text-sm text-slate-400">{users.length}명</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">닉네임</th>
                <th className="px-4 py-3 text-left">이메일</th>
                <th className="px-4 py-3 text-center">가입 유형</th>
                <th className="px-4 py-3 text-right">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">일반 회원이 없습니다.</td>
                </tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.nickname}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {u.is_kakao
                      ? <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">카카오</span>
                      : <span className="text-xs bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">이메일</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
