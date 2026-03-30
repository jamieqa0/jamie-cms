import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccounts, createAccount } from '../api/accounts';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = () => getAccounts().then(r => setAccounts(r.data)).catch(() => setError('계좌 목록을 불러오지 못했습니다.'));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createAccount(newName);
      setNewName('');
      await load();
    } catch (err) {
      setError(err.message || '계좌 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">내 계좌</h1>
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="계좌 이름 (예: 생활비 계좌)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition sm:w-auto w-full"
        >
          {creating ? '생성 중...' : '계좌 개설'}
        </button>
      </form>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="space-y-3">
        {accounts.map(a => (
          <Link key={a.id} to={`/accounts/${a.id}`}
            className="block bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 transition">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-900">{a.name}</span>
              <span className="text-xl font-bold text-slate-900">{Number(a.balance).toLocaleString()}원</span>
            </div>
          </Link>
        ))}
        {accounts.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">계좌가 없어요. 위에서 만들어보세요!</p>
        )}
      </div>
    </div>
  );
}
