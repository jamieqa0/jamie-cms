# Phase 1 v2 설계 (2026-03-28)

## 개요

CMS v2의 핵심 인프라 구축. DB 스키마 확장, 자동이체 고도화, 외부 스케줄러 연동 엔드포인트 추가.

---

## Task 1: DB 스키마 업데이트

**파일:** `server/supabase/migrations/001_v2_schema.sql`

### 변경 사항
- `accounts.type` 컬럼 추가: `'personal' | 'collection'`, DEFAULT `'personal'`
- `subscriptions.payment_method` 컬럼 추가: `'account' | 'card' | 'phone'`, DEFAULT `'account'`
- 시스템 유저 Seed: `kakao_id = 'system'`, `nickname = '시스템'`, `role = 'admin'`
- 집금 계좌 Seed: 시스템 유저 소유, `type = 'collection'`, `name = '기관 집금 계좌'`

### 실행 방법
Supabase 대시보드 → SQL Editor → 파일 내용 붙여넣기 → Run

---

## Task 2: 자동이체 고도화

**파일:** `server/src/scheduler/autoDebit.js`

### 변경 사항
1. `node-cron` 의존성 및 `startScheduler()` 제거
2. 진입 시 멱등성 체크: `billing_logs`에서 오늘(`targetDay`) 이미 `'success'`인 `subscription_id` 제외
3. 집금 계좌 조회: `accounts.type = 'collection'` 1개 조회 → 없으면 전체 중단 + 에러 throw
4. 트랜잭션 내 처리:
   - `SELECT ... FOR UPDATE`: 개인 계좌 먼저, 집금 계좌 나중 (데드락 방지)
   - 잔액 부족 시 ROLLBACK → `billing_logs` failed 기록
   - 성공 시: 개인 계좌 차감 + 집금 계좌 입금 + `billing_logs` success 기록 — 모두 단일 트랜잭션

### Critical Guardrails
- 멱등성: 동일 날짜 동일 구독 중복 실행 방지
- 데드락 방지: 잠금 순서 고정 (personal → collection)
- 트랜잭션 안전성: 차감+입금+로그 모두 BEGIN-COMMIT 안에서 처리

---

## Task 3: 스케줄러 HTTP 엔드포인트

**신규 파일:**
- `server/src/controllers/schedulerController.js`
- `server/src/routes/scheduler.js`

**app.js에 라우트 추가:** `app.use('/api/scheduler', require('./routes/scheduler'))`

### 엔드포인트
```
POST /api/scheduler/run
Header: x-scheduler-secret: <SCHEDULER_SECRET>
Body: { "day": 15 }  // 선택적, 없으면 오늘 날짜
```

### 인증
`req.headers['x-scheduler-secret'] !== process.env.SCHEDULER_SECRET` → 401

### 응답
- `200`: `{ message: 'AutoDebit complete', day: 15 }`
- `401`: `{ error: 'Unauthorized' }`
- `500`: `{ error: '...' }`
