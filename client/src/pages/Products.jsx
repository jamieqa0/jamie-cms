import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../api/products';

const CATEGORY_LABEL = {
  delivery: '배달/배송',
  rental: '렌탈',
  donation: '기부금',
  etc: '기타',
};

export default function Products() {
  const [products, setProducts] = useState([]);

  useEffect(() => { getProducts().then(r => setProducts(r.data)); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">CMS 상품</h1>
      <div className="grid gap-4">
        {products.map(p => (
          <Link key={p.id} to={`/products/${p.id}`}
            className="block bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 transition">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {CATEGORY_LABEL[p.category] || p.category}
                </span>
                <p className="font-semibold text-slate-900 mt-1">{p.name}</p>
                <p className="text-slate-500 text-sm mt-0.5">{p.description}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">{Number(p.amount).toLocaleString()}원</p>
                <p className="text-slate-400 text-xs">매월 {p.billing_day}일</p>
              </div>
            </div>
          </Link>
        ))}
        {products.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">등록된 상품이 없어요.</p>
        )}
      </div>
    </div>
  );
}
