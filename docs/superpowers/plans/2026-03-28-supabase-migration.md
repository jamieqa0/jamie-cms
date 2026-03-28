# Supabase Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express 서버(`server/`)를 완전히 제거하고 Supabase(Auth + DB + RLS + Edge Functions)로 대체한다.

**Architecture:** Supabase Auth로 카카오 OAuth를 처리하고, RLS 정책으로 접근 제어를 DB 레벨로 이동. 복잡한 autoDebit 로직은 PostgreSQL 저장 함수 + Edge Function으로 이식. 프론트는 axios 대신 `@supabase/supabase-js` 클라이언트를 직접 사용.

**Tech Stack:** React 19 + Vite, @supabase/supabase-js, Supabase Auth (Kakao), Supabase Edge Functions (Deno), PostgreSQL RLS + pl/pgsql

---

## File Structure

**Create:**
- `client/src/lib/supabase.js` — Supabase 클라이언트 싱글톤
- `supabase/functions/auto-debit/index.ts` — autoDebit Edge Function

**Rewrite:**
- `client/src/store/authStore.js` — Supabase 세션 기반으로 교체
- `client/src/api/client.js` — supabase 클라이언트 re-export로 교체 (기존 import 경로 유지)
- `client/src/api/auth.js` — supabase.auth 호출로 교체
- `client/src/api/accounts.js` — supabase.from('accounts') 호출로 교체
- `client/src/api/products.js` — supabase.from('products') 호출로 교체
- `client/src/api/subscriptions.js` — supabase.from('subscriptions') 호출로 교체
- `client/src/api/admin.js` — supabase.rpc() 호출로 교체
- `client/src/pages/Landing.jsx` — supabase.auth.signInWithOAuth('kakao')로 교체
- `client/src/pages/AuthCallback.jsx` — Supabase 세션 감지로 교체
- `client/src/components/ProtectedRoute.jsx` — Supabase 세션 체크로 교체
- `client/src/components/AdminRoute.jsx` — users.role DB 조회로 교체
- `client/src/pages/admin/AdminDashboard.jsx` — Edge Function 호출로 교체
- `client/.env` — Supabase 환경변수로 교체

**Delete:**
- `server/` 디렉토리 전체

---

## Task 1: Supabase Dashboard 설정 (수동 작업)

**Files:** 없음 (Supabase 대시보드에서 직접 설정)

- [ ] **Step 1: Kakao OAuth 앱 설정**

  카카오 개발자 콘솔(https://developers.kakao.com) → 앱 설정 → 카카오 로그인:
  - Redirect URI 추가: `https://<your-project>.supabase.co/auth/v1/callback`
  - 동의항목: 닉네임, 이메일(선택) 활성화

- [ ] **Step 2: Supabase Auth에 Kakao Provider 추가**

  Supabase 대시보드 → Authentication → Providers → Kakao:
  - Enabled: ON
  - Kakao REST API Key: 카카오 앱의 REST API 키
  - Kakao Admin Key: 카카오 앱의 Admin 키
  - Redirect URL 확인: `https://<your-project>.supabase.co/auth/v1/callback`

- [ ] **Step 3: Supabase 환경변수 수집**

  Supabase 대시보드 → Project Settings → API:
  - `Project URL` 복사 (VITE_SUPABASE_URL로 사용)
  - `anon public` 키 복사 (VITE_SUPABASE_ANON_KEY로 사용)
  - `service_role` 키 복사 (Edge Function 환경변수용, 절대 프론트에 노출 금지)

- [ ] **Step 4: client/.env 업데이트**

  ```
  VITE_SUPABASE_URL=https://<your-project>.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon-public-key>
  ```

  기존 `VITE_API_URL` 줄은 삭제.

- [ ] **Step 5: Supabase 대시보드에서 pg_net extension 활성화**

  Supabase 대시보드 → Database → Extensions → `pg_net` 검색 → Enable

---

## Task 2: DB 스키마 마이그레이션 (Supabase SQL Editor)

**Files:** `server/supabase/schema.sql` (참고용), Supabase SQL Editor에서 직접 실행

> **주의:** 이 작업은 기존 users 테이블 데이터를 초기화합니다. 데모 프로젝트이므로 기존 테스트 데이터를 모두 삭제하고 깨끗하게 시작합니다.

- [ ] **Step 1: 기존 데이터 정리 및 users 테이블 구조 변경**

  Supabase SQL Editor에서 실행:

  ```sql
  -- 기존 데이터 정리 (FK 순서대로)
  DELETE FROM billing_logs;
  DELETE FROM transactions;
  DELETE FROM subscriptions;
  DELETE FROM refresh_tokens;
  DELETE FROM auth_codes;
  DELETE FROM accounts WHERE type != 'collection';
  DELETE FROM users;

  -- collection 계좌의 user_id FK 제약 때문에 collection 계좌도 삭제
  DELETE FROM accounts;
  ```

- [ ] **Step 2: users.id를 auth.users.id와 연결**

  Supabase SQL Editor에서 실행:

  ```sql
  -- users 테이블 재생성 (id = auth.users.id UUID)
  -- 기존 테이블을 backup 후 재생성
  ALTER TABLE billing_logs DROP CONSTRAINT IF EXISTS billing_logs_account_id_fkey;
  ALTER TABLE billing_logs DROP CONSTRAINT IF EXISTS billing_logs_subscription_id_fkey;
  ALTER TABLE billing_logs DROP CONSTRAINT IF EXISTS billing_logs_product_id_fkey;
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_account_id_fkey;
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_product_id_fkey;
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
  ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

  DROP TABLE IF EXISTS users CASCADE;

  CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    kakao_id VARCHAR UNIQUE NOT NULL,
    nickname VARCHAR NOT NULL,
    email VARCHAR,
    role VARCHAR NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- FK 복원 (accounts)
  ALTER TABLE accounts
    ADD CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

  -- FK 복원 (subscriptions)
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT subscriptions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    ADD CONSTRAINT subscriptions_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

  -- FK 복원 (billing_logs)
  ALTER TABLE billing_logs
    ADD CONSTRAINT billing_logs_subscription_id_fkey
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    ADD CONSTRAINT billing_logs_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    ADD CONSTRAINT billing_logs_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT;

  -- FK 복원 (transactions)
  ALTER TABLE transactions
    ADD CONSTRAINT transactions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
  ```

- [ ] **Step 3: 신규 유저 자동 upsert 트리거 생성**

  ```sql
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.users (id, kakao_id, nickname, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'provider_id', NEW.id::text),
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
      NEW.email,
      'user'
    )
    ON CONFLICT (id) DO UPDATE
      SET nickname = EXCLUDED.nickname,
          email = EXCLUDED.email;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  ```

- [ ] **Step 4: 집금 계좌 Seed 데이터 재삽입**

  ```sql
  -- 시스템 유저 생성 (auth.users 없이 직접 삽입)
  INSERT INTO users (id, kakao_id, nickname, role)
  VALUES (gen_random_uuid(), 'system', 'System', 'admin');

  -- 집금 계좌 생성
  INSERT INTO accounts (user_id, name, type, balance)
  SELECT id, '기관 집금 계좌', 'collection', 0 FROM users WHERE kakao_id = 'system';
  ```

- [ ] **Step 5: RLS 헬퍼 함수 생성**

  ```sql
  -- 현재 로그인 유저가 어드민인지 확인
  CREATE OR REPLACE FUNCTION is_admin()
  RETURNS BOOLEAN AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    );
  $$ LANGUAGE sql SECURITY DEFINER STABLE;
  ```

- [ ] **Step 6: RLS 정책 활성화**

  ```sql
  -- users
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users can view own profile" ON users FOR SELECT USING (id = auth.uid() OR is_admin());
  CREATE POLICY "users can update own profile" ON users FOR UPDATE USING (id = auth.uid());

  -- accounts
  ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "accounts access" ON accounts FOR ALL USING (user_id = auth.uid() OR is_admin() OR type = 'collection');

  -- products
  ALTER TABLE products ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anyone can view active products" ON products FOR SELECT USING (is_active = true OR is_admin());
  CREATE POLICY "admin can manage products" ON products FOR INSERT WITH CHECK (is_admin());
  CREATE POLICY "admin can update products" ON products FOR UPDATE USING (is_admin());
  CREATE POLICY "admin can delete products" ON products FOR DELETE USING (is_admin());

  -- subscriptions
  ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "subscriptions access" ON subscriptions FOR ALL USING (user_id = auth.uid() OR is_admin());

  -- billing_logs
  ALTER TABLE billing_logs ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "billing_logs access" ON billing_logs FOR ALL USING (
    account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
    OR is_admin()
  );

  -- transactions
  ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "transactions access" ON transactions FOR ALL USING (
    account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
    OR is_admin()
  );
  ```

- [ ] **Step 7: 어드민 RPC 함수 생성**

  ```sql
  -- 어드민 통계
  CREATE OR REPLACE FUNCTION get_admin_stats()
  RETURNS json
  LANGUAGE sql SECURITY DEFINER AS $$
    SELECT json_build_object(
      'successRate',
        ROUND(
          COUNT(*) FILTER (WHERE status = 'success') * 100.0
          / NULLIF(COUNT(*), 0), 1
        ),
      'totalAmount',
        COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0),
      'failCount',
        COUNT(*) FILTER (WHERE status = 'failed')
    )
    FROM billing_logs
    WHERE DATE_TRUNC('month', executed_at) = DATE_TRUNC('month', CURRENT_DATE);
  $$;

  -- 미수납 목록
  CREATE OR REPLACE FUNCTION get_unpaid_list()
  RETURNS TABLE (
    id UUID, subscription_id UUID, product_id UUID, account_id UUID,
    amount BIGINT, reason VARCHAR, executed_at TIMESTAMPTZ,
    nickname VARCHAR, product_name VARCHAR
  )
  LANGUAGE sql SECURITY DEFINER AS $$
    SELECT
      bl.id, bl.subscription_id, bl.product_id, bl.account_id,
      bl.amount, bl.reason, bl.executed_at,
      u.nickname, p.name AS product_name
    FROM billing_logs bl
    JOIN subscriptions s ON bl.subscription_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN products p ON bl.product_id = p.id
    WHERE bl.status = 'failed'
    ORDER BY bl.executed_at DESC;
  $$;

  -- 어드민 유저 목록
  CREATE OR REPLACE FUNCTION get_admin_users()
  RETURNS TABLE (id UUID, nickname VARCHAR, email VARCHAR, role VARCHAR, created_at TIMESTAMPTZ)
  LANGUAGE sql SECURITY DEFINER AS $$
    SELECT id, nickname, email, role, created_at FROM users ORDER BY created_at DESC;
  $$;

  -- 어드민 자동이체 내역 (JOIN 포함)
  CREATE OR REPLACE FUNCTION get_admin_transfers()
  RETURNS TABLE (
    id UUID, amount BIGINT, status VARCHAR, reason VARCHAR,
    executed_at TIMESTAMPTZ, nickname VARCHAR, product_name VARCHAR
  )
  LANGUAGE sql SECURITY DEFINER AS $$
    SELECT
      bl.id, bl.amount, bl.status, bl.reason, bl.executed_at,
      u.nickname, p.name AS product_name
    FROM billing_logs bl
    JOIN subscriptions s ON bl.subscription_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN products p ON bl.product_id = p.id
    ORDER BY bl.executed_at DESC;
  $$;
  ```

- [ ] **Step 8: run_auto_debit 저장 함수 생성**

  ```sql
  CREATE OR REPLACE FUNCTION run_auto_debit(target_day INT DEFAULT NULL)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    v_today INT := COALESCE(target_day, EXTRACT(DAY FROM CURRENT_DATE)::INT);
    v_collection_id UUID;
    v_row RECORD;
    v_balance BIGINT;
    v_success INT := 0;
    v_failed INT := 0;
  BEGIN
    SELECT id INTO v_collection_id FROM accounts WHERE type = 'collection' LIMIT 1;
    IF v_collection_id IS NULL THEN
      RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
    END IF;

    FOR v_row IN
      SELECT s.id AS subscription_id, s.account_id, p.id AS product_id, p.amount
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
        SELECT balance INTO v_balance FROM accounts WHERE id = v_row.account_id FOR UPDATE;
        PERFORM id FROM accounts WHERE id = v_collection_id FOR UPDATE;

        IF v_balance < v_row.amount THEN
          INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
          VALUES (v_row.subscription_id, v_row.product_id, v_row.account_id, v_row.amount, 'failed', '잔액 부족');
          v_failed := v_failed + 1;
          CONTINUE;
        END IF;

        UPDATE accounts SET balance = balance - v_row.amount WHERE id = v_row.account_id;
        UPDATE accounts SET balance = balance + v_row.amount WHERE id = v_collection_id;

        INSERT INTO transactions (account_id, type, amount, description)
        VALUES (v_row.account_id, 'auto_debit', v_row.amount, '자동이체');

        INSERT INTO transactions (account_id, type, amount, description)
        VALUES (v_collection_id, 'deposit', v_row.amount, '자동이체 수납');

        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
        VALUES (v_row.subscription_id, v_row.product_id, v_row.account_id, v_row.amount, 'success');

        v_success := v_success + 1;

      EXCEPTION WHEN OTHERS THEN
        INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
        VALUES (v_row.subscription_id, v_row.product_id, v_row.account_id, v_row.amount, 'failed', SQLERRM);
        v_failed := v_failed + 1;
      END;
    END LOOP;

    RETURN json_build_object('success', v_success, 'failed', v_failed);
  END;
  $$;
  ```

- [ ] **Step 9: retry_billing 저장 함수 생성**

  ```sql
  CREATE OR REPLACE FUNCTION retry_billing(log_id UUID)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    v_log RECORD;
    v_collection_id UUID;
    v_balance BIGINT;
  BEGIN
    SELECT * INTO v_log FROM billing_logs WHERE id = log_id AND status = 'failed';
    IF NOT FOUND THEN
      RAISE EXCEPTION '대상 미수납 내역을 찾을 수 없습니다.';
    END IF;

    SELECT id INTO v_collection_id FROM accounts WHERE type = 'collection' LIMIT 1;

    SELECT balance INTO v_balance FROM accounts WHERE id = v_log.account_id FOR UPDATE;
    PERFORM id FROM accounts WHERE id = v_collection_id FOR UPDATE;

    IF v_balance < v_log.amount THEN
      RAISE EXCEPTION '잔액 부족';
    END IF;

    UPDATE accounts SET balance = balance - v_log.amount WHERE id = v_log.account_id;
    UPDATE accounts SET balance = balance + v_log.amount WHERE id = v_collection_id;

    INSERT INTO transactions (account_id, type, amount, description)
    VALUES (v_log.account_id, 'auto_debit', v_log.amount, '재청구');

    INSERT INTO transactions (account_id, type, amount, description)
    VALUES (v_collection_id, 'deposit', v_log.amount, '재청구 수납');

    UPDATE billing_logs SET status = 'success', reason = null WHERE id = log_id;

    INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
    VALUES (v_log.subscription_id, v_log.product_id, v_log.account_id, v_log.amount, 'success');

    RETURN json_build_object('message', '재청구 완료');
  END;
  $$;
  ```

- [ ] **Step 10: SQL 실행 결과 확인**

  Supabase SQL Editor에서 실행:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name;
  -- users, accounts, products, subscriptions, billing_logs, transactions 확인

  SELECT * FROM accounts WHERE type = 'collection';
  -- 집금 계좌 1개 존재 확인
  ```

- [ ] **Step 11: 커밋**

  ```bash
  git add server/supabase/schema.sql
  git commit -m "docs: update schema notes for Supabase migration"
  ```

---

## Task 3: Supabase 클라이언트 설치 및 초기화

**Files:**
- Modify: `client/package.json`
- Create: `client/src/lib/supabase.js`

- [ ] **Step 1: @supabase/supabase-js 설치**

  ```bash
  cd client
  npm install @supabase/supabase-js
  ```

  Expected output: `added 1 package` 또는 `up to date`

- [ ] **Step 2: supabase.js 생성**

  `client/src/lib/supabase.js`:

  ```js
  import { createClient } from '@supabase/supabase-js';

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
  }

  export const supabase = createClient(supabaseUrl, supabaseAnonKey);
  ```

- [ ] **Step 3: 빌드 확인**

  ```bash
  cd client
  npm run build
  ```

  Expected: 에러 없이 빌드 성공

- [ ] **Step 4: 커밋**

  ```bash
  git add client/package.json client/package-lock.json client/src/lib/supabase.js
  git commit -m "feat: add Supabase client"
  ```

---

## Task 4: Auth Store 교체

**Files:**
- Modify: `client/src/store/authStore.js`
- Modify: `client/src/api/client.js`

- [ ] **Step 1: authStore.js 교체**

  `client/src/store/authStore.js` 전체를 아래로 교체:

  ```js
  import { create } from 'zustand';
  import { supabase } from '../lib/supabase';

  export const useAuthStore = create((set) => ({
    user: null,
    session: null,
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    logout: async () => {
      await supabase.auth.signOut();
      set({ user: null, session: null });
    },
  }));

  // Supabase 세션 변경 구독 (앱 전체에서 자동 갱신)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      // users 테이블에서 role 포함 유저 정보 조회
      const { data: userData } = await supabase
        .from('users')
        .select('id, nickname, email, role')
        .eq('id', session.user.id)
        .single();
      useAuthStore.setState({ session, user: userData });
    } else {
      useAuthStore.setState({ session: null, user: null });
    }
  });
  ```

- [ ] **Step 2: client.js 교체 (supabase re-export)**

  `client/src/api/client.js` 전체를 아래로 교체:

  ```js
  // 기존 axios 클라이언트를 Supabase 클라이언트로 교체
  // api/*.js 파일들이 이 파일을 import하므로 supabase를 re-export
  export { supabase as default } from '../lib/supabase';
  ```

- [ ] **Step 3: 커밋**

  ```bash
  git add client/src/store/authStore.js client/src/api/client.js
  git commit -m "feat: replace JWT auth store with Supabase session"
  ```

---

## Task 5: 인증 관련 페이지 교체

**Files:**
- Modify: `client/src/pages/Landing.jsx`
- Modify: `client/src/pages/AuthCallback.jsx`
- Modify: `client/src/components/ProtectedRoute.jsx`
- Modify: `client/src/components/AdminRoute.jsx`

- [ ] **Step 1: Landing.jsx 교체**

  `client/src/pages/Landing.jsx` 전체를 아래로 교체:

  ```jsx
  import { useEffect } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { supabase } from '../lib/supabase';
  import { useAuthStore } from '../store/authStore';

  export default function Landing() {
    const { session } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
      if (session) navigate('/dashboard');
    }, [session, navigate]);

    const handleKakaoLogin = async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-slate-900">Jamie CMS</h1>
          <p className="text-slate-500">정기결제 자동이체 관리 서비스</p>
          <button
            onClick={handleKakaoLogin}
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold px-8 py-3 rounded-xl flex items-center gap-2 mx-auto transition"
          >
            카카오로 로그인
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: AuthCallback.jsx 교체**

  Supabase는 OAuth 콜백 시 URL에 `#access_token=...` 해시를 붙여서 리다이렉트함. `onAuthStateChange`가 자동으로 처리하므로 AuthCallback은 세션 감지만 하면 됨.

  `client/src/pages/AuthCallback.jsx` 전체를 아래로 교체:

  ```jsx
  import { useEffect, useRef } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useAuthStore } from '../store/authStore';

  export default function AuthCallback() {
    const { session } = useAuthStore();
    const navigate = useNavigate();
    const redirected = useRef(false);

    useEffect(() => {
      if (redirected.current) return;
      if (session) {
        redirected.current = true;
        navigate('/dashboard');
      }
    }, [session, navigate]);

    // 세션이 없는 채로 5초 경과 시 홈으로
    useEffect(() => {
      const timer = setTimeout(() => {
        if (!redirected.current) navigate('/');
      }, 5000);
      return () => clearTimeout(timer);
    }, [navigate]);

    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">로그인 중...</p>
      </div>
    );
  }
  ```

- [ ] **Step 3: ProtectedRoute.jsx 교체**

  `client/src/components/ProtectedRoute.jsx` 전체를 아래로 교체:

  ```jsx
  import { Navigate, Outlet } from 'react-router-dom';
  import { useAuthStore } from '../store/authStore';

  export default function ProtectedRoute() {
    const { session } = useAuthStore();
    return session ? <Outlet /> : <Navigate to="/" replace />;
  }
  ```

- [ ] **Step 4: AdminRoute.jsx 교체**

  `client/src/components/AdminRoute.jsx` 전체를 아래로 교체:

  ```jsx
  import { Navigate, Outlet } from 'react-router-dom';
  import { useAuthStore } from '../store/authStore';

  export default function AdminRoute() {
    const { user } = useAuthStore();
    return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />;
  }
  ```

- [ ] **Step 5: 로컬 개발 서버 기동 및 인증 흐름 테스트**

  ```bash
  cd client
  npm run dev
  ```

  1. `http://localhost:5173` 접속
  2. "카카오로 로그인" 버튼 클릭 → 카카오 인증 페이지로 이동 확인
  3. 카카오 로그인 완료 → `/auth/callback` → `/dashboard` 리다이렉트 확인
  4. Supabase 대시보드 → Authentication → Users에 유저 등록 확인
  5. Supabase 대시보드 → Table Editor → users 테이블에 자동 upsert 확인

- [ ] **Step 6: 커밋**

  ```bash
  git add client/src/pages/Landing.jsx client/src/pages/AuthCallback.jsx \
    client/src/components/ProtectedRoute.jsx client/src/components/AdminRoute.jsx
  git commit -m "feat: replace auth flow with Supabase OAuth"
  ```

---

## Task 6: API 레이어 교체 (CRUD)

**Files:**
- Modify: `client/src/api/auth.js`
- Modify: `client/src/api/accounts.js`
- Modify: `client/src/api/products.js`
- Modify: `client/src/api/subscriptions.js`

> **참고:** api 함수들의 반환 형식을 `{ data: [...] }` 형태로 유지해서 기존 페이지 컴포넌트 코드를 변경하지 않아도 됨.

- [ ] **Step 1: api/auth.js 교체**

  `client/src/api/auth.js` 전체를 아래로 교체:

  ```js
  import { supabase } from '../lib/supabase';

  export const getMe = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('users')
      .select('id, nickname, email, role')
      .eq('id', user.id)
      .single();
    return { data };
  };

  export const updateMe = async ({ nickname }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('users')
      .update({ nickname })
      .eq('id', user.id)
      .select()
      .single();
    return { data };
  };

  export const logout = async () => {
    await supabase.auth.signOut();
    return { data: { message: 'Logged out' } };
  };
  ```

- [ ] **Step 2: api/accounts.js 교체**

  `client/src/api/accounts.js` 전체를 아래로 교체:

  ```js
  import { supabase } from '../lib/supabase';

  export const getAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'personal')
      .order('created_at');
    return { data };
  };

  export const createAccount = async (name) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, name, type: 'personal' })
      .select()
      .single();
    return { data };
  };

  export const getAccount = async (id) => {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();
    return { data };
  };

  export const deposit = async (id, amount) => {
    const { data } = await supabase.rpc('account_deposit', { account_id: id, amount: Number(amount) });
    return { data };
  };

  export const withdraw = async (id, amount) => {
    const { data } = await supabase.rpc('account_withdraw', { account_id: id, amount: Number(amount) });
    return { data };
  };

  export const deleteAccount = async (id) => {
    const { data } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    return { data };
  };
  ```

- [ ] **Step 3: deposit/withdraw RPC 함수 생성 (Supabase SQL Editor)**

  ```sql
  CREATE OR REPLACE FUNCTION account_deposit(account_id UUID, amount BIGINT)
  RETURNS accounts
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    v_account accounts;
  BEGIN
    IF amount <= 0 THEN RAISE EXCEPTION '금액은 0보다 커야 합니다.'; END IF;
    UPDATE accounts SET balance = balance + amount WHERE id = account_id
    RETURNING * INTO v_account;
    INSERT INTO transactions (account_id, type, amount, description)
    VALUES (account_id, 'deposit', amount, '입금');
    RETURN v_account;
  END;
  $$;

  CREATE OR REPLACE FUNCTION account_withdraw(account_id UUID, amount BIGINT)
  RETURNS accounts
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE
    v_account accounts;
    v_balance BIGINT;
  BEGIN
    IF amount <= 0 THEN RAISE EXCEPTION '금액은 0보다 커야 합니다.'; END IF;
    SELECT balance INTO v_balance FROM accounts WHERE id = account_id FOR UPDATE;
    IF v_balance < amount THEN RAISE EXCEPTION '잔액이 부족합니다.'; END IF;
    UPDATE accounts SET balance = balance - amount WHERE id = account_id
    RETURNING * INTO v_account;
    INSERT INTO transactions (account_id, type, amount, description)
    VALUES (account_id, 'withdrawal', amount, '출금');
    RETURN v_account;
  END;
  $$;
  ```

- [ ] **Step 4: api/products.js 교체**

  `client/src/api/products.js` 전체를 아래로 교체:

  ```js
  import { supabase } from '../lib/supabase';

  export const getProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at');
    return { data };
  };

  export const getProduct = async (id) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    return { data };
  };
  ```

- [ ] **Step 5: api/subscriptions.js 교체**

  `client/src/api/subscriptions.js` 전체를 아래로 교체:

  ```js
  import { supabase } from '../lib/supabase';

  export const getSubscriptions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('subscriptions')
      .select('*, products(name, amount, billing_day)')
      .eq('user_id', user.id)
      .order('created_at');
    // 기존 컴포넌트가 s.product_name, s.amount, s.billing_day를 직접 참조하므로 flatten
    const flattened = (data || []).map(s => ({
      ...s,
      product_name: s.products?.name,
      amount: s.products?.amount,
      billing_day: s.products?.billing_day,
    }));
    return { data: flattened };
  };

  export const createSubscription = async ({ productId, accountId, paymentMethod = 'account' }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        product_id: productId,
        account_id: accountId,
        payment_method: paymentMethod,
      })
      .select()
      .single();
    return { data };
  };

  export const cancelSubscription = async (id) => {
    const { data } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();
    return { data };
  };
  ```

- [ ] **Step 6: 기능 확인**

  `npm run dev` 상태에서:
  1. `/accounts` → 계좌 목록 로드 확인
  2. 계좌 생성 → 목록 갱신 확인
  3. 입금/출금 → 잔액 변경 확인
  4. `/products` → 상품 목록 로드 확인
  5. `/subscriptions` → 구독 목록 로드 확인

- [ ] **Step 7: 커밋**

  ```bash
  git add client/src/api/auth.js client/src/api/accounts.js \
    client/src/api/products.js client/src/api/subscriptions.js
  git commit -m "feat: replace API layer with Supabase client"
  ```

---

## Task 7: 어드민 API 교체

**Files:**
- Modify: `client/src/api/admin.js`

- [ ] **Step 1: api/admin.js 교체**

  `client/src/api/admin.js` 전체를 아래로 교체:

  ```js
  import { supabase } from '../lib/supabase';

  export const getAdminUsers = async () => {
    const { data } = await supabase.rpc('get_admin_users');
    return { data };
  };

  export const getAdminTransfers = async () => {
    const { data } = await supabase.rpc('get_admin_transfers');
    return { data };
  };

  export const getAdminProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    return { data };
  };

  export const getAdminProduct = async (id) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    return { data };
  };

  export const createProduct = async (productData) => {
    const { data } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();
    return { data };
  };

  export const updateProduct = async (id, productData) => {
    const { data } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();
    return { data };
  };

  export const deleteProduct = async (id) => {
    const { data } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    return { data };
  };

  export const getAdminStats = async () => {
    const { data } = await supabase.rpc('get_admin_stats');
    return { data };
  };

  export const getUnpaid = async () => {
    const { data } = await supabase.rpc('get_unpaid_list');
    return { data };
  };

  export const retryBilling = async (id) => {
    const { data, error } = await supabase.rpc('retry_billing', { log_id: id });
    if (error) throw { response: { data: { error: error.message } } };
    return { data };
  };

  // Edge Function 호출 (Task 8에서 Edge Function 배포 후 동작)
  export const runAdminScheduler = async (day) => {
    const { data, error } = await supabase.functions.invoke('auto-debit', {
      body: { targetDay: day },
    });
    if (error) throw { response: { data: { error: error.message } } };
    return { data };
  };
  ```

- [ ] **Step 2: 어드민 기능 확인**

  어드민 계정으로 로그인 후:
  1. `/admin` 대시보드 → 통계 카드 로드 확인
  2. `/admin/users` → 회원 목록 확인
  3. `/admin/transfers` → 자동이체 내역 확인
  4. `/admin/products` → 상품 목록 + CRUD 확인
  5. `/admin/unpaid` → 미수납 목록 확인

- [ ] **Step 3: 커밋**

  ```bash
  git add client/src/api/admin.js
  git commit -m "feat: replace admin API with Supabase RPC calls"
  ```

---

## Task 8: autoDebit Edge Function 배포

**Files:**
- Create: `supabase/functions/auto-debit/index.ts`

- [ ] **Step 1: Supabase CLI 설치 확인**

  ```bash
  npx supabase --version
  ```

  버전이 출력되면 OK. 없으면:
  ```bash
  npm install -g supabase
  ```

- [ ] **Step 2: Supabase 프로젝트 연결**

  ```bash
  cd C:/Users/이유미/Documents/study/jamie-cms/jamie-cms
  npx supabase login
  npx supabase link --project-ref <your-project-ref>
  ```

  `<your-project-ref>`: Supabase 대시보드 URL에서 확인 (예: `abcdefghijklmnop`)

- [ ] **Step 3: Edge Function 파일 생성**

  `supabase/functions/auto-debit/index.ts`:

  ```typescript
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    try {
      // 1. 어드민 JWT 검증 OR 스케줄러 시크릿 검증
      const authHeader = req.headers.get('Authorization');
      const schedulerSecret = req.headers.get('x-scheduler-secret');

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      if (schedulerSecret) {
        // cron-job.org 등 외부 스케줄러에서 호출 시
        if (schedulerSecret !== Deno.env.get('SCHEDULER_SECRET')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
      } else if (authHeader) {
        // 어드민 UI에서 호출 시
        const supabaseUser = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        const { data: userData } = await supabaseAdmin
          .from('users').select('role').eq('id', user.id).single();
        if (userData?.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }

      // 2. autoDebit 실행
      const body = await req.json().catch(() => ({}));
      const targetDay = body.targetDay ?? null;

      const { data, error } = await supabaseAdmin.rpc('run_auto_debit', { target_day: targetDay });
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
  ```

- [ ] **Step 4: Edge Function 배포**

  ```bash
  npx supabase functions deploy auto-debit --no-verify-jwt
  ```

  Expected: `Deployed Function auto-debit`

- [ ] **Step 5: Edge Function 환경변수 설정**

  Supabase 대시보드 → Edge Functions → auto-debit → Secrets:
  - `SCHEDULER_SECRET`: 랜덤 문자열 (예: `openssl rand -hex 32`로 생성)

  또는 CLI로:
  ```bash
  npx supabase secrets set SCHEDULER_SECRET=<your-secret>
  ```

- [ ] **Step 6: 어드민 대시보드 "▶ 자동이체 실행" 버튼 테스트**

  1. 어드민 로그인
  2. `/admin` 대시보드에서 "▶ 자동이체 실행 (시연)" 버튼 클릭
  3. `confirm` 팝업 → 확인
  4. 성공 알림 확인
  5. Supabase → billing_logs 테이블에 실행 기록 확인

- [ ] **Step 7: 커밋**

  ```bash
  git add supabase/functions/auto-debit/index.ts
  git commit -m "feat: add auto-debit Edge Function"
  ```

---

## Task 9: server/ 삭제 및 최종 정리

**Files:**
- Delete: `server/` 디렉토리
- Modify: `CLAUDE.md`

- [ ] **Step 1: client api/admin.js에서 profile 페이지 동작 확인**

  `/profile` 페이지 테스트:
  1. 닉네임 수정 → 저장 확인
  2. 로그아웃 → 홈으로 이동 확인

- [ ] **Step 2: 전체 기능 최종 점검**

  아래 시나리오 순서대로 테스트:

  ```
  [ ] 카카오 로그인 → 대시보드 진입
  [ ] 계좌 생성 → 입금 → 잔액 확인
  [ ] 상품 목록 → 상품 상세 → 구독 신청
  [ ] 대시보드 → 활성 구독 표시 확인
  [ ] 어드민: 상품 CRUD
  [ ] 어드민: 회원 목록
  [ ] 어드민: 자동이체 내역
  [ ] 어드민: 자동이체 실행 버튼 → billing_logs 확인
  [ ] 어드민: 미수납 목록 → 재청구 버튼
  [ ] 로그아웃 → 재로그인
  ```

- [ ] **Step 3: server/ 삭제**

  ```bash
  cd C:/Users/이유미/Documents/study/jamie-cms/jamie-cms
  rm -rf server/
  ```

- [ ] **Step 4: Vercel server 배포 비활성화**

  Vercel 대시보드 → jamie-cms-server 프로젝트 → Settings → General → Delete Project
  (또는 그냥 두고 무시해도 됨 - 프론트가 더 이상 호출하지 않으므로)

- [ ] **Step 5: CLAUDE.md 업데이트**

  CLAUDE.md의 `## Commands` 섹션에서 백엔드 부분을 아래로 교체:

  ```markdown
  ### 백엔드 (Supabase)
  - DB 스키마: `server/supabase/schema.sql` (참고용, 실제 DB는 Supabase)
  - SQL 함수/RLS: Supabase 대시보드 → SQL Editor에서 관리
  - Edge Functions: `supabase/functions/` 디렉토리, `npx supabase functions deploy <name>`

  ### 프론트엔드 (client/)
  ```bash
  cd client
  npm run dev        # Vite 개발 서버 (포트 5173)
  npm run build      # 프로덕션 빌드
  ```
  ```

- [ ] **Step 6: 최종 커밋**

  ```bash
  git add CLAUDE.md
  git add -A  # server/ 삭제 반영
  git commit -m "feat: complete Supabase migration, remove Express server"
  ```

- [ ] **Step 7: Vercel 재배포 확인**

  client/ Vercel 프로젝트 → 최신 배포 성공 확인 → 배포된 URL에서 카카오 로그인 테스트

---

## 발표 전 체크리스트

- [ ] Supabase Auth에 카카오 OAuth Redirect URI가 Vercel 배포 URL로 등록되어 있는지 확인
- [ ] `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 Vercel 환경변수에 등록되어 있는지 확인
- [ ] 어드민 계정: Supabase Table Editor → users → role = 'admin' 설정
- [ ] 데모용 상품, 계좌, 구독 데이터 미리 삽입
- [ ] Edge Function `auto-debit` 배포 및 SCHEDULER_SECRET 설정 확인
