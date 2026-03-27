import { useEffect, useState } from 'react';
import { getAdminUsers } from '../../api/admin';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  useEffect(() => { getAdminUsers().then(r => setUsers(r.data)); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">회원 목록</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">닉네임</th>
              <th className="px-4 py-3 text-left">이메일</th>
              <th className="px-4 py-3 text-center">역할</th>
              <th className="px-4 py-3 text-right">가입일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{u.nickname}</td>
                <td className="px-4 py-3 text-slate-500">{u.email || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                    {u.role}
                  </span>
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
  );
}
