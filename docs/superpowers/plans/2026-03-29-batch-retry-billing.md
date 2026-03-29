# 미청구분 일괄 재청구 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 미수납 관리 화면에서 체크박스로 여러 건을 선택해 일괄 재청구할 수 있게 한다.

**Architecture:** `retry_billing_bulk` RPC를 신규 생성해 배열로 받은 billing_log ID들을 순차 처리한다. CompanyUnpaid.jsx에 체크박스 + 전체선택 + 일괄 재청구 버튼을 추가한다.

**Tech Stack:** Supabase PostgreSQL (RPC), React + Tailwind

---

## File Map

| 역할 | 파일 |
|------|------|
| 신규 | `supabase/migrations/022_retry_billing_bulk.sql` |
| 수정 | `client/src/api/admin.js` |
| 수정 | `client/src/pages/company/CompanyUnpaid.jsx` |

---

## Task 1: retry_billing_bulk RPC 추가

**Files:**
- Create: `supabase/migrations/022_retry_billing_bulk.sql`

- [ ] **Step 1: migration SQL 작성**

```sql
-- 022_retry_billing_bulk.sql
-- 미수납 일괄 재청구: billing_log ID 배열을 받아 순차 처리
-- 개별 실패는 건너뛰고 전체 결과를 JSON으로 반환

CREATE OR REPLACE FUNCTION retry_billing_bulk(log_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_id            UUID;
  v_success_count INT := 0;
  v_fail_count    INT := 0;
  v_fail_reasons  JSONB := '[]'::JSONB;
  v_result        JSON;
BEGIN
  FOREACH v_id IN ARRAY log_ids LOOP
    BEGIN
      SELECT retry_billing(v_id) INTO v_result;
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail_count   := v_fail_count + 1;
      v_fail_reasons := v_fail_reasons || jsonb_build_object('id', v_id, 'reason', SQLERRM);
    END;
  END LOOP;

  RETURN json_build_object(
    'total',    array_length(log_ids, 1),
    'success',  v_success_count,
    'failed',   v_fail_count,
    'failures', v_fail_reasons
  );
END;
$func$;
```

- [ ] **Step 2: Supabase 대시보드 → SQL Editor에서 실행**

Expected: `CREATE OR REPLACE FUNCTION` 성공

- [ ] **Step 3: 결과 확인**

```sql
-- 함수 존재 확인
SELECT proname FROM pg_proc WHERE proname = 'retry_billing_bulk';
```

Expected: `retry_billing_bulk` 1행 반환

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/022_retry_billing_bulk.sql
git commit -m "feat: add retry_billing_bulk RPC for batch retrying failed billing"
```

---

## Task 2: API — retryBillingBulk 함수 추가

**Files:**
- Modify: `client/src/api/admin.js`

현재 `admin.js` 파일 끝에 `retryBillingBulk` 함수가 없다. 추가한다.

- [ ] **Step 1: admin.js에 retryBillingBulk 추가**

`client/src/api/admin.js`의 `retryBilling` 함수 바로 아래에 추가:

```js
export const retryBillingBulk = async (ids) => {
  const { data, error } = await supabase.rpc('retry_billing_bulk', { log_ids: ids });
  if (error) throw { response: { data: { error: error.message } } };
  return { data };
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/admin.js
git commit -m "feat: add retryBillingBulk API function"
```

---

## Task 3: CompanyUnpaid.jsx — 체크박스 + 일괄 재청구 UI

**Files:**
- Modify: `client/src/pages/company/CompanyUnpaid.jsx`

현재 파일 내용:
```jsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyUnpaid } from '../../api/company';
import { retryBilling } from '../../api/admin';

export default function CompanyUnpaid() {
  const { user } = useAuthStore();
  const [unpaid, setUnpaid] = useState([]);
  const [retrying, setRetrying] = useState(null);

  const load = () => {
    if (!user?.id) return;
    getCompanyUnpaid(user.id).then(setUnpaid).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const handleRetry = async (id) => {
    if (!confirm('재청구를 실행할까요?')) return;
    setRetrying(id);
    try {
      await retryBilling(id);
      alert('재청구 완료!');
      load();
    } catch (e) {
      alert(e.response?.data?.error || '재청구 실패');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">미수납 관리</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">날짜</th>
              <th className="px-5 py-3 font-medium">고객</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">실패 사유</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {unpaid.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">미수납 내역이 없습니다.</td></tr>
            )}
            {unpaid.map(u => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{new Date(u.executed_at).toLocaleDateString('ko-KR')}</td>
                <td className="px-5 py-3 text-slate-700">{u.user_nickname}</td>
                <td className="px-5 py-3 text-slate-700">{u.product_name}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{Number(u.amount).toLocaleString()}원</td>
                <td className="px-5 py-3 text-red-500 text-xs">{u.reason || '-'}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRetry(u.id)}
                    disabled={retrying === u.id}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                  >
                    {retrying === u.id ? '재청구 중...' : '재청구'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: 전체 파일 교체**

Replace entire file with:

```jsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyUnpaid } from '../../api/company';
import { retryBilling, retryBillingBulk } from '../../api/admin';

export default function CompanyUnpaid() {
  const { user } = useAuthStore();
  const [unpaid, setUnpaid] = useState([]);
  const [retrying, setRetrying] = useState(null);   // 개별 재청구 중인 ID
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const load = () => {
    if (!user?.id) return;
    getCompanyUnpaid(user.id).then(data => {
      setUnpaid(data);
      setSelected(new Set());
    }).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const allIds = unpaid.map(u => u.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRetry = async (id) => {
    if (!confirm('재청구를 실행할까요?')) return;
    setRetrying(id);
    try {
      await retryBilling(id);
      alert('재청구 완료!');
      load();
    } catch (e) {
      alert(e.response?.data?.error || '재청구 실패');
    } finally {
      setRetrying(null);
    }
  };

  const handleBulkRetry = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 일괄 재청구할까요?`)) return;
    setBulkRetrying(true);
    try {
      const result = await retryBillingBulk(Array.from(selected));
      const { success, failed, failures } = result.data;
      if (failed > 0) {
        const reasons = failures.map(f => f.reason).join('\n');
        alert(`완료: 성공 ${success}건, 실패 ${failed}건\n\n실패 사유:\n${reasons}`);
      } else {
        alert(`${success}건 재청구 완료!`);
      }
      load();
    } catch (e) {
      alert(e.response?.data?.error || '일괄 재청구 실패');
    } finally {
      setBulkRetrying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">미수납 관리</h1>
        {selected.size > 0 && (
          <button
            onClick={handleBulkRetry}
            disabled={bulkRetrying}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
          >
            {bulkRetrying ? '재청구 중...' : `선택 ${selected.size}건 일괄 재청구`}
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
              <th className="px-5 py-3 font-medium">날짜</th>
              <th className="px-5 py-3 font-medium">고객</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">실패 사유</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {unpaid.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">미수납 내역이 없습니다.</td></tr>
            )}
            {unpaid.map(u => (
              <tr key={u.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 ${selected.has(u.id) ? 'bg-red-50/30' : ''}`}>
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>
                <td className="px-5 py-3 text-slate-500">{new Date(u.executed_at).toLocaleDateString('ko-KR')}</td>
                <td className="px-5 py-3 text-slate-700">{u.user_nickname}</td>
                <td className="px-5 py-3 text-slate-700">{u.product_name}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{Number(u.amount).toLocaleString()}원</td>
                <td className="px-5 py-3 text-red-500 text-xs">{u.reason || '-'}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRetry(u.id)}
                    disabled={retrying === u.id || bulkRetrying}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                  >
                    {retrying === u.id ? '재청구 중...' : '재청구'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/company/CompanyUnpaid.jsx
git commit -m "feat: add bulk retry billing with checkboxes to company unpaid page"
```

---

## 전체 실행 순서

1. Task 1 → SQL 실행 (022 migration) in Supabase Dashboard
2. Task 2 → admin.js 수정
3. Task 3 → CompanyUnpaid.jsx 교체
