# CMS v2 설계 문서

**날짜:** 2026-03-28
**목적:** 사내 스터디 발표용 CMS — v1 완성 이후 신규 요건 반영
**개발자:** Jamie
**예상 사용자:** 약 7명

---

## 1. 개요

실제 CMS(Cash Management Service)의 핵심 개념을 반영한 v2 업그레이드.
v1에서 완성된 기본 자동이체 시스템 위에 집금 계좌, 수납률 통계, 미납 재청구, 결제수단 다양화(일부 스텁), 모바일 반응형을 추가한다.

---

## 2. v1 → v2 변경 범위

### 실제 구현
| 기능 | 설명 |
|------|------|
| 집금 계좌 | 자동이체 성공 시 사용자 계좌 차감 + 기관 공용 집금 계좌 입금 |
| 수납률 통계 | 어드민 대시보드에 성공/실패 건수, 수납률, 총 집금액 표시 |
| 미출금 내역 페이지 | 실패 건 목록, 실패 사유별 분류, 재청구 버튼 |
| 미납 재청구 | 어드민이 미출금 건을 버튼 하나로 재출금 시도 |
| 결제수단 선택 UI | 구독 신청 시 결제수단 선택 (계좌이체만 실제 동작) |
| 시연용 자동이체 버튼 | 어드민 대시보드에서 즉시 자동이체 실행 |
| 스케줄러 HTTP 엔드포인트 | node-cron 제거 → POST /api/scheduler/run 으로 교체 |
| 모바일 반응형 | 전체 화면 Tailwind 브레이크포인트 적용 |

### UI 스텁 (향후 확장용, 클릭 시 "준비 중" 토스트)
| 기능 | 위치 |
|------|------|
| 카드 결제 | 구독 신청 결제수단 선택 |
| 휴대폰 결제 | 구독 신청 결제수단 선택 |
| 가상계좌 결제 | 구독 신청 결제수단 선택 |
| 청구서 자동 발송 | 어드민 메뉴 |
| 세금계산서 자동 발행 | 어드민 메뉴 |
| QR 비대면 동의 | 어드민 메뉴 |

---

## 3. DB 스키마 변경

### `accounts` 테이블 — `type` 컬럼 추가
```sql
ALTER TABLE accounts
  ADD COLUMN type VARCHAR NOT NULL DEFAULT 'personal'
  CHECK (type IN ('personal', 'collection'));
```
- `personal`: 일반 사용자 계좌 (기존)
- `collection`: 기관 집금 계좌 (전역 1개)

집금 계좌는 Supabase 대시보드에서 아래 SQL로 수동 생성 (최초 1회):
```sql
-- 1) 시스템 유저 생성 (users.user_id FK 충족용)
INSERT INTO users (kakao_id, nickname, email, role)
VALUES ('system', '시스템', 'system@cms.internal', 'admin')
ON CONFLICT (kakao_id) DO NOTHING;

-- 2) 집금 계좌 생성
INSERT INTO accounts (user_id, name, balance, type)
VALUES (
  (SELECT id FROM users WHERE kakao_id = 'system'),
  '기관 집금 계좌',
  0,
  'collection'
);
```
- 집금 계좌가 DB에 없을 경우: `runAutoDebit()`은 에러 로그 출력 후 해당 건 스킵 (다른 구독 자동이체는 계속 진행)
- 집금 계좌는 전역 1개 — 모든 상품의 수납금이 동일 계좌로 집금. `runAutoDebit()`에서 `type='collection'`인 계좌를 쿼리하여 사용

### `subscriptions` 테이블 — `payment_method` 컬럼 추가
```sql
ALTER TABLE subscriptions
  ADD COLUMN payment_method VARCHAR NOT NULL DEFAULT 'bank_transfer'
  CHECK (payment_method IN ('bank_transfer', 'card', 'phone', 'virtual_account'));
```

### 기타
- `billing_logs.reason` 컬럼 이미 존재 — 변경 없음
- 출금일/금액은 상품 기준 유지 (월 단위 고정)

---

## 4. API 변경사항

### 신규 엔드포인트
```
POST /api/scheduler/run           자동이체 실행 (x-scheduler-secret 헤더 검증)
GET  /api/admin/stats             수납률 통계
GET  /api/admin/unpaid            미출금 내역 목록
POST /api/admin/unpaid/:id/retry  미출금 건 재청구 (:id = billing_logs.id)
```

> **라우터 등록 위치**
> `POST /api/scheduler/run`은 **별도 `routes/scheduler.js`** 파일로 분리하여 `app.js`에 직접 등록.
> `authenticate` / `requireAdmin` 미들웨어 **적용하지 않음** — `x-scheduler-secret` 헤더만으로 인증.
> 나머지 어드민 API는 기존 `routes/admin.js` (auth + requireAdmin 유지).

### 변경되는 로직
- `runAutoDebit()` — 성공 시 사용자 계좌 차감 + 집금 계좌 잔액 증가 (단일 트랜잭션). 집금 계좌 없으면 에러 로그 후 스킵
- `POST /api/subscriptions` — `payment_method` 필드 수신 (기본값: `bank_transfer`)
- `GET /api/admin/stats` — 이번 달 기준 집계. `?month=YYYY-MM` 쿼리 파라미터로 월 변경 가능

### 재청구(retry) 동작 정의
- `:id`는 `billing_logs.id` (failed 상태인 건)
- 재청구 성공 시: 기존 failed log 유지 (감사 추적) + 새로운 success log INSERT
- 재청구 실패 시: 새로운 failed log INSERT

### 삭제
- `server.js`의 `startScheduler()` 호출 제거
- `node-cron` 의존성 제거
- 참고: `scheduler.test.js`는 `runAutoDebit()`을 직접 import — `startScheduler` 제거해도 테스트 영향 없음

### 기존 API
- 전부 그대로 유지

---

## 5. 프론트엔드 변경사항

### 신규 화면
| 경로 | 내용 |
|------|------|
| `/admin/unpaid` | 미출금 내역 목록, 실패 사유, 재청구 버튼 |

### 기존 화면 수정
| 화면 | 변경 내용 |
|------|----------|
| `/admin` (어드민 대시보드) | 수납률 통계 카드 추가, 시연용 자동이체 버튼 추가 |
| 구독 신청 화면 | 결제수단 선택 UI 추가 (계좌이체만 실제 동작, 나머지 스텁) |
| 어드민 공통 메뉴 | 청구서 발송 / 세금계산서 / QR 동의 메뉴 스텁 추가 |
| 전체 화면 | 모바일 반응형 적용 (Tailwind sm: / md: 브레이크포인트) |

---

## 6. 보안

### 스케줄러 엔드포인트 보호
```
POST /api/scheduler/run
  요청 헤더: x-scheduler-secret: {SCHEDULER_SECRET}
  불일치 시: 401 반환
```

### 환경변수 추가
```
SCHEDULER_SECRET   cron-job.org 요청 인증 키
```
- `server/.env` 및 `server/.env.test` 모두에 추가 필요

---

## 7. 배포 구성

### 아키텍처
```
[React 앱 - Vercel (무료)]
        ↓ HTTPS (JWT 포함)
[Express 서버 - Vercel Serverless (무료)]
  ├── 카카오 OAuth → JWT 발급
  ├── 계좌/상품/구독 API
  ├── 어드민 API
  └── POST /api/scheduler/run
        ↑
[cron-job.org] → 매일 12:00 KST 호출 (무료, 후순위)
        ↓ SQL
[Supabase PostgreSQL]
```

### 환경변수 (server)
```
DATABASE_URL          Supabase Connection Pooler URL
JWT_ACCESS_SECRET     Access Token 서명 키
JWT_REFRESH_SECRET    Refresh Token 서명 키
KAKAO_CLIENT_ID       카카오 앱 REST API 키
KAKAO_REDIRECT_URI    배포된 백엔드 콜백 URL
CLIENT_URL            프론트엔드 URL
SCHEDULER_SECRET      스케줄러 인증 키 (신규)
```

### 환경변수 (client)
```
VITE_API_URL          백엔드 API 베이스 URL
```

### 배포 순서
1. 코드 수정 + GitHub push
2. Vercel 백엔드 배포 + 환경변수 설정
3. 카카오 개발자 콘솔 Redirect URI 업데이트
4. Vercel 프론트엔드 배포 + VITE_API_URL 설정
5. E2E 테스트
6. cron-job.org 설정 (후순위)

---

## 8. 우선순위

| 순서 | 작업 |
|------|------|
| 1 | DB 스키마 변경 (컬럼 추가) |
| 2 | runAutoDebit() 집금 계좌 로직 수정 |
| 3 | 스케줄러 HTTP 엔드포인트 + 시연용 버튼 |
| 4 | 미출금 내역 API + 화면 |
| 5 | 수납률 통계 API + 어드민 대시보드 |
| 6 | 결제수단 선택 UI |
| 7 | UI 스텁 (청구서/세금계산서/QR) |
| 8 | 모바일 반응형 |
| 9 | Vercel 배포 |
| 10 | cron-job.org 설정 |
