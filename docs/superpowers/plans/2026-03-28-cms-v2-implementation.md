# CMS v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1 위에 집금 계좌, 수납률 통계, 미납 재청구, 결제수단 선택 UI, 모바일 반응형을 추가하고 Vercel에 배포한다.

**Architecture:** node-cron 제거 → POST /api/scheduler/run HTTP 엔드포인트로 교체. 자동이체 성공 시 사용자 계좌 차감 + 집금 계좌(type='collection') 입금을 단일 트랜잭션으로 처리. 어드민 API에 통계/미출금/재청구 엔드포인트 추가.

**Tech Stack:** Node.js + Express (Vercel Serverless), React 19 + Tailwind CSS, Supabase PostgreSQL, Jest + Supertest

---

## File Map

### 신규 생성
- `server/src/routes/scheduler.js` — POST /api/scheduler/run 라우터 (auth 없음)
- `server/src/controllers/schedulerController.js` — SCHEDULER_SECRET 검증 + runAutoDebit 호출
- `client/src/pages/admin/AdminUnpaid.jsx` — 미출금 내역 화면

### 수정
- `server/src/scheduler/autoDebit.js` — 집금 계좌 입금 로직 추가, startScheduler 제거
- `server/src/server.js` — startScheduler 호출 제거
- `server/src/app.js` — /api/scheduler 라우트 등록
- `server/src/controllers/adminController.js` — getStats, getUnpaid, retryUnpaid 추가
- `server/src/routes/admin.js` — /stats, /unpaid, /unpaid/:id/retry 라우트 추가
- `server/src/controllers/subscriptionsController.js` — payment_method 필드 처리
- `client/src/api/admin.js` — getAdminStats, getAdminUnpaid, retryUnpaid, runScheduler 추가
- `client/src/api/subscriptions.js` — createSubscription에 payment_method 추가
- `client/src/App.jsx` — /admin/unpaid 라우트 추가
- `client/src/components/Layout.jsx` — 어드민 스텁 메뉴 추가, 모바일 반응형
- `client/src/pages/admin/AdminDashboard.jsx` — 통계 카드 + 시연 버튼
- `client/src/pages/ProductDetail.jsx` — 결제수단 선택 UI
- 전체 페이지 — 모바일 반응형

### 테스트
- `server/tests/scheduler.test.js` — HTTP 엔드포인트 테스트 추가

---

## Task 1: DB 스키마 변경 (Supabase에서 직접 실행)

**Files:**
- Supabase SQL Editor에서 실행 (파일 변경 없음)
- `server/supabase/schema.sql` — 참고용 스키마 파일 (수정 필요시)

- [ ] **Step 1: Supabase 대시보드 → SQL Editor 열기**

- [ ] **Step 2: accounts 테이블에 type 컬럼 추가**

```sql
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'personal'
  CHECK (type IN ('personal', 'collection'));
```

- [ ] **Step 3: subscriptions 테이블에 payment_method 컬럼 추가**

```sql
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR NOT NULL DEFAULT 'bank_transfer'
  CHECK (payment_method IN ('bank_transfer', 'card', 'phone', 'virtual_account'));
```

- [ ] **Step 4: 시스템 유저 + 집금 계좌 seed 데이터 삽입**

```sql
-- 시스템 유저 생성 (집금 계좌의 user_id FK 충족용)
INSERT INTO users (kakao_id, nickname, email, role)
VALUES ('system', '시스템', 'system@cms.internal', 'admin')
ON CONFLICT (kakao_id) DO NOTHING;

-- 집금 계좌 생성 (전역 1개)
INSERT INTO accounts (user_id, name, balance, type)
SELECT id, '기관 집금 계좌', 0, 'collection'
FROM users WHERE kakao_id = 'system'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 5: 결과 확인**

```sql
SELECT * FROM accounts WHERE type = 'collection';
-- 1개 행이 나와야 함
```

---

## Task 2: runAutoDebit() 집금 계좌 로직 추가 + node-cron 제거

**Files:**
- Modify: `server/src/scheduler/autoDebit.js`
- Modify: `server/src/server.js`

- [ ] **Step 1: 테스트 먼저 확인 — 현재 scheduler 테스트 통과 확인**

```bash
cd server
npx jest tests/scheduler.test.js --runInBand
```
Expected: PASS (기존 테스트 기준선 확인)

- [ ] **Step 2: autoDebit.js 수정 — 집금 계좌 입금 + startScheduler 제거**

`server/src/scheduler/autoDebit.js` 전체를 아래로 교체:

```js
const pool = require('../config/db');

const runAutoDebit = async (targetDay = null) => {
  const today = targetDay ?? new Date().getDate();
  console.log(`[AutoDebit] Running for billing_day=${today}`);

  // 집금 계좌 조회
  const collectionResult = await pool.query(
    `SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`
  );
  if (collectionResult.rows.length === 0) {
    console.error('[AutoDebit] 집금 계좌가 없습니다. Supabase에서 seed SQL을 실행해주세요.');
    return;
  }
  const collectionAccountId = collectionResult.rows[0].id;

  const result = await pool.query(
    `SELECT s.id as subscription_id, s.account_id, p.id as product_id, p.amount
     FROM subscriptions s
     JOIN products p ON s.product_id = p.id
     WHERE p.billing_day = $1
       AND s.status = 'active'
       AND p.is_active = true`,
    [today]
  );

  for (const row of result.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const acct = await client.query(
        `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [row.account_id]
      );
      const balance = Number(acct.rows[0].balance);

      if (balance < row.amount) {
        await client.query('ROLLBACK');
        await pool.query(
          `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
           VALUES ($1, $2, $3, $4, 'failed', '잔액 부족')`,
          [row.subscription_id, row.product_id, row.account_id, row.amount]
        );
        continue;
      }

      // 사용자 계좌 차감
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [row.amount, row.account_id]
      );
      // 집금 계좌 입금
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
        [row.amount, collectionAccountId]
      );
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'auto_debit', $2, '자동이체')`,
        [row.account_id, row.amount]
      );
      await client.query('COMMIT');

      await pool.query(
        `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
         VALUES ($1, $2, $3, $4, 'success')`,
        [row.subscription_id, row.product_id, row.account_id, row.amount]
      );

      console.log(`[AutoDebit] Success: subscription ${row.subscription_id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[AutoDebit] Error for subscription ${row.subscription_id}:`, err);
    } finally {
      client.release();
    }
  }
};

module.exports = { runAutoDebit };
```

- [ ] **Step 3: server.js에서 startScheduler 제거**

`server/src/server.js` 전체를 아래로 교체:

```js
require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 4: 기존 scheduler 테스트 재실행 — 여전히 통과 확인**

```bash
npx jest tests/scheduler.test.js --runInBand
```
Expected: PASS (runAutoDebit은 직접 import라 영향 없음)

- [ ] **Step 5: 커밋**

```bash
git add server/src/scheduler/autoDebit.js server/src/server.js
git commit -m "feat: add collection account to auto-debit, remove node-cron"
```

---

## Task 3: 스케줄러 HTTP 엔드포인트

**Files:**
- Create: `server/src/controllers/schedulerController.js`
- Create: `server/src/routes/scheduler.js`
- Modify: `server/src/app.js`
- Modify: `server/src/.env` (SCHEDULER_SECRET 추가)
- Modify: `server/tests/scheduler.test.js`

- [ ] **Step 1: .env 및 .env.test에 SCHEDULER_SECRET 추가**

`server/.env`에 추가:
```
SCHEDULER_SECRET=dev-secret-1234
```

`server/.env.test`에 추가:
```
SCHEDULER_SECRET=test-secret-1234
```

`client/.env`에 추가 (개발 환경 시연 버튼용):
```
VITE_SCHEDULER_SECRET=dev-secret-1234
```

- [ ] **Step 2: schedulerController.js 생성**

```js
const { runAutoDebit } = require('../scheduler/autoDebit');

const runScheduler = async (req, res) => {
  const secret = req.headers['x-scheduler-secret'];
  if (!secret || secret !== process.env.SCHEDULER_SECRET) {
    return res.status(401).json({ error: '인증 실패' });
  }
  try {
    await runAutoDebit();
    res.json({ message: '자동이체 실행 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '자동이체 실행 중 오류가 발생했습니다.' });
  }
};

module.exports = { runScheduler };
```

- [ ] **Step 3: routes/scheduler.js 생성**

```js
const router = require('express').Router();
const { runScheduler } = require('../controllers/schedulerController');

router.post('/run', runScheduler);

module.exports = router;
```

- [ ] **Step 4: app.js에 라우트 등록**

`server/src/app.js`에서 기존 라우트 목록 아래에 추가:

```js
app.use('/api/scheduler', require('./routes/scheduler'));
```

- [ ] **Step 5: scheduler.test.js에 HTTP 엔드포인트 테스트 추가**

`server/tests/scheduler.test.js` 파일 상단에 추가:
```js
const request = require('supertest');
const app = require('../src/app');
```

파일 끝에 추가:
```js
describe('POST /api/scheduler/run', () => {
  it('유효한 secret으로 호출 시 200 반환', async () => {
    const res = await request(app)
      .post('/api/scheduler/run')
      .set('x-scheduler-secret', process.env.SCHEDULER_SECRET);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('자동이체 실행 완료');
  });

  it('잘못된 secret으로 호출 시 401 반환', async () => {
    const res = await request(app)
      .post('/api/scheduler/run')
      .set('x-scheduler-secret', 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('secret 없이 호출 시 401 반환', async () => {
    const res = await request(app)
      .post('/api/scheduler/run');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 6: 테스트 실행**

```bash
npx jest tests/scheduler.test.js --runInBand
```
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add server/src/controllers/schedulerController.js server/src/routes/scheduler.js server/src/app.js server/tests/scheduler.test.js
git commit -m "feat: add scheduler HTTP endpoint with secret auth"
```

---

## Task 4: 수납률 통계 API

**Files:**
- Modify: `server/src/controllers/adminController.js`
- Modify: `server/src/routes/admin.js`
- Modify: `client/src/api/admin.js`

- [ ] **Step 1: adminController.js에 getStats 추가**

`server/src/controllers/adminController.js` 끝에 추가:

```js
const getStats = async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const start = new Date(`${month}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1); // 다음 달 1일 → < 조건으로 사용

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'success') AS success_count,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
         COUNT(*) AS total_count,
         COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS total_collected
       FROM billing_logs
       WHERE executed_at >= $1 AND executed_at < $2`,
      [start.toISOString(), end.toISOString()]
    );

    const row = result.rows[0];
    const total = Number(row.total_count);
    const success = Number(row.success_count);
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;

    res.json({
      month,
      success_count: success,
      failed_count: Number(row.failed_count),
      total_count: total,
      collection_rate: rate,
      total_collected: Number(row.total_collected),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
```

`module.exports`에 `getStats` 추가.

- [ ] **Step 2: admin.js 라우트에 /stats 추가**

`server/src/routes/admin.js`에 추가:
```js
router.get('/stats', c.getStats);
```

- [ ] **Step 3: client/src/api/admin.js에 함수 추가**

```js
export const getAdminStats = (month) => api.get('/admin/stats', { params: month ? { month } : {} });
```

- [ ] **Step 4: server/tests/admin.test.js에 stats 테스트 추가**

기존 `tests/admin.test.js` 파일이 없다면 새로 생성. 있다면 아래 describe 블록 추가:

```js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

describe('GET /api/admin/stats', () => {
  let adminToken;

  beforeAll(async () => {
    // 어드민 유저 생성 및 토큰 발급 (기존 테스트 패턴 참고)
    const { signAccessToken } = require('../src/utils/jwt');
    const userRes = await pool.query(
      `INSERT INTO users (kakao_id, nickname, email, role) VALUES ('admin_stats_test', '어드민', 'admin@test.com', 'admin')
       ON CONFLICT (kakao_id) DO UPDATE SET role = 'admin' RETURNING id`
    );
    adminToken = signAccessToken({ userId: userRes.rows[0].id, role: 'admin' });
  });

  it('이번 달 통계를 반환한다', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('month');
    expect(res.body).toHaveProperty('collection_rate');
    expect(res.body).toHaveProperty('total_collected');
    expect(typeof res.body.success_count).toBe('number');
    expect(typeof res.body.failed_count).toBe('number');
  });

  it('?month 파라미터로 특정 월 조회', async () => {
    const res = await request(app)
      .get('/api/admin/stats?month=2025-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2025-01');
  });
});
```

- [ ] **Step 5: 테스트 실행**

```bash
npx jest tests/admin.test.js --runInBand
```
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add server/src/controllers/adminController.js server/src/routes/admin.js client/src/api/admin.js server/tests/admin.test.js
git commit -m "feat: add billing stats API"
```

---

## Task 5: 미출금 내역 API + 재청구 API

**Files:**
- Modify: `server/src/controllers/adminController.js`
- Modify: `server/src/routes/admin.js`
- Modify: `client/src/api/admin.js`

- [ ] **Step 1: adminController.js에 getUnpaid, retryUnpaid 추가**

`server/src/controllers/adminController.js`에 추가:

```js
const getUnpaid = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bl.id, bl.amount, bl.reason, bl.executed_at,
              p.name as product_name,
              u.nickname,
              a.name as account_name
       FROM billing_logs bl
       JOIN products p ON bl.product_id = p.id
       JOIN subscriptions s ON bl.subscription_id = s.id
       JOIN users u ON s.user_id = u.id
       JOIN accounts a ON bl.account_id = a.id
       WHERE bl.status = 'failed'
       ORDER BY bl.executed_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const retryUnpaid = async (req, res) => {
  // 원본 failed 로그 조회
  const logResult = await pool.query(
    `SELECT * FROM billing_logs WHERE id = $1 AND status = 'failed'`,
    [req.params.id]
  );
  if (!logResult.rows[0]) {
    return res.status(404).json({ error: '미출금 내역을 찾을 수 없습니다.' });
  }
  const log = logResult.rows[0];

  // 집금 계좌 조회
  const collectionResult = await pool.query(
    `SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`
  );
  if (collectionResult.rows.length === 0) {
    return res.status(500).json({ error: '집금 계좌가 없습니다.' });
  }
  const collectionAccountId = collectionResult.rows[0].id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const acct = await client.query(
      `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
      [log.account_id]
    );
    const balance = Number(acct.rows[0].balance);

    if (balance < log.amount) {
      await client.query('ROLLBACK');
      // 새 failed log 기록
      await pool.query(
        `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
         VALUES ($1, $2, $3, $4, 'failed', '잔액 부족 (재청구)')`,
        [log.subscription_id, log.product_id, log.account_id, log.amount]
      );
      return res.status(400).json({ error: '잔액이 부족합니다.' });
    }

    await client.query(
      `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
      [log.amount, log.account_id]
    );
    await client.query(
      `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
      [log.amount, collectionAccountId]
    );
    await client.query(
      `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'auto_debit', $2, '자동이체 (재청구)')`,
      [log.account_id, log.amount]
    );
    await client.query('COMMIT');

    // 새 success log 기록 (기존 failed log는 감사 추적용으로 유지)
    await pool.query(
      `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
       VALUES ($1, $2, $3, $4, 'success')`,
      [log.subscription_id, log.product_id, log.account_id, log.amount]
    );

    res.json({ message: '재청구 성공' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  } finally {
    client.release(); // pool.connect() 성공 시 항상 release
  }
};
```

`module.exports`에 `getUnpaid`, `retryUnpaid` 추가.

- [ ] **Step 2: admin.js 라우트에 추가**

```js
router.get('/unpaid', c.getUnpaid);
router.post('/unpaid/:id/retry', c.retryUnpaid);
```

- [ ] **Step 3: client/src/api/admin.js에 함수 추가**

```js
export const getAdminUnpaid = () => api.get('/admin/unpaid');
export const retryUnpaid = (id) => api.post(`/admin/unpaid/${id}/retry`);
```

- [ ] **Step 4: admin.test.js에 unpaid + retry 테스트 추가**

```js
describe('GET /api/admin/unpaid', () => {
  it('미출금 내역 목록을 반환한다', async () => {
    const res = await request(app)
      .get('/api/admin/unpaid')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/admin/unpaid/:id/retry', () => {
  it('존재하지 않는 id로 재청구 시 404 반환', async () => {
    const res = await request(app)
      .post('/api/admin/unpaid/00000000-0000-0000-0000-000000000000/retry')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('재청구 성공 시 기존 failed log가 유지되고 새 success log가 생성된다', async () => {
    // 테스트용 failed billing_log 생성 (scheduler.test.js의 데이터 활용 또는 직접 INSERT)
    // 1. 잔액이 충분한 계좌 + 구독 + billing_log(failed) 생성
    const userRes = await pool.query(
      `INSERT INTO users (kakao_id, nickname, email) VALUES ('retry_test_user', '재청구테스트', 'retry@test.com')
       ON CONFLICT (kakao_id) DO UPDATE SET nickname = '재청구테스트' RETURNING id`
    );
    const userId = userRes.rows[0].id;

    const acctRes = await pool.query(
      `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '테스트계좌', 50000) RETURNING id`,
      [userId]
    );
    const accountId = acctRes.rows[0].id;

    const prodRes = await pool.query(
      `SELECT id, amount FROM products WHERE is_active = true LIMIT 1`
    );
    const product = prodRes.rows[0];

    const subRes = await pool.query(
      `INSERT INTO subscriptions (user_id, product_id, account_id) VALUES ($1, $2, $3) RETURNING id`,
      [userId, product.id, accountId]
    );

    const logRes = await pool.query(
      `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
       VALUES ($1, $2, $3, $4, 'failed', '잔액 부족') RETURNING id`,
      [subRes.rows[0].id, product.id, accountId, product.amount]
    );
    const logId = logRes.rows[0].id;

    // 2. 재청구 호출
    const res = await request(app)
      .post(`/api/admin/unpaid/${logId}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('재청구 성공');

    // 3. 기존 failed log 유지 확인
    const originalLog = await pool.query(
      `SELECT * FROM billing_logs WHERE id = $1`, [logId]
    );
    expect(originalLog.rows[0].status).toBe('failed'); // 유지됨

    // 4. 새 success log 생성 확인
    const newLog = await pool.query(
      `SELECT * FROM billing_logs WHERE subscription_id = $1 AND status = 'success'`,
      [subRes.rows[0].id]
    );
    expect(newLog.rows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: 테스트 실행**

```bash
npx jest tests/admin.test.js --runInBand
```
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add server/src/controllers/adminController.js server/src/routes/admin.js client/src/api/admin.js server/tests/admin.test.js
git commit -m "feat: add unpaid list and retry API"
```

---

## Task 6: 구독 생성 시 payment_method 처리

**Files:**
- Modify: `server/src/controllers/subscriptionsController.js`
- Modify: `client/src/api/subscriptions.js`

- [ ] **Step 1: subscriptionsController.js — createSubscription 수정**

`createSubscription` 함수에서 `payment_method` 추가:

```js
const createSubscription = async (req, res) => {
  const { product_id, account_id, payment_method = 'bank_transfer' } = req.body;
  if (!product_id || !account_id) {
    return res.status(400).json({ error: 'product_id and account_id are required' });
  }
  const validMethods = ['bank_transfer', 'card', 'phone', 'virtual_account'];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({ error: '유효하지 않은 결제수단입니다.' });
  }

  const acct = await pool.query(`SELECT user_id FROM accounts WHERE id = $1`, [account_id]);
  if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
  if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  const prod = await pool.query(`SELECT id FROM products WHERE id = $1 AND is_active = true`, [product_id]);
  if (!prod.rows[0]) return res.status(404).json({ error: 'Product not found' });

  const dup = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND product_id = $2 AND status = 'active'`,
    [req.user.userId, product_id]
  );
  if (dup.rows.length > 0) return res.status(409).json({ error: 'Already subscribed' });

  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, product_id, account_id, payment_method)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.userId, product_id, account_id, payment_method]
  );
  res.status(201).json(result.rows[0]);
};
```

- [ ] **Step 2: client/src/api/subscriptions.js 수정**

```js
export const createSubscription = (product_id, account_id, payment_method = 'bank_transfer') =>
  api.post('/subscriptions', { product_id, account_id, payment_method });
```

- [ ] **Step 3: 전체 테스트 실행**

```bash
npx jest --runInBand
```
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add server/src/controllers/subscriptionsController.js client/src/api/subscriptions.js
git commit -m "feat: add payment_method to subscription creation"
```

---

## Task 7: 어드민 대시보드 — 통계 카드 + 시연 버튼

**Files:**
- Modify: `client/src/pages/admin/AdminDashboard.jsx`
- Modify: `client/src/api/admin.js` (runScheduler 추가)

- [ ] **Step 1: admin.js API에 runScheduler 추가**

```js
export const runScheduler = () =>
  api.post('/scheduler/run', {}, {
    headers: { 'x-scheduler-secret': import.meta.env.VITE_SCHEDULER_SECRET || '' }
  });
```

> 참고: 시연용 버튼은 프론트에서 직접 secret을 포함해 호출. 실제 배포 시엔 `VITE_SCHEDULER_SECRET` 환경변수에 값 설정. 개발 중에는 브라우저 DevTools Network 탭으로 확인.

- [ ] **Step 2: AdminDashboard.jsx 전체 교체**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminUsers, getAdminTransfers, getAdminProducts, getAdminStats, runScheduler } from '../../api/admin';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ users: 0, products: 0, transfers: 0 });
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([getAdminUsers(), getAdminProducts(), getAdminTransfers(), getAdminStats()]).then(
      ([u, p, t, s]) => {
        setCounts({ users: u.data.length, products: p.data.length, transfers: t.data.length });
        setStats(s.data);
      }
    );
  }, []);

  const handleRunScheduler = async () => {
    if (!window.confirm('자동이체를 지금 실행할까요?')) return;
    setRunning(true);
    try {
      await runScheduler();
      alert('자동이체 실행 완료!');
      const s = await getAdminStats();
      setStats(s.data);
    } catch (e) {
      alert(e.response?.data?.error || '실행 실패');
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">어드민 대시보드</h1>
        <button
          onClick={handleRunScheduler}
          disabled={running}
          className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-200 transition"
        >
          {running ? '실행 중...' : '⚡ 자동이체 실행 (시연용)'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: '전체 회원', value: counts.users, to: '/admin/users' },
          { label: '등록 상품', value: counts.products, to: '/admin/products' },
          { label: '자동이체 실행 기록', value: counts.transfers, to: '/admin/transfers' },
        ].map(item => (
          <Link key={item.label} to={item.to}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:border-slate-300 transition">
            <p className="text-slate-500 text-sm">{item.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{item.value}</p>
          </Link>
        ))}
      </div>

      {stats && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="font-semibold text-slate-900 mb-4">이번 달 수납 현황 ({stats.month})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-500 text-sm">수납률</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.collection_rate}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm">성공</p>
              <p className="text-2xl font-bold text-slate-900">{stats.success_count}건</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm">미수납</p>
              <p className="text-2xl font-bold text-red-500">{stats.failed_count}건</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm">총 집금액</p>
              <p className="text-2xl font-bold text-slate-900">{Number(stats.total_collected).toLocaleString()}원</p>
            </div>
          </div>
          <Link to="/admin/unpaid" className="mt-4 inline-block text-sm text-red-500 hover:text-red-700">
            미출금 내역 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 개발 서버로 확인**

```bash
cd client && npm run dev
```
브라우저에서 `/admin` 접속 → 통계 카드, 시연 버튼 확인

- [ ] **Step 4: 커밋**

```bash
git add client/src/pages/admin/AdminDashboard.jsx client/src/api/admin.js
git commit -m "feat: add stats cards and demo scheduler button to admin dashboard"
```

---

## Task 8: 미출금 내역 화면

**Files:**
- Create: `client/src/pages/admin/AdminUnpaid.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: AdminUnpaid.jsx 생성**

```jsx
import { useEffect, useState } from 'react';
import { getAdminUnpaid, retryUnpaid } from '../../api/admin';

export default function AdminUnpaid() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(null);

  const fetchList = async () => {
    setLoading(true);
    const res = await getAdminUnpaid();
    setList(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, []);

  const handleRetry = async (id) => {
    if (!window.confirm('재청구를 시도할까요?')) return;
    setRetrying(id);
    try {
      await retryUnpaid(id);
      alert('재청구 성공!');
      fetchList();
    } catch (e) {
      alert(e.response?.data?.error || '재청구 실패');
    }
    setRetrying(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">미출금 내역</h1>
      {loading ? (
        <p className="text-slate-500">로딩 중...</p>
      ) : list.length === 0 ? (
        <p className="text-slate-500">미출금 내역이 없습니다.</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">회원</th>
                  <th className="text-left px-4 py-3">상품</th>
                  <th className="text-left px-4 py-3">계좌</th>
                  <th className="text-right px-4 py-3">금액</th>
                  <th className="text-left px-4 py-3">실패 사유</th>
                  <th className="text-left px-4 py-3">일시</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.nickname}</td>
                    <td className="px-4 py-3">{item.product_name}</td>
                    <td className="px-4 py-3 text-slate-500">{item.account_name}</td>
                    <td className="px-4 py-3 text-right font-medium">{Number(item.amount).toLocaleString()}원</td>
                    <td className="px-4 py-3 text-red-500">{item.reason}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(item.executed_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRetry(item.id)}
                        disabled={retrying === item.id}
                        className="text-xs px-3 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
                      >
                        {retrying === item.id ? '처리 중...' : '재청구'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: App.jsx에 라우트 추가**

`client/src/App.jsx`에서 AdminRoute 안에 추가:
```jsx
import AdminUnpaid from './pages/admin/AdminUnpaid';
// ...
<Route path="/admin/unpaid" element={<AdminUnpaid />} />
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/pages/admin/AdminUnpaid.jsx client/src/App.jsx
git commit -m "feat: add unpaid list page with retry button"
```

---

## Task 9: 결제수단 선택 UI

**Files:**
- Modify: `client/src/pages/ProductDetail.jsx`

- [ ] **Step 1: ProductDetail.jsx 수정**

`payment_method` state 추가 및 결제수단 선택 UI 삽입:

```jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from '../api/products';
import { getAccounts } from '../api/accounts';
import { createSubscription } from '../api/subscriptions';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: '계좌이체', available: true },
  { value: 'card', label: '카드', available: false },
  { value: 'phone', label: '휴대폰', available: false },
  { value: 'virtual_account', label: '가상계좌', available: false },
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProduct(id).then(r => setProduct(r.data));
    getAccounts().then(r => setAccounts(r.data));
  }, [id]);

  const handleSubscribe = async () => {
    if (paymentMethod !== 'bank_transfer') {
      alert('해당 결제수단은 현재 준비 중입니다.');
      return;
    }
    if (!selectedAccount) { alert('계좌를 선택해주세요'); return; }
    setLoading(true);
    try {
      await createSubscription(id, selectedAccount, paymentMethod);
      alert('구독이 완료되었어요!');
      navigate('/subscriptions');
    } catch (e) {
      alert(e.response?.data?.error || '구독 실패');
    }
    setLoading(false);
  };

  if (!product) return <div className="p-6">로딩 중...</div>;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-500">월 결제금액</span>
          <span className="font-bold text-slate-900">{Number(product.amount).toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">결제일</span>
          <span className="font-bold text-slate-900">매월 {product.billing_day}일</span>
        </div>
        {product.description && (
          <p className="text-slate-500 text-sm pt-2 border-t border-slate-100">{product.description}</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-semibold text-slate-900">결제수단 선택</h2>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.value}
              onClick={() => setPaymentMethod(m.value)}
              className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition ${
                paymentMethod === m.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-700 hover:border-slate-400'
              } ${!m.available ? 'opacity-50' : ''}`}
            >
              {m.label}
              {!m.available && <span className="ml-1 text-xs">(준비 중)</span>}
            </button>
          ))}
        </div>
      </div>

      {paymentMethod === 'bank_transfer' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3">
          <h2 className="font-semibold text-slate-900">출금 계좌 선택</h2>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
          >
            <option value="">계좌를 선택하세요</option>
            {accounts.filter(a => a.type !== 'collection').map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({Number(a.balance).toLocaleString()}원)
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium hover:bg-slate-700 transition"
      >
        구독 신청
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/pages/ProductDetail.jsx
git commit -m "feat: add payment method selection UI to product detail"
```

---

## Task 10: UI 스텁 — 어드민 메뉴

**Files:**
- Modify: `client/src/components/Layout.jsx`

- [ ] **Step 1: Layout.jsx에 어드민 스텁 메뉴 추가**

어드민용 네비게이션에 스텁 메뉴 추가 (클릭 시 alert):

```jsx
{user?.role === 'admin' && (
  <>
    <NavLink to="/admin" className={navClass}>어드민</NavLink>
    <button
      onClick={() => alert('청구서 자동 발송 기능은 준비 중입니다.')}
      className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-100 transition"
    >
      청구서 발송
    </button>
    <button
      onClick={() => alert('세금계산서 자동 발행 기능은 준비 중입니다.')}
      className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-100 transition"
    >
      세금계산서
    </button>
    <button
      onClick={() => alert('QR 비대면 동의 기능은 준비 중입니다.')}
      className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-100 transition"
    >
      QR 동의
    </button>
  </>
)}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/components/Layout.jsx
git commit -m "feat: add admin stub menu items"
```

---

## Task 11: 모바일 반응형

**Files:**
- Modify: `client/src/components/Layout.jsx`
- Modify: `client/src/pages/Dashboard.jsx`
- Modify: `client/src/pages/Accounts.jsx`
- Modify: `client/src/pages/Subscriptions.jsx`
- Modify: `client/src/pages/admin/AdminProducts.jsx`
- Modify: `client/src/pages/admin/AdminUsers.jsx`
- Modify: `client/src/pages/admin/AdminTransfers.jsx`

- [ ] **Step 1: Layout.jsx 네비게이션 모바일 대응**

현재 nav를 햄버거 없이 스크롤 가능하게 수정:

```jsx
<nav className="bg-white border-b border-slate-200 px-4 py-3">
  <div className="flex items-center justify-between mb-2 sm:mb-0">
    <span className="font-bold text-slate-900">Jamie CMS</span>
    <div className="flex items-center gap-2 sm:hidden">
      <span className="text-sm text-slate-500">{user?.nickname}</span>
      <button onClick={handleLogout} className="text-sm text-red-500">로그아웃</button>
    </div>
  </div>
  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
    <NavLink to="/dashboard" className={navClass}>대시보드</NavLink>
    <NavLink to="/products" className={navClass}>상품</NavLink>
    <NavLink to="/subscriptions" className={navClass}>구독</NavLink>
    <NavLink to="/accounts" className={navClass}>계좌</NavLink>
    {user?.role === 'admin' && (
      <>
        <NavLink to="/admin" className={navClass}>어드민</NavLink>
        {/* 스텁 버튼들 */}
      </>
    )}
    <div className="hidden sm:flex items-center gap-2 ml-auto">
      <span className="text-sm text-slate-500">{user?.nickname}</span>
      <NavLink to="/profile" className={navClass}>프로필</NavLink>
      <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">로그아웃</button>
    </div>
  </div>
</nav>
```

- [ ] **Step 2: 각 페이지의 grid 반응형 적용**

`grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
`grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
테이블이 있는 페이지에 `overflow-x-auto` wrapper 추가

각 파일에서 다음 패턴 적용:
- `Dashboard.jsx`: stats grid 반응형
- `Accounts.jsx`, `Subscriptions.jsx`: 카드 레이아웃 확인
- `AdminProducts.jsx`, `AdminUsers.jsx`, `AdminTransfers.jsx`: 테이블 overflow-x-auto

- [ ] **Step 3: 모바일(375px)에서 확인**

브라우저 DevTools → 모바일 뷰 → 주요 화면 순서대로 확인:
- `/dashboard`, `/products`, `/subscriptions`, `/accounts`
- `/admin`, `/admin/unpaid`, `/admin/users`, `/admin/transfers`

- [ ] **Step 4: 커밋**

```bash
git add client/src/components/Layout.jsx client/src/pages client/src/pages/admin
git commit -m "feat: add mobile responsive layout"
```

---

## Task 12: Vercel 배포

- [ ] **Step 1: GitHub push**

```bash
git push origin master
```

- [ ] **Step 2: Vercel 백엔드 배포**

1. vercel.com → New Project
2. 저장소 선택 → Root Directory: `server`
3. Framework Preset: Other
4. 환경변수 설정 (Settings → Environment Variables):
   ```
   DATABASE_URL=
   JWT_ACCESS_SECRET=
   JWT_REFRESH_SECRET=
   KAKAO_CLIENT_ID=
   KAKAO_REDIRECT_URI=https://{vercel-backend-domain}/api/auth/kakao/callback
   CLIENT_URL=https://{vercel-frontend-domain}
   SCHEDULER_SECRET=
   ```
5. Deploy

- [ ] **Step 3: 카카오 개발자 콘솔 Redirect URI 업데이트**

developers.kakao.com → 내 앱 → 카카오 로그인 → Redirect URI
→ `https://{vercel-backend-domain}/api/auth/kakao/callback` 추가

- [ ] **Step 4: Vercel 프론트엔드 배포**

1. vercel.com → New Project
2. 저장소 선택 → Root Directory: `client`
3. 환경변수:
   ```
   VITE_API_URL=https://{vercel-backend-domain}/api
   VITE_SCHEDULER_SECRET={SCHEDULER_SECRET 값}
   ```
4. Deploy

- [ ] **Step 5: E2E 테스트**

순서대로 확인:
1. 카카오 로그인
2. 계좌 생성 → 입금
3. 상품 구독 (계좌이체 선택)
4. 어드민 → 자동이체 실행 (시연 버튼)
5. 어드민 → 수납률 통계 확인
6. 어드민 → 미출금 내역 확인

- [ ] **Step 6: 최종 태그**

```bash
git tag v2.0.0
git push origin v2.0.0
```

---

## Task 13: cron-job.org 설정 (후순위)

- [ ] **Step 1: cron-job.org 가입 및 크론 잡 생성**

1. cron-job.org → 회원가입
2. Cronjobs → Create Cronjob
3. 설정:
   - URL: `https://{vercel-backend-domain}/api/scheduler/run`
   - Schedule: 매일 03:00 UTC (= 한국 12:00 KST)
   - HTTP Method: POST
   - Headers: `x-scheduler-secret: {SCHEDULER_SECRET 값}`
4. Enable → Save

- [ ] **Step 2: 첫 번째 실행 결과 확인**

cron-job.org → Cronjob History → 200 OK 확인
