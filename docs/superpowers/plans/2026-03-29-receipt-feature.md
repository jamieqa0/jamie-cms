# 전자영수증 + 거래내역 개선 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유저 거래내역에 업체명을 표시하고, 자동이체 성공 건에 국세청 현금영수증 스타일 전자영수증 아이콘을 추가한다.

**Architecture:** 기존 invoices 데이터(invoice_id → company_name, billing_log_id 포함)를 재활용해 별도 API 추가 없이 구현한다. ReceiptModal 컴포넌트를 신규 생성하고, AccountDetail에서 getUserInvoices를 미리 로드해 거래별 매핑에 사용한다.

**Tech Stack:** React + Tailwind, window.print() 인쇄

---

## File Map

| 역할 | 파일 |
|------|------|
| 신규 | `client/src/components/ReceiptModal.jsx` |
| 수정 | `client/src/pages/AccountDetail.jsx` |

---

## Task 1: ReceiptModal.jsx — 국세청 현금영수증 스타일 컴포넌트

**Files:**
- Create: `client/src/components/ReceiptModal.jsx`

props: `{ invoice, onClose }`

invoice 필드 활용:
- `billing_log_id` → 승인번호 (앞 8자리 대문자)
- `company_name` → 가맹점명
- `product_name` → 상품명
- `amount` → 합계
- `supply_amount` → 공급가액
- `vat` → 부가세
- `paid_at` → 거래일시

- [ ] **Step 1: ReceiptModal.jsx 작성**

```jsx
// client/src/components/ReceiptModal.jsx

export default function ReceiptModal({ invoice, onClose }) {
  if (!invoice || invoice.status !== 'paid') return null;

  const approvalNo = invoice.billing_log_id
    ? invoice.billing_log_id.replace(/-/g, '').slice(0, 8).toUpperCase()
    : '--------';

  const paidAt = invoice.paid_at
    ? new Date(invoice.paid_at).toLocaleString('ko-KR')
    : '-';

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:bg-white print:inset-auto print:flex print:items-start print:justify-center">
      <div className="bg-white w-full max-w-xs shadow-xl print:shadow-none" style={{ fontFamily: 'monospace' }}>

        {/* 상단 헤더 */}
        <div className="text-center py-4 border-b-2 border-dashed border-slate-300 px-5">
          <div className="text-xs text-slate-400 mb-1">국세청 승인</div>
          <div className="text-2xl font-black tracking-widest text-slate-900">현금영수증</div>
          <div className="text-xs text-slate-500 mt-1">CASH RECEIPT</div>
        </div>

        {/* 승인번호 */}
        <div className="px-5 py-3 border-b border-dashed border-slate-200">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">승인번호</span>
            <span className="font-bold text-slate-800 tracking-widest">{approvalNo}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-400">거래일시</span>
            <span className="text-slate-700">{paidAt}</span>
          </div>
        </div>

        {/* 가맹점 정보 */}
        <div className="px-5 py-3 border-b border-dashed border-slate-200">
          <div className="text-xs text-slate-400 mb-1.5">[ 가맹점 정보 ]</div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">상호</span>
            <span className="font-medium text-slate-800">{invoice.company_name}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">사업자번호</span>
            <span className="text-slate-700">000-00-00000</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">상품명</span>
            <span className="text-slate-700">{invoice.product_name}</span>
          </div>
        </div>

        {/* 금액 내역 */}
        <div className="px-5 py-3 border-b border-dashed border-slate-200">
          <div className="text-xs text-slate-400 mb-1.5">[ 결제 금액 ]</div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">공급가액</span>
            <span className="text-slate-700">{Number(invoice.supply_amount).toLocaleString()} 원</span>
          </div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500">부가세(10%)</span>
            <span className="text-slate-700">{Number(invoice.vat).toLocaleString()} 원</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-2">
            <span className="text-slate-900">합 계</span>
            <span className="text-slate-900">{Number(invoice.amount).toLocaleString()} 원</span>
          </div>
        </div>

        {/* 하단 안내 + 도장 */}
        <div className="px-5 py-4 relative">
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            현금영수증 문의: 국세청 홈택스 (www.hometax.go.kr)<br />
            현금영수증 상담전화: 126
          </p>
          {/* 승인완료 도장 */}
          <div className="absolute top-3 right-5 w-14 h-14 border-2 border-red-500 rounded-full flex items-center justify-center rotate-12 opacity-70">
            <span className="text-red-500 text-xs font-black text-center leading-tight">승인<br/>완료</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            인쇄 / PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-700 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ReceiptModal.jsx
git commit -m "feat: add ReceiptModal with 국세청 cash receipt style"
```

---

## Task 2: AccountDetail.jsx — 업체명 표시 + 영수증 아이콘

**Files:**
- Modify: `client/src/pages/AccountDetail.jsx`

변경 사항:
1. `getUserInvoices` import 추가 (기존 `getInvoiceById` 대체)
2. `useAuthStore` import 추가
3. `supabase` import 추가
4. `invoiceMap` state 추가 (invoice_id → invoice 매핑)
5. mount 시 getUserInvoices 로드 → invoiceMap 빌드
6. 거래 항목에 업체명 표시 (invoice.company_name)
7. 📄 청구서 아이콘 유지 (기존)
8. 🧾 영수증 아이콘 추가 (invoice.status === 'paid'일 때)
9. ReceiptModal import + state + 렌더링

- [ ] **Step 1: AccountDetail.jsx 전체 교체**

```jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccount, deposit, withdraw, deleteAccount } from '../api/accounts';
import { getUserInvoices } from '../api/invoices';
import { useAuthStore } from '../store/authStore';
import InvoiceModal from '../components/InvoiceModal';
import ReceiptModal from '../components/ReceiptModal';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [invoiceMap, setInvoiceMap] = useState({});   // invoice_id → invoice
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const load = () => getAccount(id).then(r => setAccount(r.data));
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    getUserInvoices(user.id).then(list => {
      const map = {};
      list.forEach(inv => { map[inv.id] = inv; });
      setInvoiceMap(map);
    }).catch(() => {});
  }, [user?.id]);

  const handleDeposit = async () => {
    if (!amount) return;
    setLoading(true);
    await deposit(id, Number(amount));
    setAmount('');
    await load();
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!amount) return;
    setLoading(true);
    try {
      await withdraw(id, Number(amount));
      setAmount('');
      await load();
    } catch (e) {
      alert(e.response?.data?.error || '출금 실패');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('계좌를 삭제할까요?')) return;
    try {
      await deleteAccount(id);
      navigate('/accounts');
    } catch (e) {
      alert(e.response?.data?.error || '삭제 실패');
    }
  };

  if (!account) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
        <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">계좌 삭제</button>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <p className="text-slate-500 text-sm">잔액</p>
        <p className="text-4xl font-bold text-slate-900 mt-1">{Number(account.balance).toLocaleString()}원</p>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-semibold text-slate-900">입출금</h2>
        <input
          type="number"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="금액 입력"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={handleDeposit} disabled={loading}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition">
            입금
          </button>
          <button onClick={handleWithdraw} disabled={loading}
            className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition">
            출금
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-4">거래 내역</h2>
        {account.transactions?.length === 0 ? (
          <p className="text-slate-400 text-sm">거래 내역이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {account.transactions?.map(t => {
              const invoice = t.invoice_id ? invoiceMap[t.invoice_id] : null;
              return (
                <li key={t.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-sm">{t.description || t.type}</span>
                      {invoice && (
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="text-slate-400 hover:text-emerald-600 transition text-base leading-none"
                          title="청구서 보기"
                        >
                          📄
                        </button>
                      )}
                      {invoice?.status === 'paid' && (
                        <button
                          onClick={() => setSelectedReceipt(invoice)}
                          className="text-slate-400 hover:text-blue-600 transition text-base leading-none"
                          title="영수증 보기"
                        >
                          🧾
                        </button>
                      )}
                    </div>
                    {invoice?.company_name && (
                      <span className="text-xs text-slate-400">{invoice.company_name}</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${t.type === 'deposit' ? 'text-blue-600' : 'text-red-500'}`}>
                    {t.type === 'deposit' ? '+' : '-'}{Number(t.amount).toLocaleString()}원
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
      {selectedReceipt && (
        <ReceiptModal invoice={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/AccountDetail.jsx
git commit -m "feat: show company name and receipt icon in account transaction list"
```

---

## 전체 실행 순서

1. Task 1 → ReceiptModal.jsx 생성
2. Task 2 → AccountDetail.jsx 업데이트
