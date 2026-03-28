import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyCustomers } from '../../api/company';

const STATUS_LABEL = { pending: '대기', accepted: '수락', rejected: '거절' };
const STATUS_COLOR = { pending: 'text-yellow-600 bg-yellow-50', accepted: 'text-green-600 bg-green-50', rejected: 'text-red-600 bg-red-50' };

export default function CompanyCustomers() {
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyCustomers(user.id).then(setCustomers).catch(() => {});
  }, [user?.id]);

  const copyLink = (token) => {
    const url = `${window.location.origin}/consent/${token}`;
    navigator.clipboard.writeText(url);
    alert('링크가 복사되었습니다.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">고객 관리</h1>
        <Link to="/company/customers/new"
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
          + 동의 요청
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">고객명</th>
              <th className="px-5 py-3 font-medium">연락처</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium">동의 링크</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">등록된 고객이 없습니다.</td></tr>
            )}
            {customers.map(c => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{c.customer_name}</td>
                <td className="px-5 py-3 text-slate-500">{c.customer_contact}</td>
                <td className="px-5 py-3 text-slate-700">{c.products?.name}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {c.status === 'pending' && (
                    <button onClick={() => copyLink(c.invite_token)}
                      className="text-emerald-600 hover:underline text-xs">링크 복사</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
