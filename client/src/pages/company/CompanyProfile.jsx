import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getMyCompany, getCompanyAccount } from '../../api/company';
import { getAccount } from '../../api/accounts';

export default function CompanyProfile() {
  const { user } = useAuthStore();
  const [company, setCompany] = useState(null);
  const [companyAccount, setCompanyAccount] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getMyCompany(user.id).then(setCompany).catch(() => {});
    getCompanyAccount(user.id)
      .then(acc => getAccount(acc.id))
      .then(res => setCompanyAccount(res.data))
      .catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{user?.nickname}</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-3">업체 정보</h2>
        <div className="text-sm divide-y divide-slate-50">
          <div className="flex justify-between py-2">
            <span className="text-slate-500">업체명</span>
            <span className="font-medium text-slate-800">{user?.nickname}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">이메일</span>
            <span className="text-slate-700">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">업종</span>
            <span className="text-slate-700">{company?.industry || '-'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-500">수수료율</span>
            <span className="font-medium text-slate-800">{company?.commission_rate != null ? `${company.commission_rate}%` : '-'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-3">정산 계좌</h2>
        {companyAccount ? (
          <>
            <p className="text-xs text-slate-400 mb-1">{companyAccount.name}</p>
            <p className="text-3xl font-bold text-slate-900">{Number(companyAccount.balance).toLocaleString()}원</p>
          </>
        ) : (
          <p className="text-slate-400 text-sm">정산 계좌 정보를 불러올 수 없습니다.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-4">정산 내역</h2>
        {!companyAccount?.transactions || companyAccount.transactions.length === 0 ? (
          <p className="text-slate-400 text-sm">정산 내역이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {companyAccount.transactions.map(t => (
              <li key={t.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-slate-600 text-sm">{t.description || t.type}</p>
                  <p className="text-slate-400 text-xs">{new Date(t.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <span className={`text-sm font-medium ${t.type === 'deposit' ? 'text-blue-600' : 'text-red-500'}`}>
                  {t.type === 'deposit' ? '+' : '-'}{Number(t.amount).toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
