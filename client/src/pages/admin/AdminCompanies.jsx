import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const INDUSTRY_OPTIONS = ['교육', '의료', '구독서비스', '배달/배송', '렌탈', '기부금', '기타'];

function EditModal({ company, onClose, onSave }) {
  const [industry, setIndustry] = useState(company.companies?.industry || '');
  const [commission, setCommission] = useState(company.companies?.commission_rate ?? 0);
  const [nickname, setNickname] = useState(company.nickname);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('users').update({ nickname }).eq('id', company.id);
      await supabase.from('companies').update({
        industry,
        commission_rate: Number(commission),
      }).eq('user_id', company.id);
      onSave();
    } catch (e) {
      alert('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">업체 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">업체명</label>
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">업종</label>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              <option value="">선택 안 함</option>
              {INDUSTRY_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">수수료율 (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={commission}
              onChange={e => setCommission(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
            취소
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([]);
  const [editTarget, setEditTarget] = useState(null);

  const load = () => {
    supabase
      .from('users')
      .select('id, nickname, email, created_at, companies(industry, commission_rate)')
      .eq('role', 'company')
      .order('created_at', { ascending: false })
      .then(({ data }) => setCompanies(data ?? []));
  };

  useEffect(load, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">업체 관리</h1>
        <Link
          to="/admin/companies/new"
          className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition"
        >
          + 업체 등록
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">업체명</th>
              <th className="px-5 py-3 font-medium">업종</th>
              <th className="px-5 py-3 font-medium">수수료</th>
              <th className="px-5 py-3 font-medium">이메일</th>
              <th className="px-5 py-3 font-medium">등록일</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">등록된 업체가 없습니다.</td></tr>
            )}
            {companies.map(c => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-semibold text-slate-900">{c.nickname}</td>
                <td className="px-5 py-3 text-slate-500">{c.companies?.industry || '-'}</td>
                <td className="px-5 py-3 text-slate-700">{c.companies?.commission_rate != null ? `${c.companies.commission_rate}%` : '-'}</td>
                <td className="px-5 py-3 text-slate-500">{c.email}</td>
                <td className="px-5 py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setEditTarget(c)}
                    className="text-xs text-violet-600 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition font-medium"
                  >
                    수정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>


      {editTarget && (
        <EditModal
          company={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={() => { setEditTarget(null); load(); }}
        />
      )}
    </div>
  );
}
