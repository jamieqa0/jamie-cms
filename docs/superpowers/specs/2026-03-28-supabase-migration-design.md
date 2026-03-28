# Supabase Full Migration Design

## Goal

Express 서버(`server/`)를 완전히 제거하고 Supabase(Auth + Database + RLS + Edge Functions)로 대체한다. 프론트엔드(React)는 Vercel에 그대로 유지.

**Before:** Vercel(client) → Vercel(server/Express) → Supabase(DB)
**After:** Vercel(client) → Supabase(DB + Auth + Edge Functions)

---

## Architecture

### 플랫폼 구성
- **Frontend**: React + Vite → Vercel (변경 없음)
- **Backend**: Supabase (Auth, Database, RLS, Edge Functions)
- **DB**: Supabase PostgreSQL (변경 없음)

### 삭제 대상
- `server/` 디렉토리 전체
- `auth_codes` 테이블
- `refresh_tokens` 테이블

---

## Phase 1: Authentication

### 현재 → 변경

| 현재 | 변경 후 |
|---|---|
| GET /api/auth/kakao | supabase.auth.signInWithOAuth('kakao') |
| 백엔드 콜백 → JWT 발급 → auth_codes | Supabase 내부 처리 |
| GET /api/auth/token?code=xxx | supabase.auth.getSession() |
| POST /api/auth/refresh | 자동 처리 (Supabase SDK) |
| POST /api/auth/logout | supabase.auth.signOut() |
| devLogin 엔드포인트 | Supabase 대시보드 테스트 계정 |

### DB 트리거 (신규)

카카오 로그인 최초 시 `auth.users` → `public.users` 자동 upsert:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, kakao_id, nickname, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'name',
    NEW.email,
    'user'
  )
  ON CONFLICT (kakao_id) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        nickname = EXCLUDED.nickname,
        email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### users 테이블 변경

기존 `users.id` (serial) 및 모든 FK는 그대로 유지. `auth_id` 컬럼만 추가:

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id);
```

RLS 정책에서 `auth.uid() = users.auth_id`로 사용자 식별.

### Frontend 변경

- `authStore.js`: accessToken/refreshToken 제거 → `supabase.auth.getSession()` 사용
- `client.js`: axios 인터셉터 제거 → Supabase 클라이언트로 교체
- `AuthCallback.jsx`: 임시코드 교환 로직 제거 → Supabase 콜백 처리
- `ProtectedRoute.jsx`: `supabase.auth.getUser()` 기반으로 변경
- `AdminRoute.jsx`: `users.role = 'admin'` 조회로 변경

---

## Phase 2: CRUD (API → Supabase Client + RLS)

### RLS 정책

**헬퍼 함수 (RLS에서 반복 사용):**
```sql
-- 현재 로그인 유저의 users.id 반환
CREATE OR REPLACE FUNCTION my_user_id()
RETURNS INTEGER AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 현재 유저가 어드민인지 확인
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**accounts 테이블:**
```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own accounts"
  ON accounts FOR SELECT
  USING (user_id = my_user_id() OR is_admin());

CREATE POLICY "users can manage own accounts"
  ON accounts FOR ALL
  USING (user_id = my_user_id() OR is_admin());
```

**products 테이블:**
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view active products"
  ON products FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "admin can manage products"
  ON products FOR ALL USING (is_admin());
```

**subscriptions 테이블:**
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own subscriptions"
  ON subscriptions FOR ALL
  USING (user_id = my_user_id() OR is_admin());
```

**billing_logs, transactions:** 동일 패턴 (`user_id` 또는 어드민).

### API 함수 교체 (client/src/api/)

```js
// 현재: accounts.js
export const getAccounts = () => client.get('/accounts');

// 변경 후
export const getAccounts = () =>
  supabase.from('accounts').select('*').then(({ data }) => ({ data }));
```

모든 `api/*.js` 파일을 Supabase 클라이언트 호출로 교체.

### 어드민 전용 API

어드민 stats, unpaid 조회 등 복잡한 JOIN 쿼리는 RPC 함수로:

```sql
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json AS $$
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
$$ LANGUAGE sql SECURITY DEFINER;
```

`get_unpaid_list()`, `retry_billing(log_id)` 도 동일 방식으로 RPC 함수 작성.

---

## Phase 3: autoDebit → Edge Function

### 구조

```
어드민 버튼 클릭 / pg_cron
  → Edge Function: auto-debit (Deno)
      → supabase.rpc('run_auto_debit', { target_day })
          → PostgreSQL 저장 함수 (트랜잭션 처리)
```

### PostgreSQL 저장 함수

현재 `autoDebit.js`의 BEGIN/COMMIT/FOR UPDATE 로직을 pl/pgsql로 이식:

```sql
CREATE OR REPLACE FUNCTION run_auto_debit(target_day INT DEFAULT NULL)
RETURNS json AS $$
DECLARE
  v_today INT := COALESCE(target_day, EXTRACT(DAY FROM CURRENT_DATE)::INT);
  v_collection_id UUID;
  v_row RECORD;
  v_balance NUMERIC;
  v_success INT := 0;
  v_failed INT := 0;
BEGIN
  -- 집금 계좌 조회
  SELECT id INTO v_collection_id FROM accounts WHERE type = 'collection' LIMIT 1;
  IF v_collection_id IS NULL THEN
    RAISE EXCEPTION '집금 계좌가 존재하지 않습니다.';
  END IF;

  FOR v_row IN
    SELECT s.id as subscription_id, s.account_id, p.id as product_id, p.amount
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
      -- 잠금: 개인 계좌 → 집금 계좌 (데드락 방지)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Edge Function: auto-debit

```typescript
// supabase/functions/auto-debit/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const secret = req.headers.get('x-scheduler-secret');
  if (secret !== Deno.env.get('SCHEDULER_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { targetDay } = await req.json().catch(() => ({}));
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.rpc('run_auto_debit', {
    target_day: targetDay ?? null
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
});
```

### 어드민 버튼 (프론트)

```js
// 현재: runAdminScheduler(today) → POST /api/scheduler/run
// 변경 후:
const { data, error } = await supabase.functions.invoke('auto-debit', {
  body: { targetDay: today }
});
```

### pg_cron (자동 실행)

```sql
SELECT cron.schedule(
  'daily-auto-debit',
  '0 9 * * *',  -- 매일 오전 9시
  $$SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/auto-debit',
    headers := '{"x-scheduler-secret": "<secret>"}'::jsonb,
    body := '{}'::jsonb
  )$$
);
```

---

## Phase 4: Cleanup

- `server/` 디렉토리 삭제
- `server/vercel.json` 삭제
- Vercel 프로젝트에서 server 배포 제거
- `client/.env`: `VITE_API_URL` 제거, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` 추가
- `CLAUDE.md` 업데이트

---

## Migration Order

1. DB 스키마 변경 (users.id UUID, 트리거, RLS 정책, run_auto_debit 함수)
2. Supabase Auth 카카오 OAuth 설정
3. 프론트엔드 Auth 교체 (authStore, client.js, AuthCallback)
4. ProtectedRoute / AdminRoute 교체
5. api/*.js 파일 Supabase 클라이언트로 교체
6. Edge Function 배포 (auto-debit)
7. 어드민 대시보드 버튼 교체
8. server/ 삭제

---

## 어드민 계정 관리 (변경 후)

1. 카카오 로그인으로 계정 생성
2. Supabase 대시보드 → Table Editor → `users` 테이블
3. `role` 컬럼을 `'admin'`으로 수정 (현재와 동일)
