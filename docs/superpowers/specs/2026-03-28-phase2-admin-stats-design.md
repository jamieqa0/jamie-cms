# Phase 2 어드민 고도화 설계 (2026-03-28)

## 개요

어드민 대시보드에 수납 통계, 미수납 내역, 즉시 재청구 기능을 추가.

---

## Task 4: 수납률 통계 API

**엔드포인트:** `GET /api/admin/stats`
**인증:** `authenticate` + `requireAdmin` 미들웨어 (기존 admin 라우터에 추가)

### 응답 형식
```json
{
  "successRate": 87.5,
  "totalAmount": 240000,
  "failCount": 2,
  "successCount": 14,
  "month": "2026-03"
}
```

### 쿼리 로직
- 기준: 이번 달 (`DATE_TRUNC('month', executed_at) = DATE_TRUNC('month', NOW())`)
- `successRate` = `successCount / (successCount + failCount) * 100` (0건이면 0)
- `totalAmount` = `SUM(amount) WHERE status='success'`
- `failCount` = `COUNT WHERE status='failed'`

---

## Task 5: 미수납 내역 및 재청구 API

### 5-1. 미수납 목록

**엔드포인트:** `GET /api/admin/unpaid`

**응답:** 실패한 billing_logs (최신순), 유저명·상품명 포함
```json
[
  {
    "id": "uuid",
    "subscription_id": "uuid",
    "account_id": "uuid",
    "product_id": "uuid",
    "amount": 10000,
    "reason": "잔액 부족",
    "executed_at": "2026-03-15T00:00:00Z",
    "nickname": "홍길동",
    "product_name": "가스요금"
  }
]
```

### 5-2. 즉시 재청구

**엔드포인트:** `POST /api/admin/unpaid/:id/retry`
- `id`: billing_log의 UUID
- billing_log 조회 → subscription의 account_id 확인 → 단건 자동이체 즉시 실행
- 내부적으로 `autoDebit.js`의 트랜잭션 로직 직접 실행 (단, 멱등성 체크 없이 강제 재실행)
- 성공 시: `{ message: '재청구 완료', status: 'success' }`
- 잔액 부족 시: `{ error: '잔액 부족' }` (400)

---

## Task 6: 어드민 대시보드 UI 강화

**파일:** `client/src/pages/admin/AdminDashboard.jsx`
**API 함수 추가:** `client/src/api/admin.js`

### 레이아웃
```
[ 왼쪽 (flex:2) ]         [ 오른쪽 (flex:1) ]
  전체 회원 | 등록 상품 | 실행 기록     수납률 카드
  ──────────────────────────        수납액 카드
  ⚠ 미수납 내역 N건 →               실패건수 카드
                                  ──────────────
                                  ▶ 자동이체 실행 (시연)
```

### 동작
- 페이지 진입 시 `getAdminStats()` 호출 → 통계 카드 렌더
- 미수납 카드: `failCount` 표시, 클릭 시 `/admin/transfers` 이동
- 시연 버튼: 클릭 시 오늘 날짜로 `POST /api/scheduler/run` 호출 (x-scheduler-secret 헤더 불필요 — 어드민 JWT로 호출하는 별도 어드민 엔드포인트로 분리)

> **주의:** 시연 버튼은 어드민 JWT 인증으로 보호된 `POST /api/admin/scheduler/run` 엔드포인트 사용. 기존 `POST /api/scheduler/run`은 `SCHEDULER_SECRET` 헤더 필요 → 프론트엔드에서 직접 호출 불가. 어드민 라우터에 별도 엔드포인트를 추가해 `runAutoDebit(today)` 호출. Body: `{ day?: number }`, 없으면 오늘 날짜 사용.

### 새 API 함수 (`client/src/api/admin.js`)
```js
export const getAdminStats = () => api.get('/admin/stats');
export const getUnpaid = () => api.get('/admin/unpaid');
export const retryBilling = (id) => api.post(`/admin/unpaid/${id}/retry`);
export const runAdminScheduler = (day) => api.post('/admin/scheduler/run', { day });
```

---

## 파일 구조

| 작업 | 파일 |
|------|------|
| Modify | `server/src/controllers/adminController.js` (stats, unpaid, retry, adminRunScheduler 함수 추가) |
| Modify | `server/src/routes/admin.js` (4개 라우트 추가) |
| Modify | `client/src/pages/admin/AdminDashboard.jsx` |
| Modify | `client/src/api/admin.js` (4개 함수 추가) |
