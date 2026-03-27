import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccounts, createAccount } from '../api/accounts';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => getAccounts().then(r => setAccounts(r.data));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    await createAccount(newName);
    setNewName('');
    await load();
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">내 계좌</h1>
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="계좌 이름 (예: 생활비 계좌)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
        >
          계좌 개설
        </button>
      </form>
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
