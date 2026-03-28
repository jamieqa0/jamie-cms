# Phase 2 Admin Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민 수납 통계 API, 미수납 조회/재청구 API, 시연용 스케줄러 엔드포인트, 대시보드 UI 개편을 구현한다.

**Architecture:** 기존 `adminController.js`에 4개 함수(getStats, getUnpaid, retryBilling, adminRunScheduler)를 추가하고 `admin.js` 라우터에 등록. 프론트엔드는 `admin.js` API 함수 4개 추가 후 `AdminDashboard.jsx`를 레이아웃 B(우측 통계 패널)로 재구성.

**Tech Stack:** Node.js, Express, PostgreSQL(pg), Jest, Supertest, React 19, Axios

---

## 파일 구조

| 작업 | 파일 |
|------|------|
| Create | `server/tests/admin.test.js` |
| Modify | `server/src/controllers/adminController.js` |
| Modify | `server/src/routes/admin.js` |
| Modify | `client/src/api/admin.js` |
| Modify | `client/src/pages/admin/AdminDashboard.jsx` |

---

## Task 1: 어드민 API 테스트 작성 (실패 확인)

**Files:**
- Create: `server/tests/admin.test.js`

- [ ] **Step 1: 테스트 파일 생성**

`server/tests/admin.test.js` 생성:

```js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let adminToken, adminId;
let userId, accountId, productId, subscriptionId, billingLogId, collectionAccountId;

beforeAll(async () => {
  // 어드민 유저
  await pool.query(`DELETE FROM users WHERE kakao_id = 'admin_test_999'`);
  const admin = await pool.query(
    `INSERT INTO users (kakao_id, nickname, role) VALUES ('admin_test_999', 'AdminTest', 'admin') RETURNING id`
  );
  adminId = admin.rows[0].id;
  adminToken = signAccessToken({ userId: adminId, role: 'admin' });

  // 일반 유저
  await pool.query(`DELETE FROM users WHERE kakao_id = 'user_test_999'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('user_test_999', 'UserTest') RETURNING id`
  );
  userId = user.rows[0].id;

  // 개인 계좌
  const acct = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '테스트계좌', 50000) RETURNING id`,
    [userId]
  );
  accountId = acct.rows[0].id;

  // 집금 계좌 확보
  const col = await pool.query(`SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`);
  if (col.rows.length > 0) {
    collectionAccountId = col.rows[0].id;
  } else {
    const sys = await pool.query(`SELECT id FROM users WHERE kakao_id = 'system'`);
    const sysId = sys.rows.length > 0 ? sys.rows[0].id : (
      await pool.query(`INSERT INTO users (kakao_id, nickname, role) VALUES ('system', '시스템', 'admin') RETURNING id`)
    ).rows[0].id;
    const newCol = await pool.query(
      `INSERT INTO accounts (user_id, name, type, balance) VALUES ($1, '집금계좌', 'collection', 0) RETURNING id`,
      [sysId]
    );
    collectionAccountId = newCol.rows[0].id;
  }

  // 상품
  await pool.query(`DELETE FROM products WHERE name = '어드민테스트상품'`);
  const prod = await pool.query(
    `INSERT INTO products (name, category, amount, billing_day) VALUES ('어드민테스트상품', 'etc', 10000, 15) RETURNING id`
  );
  productId = prod.rows[0].id;

  // 구독
  const sub = await pool.query(
    `INSERT INTO subscriptions (user_id, product_id, account_id) VALUES ($1, $2, $3) RETURNING id`,
    [userId, productId, accountId]
  );
  subscriptionId = sub.rows[0].id;

  // 실패 billing_log
  const log = await pool.query(
    `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status, reason)
     VALUES ($1, $2, $3, 10000, 'failed', '잔액 부족') RETURNING id`,
    [subscriptionId, productId, accountId]
  );
  billingLogId = log.rows[0].id;

  // 성공 billing_log (이번 달)
  await pool.query(
    `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
     VALUES ($1, $2, $3, 10000, 'success')`,
    [subscriptionId, productId, accountId]
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);
  await pool.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [adminId, userId]);
});

// --- Stats ---

test('GET /api/admin/stats - 이번 달 수납 통계 반환', async () => {
  const res = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('successRate');
  expect(res.body).toHaveProperty('totalAmount');
  expect(res.body).toHaveProperty('failCount');
  expect(res.body).toHaveProperty('successCount');
  expect(res.body).toHaveProperty('month');
  expect(res.body.successCount).toBeGreaterThanOrEqual(1);
  expect(res.body.failCount).toBeGreaterThanOrEqual(1);
  expect(typeof res.body.successRate).toBe('number');
});

test('GET /api/admin/stats - 일반 유저 접근 불가 (403)', async () => {
  const userToken = signAccessToken({ userId, role: 'user' });
  const res = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(403);
});

// --- Unpaid ---

test('GET /api/admin/unpaid - 실패 billing_logs 반환', async () => {
  const res = await request(app)
    .get('/api/admin/unpaid')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  const found = res.body.find(r => r.id === billingLogId);
  expect(found).toBeDefined();
  expect(found.nickname).toBe('UserTest');
  expect(found.product_name).toBe('어드민테스트상품');
  expect(found.reason).toBe('잔액 부족');
});

// --- Retry ---

test('POST /api/admin/unpaid/:id/retry - 잔액 부족 시 400', async () => {
  await pool.query(`UPDATE accounts SET balance = 0 WHERE id = $1`, [accountId]);
  const res = await request(app)
    .post(`/api/admin/unpaid/${billingLogId}/retry`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('잔액 부족');
});

test('POST /api/admin/unpaid/:id/retry - 잔액 충분 시 재청구 성공', async () => {
  await pool.query(`UPDATE accounts SET balance = 50000 WHERE id = $1`, [accountId]);
  const res = await request(app)
    .post(`/api/admin/unpaid/${billingLogId}/retry`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('재청구 완료');

  const acct = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
  expect(Number(acct.rows[0].balance)).toBe(40000);
});

// --- Admin Scheduler ---

test('POST /api/admin/scheduler/run - 어드민 JWT로 자동이체 실행', async () => {
  const res = await request(app)
    .post('/api/admin/scheduler/run')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ day: 99 }); // billing_day=99인 구독 없으므로 0건 처리
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('AutoDebit complete');
  expect(res.body.day).toBe(99);
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms\server" && npx jest tests/admin.test.js --runInBand
```

Expected: 모든 테스트 FAIL (엔드포인트 미존재)

---

## Task 2: 어드민 컨트롤러 함수 추가

**Files:**
- Modify: `server/src/controllers/adminController.js`

- [ ] **Step 1: adminController.js 하단에 4개 함수 추가**

기존 `module.exports` 줄을 찾아 전체를 아래로 교체:

```js
const { runAutoDebit } = require('../scheduler/autoDebit');

const getStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'success') AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS fail_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS total_amount
      FROM billing_logs
      WHERE DATE_TRUNC('month', executed_at) = DATE_TRUNC('month', NOW())
    `);
    const { success_count, fail_count, total_amount } = result.rows[0];
    const successCount = Number(success_count);
    const failCount = Number(fail_count);
    const total = successCount + failCount;
    const successRate = total === 0 ? 0 : Math.round((successCount / total) * 1000) / 10;
    res.json({
      successRate,
      totalAmount: Number(total_amount),
      failCount,
      successCount,
      month: new Date().toISOString().slice(0, 7),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const getUnpaid = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bl.id, bl.subscription_id, bl.account_id, bl.product_id,
             bl.amount, bl.reason, bl.executed_at,
             u.nickname, p.name AS product_name
      FROM billing_logs bl
      JOIN subscriptions s ON bl.subscription_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN products p ON bl.product_id = p.id
      WHERE bl.status = 'failed'
      ORDER BY bl.executed_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

const retryBilling = async (req, res) => {
  try {
    const logResult = await pool.query(
      `SELECT bl.id, bl.subscription_id, bl.product_id, bl.amount, s.account_id
       FROM billing_logs bl
       JOIN subscriptions s ON bl.subscription_id = s.id
       WHERE bl.id = $1 AND bl.status = 'failed'`,
      [req.params.id]
    );
    if (!logResult.rows[0]) return res.status(404).json({ error: '미수납 내역을 찾을 수 없습니다.' });

    const { subscription_id, product_id, amount, account_id } = logResult.rows[0];

    const collectionRes = await pool.query(`SELECT id FROM accounts WHERE type = 'collection' LIMIT 1`);
    if (!collectionRes.rows[0]) return res.status(500).json({ error: '집금 계좌가 존재하지 않습니다.' });
    const collectionAccountId = collectionRes.rows[0].id;

    const client = await pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');

      // 잠금 순서: 개인 계좌 → 집금 계좌 (데드락 방지)
      const acct = await client.query(
        `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [account_id]
      );
      await client.query(`SELECT id FROM accounts WHERE id = $1 FOR UPDATE`, [collectionAccountId]);

      if (!acct.rows[0]) throw new Error('계좌를 찾을 수 없습니다.');
      if (Number(acct.rows[0].balance) < amount) {
        await client.query('ROLLBACK');
        committed = true;
        return res.status(400).json({ error: '잔액 부족' });
      }

      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amount, account_id]);
      await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amount, collectionAccountId]);
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'auto_debit', $2, '재청구')`,
        [account_id, amount]
      );
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'deposit', $2, '재청구 수납')`,
        [collectionAccountId, amount]
      );
      await client.query(
        `INSERT INTO billing_logs (subscription_id, product_id, account_id, amount, status)
         VALUES ($1, $2, $3, $4, 'success')`,
        [subscription_id, product_id, account_id, amount]
      );

      await client.query('COMMIT');
      committed = true;
      res.json({ message: '재청구 완료', status: 'success' });
    } catch (err) {
      if (!committed) {
        try { await client.query('ROLLBACK'); } catch (_) {}
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Admin Retry] Error:', err);
    res.status(500).json({ error: '재청구 중 오류가 발생했습니다.' });
  }
};

const adminRunScheduler = async (req, res) => {
  const day = req.body?.day ?? new Date().getDate();
  try {
    await runAutoDebit(day);
    res.json({ message: 'AutoDebit complete', day });
  } catch (err) {
    console.error('[Admin Scheduler] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUsers, getBillingLogs, getAdminProducts, getAdminProduct,
  createProduct, updateProduct, deleteProduct,
  getStats, getUnpaid, retryBilling, adminRunScheduler,
};
```

---

## Task 3: 어드민 라우트 등록

**Files:**
- Modify: `server/src/routes/admin.js`

- [ ] **Step 1: admin.js에 4개 라우트 추가**

기존 내용을 아래로 전체 교체:

```js
const router = require('express').Router();
const auth = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const c = require('../controllers/adminController');

router.use(auth, requireAdmin);

router.get('/users', c.getUsers);
router.get('/transfers', c.getBillingLogs);
router.get('/products', c.getAdminProducts);
router.get('/products/:id', c.getAdminProduct);
router.post('/products', c.createProduct);
router.put('/products/:id', c.updateProduct);
router.delete('/products/:id', c.deleteProduct);

router.get('/stats', c.getStats);
router.get('/unpaid', c.getUnpaid);
router.post('/unpaid/:id/retry', c.retryBilling);
router.post('/scheduler/run', c.adminRunScheduler);

module.exports = router;
```

- [ ] **Step 2: 테스트 실행 (통과 확인)**

```bash
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms\server" && npx jest tests/admin.test.js --runInBand
```

Expected: 6개 테스트 모두 PASS

- [ ] **Step 3: 전체 테스트 실행**

```bash
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms\server" && npm test
```

Expected: 전체 PASS

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms" && git add server/src/controllers/adminController.js server/src/routes/admin.js server/tests/admin.test.js && git commit -m "feat: add admin stats, unpaid, retry, and scheduler endpoints"
```

---

## Task 4: 프론트엔드 API 함수 추가 및 대시보드 UI 개편

**Files:**
- Modify: `client/src/api/admin.js`
- Modify: `client/src/pages/admin/AdminDashboard.jsx`

- [ ] **Step 1: client/src/api/admin.js에 4개 함수 추가**

기존 파일 끝에 추가:

```js
export const getAdminStats = () => api.get('/admin/stats');
export const getUnpaid = () => api.get('/admin/unpaid');
export const retryBilling = (id) => api.post(`/admin/unpaid/${id}/retry`);
export const runAdminScheduler = (day) => api.post('/admin/scheduler/run', { day });
```

- [ ] **Step 2: AdminDashboard.jsx 전체 교체**

```jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAdminUsers, getAdminProducts, getAdminTransfers, getAdminStats, runAdminScheduler } from '../../api/admin';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ users: 0, products: 0, transfers: 0 });
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Promise.all([getAdminUsers(), getAdminProducts(), getAdminTransfers()]).then(
      ([u, p, t]) => setCounts({ users: u.data.length, products: p.data.length, transfers: t.data.length })
    );
    getAdminStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const handleRunScheduler = async () => {
    if (!confirm(`오늘(${new Date().getDate()}일) 자동이체를 실행할까요?`)) return;
    setRunning(true);
    try {
      const today = new Date().getDate();
      await runAdminScheduler(today);
      alert('자동이체 실행 완료!');
      getAdminStats().then(r => setStats(r.data)).catch(() => {});
    } catch (e) {
      alert(e.response?.data?.error || '실행 실패');
    }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">어드민 대시보드</h1>
      <div className="flex gap-4 items-start">
        {/* 왼쪽: 기본 카드 + 미수납 바로가기 */}
        <div className="flex-[2] space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '전체 회원', value: counts.users, to: '/admin/users' },
              { label: '등록 상품', value: counts.products, to: '/admin/products' },
              { label: '자동이체 기록', value: counts.transfers, to: '/admin/transfers' },
            ].map(item => (
              <Link key={item.label} to={item.to}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-slate-300 transition">
                <p className="text-slate-500 text-sm">{item.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{item.value}</p>
              </Link>
            ))}
          </div>
          {stats && stats.failCount > 0 && (
            <Link to="/admin/transfers"
              className="flex items-center justify-between bg-red-50 border border-red-200 rounded-2xl p-5 hover:border-red-400 transition">
              <div>
                <p className="text-red-600 text-sm font-semibold">⚠ 미수납 내역</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{stats.failCount}건 미처리</p>
              </div>
              <span className="text-red-400 text-xl">→</span>
            </Link>
          )}
        </div>

        {/* 오른쪽: 통계 + 시연 버튼 */}
        <div className="flex-1 space-y-3">
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
            <p className="text-red-600 text-sm">실패 건수</p>
            <p className="text-3xl font-bold text-red-700 mt-1">
              {stats ? `${stats.failCount}건` : '-'}
            </p>
          </div>
          <button
            onClick={handleRunScheduler}
            disabled={running}
            className="w-full bg-violet-600 text-white py-3 rounded-2xl font-semibold hover:bg-violet-700 transition disabled:opacity-50">
            {running ? '실행 중...' : '▶ 자동이체 실행 (시연)'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 로컬에서 동작 확인**

```bash
# 터미널 1
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms\server" && npm run dev

# 터미널 2
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms\client" && npm run dev
```

브라우저에서 `http://localhost:5173/admin` 접속 후 확인:
- 우측에 수납률·수납액·실패건수 카드 표시
- 실패 건수가 있으면 왼쪽 하단에 미수납 카드 표시
- 자동이체 실행 버튼 클릭 → confirm 후 실행

- [ ] **Step 4: 커밋**

```bash
cd "C:\Users\이유미\Documents\study\jamie-cms\jamie-cms" && git add client/src/api/admin.js client/src/pages/admin/AdminDashboard.jsx && git commit -m "feat: add admin stats UI and demo scheduler button"
```
