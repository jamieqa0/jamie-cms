# 청구서(Invoice) 기능 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동이체 실행 시 청구서를 자동 발행하고, 업체/유저 화면에서 조회 및 수동 발행 가능하게 한다.

**Architecture:** invoices 테이블을 신규 생성하고 run_auto_debit/retry_billing RPC에 청구서 생성·상태 업데이트 로직을 추가한다. 프론트는 공통 InvoiceModal 컴포넌트를 만들어 유저/업체 화면에서 공용으로 사용한다.

**Tech Stack:** Supabase PostgreSQL (RPC), React + Tailwind

---

## File Map

| 역할 | 파일 |
|------|------|
| 신규 | `supabase/migrations/019_invoices_table.sql` |
| 신규 | `supabase/migrations/020_auto_debit_with_invoice.sql` |
| 신규 | `supabase/migrations/021_invoice_rpcs.sql` |
| 신규 | `client/src/api/invoices.js` |
| 수정 | `client/src/api/company.js` |
| 신규 | `client/src/components/InvoiceModal.jsx` |
| 수정 | `client/src/pages/AccountDetail.jsx` |
| 수정 | `client/src/pages/company/CompanyTransfers.jsx` |
| 수정 | `client/src/pages/company/CompanyCustomers.jsx` |

---

## Task 1: invoices 테이블 + transactions.invoice_id 컬럼 추가

**Files:**
- Create: `supabase/migrations/019_invoices_table.sql`

- [ ] **Step 1: Migration SQL 작성**

```sql
-- 019_invoices_table.sql

-- invoices 테이블
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  billing_log_id  UUID REFERENCES billing_logs(id),  -- 결제 후 연결 (nullable)
  amount          BIGINT NOT NULL,
  supply_amount   BIGINT NOT NULL,
  vat             BIGINT NOT NULL,
  status          VARCHAR NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('issued', 'paid', 'failed')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
);

-- transactions에 invoice_id 추가 (nullable FK)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
```

- [ ] **Step 2: Supabase 대시보드 → SQL Editor에서 실행**

위 SQL을 붙여넣고 Run.

Expected: `CREATE TABLE`, `ALTER TABLE` 성공 메시지

- [ ] **Step 3: 결과 확인**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;
```

Expected: id, subscription_id, billing_log_id, amount, supply_amount, vat, status, issued_at, paid_at 컬럼 확인

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_invoices_table.sql
git commit -m "feat: add invoices table and transactions.invoice_id"
```

---

## Task 2: run_auto_debit + retry_billing에 청구서 로직 추가

**Files:**
- Create: `supabase/migrations/020_auto_debit_with_invoice.sql`

현재 `016_settlement_auto_debit.sql`의 run_auto_debit 구조:
- 성공 시: 유저계좌 차감 → 집금계좌 입금 → 업체 정산 → billing_log INSERT
- 실패 시: billing_log INSERT (failed)

변경 후 흐름:
1. invoice INSERT (status='issued')
2. 결제 시도
   - 성공 → billing_log INSERT + invoice UPDATE (paid, billing_log_id, paid_at)
   - 실패 → billing_log INSERT (failed) + invoice UPDATE (failed)

- [ ] **Step 1: Migration SQL 작성**

```sql
-- 020_auto_debit_with_invoice.sql

-- run_auto_debit: invoice 발행 로직 추가
DROP FUNCTION IF EXISTS run_auto_debit(INT);

CREATE OR REPLACE FUNCTION run_auto_debit(target_day INT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_today                 INT;
  v_collection_account_id UUID;
  v_sub                   RECORD;
  v_balance               BIGINT;
  v_company_account_id    UUID;
  v_commission_rate       NUMERIC;
  v_settlement_amount     BIGINT;
  v_success_count         INT := 0;
  v_fail_count            INT := 0;
  v_invoice_id            UUID;
  v_billing_log_id        UUID;
  v_supply                BIGINT;
  v_vat                   BIGINT;
BEGIN
  v_today := COALESCE(target_day, EXTRACT(DAY FROM NOW())::INT);

  -- 집금 계좌 조회 (없으면 전체 중단)
  SELECT id INTO v_collection_account_id
  FROM accounts WHERE type = 'collection' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  -- 오늘 청구 대상 조회 (이미 성공한 건 제외 — 멱등성)
  FOR v_sub IN
    SELECT
      s.id AS subscription_id,
      s.account_id,
      p.id AS product_id,
      p.amount,
      p.company_id
    FROM subscriptions s
    JOIN products p ON s.product_id = p.id
    WHERE p.billing_day = v_today
      AND s.status = 'active'
      AND p.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM billing_logs bl
        WHERE bl.subscription_id = s.id
          AND bl.status = 'success'
          AND DATE(bl.executed_at) = CURRENT_DATE
      )
  LOOP
    BEGIN
      -- 업체 계좌 + 수수료율 조회
      v_company_account_id := NULL;
      v_commission_rate := 0;

      IF v_sub.company_id IS NOT NULL THEN
        SELECT a.id, COALESCE(c.commission_rate, 0)
        INTO v_company_account_id, v_commission_rate
        FROM accounts a
        LEFT JOIN companies c ON c.user_id = v_sub.company_id
        WHERE a.user_id = v_sub.company_id AND a.type = 'company'
        LIMIT 1;
      END IF;

      v_settlement_amount := FLOOR(v_sub.amount * (1 - v_commission_rate / 100.0))::BIGINT;

      -- ① invoice INSERT (issued)
      v_supply := FLOOR(v_sub.amount / 1.1)::BIGINT;
      v_vat    := v_sub.amount - v_supply;

      INSERT INTO invoices (subscription_id, amount, supply_amount, vat, status)
      VALUES (v_sub.subscription_id, v_sub.amount, v_supply, v_vat, 'issued')
      RETURNING id INTO v_invoice_id;

      -- 잠금 순서: 유저계좌 → 집금계좌 → 업체계좌 (데드락 방지)
      SELECT balance INTO v_balance
      FROM accounts WHERE id = v_sub.account_id FOR UPDATE;

      PERFORM id FROM accounts WHERE id = v_collection_account_id FOR UPDATE;

      IF v_company_account_id IS NOT NULL THEN
        PERFORM id FROM accounts WHERE id = v_company_account_id FOR UPDATE;
      END IF;

      IF v_balance < v_sub.amount THEN
        -- 잔액 부족 → failed 기록
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
        VALUES (v_sub.subscription_id, v_sub.product_id, v_sub.account_id, v_sub.amount, 'failed', '잔액 부족')
        RETURNING id INTO v_billing_log_id;

        -- ② invoice UPDATE (failed)
        UPDATE invoices SET status = 'failed', billing_log_id = v_billing_log_id
        WHERE id = v_invoice_id;

        v_fail_count := v_fail_count + 1;
      ELSE
        -- 1. 유저계좌 차감
        UPDATE accounts SET balance = balance - v_sub.amount WHERE id = v_sub.account_id;
        -- 2. 집금계좌 입금 (전체 금액)
        UPDATE accounts SET balance = balance + v_sub.amount WHERE id = v_collection_account_id;

        -- 3. 업체계좌 정산 (수수료 제외 금액)
        IF v_company_account_id IS NOT NULL AND v_settlement_amount > 0 THEN
          UPDATE accounts SET balance = balance - v_settlement_amount WHERE id = v_collection_account_id;
          UPDATE accounts SET balance = balance + v_settlement_amount WHERE id = v_company_account_id;
          INSERT INTO transactions (account_id, type, amount, description)
          VALUES (v_company_account_id, 'deposit', v_settlement_amount, '자동이체 정산');
        END IF;

        -- 거래 기록 (invoice_id 포함)
        INSERT INTO transactions (account_id, type, amount, description, invoice_id)
        VALUES (v_sub.account_id, 'auto_debit', v_sub.amount, '자동이체', v_invoice_id);
        INSERT INTO transactions (account_id, type, amount, description)
        VALUES (v_collection_account_id, 'deposit', v_sub.amount, '자동이체 수납');

        -- 성공 로그
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
        VALUES (v_sub.subscription_id, v_sub.product_id, v_sub.account_id, v_sub.amount, 'success')
        RETURNING id INTO v_billing_log_id;

        -- ③ invoice UPDATE (paid)
        UPDATE invoices
        SET status = 'paid', billing_log_id = v_billing_log_id, paid_at = NOW()
        WHERE id = v_invoice_id;

        v_success_count := v_success_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[AutoDebit] subscription % 처리 실패: %', v_sub.subscription_id, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'day',       v_today,
    'processed', v_success_count + v_fail_count,
    'success',   v_success_count,
    'failed',    v_fail_count
  );
END;
$func$;


-- retry_billing: invoice 발행 로직 추가
DROP FUNCTION IF EXISTS retry_billing(UUID);

CREATE OR REPLACE FUNCTION retry_billing(log_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_subscription_id       UUID;
  v_product_id            UUID;
  v_account_id            UUID;
  v_amount                BIGINT;
  v_balance               BIGINT;
  v_collection_account_id UUID;
  v_company_id            UUID;
  v_company_account_id    UUID;
  v_commission_rate       NUMERIC;
  v_settlement_amount     BIGINT;
  v_invoice_id            UUID;
  v_billing_log_id        UUID;
  v_supply                BIGINT;
  v_vat                   BIGINT;
BEGIN
  -- 실패 billing_log 조회
  SELECT bl.subscription_id, bl.product_id, s.account_id, bl.amount, p.company_id
  INTO v_subscription_id, v_product_id, v_account_id, v_amount, v_company_id
  FROM billing_logs bl
  JOIN subscriptions s ON bl.subscription_id = s.id
  JOIN products p ON bl.product_id = p.id
  WHERE bl.id = log_id AND bl.status = 'failed';

  IF NOT FOUND THEN
    RAISE EXCEPTION '미수납 내역을 찾을 수 없습니다.';
  END IF;

  -- 집금 계좌 조회
  SELECT id INTO v_collection_account_id
  FROM accounts WHERE type = 'collection' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  -- 업체 계좌 + 수수료율 조회
  v_company_account_id := NULL;
  v_commission_rate := 0;

  IF v_company_id IS NOT NULL THEN
    SELECT a.id, COALESCE(c.commission_rate, 0)
    INTO v_company_account_id, v_commission_rate
    FROM accounts a
    LEFT JOIN companies c ON c.user_id = v_company_id
    WHERE a.user_id = v_company_id AND a.type = 'company'
    LIMIT 1;
  END IF;

  v_settlement_amount := FLOOR(v_amount * (1 - v_commission_rate / 100.0))::BIGINT;

  -- ① invoice INSERT (issued)
  v_supply := FLOOR(v_amount / 1.1)::BIGINT;
  v_vat    := v_amount - v_supply;

  INSERT INTO invoices (subscription_id, amount, supply_amount, vat, status)
  VALUES (v_subscription_id, v_amount, v_supply, v_vat, 'issued')
  RETURNING id INTO v_invoice_id;

  -- 잠금 순서: 유저계좌 → 집금계좌 → 업체계좌 (데드락 방지)
  SELECT balance INTO v_balance
  FROM accounts WHERE id = v_account_id FOR UPDATE;

  PERFORM id FROM accounts WHERE id = v_collection_account_id FOR UPDATE;

  IF v_company_account_id IS NOT NULL THEN
    PERFORM id FROM accounts WHERE id = v_company_account_id FOR UPDATE;
  END IF;

  IF v_balance < v_amount THEN
    RAISE EXCEPTION '잔액 부족';
  END IF;

  -- 유저계좌 차감
  UPDATE accounts SET balance = balance - v_amount WHERE id = v_account_id;
  -- 집금계좌 입금
  UPDATE accounts SET balance = balance + v_amount WHERE id = v_collection_account_id;

  -- 업체계좌 정산
  IF v_company_account_id IS NOT NULL AND v_settlement_amount > 0 THEN
    UPDATE accounts SET balance = balance - v_settlement_amount WHERE id = v_collection_account_id;
    UPDATE accounts SET balance = balance + v_settlement_amount WHERE id = v_company_account_id;
    INSERT INTO transactions (account_id, type, amount, description)
    VALUES (v_company_account_id, 'deposit', v_settlement_amount, '재청구 정산');
  END IF;

  -- 거래 기록 (invoice_id 포함)
  INSERT INTO transactions (account_id, type, amount, description, invoice_id)
  VALUES (v_account_id, 'auto_debit', v_amount, '재청구', v_invoice_id);
  INSERT INTO transactions (account_id, type, amount, description)
  VALUES (v_collection_account_id, 'deposit', v_amount, '재청구 수납');

  -- 성공 billing_log
  INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
  VALUES (v_subscription_id, v_product_id, v_account_id, v_amount, 'success')
  RETURNING id INTO v_billing_log_id;

  -- ③ invoice UPDATE (paid)
  UPDATE invoices
  SET status = 'paid', billing_log_id = v_billing_log_id, paid_at = NOW()
  WHERE id = v_invoice_id;

  RETURN json_build_object('message', '재청구 완료', 'status', 'success');
END;
$func$;
```

- [ ] **Step 2: Supabase 대시보드 → SQL Editor에서 실행**

Expected: `DROP FUNCTION`, `CREATE OR REPLACE FUNCTION` 각 2회 성공

- [ ] **Step 3: 시연 확인**

AdminDashboard에서 자동이체 시연 실행 후:
```sql
SELECT id, status, amount, supply_amount, vat, paid_at
FROM invoices
ORDER BY issued_at DESC
LIMIT 5;
```
Expected: status='paid' 레코드 확인

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_auto_debit_with_invoice.sql
git commit -m "feat: add invoice creation to run_auto_debit and retry_billing"
```

---

## Task 3: get_user_invoices + create_invoice_manual RPC 추가

**Files:**
- Create: `supabase/migrations/021_invoice_rpcs.sql`

- [ ] **Step 1: Migration SQL 작성**

```sql
-- 021_invoice_rpcs.sql

-- 유저 청구서 목록 (업체명, 상품명 포함)
CREATE OR REPLACE FUNCTION get_user_invoices(p_user_id UUID)
RETURNS TABLE (
  id              UUID,
  status          VARCHAR,
  amount          BIGINT,
  supply_amount   BIGINT,
  vat             BIGINT,
  issued_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  company_name    VARCHAR,
  product_name    VARCHAR
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    inv.id,
    inv.status,
    inv.amount,
    inv.supply_amount,
    inv.vat,
    inv.issued_at,
    inv.paid_at,
    u.nickname    AS company_name,
    p.name        AS product_name
  FROM invoices inv
  JOIN subscriptions s  ON s.id  = inv.subscription_id
  JOIN products p       ON p.id  = s.product_id
  JOIN users u          ON u.id  = p.company_id
  WHERE s.user_id = p_user_id
  ORDER BY inv.issued_at DESC;
END;
$func$;


-- 업체 수동 발행 (이미 issued 이면 에러)
CREATE OR REPLACE FUNCTION create_invoice_manual(p_subscription_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_amount      BIGINT;
  v_supply      BIGINT;
  v_vat         BIGINT;
  v_invoice_id  UUID;
BEGIN
  -- 이미 issued 상태 청구서 존재하면 에러
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE subscription_id = p_subscription_id AND status = 'issued'
  ) THEN
    RAISE EXCEPTION '이미 발행된 청구서가 있습니다.';
  END IF;

  -- 상품 금액 조회
  SELECT p.amount INTO v_amount
  FROM subscriptions s
  JOIN products p ON p.id = s.product_id
  WHERE s.id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '구독 정보를 찾을 수 없습니다.';
  END IF;

  v_supply := FLOOR(v_amount / 1.1)::BIGINT;
  v_vat    := v_amount - v_supply;

  INSERT INTO invoices (subscription_id, amount, supply_amount, vat, status)
  VALUES (p_subscription_id, v_amount, v_supply, v_vat, 'issued')
  RETURNING id INTO v_invoice_id;

  RETURN json_build_object('invoice_id', v_invoice_id);
END;
$func$;


-- 업체별 청구서 목록
CREATE OR REPLACE FUNCTION get_company_invoices(p_company_id UUID)
RETURNS TABLE (
  id              UUID,
  status          VARCHAR,
  amount          BIGINT,
  supply_amount   BIGINT,
  vat             BIGINT,
  issued_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  user_nickname   VARCHAR,
  product_name    VARCHAR,
  subscription_id UUID
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    inv.id,
    inv.status,
    inv.amount,
    inv.supply_amount,
    inv.vat,
    inv.issued_at,
    inv.paid_at,
    u.nickname    AS user_nickname,
    p.name        AS product_name,
    s.id          AS subscription_id
  FROM invoices inv
  JOIN subscriptions s  ON s.id  = inv.subscription_id
  JOIN products p       ON p.id  = s.product_id
  JOIN users u          ON u.id  = s.user_id
  WHERE p.company_id = p_company_id
  ORDER BY inv.issued_at DESC;
END;
$func$;
```

- [ ] **Step 2: Supabase 대시보드 → SQL Editor에서 실행**

Expected: 3개 함수 생성 성공

- [ ] **Step 3: 결과 확인 (invoices 데이터가 있는 경우)**

```sql
SELECT * FROM get_company_invoices('<company_user_id>');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/021_invoice_rpcs.sql
git commit -m "feat: add get_user_invoices, get_company_invoices, create_invoice_manual RPCs"
```

---

## Task 4: API 레이어 — invoices.js 신규 + company.js 수정

**Files:**
- Create: `client/src/api/invoices.js`
- Modify: `client/src/api/company.js`

- [ ] **Step 1: invoices.js 작성**

```js
// client/src/api/invoices.js
import { supabase } from '../lib/supabase';

export const getUserInvoices = async (userId) => {
  const { data, error } = await supabase.rpc('get_user_invoices', { p_user_id: userId });
  if (error) throw error;
  return data;
};

export const getInvoiceById = async (invoiceId) => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, subscriptions(id, products(name, company_id, companies:users!products_company_id_fkey(nickname)))')
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return data;
};
```

- [ ] **Step 2: company.js에 createManualInvoice + getCompanyInvoices 추가**

`client/src/api/company.js` 파일 맨 끝에 추가:

```js
// ── Invoices ──────────────────────────────────────────────

export const getCompanyInvoices = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_invoices', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

export const createManualInvoice = async (subscriptionId) => {
  const { data, error } = await supabase.rpc('create_invoice_manual', { p_subscription_id: subscriptionId });
  if (error) throw error;
  return data;
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api/invoices.js client/src/api/company.js
git commit -m "feat: add invoice API functions"
```

---

## Task 5: InvoiceModal.jsx 공통 컴포넌트

**Files:**
- Create: `client/src/components/InvoiceModal.jsx`

모달은 `invoice` 객체를 props로 받아 렌더링한다.
invoice 필드: `id`, `status`, `amount`, `supply_amount`, `vat`, `issued_at`, `paid_at`, `company_name`, `product_name`

- [ ] **Step 1: InvoiceModal.jsx 작성**

```jsx
// client/src/components/InvoiceModal.jsx

const STATUS_LABEL = { issued: '발행됨', paid: '납부완료', failed: '실패' };
const STATUS_COLOR = {
  issued:  'bg-yellow-50 text-yellow-700',
  paid:    'bg-green-50 text-green-700',
  failed:  'bg-red-50 text-red-700',
};

export default function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;

  const invoiceNo = invoice.id.replace(/-/g, '').slice(0, 8).toUpperCase();

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm print:shadow-none print:rounded-none">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">청구서</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 print:hidden text-xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-4">
          {/* 청구서 번호 + 상태 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">청구서 번호</span>
            <span className="font-mono text-sm font-semibold text-slate-700">{invoiceNo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">상태</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>

          <hr className="border-dashed border-slate-200" />

          {/* 업체/상품 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">업체명</span>
            <span className="text-sm text-slate-800">{invoice.company_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">상품명</span>
            <span className="text-sm text-slate-800">{invoice.product_name}</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          {/* 금액 내역 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">공급가액</span>
            <span className="text-sm text-slate-800">{Number(invoice.supply_amount).toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">부가세 (10%)</span>
            <span className="text-sm text-slate-800">{Number(invoice.vat).toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between font-bold">
            <span className="text-sm text-slate-900">합계</span>
            <span className="text-base text-slate-900">{Number(invoice.amount).toLocaleString()}원</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          {/* 날짜 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">청구일</span>
            <span className="text-sm text-slate-600">
              {new Date(invoice.issued_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
          {invoice.paid_at && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">납부일</span>
              <span className="text-sm text-slate-600">
                {new Date(invoice.paid_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 pb-6 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
          >
            인쇄 / PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
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
git add client/src/components/InvoiceModal.jsx
git commit -m "feat: add InvoiceModal component"
```

---

## Task 6: AccountDetail.jsx — 거래내역에 📄 아이콘 추가

**Files:**
- Modify: `client/src/pages/AccountDetail.jsx`

현재 `getAccount`는 `transactions(id, type, amount, description, created_at)` 조회.
`invoice_id`를 추가로 조회하고, invoice_id가 있는 거래 항목 옆에 📄 아이콘을 표시한다.
클릭 시 해당 invoice를 불러와 InvoiceModal을 연다.

- [ ] **Step 1: AccountDetail.jsx 수정**

```jsx
// client/src/pages/AccountDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccount, deposit, withdraw, deleteAccount } from '../api/accounts';
import { getInvoiceById } from '../api/invoices';
import InvoiceModal from '../components/InvoiceModal';

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const load = () => getAccount(id).then(r => setAccount(r.data));
  useEffect(() => { load(); }, [id]);

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

  const handleOpenInvoice = async (invoiceId) => {
    try {
      const inv = await getInvoiceById(invoiceId);
      // getInvoiceById returns nested structure; flatten for modal
      const product = inv.subscriptions?.products;
      const companyUser = product?.['companies'];
      setSelectedInvoice({
        ...inv,
        company_name: companyUser?.nickname ?? '-',
        product_name: product?.name ?? '-',
      });
    } catch {
      alert('청구서를 불러올 수 없습니다.');
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
            {account.transactions?.map(t => (
              <li key={t.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-sm">{t.description || t.type}</span>
                  {t.invoice_id && (
                    <button
                      onClick={() => handleOpenInvoice(t.invoice_id)}
                      className="text-slate-400 hover:text-emerald-600 transition text-base leading-none"
                      title="청구서 보기"
                    >
                      📄
                    </button>
                  )}
                </div>
                <span className={`text-sm font-medium ${t.type === 'deposit' ? 'text-blue-600' : 'text-red-500'}`}>
                  {t.type === 'deposit' ? '+' : '-'}{Number(t.amount).toLocaleString()}원
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: accounts.js에서 invoice_id 포함하도록 수정**

`client/src/api/accounts.js`의 `getAccount` 함수에서 transactions select에 `invoice_id` 추가:

```js
export const getAccount = async (id) => {
  const { data } = await supabase
    .from('accounts')
    .select('*, transactions(id, type, amount, description, created_at, invoice_id)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'transactions', ascending: false })
    .single();
  return { data };
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AccountDetail.jsx client/src/api/accounts.js
git commit -m "feat: show invoice icon in account transaction list"
```

---

## Task 7: CompanyTransfers.jsx — 수납내역에 청구서 버튼 추가

**Files:**
- Modify: `client/src/pages/company/CompanyTransfers.jsx`

수납내역 각 행에 "청구서" 버튼 추가. 클릭 시 해당 billing_log와 연결된 invoice를 조회하여 모달 표시.
`get_company_invoices` 결과를 미리 로드해서 billing_log_id로 매핑한다.

- [ ] **Step 1: CompanyTransfers.jsx 수정**

```jsx
// client/src/pages/company/CompanyTransfers.jsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyTransfers, getCompanyInvoices } from '../../api/company';
import InvoiceModal from '../../components/InvoiceModal';

export default function CompanyTransfers() {
  const { user } = useAuthStore();
  const [transfers, setTransfers] = useState([]);
  const [invoiceMap, setInvoiceMap] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyTransfers(user.id).then(setTransfers).catch(() => {});
    getCompanyInvoices(user.id).then(list => {
      const map = {};
      list.forEach(inv => { if (inv.billing_log_id) map[inv.billing_log_id] = inv; });
      setInvoiceMap(map);
    }).catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">수납 내역</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">날짜</th>
              <th className="px-5 py-3 font-medium">고객</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">수납 내역이 없습니다.</td></tr>
            )}
            {transfers.map(t => {
              const invoice = invoiceMap[t.id];
              return (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-500">{new Date(t.executed_at).toLocaleDateString('ko-KR')}</td>
                  <td className="px-5 py-3 text-slate-700">{t.user_nickname}</td>
                  <td className="px-5 py-3 text-slate-700">{t.product_name}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{Number(t.amount).toLocaleString()}원</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.status === 'success' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                    }`}>
                      {t.status === 'success' ? '성공' : '실패'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {invoice && (
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-200 transition"
                      >
                        청구서
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
```

**주의:** `get_company_invoices` RPC 반환 타입에 `billing_log_id`가 없으므로 021 migration에서 추가해야 한다. Task 3의 `get_company_invoices` RETURNS TABLE에 `billing_log_id UUID` 컬럼과 SELECT에 `inv.billing_log_id` 추가 필요. (아래 Task 3 보정 참조)

**021 migration 보정 — get_company_invoices에 billing_log_id 추가:**

Task 3 SQL의 `get_company_invoices` 함수를 아래로 교체:

```sql
DROP FUNCTION IF EXISTS get_company_invoices(UUID);

CREATE OR REPLACE FUNCTION get_company_invoices(p_company_id UUID)
RETURNS TABLE (
  id              UUID,
  billing_log_id  UUID,
  status          VARCHAR,
  amount          BIGINT,
  supply_amount   BIGINT,
  vat             BIGINT,
  issued_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  user_nickname   VARCHAR,
  product_name    VARCHAR,
  subscription_id UUID
)
LANGUAGE plpgsql
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    inv.id,
    inv.billing_log_id,
    inv.status,
    inv.amount,
    inv.supply_amount,
    inv.vat,
    inv.issued_at,
    inv.paid_at,
    u.nickname    AS user_nickname,
    p.name        AS product_name,
    s.id          AS subscription_id
  FROM invoices inv
  JOIN subscriptions s  ON s.id  = inv.subscription_id
  JOIN products p       ON p.id  = s.product_id
  JOIN users u          ON u.id  = s.user_id
  WHERE p.company_id = p_company_id
  ORDER BY inv.issued_at DESC;
END;
$func$;
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/company/CompanyTransfers.jsx
git commit -m "feat: add invoice button to company transfers page"
```

---

## Task 8: CompanyCustomers.jsx — 수동 청구서 발행 버튼 추가

**Files:**
- Modify: `client/src/pages/company/CompanyCustomers.jsx`

고객 목록에서 `accepted` 상태인 행에 "청구서 발행" 버튼 추가.
subscription_id가 필요하므로 `getCompanyCustomers` 쿼리에 `subscription_id` 포함 필요.

- [ ] **Step 1: company.js의 getCompanyCustomers 수정**

`client/src/api/company.js`에서:

```js
export const getCompanyCustomers = async (companyId) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .select('*, products(name, amount), subscriptions(id)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};
```

- [ ] **Step 2: CompanyCustomers.jsx 수정**

```jsx
// client/src/pages/company/CompanyCustomers.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyCustomers, createManualInvoice } from '../../api/company';
import InvoiceModal from '../../components/InvoiceModal';

const STATUS_LABEL = { pending: '대기', accepted: '수락', rejected: '거절' };
const STATUS_COLOR = { pending: 'text-yellow-600 bg-yellow-50', accepted: 'text-green-600 bg-green-50', rejected: 'text-red-600 bg-red-50' };

export default function CompanyCustomers() {
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState([]);
  const [issuing, setIssuing] = useState(null);
  const [issuedInvoice, setIssuedInvoice] = useState(null);

  const load = () => {
    if (!user?.id) return;
    getCompanyCustomers(user.id).then(setCustomers).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const copyLink = (token) => {
    const url = `${window.location.origin}/consent/${token}`;
    navigator.clipboard.writeText(url);
    alert('링크가 복사되었습니다.');
  };

  const handleIssueInvoice = async (subscriptionId) => {
    setIssuing(subscriptionId);
    try {
      const result = await createManualInvoice(subscriptionId);
      alert('청구서가 발행되었습니다.');
    } catch (e) {
      alert(e.message || '청구서 발행 실패');
    } finally {
      setIssuing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">고객 관리</h1>
        <Link to="/company/customers/new"
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
          + 동의 요청
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">고객명</th>
              <th className="px-5 py-3 font-medium">연락처</th>
              <th className="px-5 py-3 font-medium">상품</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="px-5 py-3 font-medium">동의 링크</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">등록된 고객이 없습니다.</td></tr>
            )}
            {customers.map(c => {
              const subscriptionId = c.subscriptions?.id;
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{c.customer_name}</td>
                  <td className="px-5 py-3 text-slate-500">{c.customer_contact}</td>
                  <td className="px-5 py-3 text-slate-700">{c.products?.name}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {c.status === 'pending' && (
                      <button onClick={() => copyLink(c.invite_token)}
                        className="text-emerald-600 hover:underline text-xs">링크 복사</button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.status === 'accepted' && subscriptionId && (
                      <button
                        onClick={() => handleIssueInvoice(subscriptionId)}
                        disabled={issuing === subscriptionId}
                        className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50"
                      >
                        {issuing === subscriptionId ? '발행 중...' : '청구서 발행'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**주의:** `consent_requests`에서 `subscriptions(id)`로 조인하려면 `consent_requests.subscription_id` FK가 있어야 한다. `018_fix_company_rpc.sql`의 `accept_consent` 함수에서 `UPDATE consent_requests SET subscription_id = v_sub_id`로 저장하고 있으므로 컬럼이 존재해야 한다. 없다면:

```sql
ALTER TABLE consent_requests ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/company/CompanyCustomers.jsx client/src/api/company.js
git commit -m "feat: add manual invoice creation button to company customers page"
```

---

## 전체 실행 순서 요약

1. Task 1 → SQL 실행 (019 migration)
2. Task 2 → SQL 실행 (020 migration)
3. Task 3 → SQL 실행 (021 migration, billing_log_id 포함 버전)
4. Task 4 → invoices.js 생성, company.js 수정
5. Task 5 → InvoiceModal.jsx 생성
6. Task 6 → AccountDetail.jsx + accounts.js 수정
7. Task 7 → CompanyTransfers.jsx 수정
8. Task 8 → CompanyCustomers.jsx + company.js(getCompanyCustomers) 수정

각 Task는 SQL 실행 → 프론트 코드 변경 → commit 순으로 진행.
