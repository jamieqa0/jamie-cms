# Role Redesign (admin / company / user) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the role system from 2 roles (admin/user) to 3 roles (admin/company/user), adding a full consent-request flow where companies register customers, send invite links, and users accept to create subscriptions.

**Architecture:** DB migrations add `company_id` to products and a new `consent_requests` table with invite tokens. Four Supabase RPC functions handle company-scoped queries and consent acceptance atomically. The frontend adds a `/company/*` route tree with its own layout, and a public `/consent/:token` page.

**Tech Stack:** React 19, Vite, React Router v7, Zustand, Supabase JS v2, Tailwind CSS, PostgreSQL (Supabase)

---

## File Map

### New Files
- `supabase/migrations/007_role_company.sql` — users.role CHECK constraint change
- `supabase/migrations/008_products_company.sql` — products.company_id FK
- `supabase/migrations/009_consent_requests.sql` — consent_requests table
- `supabase/migrations/010_company_rpc.sql` — 4 new RPC functions
- `client/src/components/CompanyRoute.jsx` — route guard for role === 'company'
- `client/src/components/CompanyLayout.jsx` — company nav layout
- `client/src/api/company.js` — all company-scoped API calls
- `client/src/pages/company/CompanyDashboard.jsx`
- `client/src/pages/company/CompanyProducts.jsx`
- `client/src/pages/company/CompanyProductForm.jsx`
- `client/src/pages/company/CompanyCustomers.jsx`
- `client/src/pages/company/CompanyCustomerForm.jsx`
- `client/src/pages/company/CompanyTransfers.jsx`
- `client/src/pages/company/CompanyUnpaid.jsx`
- `client/src/pages/admin/AdminCompanies.jsx`
- `client/src/pages/admin/AdminCompanyForm.jsx`
- `client/src/pages/ConsentPage.jsx`

### Modified Files
- `client/src/App.jsx` — add /company/* routes and /consent/:token route
- `client/src/pages/Landing.jsx` — add company → /company redirect, remove debug logs
- `client/src/components/AdminLayout.jsx` — swap "상품 관리" nav for "업체 관리"
- `client/src/pages/admin/AdminDashboard.jsx` — swap product/user counts for company count

---

## Task 1: DB Migration — users.role constraint

**Files:**
- Create: `supabase/migrations/007_role_company.sql`

> Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/007_role_company.sql
-- Expand role CHECK to include 'company'

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'company', 'user'));
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Copy the file contents into Dashboard → SQL Editor → New query → Run.
Expected: "Success. No rows returned"

- [ ] **Step 3: Verify**

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'users_role_check';
```
Expected: one row with `check_clause` containing `'admin', 'company', 'user'`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_role_company.sql
git commit -m "feat: expand users.role constraint to include company"
```

---

## Task 2: DB Migration — products.company_id

**Files:**
- Create: `supabase/migrations/008_products_company.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/008_products_company.sql
-- Add company_id FK to products table

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES users(id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: "Success. No rows returned"

- [ ] **Step 3: Verify**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'company_id';
```
Expected: one row with `data_type = 'uuid'`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_products_company.sql
git commit -m "feat: add company_id FK to products table"
```

---

## Task 3: DB Migration — consent_requests table

**Files:**
- Create: `supabase/migrations/009_consent_requests.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/009_consent_requests.sql
CREATE TABLE IF NOT EXISTS consent_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES users(id),
  product_id       UUID NOT NULL REFERENCES products(id),
  customer_name    VARCHAR NOT NULL,
  customer_contact VARCHAR NOT NULL,
  invite_token     VARCHAR UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status           VARCHAR NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'rejected')),
  user_id          UUID REFERENCES users(id),
  subscription_id  UUID REFERENCES subscriptions(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: "Success. No rows returned"

- [ ] **Step 3: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'consent_requests'
ORDER BY ordinal_position;
```
Expected: 10 columns — id, company_id, product_id, customer_name, customer_contact, invite_token, status, user_id, subscription_id, created_at

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_consent_requests.sql
git commit -m "feat: create consent_requests table"
```

---

## Task 4: DB Migration — company RPC functions

**Files:**
- Create: `supabase/migrations/010_company_rpc.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/010_company_rpc.sql

-- 1) Company stats: 수납률, 수납액, 미수납 건수
CREATE OR REPLACE FUNCTION get_company_stats(p_company_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_total   INT;
  v_success INT;
  v_amount  NUMERIC;
  v_fail    INT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  WHERE p.company_id = p_company_id
    AND DATE_TRUNC('month', bl.billed_at) = DATE_TRUNC('month', NOW());

  SELECT COUNT(*), COALESCE(SUM(bl.amount), 0)
  INTO v_success, v_amount
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  WHERE p.company_id = p_company_id
    AND bl.status = 'success'
    AND DATE_TRUNC('month', bl.billed_at) = DATE_TRUNC('month', NOW());

  SELECT COUNT(*) INTO v_fail
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  WHERE p.company_id = p_company_id
    AND bl.status = 'failed'
    AND DATE_TRUNC('month', bl.billed_at) = DATE_TRUNC('month', NOW());

  RETURN json_build_object(
    'successRate', CASE WHEN v_total = 0 THEN 0 ELSE ROUND(v_success * 100.0 / v_total) END,
    'totalAmount', v_amount,
    'failCount',   v_fail
  );
END;
$$;

-- 2) Company transfer history
CREATE OR REPLACE FUNCTION get_company_transfers(p_company_id UUID)
RETURNS TABLE (
  id            UUID,
  status        VARCHAR,
  amount        NUMERIC,
  billed_at     TIMESTAMPTZ,
  reason        TEXT,
  product_name  VARCHAR,
  user_nickname VARCHAR
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id,
    bl.status,
    bl.amount,
    bl.billed_at,
    bl.reason,
    p.name   AS product_name,
    u.nickname AS user_nickname
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  JOIN users u ON u.id = s.user_id
  WHERE p.company_id = p_company_id
  ORDER BY bl.billed_at DESC;
END;
$$;

-- 3) Company unpaid list
CREATE OR REPLACE FUNCTION get_company_unpaid(p_company_id UUID)
RETURNS TABLE (
  id            UUID,
  amount        NUMERIC,
  billed_at     TIMESTAMPTZ,
  reason        TEXT,
  product_name  VARCHAR,
  user_nickname VARCHAR,
  subscription_id UUID
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    bl.id,
    bl.amount,
    bl.billed_at,
    bl.reason,
    p.name     AS product_name,
    u.nickname AS user_nickname,
    bl.subscription_id
  FROM billing_logs bl
  JOIN subscriptions s ON s.id = bl.subscription_id
  JOIN products p ON p.id = s.product_id
  JOIN users u ON u.id = s.user_id
  WHERE p.company_id = p_company_id
    AND bl.status = 'failed'
  ORDER BY bl.billed_at DESC;
END;
$$;

-- 4) Accept consent: create subscription + update consent_request (single transaction)
CREATE OR REPLACE FUNCTION accept_consent(p_token VARCHAR, p_account_id UUID)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_req       consent_requests%ROWTYPE;
  v_product   products%ROWTYPE;
  v_sub_id    UUID;
BEGIN
  -- Lock and load the consent request
  SELECT * INTO v_req
  FROM consent_requests
  WHERE invite_token = p_token AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consent_request not found or already processed';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = v_req.product_id;

  -- Create subscription
  INSERT INTO subscriptions (user_id, product_id, account_id, billing_day, status)
  VALUES (auth.uid(), v_req.product_id, p_account_id, v_product.billing_day, 'active')
  RETURNING id INTO v_sub_id;

  -- Mark consent as accepted
  UPDATE consent_requests
  SET status = 'accepted',
      user_id = auth.uid(),
      subscription_id = v_sub_id
  WHERE id = v_req.id;

  RETURN json_build_object('subscription_id', v_sub_id);
END;
$$;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: "Success. No rows returned" (4 functions created)

- [ ] **Step 3: Verify**

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_company_stats', 'get_company_transfers',
    'get_company_unpaid', 'accept_consent'
  );
```
Expected: 4 rows

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/010_company_rpc.sql
git commit -m "feat: add company RPC functions (stats, transfers, unpaid, accept_consent)"
```

---

## Task 5: CompanyRoute and CompanyLayout

**Files:**
- Create: `client/src/components/CompanyRoute.jsx`
- Create: `client/src/components/CompanyLayout.jsx`

- [ ] **Step 1: Create CompanyRoute.jsx**

```jsx
// client/src/components/CompanyRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function CompanyRoute() {
  const { user } = useAuthStore();
  return user?.role === 'company' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
```

- [ ] **Step 2: Create CompanyLayout.jsx**

```jsx
// client/src/components/CompanyLayout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function CompanyLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      isActive ? 'bg-emerald-700 text-white' : 'text-emerald-100 hover:bg-emerald-700/60'
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-emerald-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">Jamie CMS</span>
            <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">업체</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-300 hidden sm:block">{user?.nickname}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-300 hover:text-red-100 px-2 py-2 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
          <NavLink to="/company" end className={navClass}>대시보드</NavLink>
          <NavLink to="/company/products" className={navClass}>상품 관리</NavLink>
          <NavLink to="/company/customers" className={navClass}>고객 관리</NavLink>
          <NavLink to="/company/transfers" className={navClass}>수납 내역</NavLink>
          <NavLink to="/company/unpaid" className={navClass}>미수납 관리</NavLink>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/CompanyRoute.jsx client/src/components/CompanyLayout.jsx
git commit -m "feat: add CompanyRoute guard and CompanyLayout nav"
```

---

## Task 6: company API module

**Files:**
- Create: `client/src/api/company.js`

- [ ] **Step 1: Create company.js**

```js
// client/src/api/company.js
import { supabase } from '../lib/supabase';

// ── Products ──────────────────────────────────────────────

export const getCompanyProducts = async (companyId) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getCompanyProduct = async (id) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const createCompanyProduct = async (companyId, productData) => {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...productData, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCompanyProduct = async (id, productData) => {
  const { data, error } = await supabase
    .from('products')
    .update(productData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteCompanyProduct = async (id) => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

// ── Customers (consent requests) ─────────────────────────

export const getCompanyCustomers = async (companyId) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .select('*, products(name, amount)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createConsentRequest = async ({ companyId, productId, customerName, customerContact }) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .insert({
      company_id: companyId,
      product_id: productId,
      customer_name: customerName,
      customer_contact: customerContact,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Stats / Transfers / Unpaid ────────────────────────────

export const getCompanyStats = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_stats', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

export const getCompanyTransfers = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_transfers', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

export const getCompanyUnpaid = async (companyId) => {
  const { data, error } = await supabase.rpc('get_company_unpaid', { p_company_id: companyId });
  if (error) throw error;
  return data;
};

// ── Consent acceptance ────────────────────────────────────

export const getConsentRequest = async (token) => {
  const { data, error } = await supabase
    .from('consent_requests')
    .select('*, products(name, amount, billing_day), users!company_id(nickname)')
    .eq('invite_token', token)
    .single();
  if (error) throw error;
  return data;
};

export const acceptConsent = async (token, accountId) => {
  const { data, error } = await supabase.rpc('accept_consent', {
    p_token: token,
    p_account_id: accountId,
  });
  if (error) throw error;
  return data;
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/company.js
git commit -m "feat: add company API module"
```

---

## Task 7: Landing.jsx — add company redirect + remove debug logs

**Files:**
- Modify: `client/src/pages/Landing.jsx`

- [ ] **Step 1: Update the role-based redirect in useEffect**

In `client/src/pages/Landing.jsx`, replace line 17:
```js
navigate(user.role === 'admin' ? '/admin' : '/dashboard');
```
with:
```js
if (user.role === 'admin') navigate('/admin');
else if (user.role === 'company') navigate('/company');
else navigate('/dashboard');
```

- [ ] **Step 2: Update handleDevLogin to handle company role**

Replace the navigate call at line 51:
```js
navigate(userData?.role === 'admin' ? '/admin' : '/dashboard');
```
with:
```js
if (userData?.role === 'admin') navigate('/admin');
else if (userData?.role === 'company') navigate('/company');
else navigate('/dashboard');
```

- [ ] **Step 3: Remove debug console.logs from handleDevLogin**

Remove these four lines:
```js
console.log('[1] signInWithPassword 시작');
console.log('[2] 결과:', { data, error });
console.log('[3] user id:', data.user.id);
console.log('[4] users table:', userData, userError);
```

Also remove the unused `userError` destructuring — change:
```js
const { data: userData, error: userError } = await supabase
```
to:
```js
const { data: userData } = await supabase
```

- [ ] **Step 4: Verify the final handleDevLogin looks like**

```js
const handleDevLogin = async (e) => {
  e.preventDefault();
  setDevError('');
  setDevLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    });
    if (error) { setDevError(error.message); return; }
    if (!data?.user) { setDevError('유저 정보 없음'); return; }
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
    if (userData?.role === 'admin') navigate('/admin');
    else if (userData?.role === 'company') navigate('/company');
    else navigate('/dashboard');
  } catch (err) {
    setDevError(err.message || '로그인 중 오류가 발생했습니다.');
  } finally {
    setDevLoading(false);
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Landing.jsx
git commit -m "feat: add company role redirect in Landing, remove debug logs"
```

---

## Task 8: AdminLayout.jsx — update nav for companies

**Files:**
- Modify: `client/src/components/AdminLayout.jsx`

- [ ] **Step 1: Replace product/user nav links with company link**

In `client/src/components/AdminLayout.jsx`, replace the nav links block:
```jsx
<NavLink to="/admin" end className={navClass}>대시보드</NavLink>
<NavLink to="/admin/products" className={navClass}>상품 관리</NavLink>
<NavLink to="/admin/users" className={navClass}>회원 목록</NavLink>
<NavLink to="/admin/transfers" className={navClass}>자동이체 내역</NavLink>
<NavLink to="/admin/unpaid" className={navClass}>미수납 관리</NavLink>
```
with:
```jsx
<NavLink to="/admin" end className={navClass}>대시보드</NavLink>
<NavLink to="/admin/companies" className={navClass}>업체 관리</NavLink>
<NavLink to="/admin/transfers" className={navClass}>자동이체 내역</NavLink>
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/AdminLayout.jsx
git commit -m "feat: update AdminLayout nav for company management"
```

---

## Task 9: AdminDashboard.jsx — update stats cards

**Files:**
- Modify: `client/src/pages/admin/AdminDashboard.jsx`

- [ ] **Step 1: Replace getAdminUsers/getAdminProducts imports with company count**

In `client/src/pages/admin/AdminDashboard.jsx`, replace the import line:
```js
import { getAdminUsers, getAdminProducts, getAdminTransfers, getAdminStats, runAdminScheduler } from '../../api/admin';
```
with:
```js
import { getAdminTransfers, getAdminStats, runAdminScheduler } from '../../api/admin';
import { supabase } from '../../lib/supabase';
```

- [ ] **Step 2: Replace counts state and useEffect**

Replace:
```js
const [counts, setCounts] = useState({ users: 0, products: 0, transfers: 0 });
```
with:
```js
const [counts, setCounts] = useState({ companies: 0, transfers: 0 });
```

Replace the useEffect:
```js
useEffect(() => {
  Promise.all([getAdminUsers(), getAdminProducts(), getAdminTransfers()]).then(
    ([u, p, t]) => setCounts({ users: u.data.length, products: p.data.length, transfers: t.data.length })
  ).catch(() => {});
  getAdminStats().then(r => setStats(r.data)).catch(() => {});
}, []);
```
with:
```js
useEffect(() => {
  Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'company'),
    getAdminTransfers(),
  ]).then(([companyRes, t]) => {
    setCounts({ companies: companyRes.count ?? 0, transfers: t.data?.length ?? 0 });
  }).catch(() => {});
  getAdminStats().then(r => setStats(r.data)).catch(() => {});
}, []);
```

- [ ] **Step 3: Replace the stats cards array**

Replace:
```js
{ label: '전체 회원', value: counts.users, to: '/admin/users' },
{ label: '등록 상품', value: counts.products, to: '/admin/products' },
{ label: '자동이체 기록', value: counts.transfers, to: '/admin/transfers' },
```
with:
```js
{ label: '등록 업체', value: counts.companies, to: '/admin/companies' },
{ label: '자동이체 기록', value: counts.transfers, to: '/admin/transfers' },
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminDashboard.jsx
git commit -m "feat: update AdminDashboard to show company count instead of users/products"
```

---

## Task 10: AdminCompanies and AdminCompanyForm pages

**Files:**
- Create: `client/src/pages/admin/AdminCompanies.jsx`
- Create: `client/src/pages/admin/AdminCompanyForm.jsx`

- [ ] **Step 1: Create AdminCompanies.jsx**

```jsx
// client/src/pages/admin/AdminCompanies.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    supabase
      .from('users')
      .select('id, nickname, email, created_at')
      .eq('role', 'company')
      .order('created_at', { ascending: false })
      .then(({ data }) => setCompanies(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">업체 관리</h1>
        <Link
          to="/admin/companies/new"
          className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 transition"
        >
          + 업체 등록
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">업체명</th>
              <th className="px-5 py-3 font-medium">이메일</th>
              <th className="px-5 py-3 font-medium">등록일</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">등록된 업체가 없습니다.</td></tr>
            )}
            {companies.map(c => (
              <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{c.nickname}</td>
                <td className="px-5 py-3 text-slate-500">{c.email}</td>
                <td className="px-5 py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AdminCompanyForm.jsx**

```jsx
// client/src/pages/admin/AdminCompanyForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AdminCompanyForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Create auth user via Supabase Admin (requires service role key)
      // For demo: use signUp and then update role manually via SQL
      // This creates the auth user; the trigger will insert into public.users
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.nickname } },
      });
      if (signUpError) throw signUpError;

      // Update the role to 'company' (trigger creates user with role='user')
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'company', nickname: form.nickname })
        .eq('id', data.user.id);
      if (updateError) throw updateError;

      navigate('/admin/companies');
    } catch (err) {
      setError(err.message || '업체 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">업체 등록</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">업체명</label>
          <input
            type="text"
            required
            value={form.nickname}
            onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="(주)예시업체"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="company@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
          <input
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="6자 이상"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/admin/companies')}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50"
          >
            {loading ? '등록 중...' : '업체 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/AdminCompanies.jsx client/src/pages/admin/AdminCompanyForm.jsx
git commit -m "feat: add AdminCompanies list and AdminCompanyForm pages"
```

---

## Task 11: Company Dashboard

**Files:**
- Create: `client/src/pages/company/CompanyDashboard.jsx`

- [ ] **Step 1: Create CompanyDashboard.jsx**

```jsx
// client/src/pages/company/CompanyDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyStats, getCompanyUnpaid } from '../../api/company';

export default function CompanyDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyStats(user.id).then(setStats).catch(() => {});
    getCompanyUnpaid(user.id).then(data => setUnpaidCount(data?.length ?? 0)).catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">업체 대시보드</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <p className="text-green-600 text-sm">이번 달 수납률</p>
          <p className="text-3xl font-bold text-green-700 mt-1">
            {stats ? `${stats.successRate}%` : '-'}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center">
          <p className="text-blue-600 text-sm">총 수납액</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {stats ? `${Number(stats.totalAmount).toLocaleString()}원` : '-'}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-red-600 text-sm">미수납 건수</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{stats ? `${stats.failCount}건` : '-'}</p>
        </div>
      </div>
      {unpaidCount > 0 && (
        <Link
          to="/company/unpaid"
          className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-5 hover:border-red-400 transition"
        >
          <div>
            <p className="text-red-600 text-sm font-semibold">⚠ 미수납 내역</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{unpaidCount}건 미처리</p>
          </div>
          <span className="text-red-400 text-xl">→</span>
        </Link>
      )}
      <div className="flex gap-3">
        <Link to="/company/customers/new"
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
          + 고객 등록
        </Link>
        <Link to="/company/products/new"
          className="border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">
          + 상품 등록
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/company/CompanyDashboard.jsx
git commit -m "feat: add CompanyDashboard page"
```

---

## Task 12: Company Products pages

**Files:**
- Create: `client/src/pages/company/CompanyProducts.jsx`
- Create: `client/src/pages/company/CompanyProductForm.jsx`

- [ ] **Step 1: Create CompanyProducts.jsx**

```jsx
// client/src/pages/company/CompanyProducts.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyProducts, deleteCompanyProduct } from '../../api/company';

export default function CompanyProducts() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);

  const load = () => {
    if (!user?.id) return;
    getCompanyProducts(user.id).then(setProducts).catch(() => {});
  };

  useEffect(load, [user?.id]);

  const handleDelete = async (id) => {
    if (!confirm('상품을 삭제할까요?')) return;
    await deleteCompanyProduct(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">상품 관리</h1>
        <Link to="/company/products/new"
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition">
          + 상품 등록
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-3 font-medium">상품명</th>
              <th className="px-5 py-3 font-medium">금액</th>
              <th className="px-5 py-3 font-medium">결제일</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">등록된 상품이 없습니다.</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-5 py-3 text-slate-700">{Number(p.amount).toLocaleString()}원</td>
                <td className="px-5 py-3 text-slate-500">매월 {p.billing_day}일</td>
                <td className="px-5 py-3 text-right space-x-2">
                  <Link to={`/company/products/${p.id}`}
                    className="text-emerald-600 hover:underline text-xs">수정</Link>
                  <button onClick={() => handleDelete(p.id)}
                    className="text-red-400 hover:text-red-600 text-xs">삭제</button>
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

- [ ] **Step 2: Create CompanyProductForm.jsx**

```jsx
// client/src/pages/company/CompanyProductForm.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyProduct, createCompanyProduct, updateCompanyProduct } from '../../api/company';

export default function CompanyProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ name: '', amount: '', billing_day: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    getCompanyProduct(id).then(p => setForm({ name: p.name, amount: p.amount, billing_day: p.billing_day })).catch(() => {});
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const day = Number(form.billing_day);
    if (day < 1 || day > 28) { setError('결제일은 1~28 사이여야 합니다.'); return; }
    setLoading(true);
    try {
      const payload = { name: form.name, amount: Number(form.amount), billing_day: day };
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
          <label className="block text-sm font-medium text-slate-700 mb-1">금액 (원)</label>
          <input type="number" required min="1" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="29900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">결제일 (1~28)</label>
          <input type="number" required min="1" max="28" value={form.billing_day}
            onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="15" />
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
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/company/CompanyProducts.jsx client/src/pages/company/CompanyProductForm.jsx
git commit -m "feat: add CompanyProducts list and CompanyProductForm pages"
```

---

## Task 13: Company Customers pages (consent request)

**Files:**
- Create: `client/src/pages/company/CompanyCustomers.jsx`
- Create: `client/src/pages/company/CompanyCustomerForm.jsx`

- [ ] **Step 1: Create CompanyCustomers.jsx**

```jsx
// client/src/pages/company/CompanyCustomers.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyCustomers } from '../../api/company';

const STATUS_LABEL = { pending: '대기', accepted: '수락', rejected: '거절' };
const STATUS_COLOR = { pending: 'text-yellow-600 bg-yellow-50', accepted: 'text-green-600 bg-green-50', rejected: 'text-red-600 bg-red-50' };

export default function CompanyCustomers() {
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyCustomers(user.id).then(setCustomers).catch(() => {});
  }, [user?.id]);

  const copyLink = (token) => {
    const url = `${window.location.origin}/consent/${token}`;
    navigator.clipboard.writeText(url);
    alert('링크가 복사되었습니다.');
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
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">등록된 고객이 없습니다.</td></tr>
            )}
            {customers.map(c => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CompanyCustomerForm.jsx**

```jsx
// client/src/pages/company/CompanyCustomerForm.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getCompanyProducts, createConsentRequest } from '../../api/company';

export default function CompanyCustomerForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customerName: '', customerContact: '', productId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyProducts(user.id).then(setProducts).catch(() => {});
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.productId) { setError('상품을 선택해주세요.'); return; }
    setLoading(true);
    try {
      const req = await createConsentRequest({
        companyId: user.id,
        productId: form.productId,
        customerName: form.customerName,
        customerContact: form.customerContact,
      });
      const link = `${window.location.origin}/consent/${req.invite_token}`;
      navigator.clipboard.writeText(link);
      alert(`동의 요청이 생성되었습니다.\n링크가 클립보드에 복사되었습니다:\n${link}`);
      navigate('/company/customers');
    } catch (err) {
      setError(err.message || '등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">동의 요청 생성</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">고객명</label>
          <input type="text" required value={form.customerName}
            onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="홍길동" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">연락처</label>
          <input type="text" required value={form.customerContact}
            onChange={e => setForm(f => ({ ...f, customerContact: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="010-1234-5678" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">상품 선택</label>
          <select required value={form.productId}
            onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">-- 상품을 선택하세요 --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({Number(p.amount).toLocaleString()}원 / 매월 {p.billing_day}일)</option>
            ))}
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/company/customers')}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50">
            {loading ? '생성 중...' : '요청 생성 + 링크 복사'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/company/CompanyCustomers.jsx client/src/pages/company/CompanyCustomerForm.jsx
git commit -m "feat: add CompanyCustomers list and CompanyCustomerForm pages"
```

---

## Task 14: CompanyTransfers and CompanyUnpaid pages

**Files:**
- Create: `client/src/pages/company/CompanyTransfers.jsx`
- Create: `client/src/pages/company/CompanyUnpaid.jsx`

- [ ] **Step 1: Create CompanyTransfers.jsx**

```jsx
// client/src/pages/company/CompanyTransfers.jsx
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getCompanyTransfers } from '../../api/company';

export default function CompanyTransfers() {
  const { user } = useAuthStore();
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    getCompanyTransfers(user.id).then(setTransfers).catch(() => {});
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
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">수납 내역이 없습니다.</td></tr>
            )}
            {transfers.map(t => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{new Date(t.billed_at).toLocaleDateString('ko-KR')}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CompanyUnpaid.jsx**

```jsx
// client/src/pages/company/CompanyUnpaid.jsx
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
                <td className="px-5 py-3 text-slate-500">{new Date(u.billed_at).toLocaleDateString('ko-KR')}</td>
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

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/company/CompanyTransfers.jsx client/src/pages/company/CompanyUnpaid.jsx
git commit -m "feat: add CompanyTransfers and CompanyUnpaid pages"
```

---

## Task 15: ConsentPage

**Files:**
- Create: `client/src/pages/ConsentPage.jsx`

- [ ] **Step 1: Create ConsentPage.jsx**

```jsx
// client/src/pages/ConsentPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getConsentRequest, acceptConsent } from '../api/company';
import { supabase } from '../lib/supabase';

export default function ConsentPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, session, initializing } = useAuthStore();
  const [request, setRequest] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (initializing) return;
    if (!session) {
      navigate(`/?redirect=/consent/${token}`, { replace: true });
    }
  }, [initializing, session, token, navigate]);

  useEffect(() => {
    if (!session || !user) return;
    Promise.all([
      getConsentRequest(token),
      supabase.from('accounts').select('id, balance').eq('user_id', user.id).eq('type', 'personal'),
    ]).then(([req, { data: accs }]) => {
      setRequest(req);
      setAccounts(accs ?? []);
      if (accs?.length > 0) setSelectedAccount(accs[0].id);
    }).catch(() => setError('요청 정보를 불러올 수 없습니다.')).finally(() => setLoading(false));
  }, [session, user, token]);

  const handleAccept = async () => {
    if (!selectedAccount) { setError('출금 계좌를 선택해주세요.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await acceptConsent(token, selectedAccount);
      setDone(true);
    } catch (err) {
      setError(err.message || '동의 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing || loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">로딩 중...</div>;
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 p-8 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-sm w-full mx-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-bold text-slate-900">동의 완료</h2>
          <p className="text-slate-500 text-sm">자동이체 구독이 시작되었습니다.</p>
          <button onClick={() => navigate('/subscriptions')}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
            구독 내역 보기
          </button>
        </div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>
    );
  }

  if (request?.status !== 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <p className="text-slate-500">이미 처리된 동의 요청입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h1 className="text-xl font-bold text-slate-900">자동이체 동의</h1>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">업체명</span>
              <span className="font-medium text-slate-900">{request?.users?.nickname}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">상품명</span>
              <span className="font-medium text-slate-900">{request?.products?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">결제 금액</span>
              <span className="font-bold text-slate-900">{Number(request?.products?.amount).toLocaleString()}원</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">결제일</span>
              <span className="font-medium text-slate-900">매월 {request?.products?.billing_day}일</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">출금 계좌 선택</label>
            {accounts.length === 0 ? (
              <p className="text-sm text-red-500">등록된 계좌가 없습니다. 먼저 계좌를 등록해주세요.</p>
            ) : (
              <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    계좌 ({Number(a.balance).toLocaleString()}원)
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleAccept}
            disabled={submitting || accounts.length === 0}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {submitting ? '처리 중...' : '동의하고 구독 시작'}
          </button>
          <p className="text-xs text-slate-400 text-center">
            동의 시 매월 {request?.products?.billing_day}일에 자동이체가 실행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/ConsentPage.jsx
git commit -m "feat: add ConsentPage for user consent acceptance flow"
```

---

## Task 16: App.jsx — wire up all new routes

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Add all new imports to App.jsx**

At the top of `client/src/App.jsx`, add after the existing imports:

```jsx
import CompanyRoute from './components/CompanyRoute';
import CompanyLayout from './components/CompanyLayout';
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyProducts from './pages/company/CompanyProducts';
import CompanyProductForm from './pages/company/CompanyProductForm';
import CompanyCustomers from './pages/company/CompanyCustomers';
import CompanyCustomerForm from './pages/company/CompanyCustomerForm';
import CompanyTransfers from './pages/company/CompanyTransfers';
import CompanyUnpaid from './pages/company/CompanyUnpaid';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminCompanyForm from './pages/admin/AdminCompanyForm';
import ConsentPage from './pages/ConsentPage';
```

- [ ] **Step 2: Add new routes inside the Routes block**

In `client/src/App.jsx`, add the following routes:

1. After `<Route path="/auth/callback" element={<AuthCallback />} />` (public route), add:
```jsx
<Route path="/consent/:token" element={<ConsentPage />} />
```

2. Inside `<Route element={<ProtectedRoute />}>`, after the AdminRoute block, add:
```jsx
<Route element={<CompanyRoute />}>
  <Route element={<CompanyLayout />}>
    <Route path="/company" element={<CompanyDashboard />} />
    <Route path="/company/products" element={<CompanyProducts />} />
    <Route path="/company/products/new" element={<CompanyProductForm />} />
    <Route path="/company/products/:id" element={<CompanyProductForm />} />
    <Route path="/company/customers" element={<CompanyCustomers />} />
    <Route path="/company/customers/new" element={<CompanyCustomerForm />} />
    <Route path="/company/transfers" element={<CompanyTransfers />} />
    <Route path="/company/unpaid" element={<CompanyUnpaid />} />
  </Route>
</Route>
```

3. Inside the AdminRoute/AdminLayout block, add company admin routes:
```jsx
<Route path="/admin/companies" element={<AdminCompanies />} />
<Route path="/admin/companies/new" element={<AdminCompanyForm />} />
```

- [ ] **Step 3: Verify the complete App.jsx looks like**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Subscriptions from './pages/Subscriptions';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTransfers from './pages/admin/AdminTransfers';
import AdminUnpaid from './pages/admin/AdminUnpaid';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminCompanyForm from './pages/admin/AdminCompanyForm';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import CompanyRoute from './components/CompanyRoute';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import CompanyLayout from './components/CompanyLayout';
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyProducts from './pages/company/CompanyProducts';
import CompanyProductForm from './pages/company/CompanyProductForm';
import CompanyCustomers from './pages/company/CompanyCustomers';
import CompanyCustomerForm from './pages/company/CompanyCustomerForm';
import CompanyTransfers from './pages/company/CompanyTransfers';
import CompanyUnpaid from './pages/company/CompanyUnpaid';
import ConsentPage from './pages/ConsentPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/consent/:token" element={<ConsentPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/products/new" element={<AdminProductForm />} />
              <Route path="/admin/products/:id" element={<AdminProductForm />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/transfers" element={<AdminTransfers />} />
              <Route path="/admin/unpaid" element={<AdminUnpaid />} />
              <Route path="/admin/companies" element={<AdminCompanies />} />
              <Route path="/admin/companies/new" element={<AdminCompanyForm />} />
            </Route>
          </Route>
          <Route element={<CompanyRoute />}>
            <Route element={<CompanyLayout />}>
              <Route path="/company" element={<CompanyDashboard />} />
              <Route path="/company/products" element={<CompanyProducts />} />
              <Route path="/company/products/new" element={<CompanyProductForm />} />
              <Route path="/company/products/:id" element={<CompanyProductForm />} />
              <Route path="/company/customers" element={<CompanyCustomers />} />
              <Route path="/company/customers/new" element={<CompanyCustomerForm />} />
              <Route path="/company/transfers" element={<CompanyTransfers />} />
              <Route path="/company/unpaid" element={<CompanyUnpaid />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: wire up all company and consent routes in App.jsx"
```

---

## Task 17: End-to-end manual verification

No automated tests for this UI-heavy flow. Test in browser with `npm run dev` in `client/`.

- [ ] **Step 1: Run dev server**

```bash
cd client && npm run dev
```

- [ ] **Step 2: Test admin flow**
  1. Login as admin → should land on `/admin`
  2. `/admin/companies` → empty list with "+ 업체 등록" button
  3. Create a company account → should appear in list
  4. AdminDashboard → "등록 업체" card shows count

- [ ] **Step 3: Test company flow**
  1. Login as company (dev login) → should land on `/company`
  2. `/company/products/new` → create a product (e.g., "월 구독", 10000원, 15일)
  3. `/company/customers/new` → fill customer name/contact, select product → click "요청 생성 + 링크 복사"
  4. Clipboard should have a link like `http://localhost:5173/consent/<token>`

- [ ] **Step 4: Test consent flow**
  1. Open the consent link in a new tab (logged in as a regular user)
  2. Should see product details (company name, product name, amount, billing day)
  3. Select an account → click "동의하고 구독 시작"
  4. Should show "동의 완료" screen
  5. Navigate to `/subscriptions` — should show the new subscription
  6. `/company/customers` → status should be "수락"

- [ ] **Step 5: Test role redirect**
  1. Landing page: login as company → redirects to `/company`
  2. Landing page: login as admin → redirects to `/admin`
  3. Landing page: login as user → redirects to `/dashboard`

- [ ] **Step 6: Commit any fixes found**

```bash
git add -p
git commit -m "fix: <describe any issues found during manual testing>"
```

---

## Notes

- **업체 계정 생성 방법 (시연용):** `AdminCompanyForm`은 `supabase.auth.signUp`을 사용하므로 Supabase 이메일 확인이 활성화된 경우 계정이 즉시 활성화되지 않을 수 있음. 이 경우 Supabase Dashboard → Authentication → Users에서 "Confirm" 처리 필요.
- **accept_consent RPC의 auth.uid():** 이 함수는 Supabase RLS 컨텍스트에서 실행되므로 로그인된 사용자의 ID를 자동으로 사용함. 미로그인 상태에서는 ConsentPage가 로그인 페이지로 리다이렉트하므로 항상 로그인 상태에서 실행됨.
- **기존 subscriptions 테이블:** `account_id` 컬럼이 있어야 함. 없다면 마이그레이션 추가 필요.
