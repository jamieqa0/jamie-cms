import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyStats, getCompanyUnpaid, getCompanyAccount } from '../../api/company';

export default function CompanyDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyStats(user.id).then(setStats).catch(() => {});
    getCompanyUnpaid(user.id).then(data => setUnpaidCount(data?.length ?? 0)).catch(() => {});
    getCompanyAccount(user.id).then(setAccount).catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">업체 대시보드</h1>
      {/* 업체 계좌 잔액 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <p className="text-slate-500 text-sm">정산 계좌 잔액</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">
          {account != null ? `${Number(account.balance).toLocaleString()}원` : '-'}
        </p>
        <p className="text-slate-400 text-xs mt-1">자동이체 정산 후 자동 입금됩니다</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <p className="text-green-600 text-sm">이번 달 수납률</p>
          <p className="text-3xl font-bold text-green-700 mt-1">
            {stats ? `${stats.successRate}%` : '-'}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
          <p className="text-blue-600 text-sm">총 수납액</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {stats ? `${Number(stats.totalAmount).toLocaleString()}원` : '-'}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-red-600 text-sm">미수납 건수</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{stats ? `${stats.failCount}건` : '-'}</p>
        </div>
      </div>
      {unpaidCount > 0 && (
        <Link
          to="/company/unpaid"
          className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-5 hover:border-red-400 transition"
        >
          <div>
            <p className="text-red-600 text-sm font-semibold">⚠ 미수납 내역</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{unpaidCount}건 미처리</p>
          </div>
          <span className="text-red-400 text-xl">→</span>
        </Link>
      )}
      <div className="flex gap-3">
        <Link to="/company/customers/new"
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
          + 고객 등록
        </Link>
        <Link to="/company/products/new"
          className="border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">
          + 상품 등록
        </Link>
      </div>
    </div>
  );
}
