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
  const [filter, setFilter] = useState('all');

  useEffect(() => { getProducts().then(r => setProducts(r.data)); }, []);

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">CMS 상품</h1>

      {/* 카테고리 필터 */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                filter === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
              }`}
            >
              {cat === 'all' ? '전체' : (CATEGORY_LABEL[cat] || cat)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map(p => (
          <Link key={p.id} to={`/products/${p.id}`}
            className="block bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                {p.category && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                    {CATEGORY_LABEL[p.category] || p.category}
                  </span>
                )}
                <p className="font-bold text-slate-900 mt-1">{p.name}</p>
                {p.description && <p className="text-slate-500 text-sm mt-0.5 truncate">{p.description}</p>}
              </div>
              <div className="text-right ml-4 flex-shrink-0">
                <p className="font-extrabold text-slate-900 tabular-nums">{Number(p.amount).toLocaleString()}원</p>
                <p className="text-slate-400 text-xs mt-0.5">매월 {p.billing_day}일</p>
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">
            {products.length === 0 ? '등록된 상품이 없어요.' : '해당 카테고리의 상품이 없어요.'}
          </p>
        )}
      </div>
    </div>
  );
}
