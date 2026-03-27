import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminProducts, deleteProduct } from '../../api/admin';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const load = () => getAdminProducts().then(r => setProducts(r.data));
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('상품을 비활성화할까요?')) return;
    await deleteProduct(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
        <Link to="/admin/products/new"
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition">
          상품 등록
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">상품명</th>
              <th className="px-4 py-3 text-left">카테고리</th>
              <th className="px-4 py-3 text-right">금액</th>
              <th className="px-4 py-3 text-center">결제일</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.category}</td>
                <td className="px-4 py-3 text-right font-medium">{Number(p.amount).toLocaleString()}원</td>
                <td className="px-4 py-3 text-center text-slate-500">매월 {p.billing_day}일</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    {p.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <Link to={`/admin/products/${p.id}`} className="text-blue-500 hover:underline text-xs">수정</Link>
                    <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">등록된 상품이 없어요.</p>
        )}
      </div>
    </div>
  );
}
