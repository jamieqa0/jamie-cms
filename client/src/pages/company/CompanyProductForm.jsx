import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyProduct, createCompanyProduct, updateCompanyProduct } from '../../api/company';

export default function CompanyProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ name: '', amount: '', billing_day: '', category: 'etc', description: '', invoice_day: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getCompanyProduct(id).then(p => setForm({
      name: p.name,
      amount: p.amount,
      billing_day: p.billing_day,
      category: p.category ?? 'etc',
      description: p.description ?? '',
      invoice_day: p.invoice_day != null ? String(p.invoice_day) : '',
    })).catch(() => {});
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const day = Number(form.billing_day);
    if (day < 1 || day > 28) { setError('결제일은 1~28 사이여야 합니다.'); return; }
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        amount: Number(form.amount),
        billing_day: day,
        category: form.category,
        description: form.description || null,
        invoice_day: form.invoice_day ? Number(form.invoice_day) : null,
      };
      if (isEdit) await updateCompanyProduct(id, payload);
      else await createCompanyProduct(user.id, payload);
      navigate('/company/products');
    } catch (err) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? '상품 수정' : '상품 등록'}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">상품명</label>
          <input type="text" required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="월간 구독권" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">상품 설명</label>
          <textarea rows={3} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            placeholder="상품에 대한 설명을 입력하세요" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">금액 (원)</label>
          <input type="number" required min="1" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="29900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">카테고리</label>
          <select required value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="delivery">배송</option>
            <option value="rental">렌탈</option>
            <option value="donation">후원</option>
            <option value="etc">기타</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">결제일 (1~28)</label>
          <input type="number" required min="1" max="28" value={form.billing_day}
            onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="15" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">청구서 발행일 <span className="text-slate-400 font-normal">(선택)</span></label>
          <select value={form.invoice_day}
            onChange={e => setForm(f => ({ ...f, invoice_day: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">미설정</option>
            <option value="1">매월 1일</option>
            <option value="15">매월 15일</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/company/products')}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50">
            {loading ? '저장 중...' : (isEdit ? '수정 저장' : '등록')}
          </button>
        </div>
      </form>
    </div>
  );
}
