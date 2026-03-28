# Refresh Token Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** refresh 엔드포인트가 accessToken과 함께 새 refreshToken을 발급하고, 기존 토큰을 revoke하도록 수정한다.

**Architecture:** 백엔드 `refresh` 핸들러에서 기존 refreshToken을 revoked=true로 마킹하고 새 refreshToken을 DB에 삽입한다. 응답에 `{ accessToken, refreshToken }` 둘 다 포함. 프론트 인터셉터는 응답의 새 refreshToken으로 store를 업데이트한다.

**Tech Stack:** Node.js/Express, pg, jsonwebtoken, axios (frontend)

---

### Task 1: 백엔드 refresh 엔드포인트 — 토큰 로테이션

**Files:**
- Modify: `server/src/controllers/authController.js` (refresh 함수)

- [ ] **Step 1: 테스트 파일 작성**

`server/tests/auth.test.js` 파일 생성:

```js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signRefreshToken } = require('../src/utils/jwt');

let userId, refreshToken;

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE kakao_id = 'auth_rotation_test'`);
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('auth_rotation_test', 'RotationUser') RETURNING id`
  );
  userId = user.rows[0].id;
  refreshToken = signRefreshToken({ userId, role: 'user' });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, refreshToken, expiresAt]
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
});

test('refresh 성공 시 새 accessToken과 새 refreshToken 반환', async () => {
  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  expect(res.status).toBe(200);
  expect(res.body.accessToken).toBeDefined();
  expect(res.body.refreshToken).toBeDefined();
  expect(res.body.refreshToken).not.toBe(refreshToken);
});

test('기존 refreshToken은 로테이션 후 재사용 불가 (401)', async () => {
  // 첫 번째 refresh로 토큰 로테이션
  const first = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  expect(first.status).toBe(200);

  // 기존 토큰으로 재시도 → 401
  const second = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken });
  expect(second.status).toBe(401);
});

test('유효하지 않은 refreshToken → 401', async () => {
  const res = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: 'invalid.token.here' });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd server && npx jest tests/auth.test.js --runInBand
```

Expected: `refresh 성공 시 새 accessToken과 새 refreshToken 반환` FAIL (응답에 refreshToken 없음)

- [ ] **Step 3: authController.js의 refresh 함수 수정**

`server/src/controllers/authController.js`에서 `refresh` 함수를 아래로 교체:

```js
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const result = await pool.query(
      `SELECT id FROM refresh_tokens
       WHERE token = $1 AND revoked = false AND expires_at > NOW()`,
      [refreshToken]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const newAccessToken = signAccessToken({ userId: decoded.userId, role: decoded.role });
    const newRefreshToken = signRefreshToken({ userId: decoded.userId, role: decoded.role });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token = $1`, [refreshToken]);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [decoded.userId, newRefreshToken, expiresAt]
    );

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd server && npx jest tests/auth.test.js --runInBand
```

Expected: 3개 테스트 모두 PASS

- [ ] **Step 5: 전체 테스트 — 기존 테스트 깨지지 않음 확인**

```bash
cd server && npm test
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
git add server/src/controllers/authController.js server/tests/auth.test.js
git commit -m "feat: implement refresh token rotation"
```

---

### Task 2: 프론트엔드 인터셉터 — 새 refreshToken 저장

**Files:**
- Modify: `client/src/api/client.js` (response interceptor)

- [ ] **Step 1: client.js 인터셉터 수정**

`client/src/api/client.js`의 `setTokens` 호출 라인을 수정:

```js
// 기존
setTokens(res.data.accessToken, refreshToken);

// 변경 후
setTokens(res.data.accessToken, res.data.refreshToken ?? refreshToken);
```

`res.data.refreshToken`이 있으면 새 토큰으로, 없으면 기존 유지 (하위 호환 방어).

- [ ] **Step 2: 커밋**

```bash
git add client/src/api/client.js
git commit -m "feat: update client interceptor to store rotated refresh token"
```
