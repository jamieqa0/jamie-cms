import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const INDUSTRY_OPTIONS = [
  { value: '식품', rate: 3.5 },
  { value: '금융', rate: 2.0 },
  { value: '렌탈', rate: 3.0 },
  { value: '자선', rate: 1.5 },
  { value: '기타', rate: null },
];

export default function AdminCompanyForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', nickname: '', industry: '', commission_rate: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleIndustryChange = (value) => {
    const option = INDUSTRY_OPTIONS.find(o => o.value === value);
    setForm(f => ({
      ...f,
      industry: value,
      commission_rate: option?.rate != null ? String(option.rate) : '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.nickname, role: 'company' } },
      });
      if (signUpError) throw signUpError;
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
      const { error: companyError } = await supabase.from('companies').insert({
        user_id: data.user.id,
        industry: form.industry || null,
        commission_rate: form.commission_rate !== '' ? Number(form.commission_rate) : null,
      });
      if (companyError) throw companyError;
      const { error: accountError } = await supabase.from('accounts').insert({
        user_id: data.user.id,
        name: `${form.nickname} 정산 계좌`,
        type: 'company',
        balance: 0,
      });
      if (accountError) throw accountError;
      navigate('/admin/companies');
    } catch (err) {
      setError(err.message || '업체 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const rateDisabled = form.industry !== '' && form.industry !== '기타';

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">업체 등록</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">업체명</label>
          <input type="text" required value={form.nickname}
            onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="(주)예시업체" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
          <input type="email" required value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="company@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
          <input type="password" required minLength={6} value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="6자 이상" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">업종</label>
          <select value={form.industry} onChange={e => handleIndustryChange(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">선택</option>
            {INDUSTRY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.value}{o.rate != null ? ` (${o.rate}%)` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">수수료 (%)</label>
          <input type="number" min="0" max="100" step="0.1"
            value={form.commission_rate}
            onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
            disabled={rateDisabled}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="3.5" />
          {rateDisabled && <p className="text-xs text-slate-400 mt-1">업종 기본 수수료 자동 적용</p>}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/admin/companies')}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50">
            {loading ? '등록 중...' : '업체 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
