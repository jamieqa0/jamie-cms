import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyProducts, deleteCompanyProduct } from '../../api/company';

export default function CompanyProducts() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);

  const load = () => {
    if (!user?.id) return;
    getCompanyProducts(user.id).then(setProducts).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const handleDelete = async (id) => {
    if (!confirm('상품을 삭제할까요?')) return;
    await deleteCompanyProduct(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
        <Link to="/company/products/new"
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
          + 상품 등록
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">상품명</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">결제일</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">등록된 상품이 없습니다.</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-5 py-3 text-slate-700">{Number(p.amount).toLocaleString()}원</td>
                <td className="px-5 py-3 text-slate-500">매월 {p.billing_day}일</td>
                <td className="px-5 py-3 text-right space-x-2">
                  <Link to={`/company/products/${p.id}`}
                    className="text-emerald-600 hover:underline text-xs">수정</Link>
                  <button onClick={() => handleDelete(p.id)}
                    className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
