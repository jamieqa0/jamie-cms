import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyProducts, createConsentRequest } from '../../api/company';

export default function CompanyCustomerForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customerName: '', customerContact: '', productId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyProducts(user.id).then(setProducts).catch(() => {});
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.productId) { setError('상품을 선택해주세요.'); return; }
    setLoading(true);
    try {
      const req = await createConsentRequest({
        companyId: user.id,
        productId: form.productId,
        customerName: form.customerName,
        customerContact: form.customerContact,
      });
      const link = `${window.location.origin}/consent/${req.invite_token}`;
      navigator.clipboard.writeText(link);
      alert(`동의 요청이 생성되었습니다.\n링크가 클립보드에 복사되었습니다:\n${link}`);
      navigate('/company/customers');
    } catch (err) {
      setError(err.message || '등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">동의 요청 생성</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">고객명</label>
          <input type="text" required value={form.customerName}
            onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="홍길동" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">연락처</label>
          <input type="text" required value={form.customerContact}
            onChange={e => setForm(f => ({ ...f, customerContact: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="010-1234-5678" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">상품 선택</label>
          <select required value={form.productId}
            onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">-- 상품을 선택하세요 --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({Number(p.amount).toLocaleString()}원 / 매월 {p.billing_day}일)</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400">생성된 링크는 30일 후 만료됩니다.</p>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/company/customers')}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50">
            {loading ? '생성 중...' : '요청 생성 + 링크 복사'}
          </button>
        </div>
      </form>
    </div>
  );
}
