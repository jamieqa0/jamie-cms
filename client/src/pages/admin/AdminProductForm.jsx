import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, getAdminProduct } from '../../api/admin';

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({
    name: '', category: 'etc', description: '', amount: '', billing_day: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getAdminProduct(id).then(r => setForm(r.data));
    }
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await updateProduct(id, form);
      else await createProduct(form);
      navigate('/admin/products');
    } catch (e) {
      alert(e.response?.data?.error || '저장 실패');
    }
    setSaving(false);
  };

  const field = (label, key, type = 'text', extra = {}) => (
    <div key={key}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        {...extra}
      />
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? '상품 수정' : '상품 등록'}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
        {field('상품명', 'name', 'text', { required: true })}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">카테고리</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
          >
            <option value="delivery">배달/배송</option>
            <option value="rental">렌탈</option>
            <option value="donation">기부금</option>
            <option value="etc">기타</option>
          </select>
        </div>
        {field('결제 금액 (원)', 'amount', 'number', { required: true, min: 1 })}
        {field('매월 결제일 (1~28)', 'billing_day', 'number', { required: true, min: 1, max: 28 })}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button type="submit" disabled={saving}
          className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition">
          {saving ? '저장 중...' : isEdit ? '수정 완료' : '상품 등록'}
        </button>
      </form>
    </div>
  );
}
