import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    supabase
      .from('users')
      .select('id, nickname, email, created_at, companies(industry, commission_rate)')
      .eq('role', 'company')
      .order('created_at', { ascending: false })
      .then(({ data }) => setCompanies(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">업체 관리</h1>
        <Link
          to="/admin/companies/new"
          className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 transition"
        >
          + 업체 등록
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">업체명</th>
              <th className="px-5 py-3 font-medium">업종</th>
              <th className="px-5 py-3 font-medium">수수료</th>
              <th className="px-5 py-3 font-medium">이메일</th>
              <th className="px-5 py-3 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">등록된 업체가 없습니다.</td></tr>
            )}
            {companies.map(c => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{c.nickname}</td>
                <td className="px-5 py-3 text-slate-500">{c.companies?.industry || '-'}</td>
                <td className="px-5 py-3 text-slate-700">{c.companies?.commission_rate != null ? `${c.companies.commission_rate}%` : '-'}</td>
                <td className="px-5 py-3 text-slate-500">{c.email}</td>
                <td className="px-5 py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
