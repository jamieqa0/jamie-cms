# CMS (Cash Management Service) 시스템 설계

**날짜:** 2026-03-27
**목적:** 사내 스터디 발표용 — 카카오 로그인, 가상계좌, 정기결제 상품 자동이체 구현
**개발자:** 혼자 (Jamie)
**예상 사용자:** 약 7명

---

## 1. 개요

관리자가 정기결제 상품(우유배달, 신문구독, 렌탈료, 기부금 등)을 등록하고, 사용자가 상품에 가입하면 매월 지정일에 가상계좌에서 자동으로 결제되는 CMS 시스템.

---

## 2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 백엔드 | Node.js + Express |
| 프론트엔드 | React + Tailwind CSS + shadcn/ui |
| 데이터베이스 | Supabase PostgreSQL |
| 인증 | 카카오 OAuth 2.0 + JWT |
| 스케줄러 | node-cron |
| 백엔드 배포 | Railway |
| 프론트엔드 배포 | Vercel |

---

## 3. 시스템 구조

```
[React 앱 - Vercel]
        ↓ HTTP 요청 (JWT 포함)
[Express 서버 - Railway]
  ├── 카카오 OAuth → JWT 발급
  ├── 계좌/상품/구독 API
  ├── 어드민 API
  └── node-cron 스케줄러
        ↓ SQL
[Supabase PostgreSQL]
```

---

## 4. 데이터베이스 스키마

```sql
-- 회원
users
  id          UUID  PK
  kakao_id    VARCHAR UNIQUE
  nickname    VARCHAR
  email       VARCHAR
  role        VARCHAR DEFAULT 'user'  -- 'user' | 'admin'
  created_at  TIMESTAMP

-- 가상계좌
accounts
  id          UUID  PK
  user_id     UUID  FK → users
  name        VARCHAR
  balance     BIGINT DEFAULT 0
  created_at  TIMESTAMP

-- 거래내역
transactions
  id            UUID  PK
  account_id    UUID  FK → accounts
  type          VARCHAR  -- 'deposit' | 'withdrawal' | 'transfer' | 'auto_debit'
  amount        BIGINT
  description   VARCHAR
  created_at    TIMESTAMP

-- 자동이체 실행 로그 (성공/실패 모두 기록)
billing_logs
  id              UUID  PK
  subscription_id UUID  FK → subscriptions
  product_id      UUID  FK → products
  account_id      UUID  FK → accounts
  amount          BIGINT
  status          VARCHAR  -- 'success' | 'failed'
  reason          VARCHAR  -- 실패 사유 (예: '잔액 부족')
  executed_at     TIMESTAMP

-- CMS 상품 (관리자 등록)
products
  id            UUID  PK
  name          VARCHAR
  category      VARCHAR  -- 'delivery' | 'rental' | 'donation' | 'etc'
  description   TEXT
  amount        BIGINT
  billing_day   INT      -- 매월 결제일 (1~28)
  is_active     BOOLEAN DEFAULT true
  created_at    TIMESTAMP

-- 상품 구독 (사용자 가입)
subscriptions
  id            UUID  PK
  user_id       UUID  FK → users
  product_id    UUID  FK → products
  account_id    UUID  FK → accounts
  status        VARCHAR  -- 'active' | 'paused' | 'cancelled'
  started_at    DATE
  created_at    TIMESTAMP

-- Refresh Token
refresh_tokens
  id            UUID  PK
  user_id       UUID  FK → users
  token         VARCHAR UNIQUE
  expires_at    TIMESTAMP
  revoked       BOOLEAN DEFAULT false
  created_at    TIMESTAMP
```

---

## 5. API 엔드포인트

### 인증
```
GET  /api/auth/kakao          카카오 로그인 페이지로 리다이렉트
GET  /api/auth/kakao/callback 카카오 인가코드 수신 → JWT 발급 (KAKAO_REDIRECT_URI)
POST /api/auth/refresh        Access Token 재발급
POST /api/auth/logout         Refresh Token 무효화
```
> 카카오 OAuth 흐름: 프론트 → `GET /api/auth/kakao` → 카카오 인증 서버 → `GET /api/auth/kakao/callback` → JWT 발급 → 프론트로 토큰 전달

### 사용자
```
GET  /api/users/me         내 프로필 조회
PUT  /api/users/me         내 프로필 수정
```

### 계좌
```
GET    /api/accounts             내 계좌 목록
POST   /api/accounts             계좌 생성
GET    /api/accounts/:id         계좌 상세 + 거래내역
POST   /api/accounts/:id/deposit    가상머니 입금
POST   /api/accounts/:id/withdraw   출금
DELETE /api/accounts/:id         계좌 삭제 (활성 구독이 있으면 400 에러 반환)
```

### 상품
```
GET  /api/products          활성 상품 목록
GET  /api/products/:id      상품 상세
```

### 구독
```
GET    /api/subscriptions         내 구독 목록
POST   /api/subscriptions         상품 가입 (body: { product_id, account_id })
PUT    /api/subscriptions/:id     구독 일시정지/재개
DELETE /api/subscriptions/:id     구독 해지
```

### 어드민 (admin role 필요)
```
GET    /api/admin/users              전체 회원 목록
GET    /api/admin/transfers          자동이체 실행 내역
GET    /api/admin/products           전체 상품 목록
POST   /api/admin/products           상품 등록
PUT    /api/admin/products/:id       상품 수정
DELETE /api/admin/products/:id       상품 삭제
```

---

## 6. React 화면 구성

### 사용자 화면
```
/                     랜딩 페이지 (카카오 로그인 버튼)
/dashboard            대시보드 (계좌 요약, 구독 중인 상품)
/products             CMS 상품 목록
/products/:id         상품 상세 + 가입
/subscriptions        내 구독 목록
/accounts             내 계좌 목록
/accounts/:id         계좌 상세 + 거래내역
/profile              프로필 설정
```

### 어드민 화면
```
/admin                어드민 대시보드
/admin/products       상품 목록
/admin/products/new   상품 등록
/admin/products/:id   상품 수정
/admin/users          회원 목록
/admin/transfers      자동이체 실행 내역
```

---

## 7. 자동이체 스케줄러

```
node-cron: 매일 자정 (0 0 * * *)
  1. 오늘 날짜의 billing_day에 해당하는 상품 조회
  2. 해당 상품의 active 구독자 목록 조회
  3. 각 구독자에 대해 DB 트랜잭션(BEGIN/COMMIT/ROLLBACK)으로 묶어서 처리:
     - 잔액 부족 → ROLLBACK → billing_logs에 'failed' 기록
     - 잔액 충분 → accounts.balance 차감 → transactions에 'auto_debit' 기록
                → COMMIT → billing_logs에 'success' 기록
```

> **billing_day 1~28 제약 이유:** 2월은 최소 28일이므로 1~28로 제한해 매월 안정적으로 실행 보장.

---

## 8. 보안 계획

### 코드 레벨 보안
- JWT Access Token 만료: 15분
- JWT Refresh Token 만료: 7일 (DB 저장 + 블랙리스트)
- Rate Limiting: 로그인 API 분당 5회 제한
- SQL Injection 방어: parameterized query (pg 라이브러리)
- CORS: 허용된 도메인만 화이트리스트
- Helmet.js: HTTP 보안 헤더 자동 설정
- 입력값 검증: express-validator

### OWASP Top 10 침투 테스트 시나리오
| 취약점 | 테스트 방법 |
|--------|------------|
| JWT 위변조 | 토큰 payload 수정 후 요청 |
| 타인 계좌 접근 | 다른 user_id로 /accounts/:id 요청 |
| 관리자 권한 탈취 | user role로 /api/admin/* 접근 시도 |
| 무차별 대입 | 로그인 API 반복 요청 → rate limit 확인 |
| SQL Injection | 입력값에 SQL 구문 삽입 시도 |
| IDOR | 구독 ID 변조로 타인 구독 해지 시도 |

---

## 9. 어드민 계정 초기 설정

최초 어드민은 Supabase 대시보드에서 직접 DB의 `users.role`을 `'admin'`으로 수정해서 생성.
별도 어드민 가입 UI 없음.

---

## 10. 배포 구성

```
GitHub 저장소
  ├── server/   → Railway 자동 배포 (main 브랜치 push 시)
  └── client/   → Vercel 자동 배포 (main 브랜치 push 시)
```

### 환경 변수 (server)
```
DATABASE_URL          Supabase PostgreSQL 연결 URL
JWT_ACCESS_SECRET     Access Token 서명 키
JWT_REFRESH_SECRET    Refresh Token 서명 키
KAKAO_CLIENT_ID       카카오 앱 REST API 키
KAKAO_REDIRECT_URI    카카오 인가 후 리다이렉트 URL
```

---

## 11. 구현 단계

```
1단계: 프로젝트 초기 설정 + Supabase DB 연결
2단계: 카카오 로그인 + JWT 발급/갱신
3단계: 계좌 API
4단계: 상품/구독 API
5단계: node-cron 자동이체 스케줄러
6단계: React UI (사용자 화면)
7단계: React UI (어드민 화면)
8단계: 보안 적용 + 취약점 테스트
9단계: Railway + Vercel 배포
```
