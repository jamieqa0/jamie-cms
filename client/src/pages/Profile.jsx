import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { updateMe } from '../api/auth';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) setNickname(user.nickname); }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateMe({ nickname });
    setUser({ ...user, nickname: res.data.nickname });
    setSaving(false);
    alert('저장되었어요!');
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">프로필</h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">닉네임</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
            <p className="text-slate-500 text-sm">{user?.email || '이메일 없음'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">역할</label>
            <p className="text-slate-500 text-sm">{user?.role}</p>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium hover:bg-slate-700 transition">
            저장
          </button>
        </form>
      </div>
    </div>
  );
}
