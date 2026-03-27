# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

모노레포 구조의 CMS(Cash Management Service) 시스템. 관리자가 정기결제 상품을 등록하고, 사용자가 가상계좌에서 자동이체를 실행하는 사내 스터디 발표용 프로젝트.

- `server/` — Node.js + Express 백엔드 (Vercel 배포)
- `client/` — React 19 + Vite 프론트엔드 (Vercel 배포)
- `server/supabase/schema.sql` — Supabase PostgreSQL 스키마 정의

## Commands

### 백엔드 (server/)

```bash
cd server
npm run dev        # nodemon으로 개발 서버 (포트 4000)
npm start          # 프로덕션 서버
npm test           # 전체 테스트 (jest --runInBand, 순서 보장 필요)
```

테스트 단일 파일 실행:
```bash
npx jest tests/accounts.test.js --runInBand
```

### 프론트엔드 (client/)

```bash
cd client
npm run dev        # Vite 개발 서버 (포트 5173)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint
npm run preview    # 빌드 결과 미리보기
```

## Architecture

### 인증 흐름

카카오 OAuth → 임시코드 교환 방식 (JWT를 URL에 직접 노출하지 않기 위함):
1. 프론트: `GET /api/auth/kakao` → 카카오 인증 서버로 리다이렉트
2. 백엔드 콜백: JWT 발급 후 30초 유효 임시코드 생성 → `${CLIENT_URL}/auth/callback?code=xxx`로 리다이렉트
3. 프론트 `/auth/callback`: `GET /api/auth/token?code=xxx`로 실제 JWT 교환
4. `useAuthStore` (Zustand + persist)에 accessToken/refreshToken 저장

Access Token 만료(15분) 시 `client.js` Axios 인터셉터가 자동으로 refresh API 호출.

### 백엔드 구조

```
server/src/
  app.js             # Express 앱 (helmet, cors, routes 등록)
  server.js          # 서버 시작 + startScheduler() 호출
  config/
    db.js            # pg Pool (SSL 항상 활성화, Supabase Pooler 대응)
    env.js           # 환경변수 검증 (없으면 즉시 에러)
  controllers/       # 비즈니스 로직 (라우터와 1:1 대응)
  routes/            # Express 라우터
  middleware/
    authenticate.js  # Bearer JWT 검증 → req.user 주입
    requireAdmin.js  # role === 'admin' 확인
    rateLimiter.js   # 로그인 1분 5회 제한
  utils/jwt.js       # signAccessToken, signRefreshToken, verify*
  scheduler/
    autoDebit.js     # runAutoDebit(targetDay?) + startScheduler()
```

### 자동이체 스케줄러

매일 자정(Asia/Seoul) `runAutoDebit()` 실행. `billing_day`가 오늘 날짜인 active 구독을 조회하고, 구독별로 DB 트랜잭션(BEGIN/COMMIT/ROLLBACK)으로 처리:
- 잔액 부족 → ROLLBACK → `billing_logs.status = 'failed'`
- 성공 → `accounts.balance` 차감 + `transactions` 기록 → `billing_logs.status = 'success'`

테스트에서는 `runAutoDebit(15)` 식으로 날짜를 주입해 today 의존성 제거.

### 프론트엔드 구조

```
client/src/
  api/
    client.js        # Axios 인스턴스 + 401 자동 토큰 갱신 인터셉터
    auth/accounts/products/subscriptions/admin.js  # API 함수 모음
  store/authStore.js # Zustand + persist (auth-storage 키)
  components/
    Layout.jsx       # 공통 네비게이션 래퍼
    ProtectedRoute.jsx  # 미인증 시 / 리다이렉트
    AdminRoute.jsx   # 비어드민 시 /dashboard 리다이렉트
  pages/             # 사용자 화면 (Dashboard, Accounts, Products, Subscriptions, Profile)
  pages/admin/       # 어드민 화면 (Products CRUD, Users, Transfers)
```

### 라우팅 구조 (React Router v7)

```
/                       Landing (카카오 로그인)
/auth/callback          임시코드 → JWT 교환
/* (ProtectedRoute)
  /dashboard, /products, /accounts, /subscriptions, /profile
  /* (AdminRoute)
    /admin, /admin/products, /admin/users, /admin/transfers
```

## Environment Variables

### server/.env
```
DATABASE_URL=          # Supabase Connection Pooler URL 사용 (IPv6 이슈)
JWT_ACCESS_SECRET=     # Access Token 서명 키
JWT_REFRESH_SECRET=    # Refresh Token 서명 키
KAKAO_CLIENT_ID=       # 카카오 앱 REST API 키
KAKAO_REDIRECT_URI=    # 카카오 인가 후 리다이렉트 URL (백엔드 콜백 엔드포인트)
CLIENT_URL=            # 프론트엔드 URL (CORS 허용 + 리다이렉트 대상)
PORT=4000
```

**중요**: `DATABASE_URL`은 반드시 Supabase **Connection Pooler** URL(`aws-0-*.pooler.supabase.com`)을 사용. 직접 DB URL(`db.*.supabase.co`)은 IPv6만 반환해 Node.js에서 연결 불가.

### client/.env
```
VITE_API_URL=          # 백엔드 API 베이스 URL (예: https://jamie-cms-server.vercel.app/api)
```

### server/.env.test
테스트 환경용. `tests/globalSetup.js`에서 dotenv로 먼저 로드.

## Testing

Jest + Supertest. `--runInBand` 필수 (테스트들이 동일 DB를 순서대로 사용).

- `tests/setup.js` — `afterEach`에서 DB 정리 (pool.end() 없음, `forceExit: true`로 처리)
- `tests/globalSetup.js` — `.env.test` dotenv 로드
- 테스트 파일: `health`, `jwt`, `accounts`, `subscriptions`, `scheduler`, `security`

## DB Schema

7개 테이블: `users` → `accounts` → `transactions`, `subscriptions` → `billing_logs`, `products`, `refresh_tokens`

- `billing_day`는 1~28 제약 (2월 안전 보장)
- `accounts.balance`는 CHECK `>= 0` (음수 불가)
- 어드민 계정 생성: Supabase 대시보드에서 `users.role`을 `'admin'`으로 직접 수정

## Deployment

- 백엔드: Vercel (`server/` 루트 디렉토리), `server/vercel.json` 설정 포함
- 프론트엔드: Vercel (`client/` 루트 디렉토리), Vite 자동 감지
- Vercel 배포 시 `KAKAO_REDIRECT_URI`는 배포된 백엔드 URL로 설정

## 어드민 계정 관리

> **운영상 중요**: 어드민 계정은 코드로 생성할 수 없고, DB를 직접 수정해야 합니다.

1. 카카오 로그인으로 계정 생성 (일반 유저로 가입)
2. Supabase 대시보드 → Table Editor → `users` 테이블
3. 해당 유저 행의 `role` 컬럼을 `'admin'`으로 수정
4. 재로그인하면 어드민 권한 적용

## Conventions

### 공통
- `async/await` 사용, 콜백(callback) 금지
- 에러 응답 형식: `{ "error": "메시지" }` (일관성 유지)
- 변수/함수명은 camelCase, DB 컬럼명은 snake_case

### 백엔드
- DB 쿼리는 상태 변경이 2개 이상이면 반드시 트랜잭션(`BEGIN/COMMIT/ROLLBACK`) 처리
- 컨트롤러는 `try-catch`로 감싸고, catch에서 `next(err)` 대신 직접 `res.status(500).json({ error: ... })` 반환
- 미들웨어는 `middleware/` 디렉토리에만 추가

### 프론트엔드
- 컴포넌트는 함수형만 사용 (클래스형 금지)
- API 호출은 `api/` 디렉토리의 함수를 통해서만 (컴포넌트에서 axios 직접 호출 금지)
- 전역 상태는 Zustand store만 사용

## Error Handling

### 백엔드 컨트롤러 패턴

```js
export const someController = async (req, res) => {
  try {
    // 비즈니스 로직
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
```

### HTTP 상태 코드 기준
- `400` — 요청 데이터 검증 실패 (필수값 누락, 형식 오류)
- `401` — 인증 실패 (토큰 없음, 만료, 유효하지 않음)
- `403` — 권한 없음 (인증은 됐지만 어드민 아님)
- `404` — 리소스 없음
- `409` — 충돌 (중복 생성 등)
- `500` — 서버 내부 오류

### 프론트엔드 에러 처리
- API 호출 실패 시 `err.response?.data?.error` 메시지를 사용자에게 표시
- 401 응답은 `client.js` 인터셉터가 자동으로 토큰 갱신 또는 로그아웃 처리

## 주의사항 (Do Not)

### DB 관련
- `billing_day`는 **절대 29~31로 설정하지 말 것** — 2월 말일 스케줄러 오작동 (DB에 1~28 CHECK 제약 있음)
- `DATABASE_URL`에 직접 DB URL(`db.*.supabase.co`) **절대 사용 금지** — IPv6만 반환해 연결 불가, 반드시 Connection Pooler URL 사용

### 인증/보안
- `accessToken`을 `localStorage`에 저장하지 말 것 — Zustand persist는 sessionStorage 또는 메모리 사용
- JWT를 URL 쿼리스트링에 직접 노출하지 말 것 — 임시코드 교환 방식 유지
- `requireAdmin` 미들웨어 없이 어드민 전용 라우트를 만들지 말 것

### 코드 구조
- 컨트롤러에서 직접 DB 풀(`pool`)을 import해서 쿼리를 날리되, `db.js` 외의 별도 풀 생성 금지
- 테스트 실행 시 `--runInBand` 빼지 말 것 — 병렬 실행 시 DB 상태 충돌
