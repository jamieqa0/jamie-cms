# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

사내 스터디 발표용 CMS(Cash Management Service). 어드민이 업체를 등록하고, 업체가 정기결제 상품을 만들어 고객(일반 유저)에게 동의 요청을 보내면, 유저가 계좌를 연결해 자동이체를 받는 구조.

**현재 아키텍처**: Full-Supabase (Express 서버 없음)
- `client/` — React 19 + Vite 프론트엔드 (Vercel 배포)
- `supabase/migrations/` — PostgreSQL 스키마 + RPC 함수 (Supabase SQL Editor에서 순서대로 실행)
- `supabase/functions/auto-debit/` — Deno Edge Function (자동이체 실행)

## Commands

```bash
cd client
npm run dev        # Vite 개발 서버 (포트 5173)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint
npx vitest         # 테스트 실행 (watch 모드)
npx vitest run     # 테스트 단회 실행
npx vitest run src/utils/chartUtils.test.js  # 단일 파일 실행
```

테스트 파일: `src/utils/*.test.js` (vitest + jsdom, `@testing-library/react` 사용)

Edge Function 배포:
```bash
npx supabase functions deploy auto-debit --no-verify-jwt
```
`--no-verify-jwt` 필수 — 없으면 게이트웨이가 JWT를 먼저 가로채서 함수 코드에 도달하기 전에 401 반환.

## Environment Variables (`client/.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Architecture

### 3-Role 구조

| Role | 로그인 방식 | 진입점 |
|------|------------|--------|
| `admin` | 이메일/비밀번호 | `/admin` |
| `company` | 이메일/비밀번호 | `/company` |
| `user` | 카카오 OAuth 또는 이메일/비밀번호 | `/dashboard` |

role은 `auth.users`의 `raw_user_meta_data->>'role'` 에서 읽어 `public.users`에 동기화 (`003`, `013` 트리거).

### 인증 흐름

**카카오 OAuth (user)**:
1. `Landing` → `supabase.auth.signInWithOAuth({ provider: 'kakao' })`
2. Supabase가 `/auth/callback?code=xxx`로 리다이렉트
3. `AuthCallback` → `exchangeCodeForSession(code)` → `onAuthStateChange` 발생
4. `authStore`에서 `public.users` 조회 후 role 기반 navigate

**이메일 로그인 (admin/company/user)**:
1. `Landing` → `supabase.auth.signInWithPassword()`
2. `onAuthStateChange` → authStore 업데이트 → `AuthCallback`과 동일한 useEffect가 navigate

**이메일 회원가입 (user)**:
- `Landing` 회원가입 탭 → `supabase.auth.signUp({ options: { data: { name, role: 'user' } } })`
- 가입 후 이메일 인증 필요 (Supabase 이메일 확인 설정에 따라)

**핵심**: navigate는 반드시 authStore의 `initializing: false` + `user` 확인 후 실행. `signInWithPassword` 직후 바로 navigate하면 안 됨.

**동의 페이지 OAuth 처리**: 비로그인 상태에서 `/consent/:token` 접근 시 `sessionStorage`에 토큰 저장 → 카카오 로그인 후 `AuthCallback`에서 복원.

### authStore (`client/src/store/authStore.js`)

Zustand store (persist 없음 — `onAuthStateChange`가 새로고침 시 자동 복원):
- `user`: `public.users`에서 조회한 `{ id, nickname, email, role }`
- `session`: Supabase session 객체 (`app_metadata.provider`로 카카오 여부 판별)
- `initializing`: `onAuthStateChange` 첫 응답 전 `true`

`onAuthStateChange` 내부에서 `setTimeout(0)` 사용 — Supabase 내부 잠금 해제 후 DB 쿼리 실행 필요.

### 업체 등록 (`AdminCompanyForm.jsx`)

`supabase.auth.signUp()` 호출 시 세션이 신규 유저로 교체됨. 패턴:
```js
const adminSession = (await supabase.auth.getSession()).data.session;
await supabase.auth.signUp({ ..., options: { data: { role: 'company' } } });
await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
// companies 테이블 insert + accounts (type='company') insert
```

### 정산 플로우

```
유저 계좌 → (전체 금액) → 집금 계좌 (type='collection')
집금 계좌 → (금액 × (1 - 수수료율%)) → 업체 계좌 (type='company')
```

- `run_auto_debit` RPC: Supabase Edge Function에서 호출 (`supabase/functions/auto-debit/index.ts`)
- 잠금 순서: 유저계좌 → 집금계좌 → 업체계좌 (데드락 방지)
- 멱등성: 오늘 이미 `success`인 `billing_logs`가 있으면 스킵
- 동시 실행 방지: `pg_advisory_xact_lock(hashtext('run_auto_debit'))` — 연속 클릭 시 중복 청구 방지 (migration 031)
- `get_collection_stats`: `p_month DATE` 파라미터로 월별 조회 가능 (NULL이면 당월)

### 라우팅 구조 (`client/src/App.jsx`)

```
/                           Landing (로그인/회원가입)
/auth/callback              OAuth 코드 교환
/consent/:token             동의 페이지 (비로그인 접근 가능)
(ProtectedRoute)
  (Layout)                  nav: 대시보드/내 구독/내 청구서/상품 + 프로필
    /dashboard, /products, /accounts, /subscriptions, /invoices, /profile
  (AdminRoute)
    (AdminLayout)
      /admin, /admin/companies, /admin/transfers, /admin/collection, /admin/users
  (CompanyRoute)
    (CompanyLayout)
      /company, /company/products, /company/customers, /company/transfers,
      /company/unpaid, /company/profile, /company/tax-invoices
```

`/accounts`는 메뉴에서 제거됐지만 라우트는 유지 — Profile 페이지에서 링크로 접근.

### API 레이어 (`client/src/api/`)

| 파일 | 용도 |
|------|------|
| `auth.js` | 프로필 조회/수정 |
| `accounts.js` | 계좌 CRUD |
| `subscriptions.js` | 구독 CRUD (products join 포함) |
| `products.js` | 상품 목록/상세 |
| `invoices.js` | `get_user_invoices` RPC 호출, `getInvoiceById` |
| `admin.js` | 어드민 전용 (RPC 호출, Edge Function 호출, `retryBillingBulk`) |
| `company.js` | 업체 전용 (상품/고객/통계/정산계좌/청구서/`getMyCompany`) |

모든 Supabase 호출은 `client/src/lib/supabase.js`의 단일 인스턴스 사용. 컴포넌트에서 직접 supabase 호출 금지 (api/ 함수 경유). 단, `CompanyTaxInvoices.jsx`는 집계 쿼리 특성상 예외적으로 직접 호출.

## DB Schema

9개 테이블: `users`, `accounts`, `transactions`, `subscriptions`, `billing_logs`, `products`, `companies`, `consent_requests`, `refresh_tokens`

**accounts.type**: `personal` (유저) | `collection` (시스템 집금) | `company` (업체 정산)

**companies 테이블**: `user_id(PK) → users`, `industry`, `commission_rate`

**consent_requests**: 업체가 고객에게 보내는 동의 요청. `invite_token`으로 공유, `status`: pending → accepted/rejected

**billing_logs.status**: `success` | `failed` | `retried` — 재청구 성공 시 원래 `failed` 로그를 `retried`로 UPDATE. `get_company_unpaid`는 `status = 'failed'`만 조회하므로 retried 로우는 자동 제외.

## Supabase SQL 주의사항

- Supabase Dashboard에서 `$` delimiter 사용 불가 → `$func$` 사용
- `accounts.name` NOT NULL — 계좌 생성 시 반드시 name 포함
- `billing_day` 1~28 CHECK 제약 (29~31 설정 불가)
- `accounts.balance` >= 0 CHECK (음수 불가)
- `billing_logs` 컬럼명: 날짜는 `executed_at` (`billed_at` 아님)
- RPC `RETURNS TABLE` 선언 시 타입을 DB 실제 타입과 정확히 맞춰야 함. `billing_logs.amount`는 `BIGINT`, 문자열 컬럼은 `VARCHAR` (TEXT 아님), `reason`도 `VARCHAR`. 타입 불일치 시 `CREATE OR REPLACE` 불가 — `DROP FUNCTION` 후 재생성 필요
- `run_auto_debit`은 `집금 계좌(type='collection')`가 없으면 즉시 EXCEPTION. 초기 세팅 시 반드시 집금 계좌 Seed 필요
- 자동이체 시연 버튼: `billing_day` 1~28 제약으로 오늘 날짜(29~31일)로 실행 불가. 어드민 대시보드에서 날짜 직접 입력 후 실행

## 계정 관리

**어드민 계정**: Supabase Dashboard → `users` 테이블 → `role`을 `'admin'`으로 직접 수정

**업체 계정**: `/admin/companies/new`에서 등록 (이메일/비밀번호 입력 → `signUp` → companies 테이블 + 정산 계좌 자동 생성)

기존 업체에 정산 계좌 일괄 생성:
```sql
INSERT INTO accounts (user_id, name, type, balance)
SELECT u.id, u.nickname || ' 정산 계좌', 'company', 0
FROM users u
WHERE u.role = 'company'
  AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.type = 'company');
```

## Conventions

- `async/await` 사용, 콜백 금지
- DB 컬럼명 snake_case, JS 변수명 camelCase
- 에러 응답 형식: `{ "error": "메시지" }`
- 컴포넌트는 함수형만 사용
- 전역 상태는 Zustand(`authStore`)만 사용
- `@` import alias → `src/` (예: `import { supabase } from '@/lib/supabase'`)
- 아이콘: `lucide-react`, 차트: `recharts`
