# CMS (Cash Management Service) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오 로그인, 가상계좌, 정기결제 상품 자동이체 기능을 갖춘 CMS 풀스택 웹 애플리케이션을 구축한다.

**Architecture:** Express API 서버(Railway)와 React SPA(Vercel)가 분리된 모노레포 구조. Supabase PostgreSQL을 DB로 사용하며, node-cron이 매일 자정 자동이체를 실행한다. 카카오 OAuth 2.0으로 인증하고 JWT(Access 15분 / Refresh 7일)로 세션을 관리한다.

**Tech Stack:** Node.js 20, Express 4, pg (node-postgres), node-cron, jsonwebtoken, helmet, express-rate-limit, express-validator, Jest + Supertest / React 18, Vite, Tailwind CSS, shadcn/ui, Zustand, Axios, React Router v6

---

## 파일 구조 (전체)

```
jamie-cms/
├── server/
│   ├── src/
│   │   ├── app.js                    Express 앱 설정 (미들웨어, 라우트 등록)
│   │   ├── server.js                 서버 시작 진입점 + node-cron 등록
│   │   ├── config/
│   │   │   ├── db.js                 Supabase PostgreSQL 연결 (pg Pool)
│   │   │   └── env.js                환경변수 로드 및 유효성 검사
│   │   ├── middleware/
│   │   │   ├── authenticate.js       JWT 검증 미들웨어
│   │   │   ├── requireAdmin.js       admin role 확인 미들웨어
│   │   │   └── rateLimiter.js        로그인 API rate limit
│   │   ├── routes/
│   │   │   ├── auth.js               /api/auth/*
│   │   │   ├── users.js              /api/users/*
│   │   │   ├── accounts.js           /api/accounts/*
│   │   │   ├── products.js           /api/products/*
│   │   │   ├── subscriptions.js      /api/subscriptions/*
│   │   │   └── admin.js              /api/admin/*
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── usersController.js
│   │   │   ├── accountsController.js
│   │   │   ├── productsController.js
│   │   │   ├── subscriptionsController.js
│   │   │   └── adminController.js
│   │   ├── utils/
│   │   │   └── jwt.js                JWT 발급/검증 헬퍼
│   │   └── scheduler/
│   │       └── autoDebit.js          node-cron 자동이체 잡
│   ├── tests/
│   │   ├── setup.js                  Jest 전역 설정
│   │   ├── auth.test.js
│   │   ├── accounts.test.js
│   │   ├── subscriptions.test.js
│   │   └── scheduler.test.js
│   ├── .env.example
│   ├── package.json
│   └── jest.config.js
│
├── client/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   라우터 설정
│   │   ├── api/
│   │   │   ├── client.js             Axios 인스턴스 + 인터셉터(토큰 갱신)
│   │   │   ├── auth.js
│   │   │   ├── accounts.js
│   │   │   ├── products.js
│   │   │   ├── subscriptions.js
│   │   │   └── admin.js
│   │   ├── store/
│   │   │   └── authStore.js          Zustand 인증 상태
│   │   ├── components/
│   │   │   ├── Layout.jsx            공통 네비게이션 레이아웃
│   │   │   ├── ProtectedRoute.jsx    로그인 필요 라우트
│   │   │   └── AdminRoute.jsx        어드민 전용 라우트
│   │   └── pages/
│   │       ├── Landing.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Products.jsx
│   │       ├── ProductDetail.jsx
│   │       ├── Subscriptions.jsx
│   │       ├── Accounts.jsx
│   │       ├── AccountDetail.jsx
│   │       ├── Profile.jsx
│   │       └── admin/
│   │           ├── AdminDashboard.jsx
│   │           ├── AdminProducts.jsx
│   │           ├── AdminProductForm.jsx
│   │           ├── AdminUsers.jsx
│   │           └── AdminTransfers.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── docs/
    └── superpowers/
        ├── specs/2026-03-27-cms-design.md
        └── plans/2026-03-27-cms-implementation.md
```

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `server/package.json`
- Create: `server/src/config/env.js`
- Create: `server/.env.example`
- Create: `client/package.json`
- Create: `client/vite.config.js`
- Create: `client/tailwind.config.js`

- [ ] **Step 1: server 디렉토리 생성 및 npm 초기화**

```bash
mkdir -p server/src/{config,middleware,routes,controllers,utils,scheduler}
mkdir -p server/tests
cd server
npm init -y
```

- [ ] **Step 2: server 의존성 설치**

```bash
cd server
npm install express pg dotenv jsonwebtoken bcryptjs helmet cors express-rate-limit express-validator node-cron axios
npm install -D jest supertest nodemon
```

- [ ] **Step 3: `server/package.json` scripts 추가**

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand"
  }
}
```

- [ ] **Step 4: `server/jest.config.js` 생성**

```js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
};
```

- [ ] **Step 5: `server/.env.example` 생성**

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_REDIRECT_URI=http://localhost:4000/api/auth/kakao/callback
CLIENT_URL=http://localhost:5173
PORT=4000
```

- [ ] **Step 6: `server/src/config/env.js` 생성**

```js
require('dotenv').config();

const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'KAKAO_CLIENT_ID',
  'KAKAO_REDIRECT_URI',
  'CLIENT_URL',
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing env: ${key}`);
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID,
  KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI,
  CLIENT_URL: process.env.CLIENT_URL,
  PORT: process.env.PORT || 4000,
};
```

- [ ] **Step 7: client 초기화**

```bash
cd ..
npm create vite@latest client -- --template react
cd client
npm install
npm install axios zustand react-router-dom @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 8: `client/tailwind.config.js` 수정**

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 9: shadcn/ui 초기화**

```bash
cd client
npx shadcn@latest init
# 프롬프트: Default style → Slate base color → CSS variables yes
```

- [ ] **Step 10: 커밋**

```bash
cd ..
git init
echo "node_modules/\n.env\ndist/" > .gitignore
git add .
git commit -m "chore: initialize monorepo with server and client"
```

---

## Task 2: Supabase DB 스키마 생성

**Files:**
- Create: `server/src/config/db.js`
- Create: `server/supabase/schema.sql`

- [ ] **Step 1: Supabase 프로젝트 생성**

Supabase 대시보드(supabase.com) 접속 → New Project → 이름: `jamie-cms`
Settings → Database → Connection string(URI) 복사 → `server/.env`의 `DATABASE_URL`에 붙여넣기

- [ ] **Step 2: `server/supabase/schema.sql` 작성**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id VARCHAR UNIQUE NOT NULL,
  nickname VARCHAR NOT NULL,
  email VARCHAR,
  role VARCHAR NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'auto_debit')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  description VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  category VARCHAR NOT NULL CHECK (category IN ('delivery', 'rental', 'donation', 'etc')),
  description TEXT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  billing_day INT NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('success', 'failed')),
  reason VARCHAR,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 3: Supabase SQL Editor에서 스키마 실행**

Supabase 대시보드 → SQL Editor → `schema.sql` 내용 붙여넣기 → Run

- [ ] **Step 4: `server/src/config/db.js` 작성**

```js
const { Pool } = require('pg');
const { DATABASE_URL } = require('./env');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('DB pool error:', err);
});

module.exports = pool;
```

- [ ] **Step 5: DB 연결 테스트**

```bash
cd server
node -e "require('./src/config/db').query('SELECT 1').then(() => console.log('DB connected')).catch(console.error)"
```

Expected: `DB connected`

- [ ] **Step 6: 커밋**

```bash
git add server/supabase/schema.sql server/src/config/
git commit -m "chore: add database schema and connection pool"
```

---

## Task 3: Express 앱 기본 구조

**Files:**
- Create: `server/src/app.js`
- Create: `server/src/server.js`
- Create: `server/tests/setup.js`

- [ ] **Step 1: `server/src/app.js` 작성**

```js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { CLIENT_URL } = require('./config/env');

const app = express();

app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

// 라우트 (이후 태스크에서 추가)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
```

- [ ] **Step 2: `server/src/server.js` 작성**

```js
const app = require('./app');
const { PORT } = require('./config/env');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 3: `server/tests/setup.js` 작성**

```js
const pool = require('../src/config/db');

afterAll(async () => {
  await pool.end();
});
```

- [ ] **Step 4: 헬스체크 테스트 작성**

```bash
# server/tests/health.test.js
```

```js
const request = require('supertest');
const app = require('../src/app');

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});
```

- [ ] **Step 5: 테스트 실행**

```bash
cd server
npm test -- tests/health.test.js
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add server/src/app.js server/src/server.js server/tests/
git commit -m "feat: add express app skeleton with health check"
```

---

## Task 4: JWT 유틸리티

**Files:**
- Create: `server/src/utils/jwt.js`
- Create: `server/src/middleware/authenticate.js`
- Create: `server/src/middleware/requireAdmin.js`

- [ ] **Step 1: JWT 유틸 테스트 작성**

```js
// server/tests/jwt.test.js
const { signAccessToken, signRefreshToken, verifyAccessToken } = require('../src/utils/jwt');

test('access token 발급 및 검증', () => {
  const payload = { userId: 'test-id', role: 'user' };
  const token = signAccessToken(payload);
  const decoded = verifyAccessToken(token);
  expect(decoded.userId).toBe('test-id');
  expect(decoded.role).toBe('user');
});

test('만료된 토큰은 에러 발생', () => {
  expect(() => verifyAccessToken('invalid.token.here')).toThrow();
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npm test -- tests/jwt.test.js
```

Expected: FAIL (jwt.js not found)

- [ ] **Step 3: `server/src/utils/jwt.js` 작성**

```js
const jwt = require('jsonwebtoken');
const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } = require('../config/env');

const signAccessToken = (payload) =>
  jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });

const signRefreshToken = (payload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

const verifyAccessToken = (token) =>
  jwt.verify(token, JWT_ACCESS_SECRET);

const verifyRefreshToken = (token) =>
  jwt.verify(token, JWT_REFRESH_SECRET);

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
```

- [ ] **Step 4: 테스트 실행 (통과 확인)**

```bash
npm test -- tests/jwt.test.js
```

Expected: PASS

- [ ] **Step 5: `server/src/middleware/authenticate.js` 작성**

```js
const { verifyAccessToken } = require('../utils/jwt');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = verifyAccessToken(auth.split(' ')[1]);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

- [ ] **Step 6: `server/src/middleware/requireAdmin.js` 작성**

```js
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
```

- [ ] **Step 7: 커밋**

```bash
git add server/src/utils/jwt.js server/src/middleware/ server/tests/jwt.test.js
git commit -m "feat: add JWT utilities and auth middleware"
```

---

## Task 5: 카카오 OAuth + 인증 API

**Files:**
- Create: `server/src/controllers/authController.js`
- Create: `server/src/routes/auth.js`
- Modify: `server/src/app.js`
- Create: `server/src/middleware/rateLimiter.js`

- [ ] **Step 1: 카카오 개발자 콘솔 설정**

1. https://developers.kakao.com 접속 → 내 애플리케이션 → 애플리케이션 추가
2. 앱 이름: `jamie-cms`
3. 앱 키 → REST API 키 복사 → `server/.env`의 `KAKAO_CLIENT_ID`에 입력
4. 카카오 로그인 → 활성화
5. Redirect URI 등록: `http://localhost:4000/api/auth/kakao/callback`
6. 동의항목 → 닉네임, 이메일(선택) 설정

- [ ] **Step 2: `server/src/middleware/rateLimiter.js` 작성**

```js
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1분
  max: 5,
  message: { error: 'Too many login attempts. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter };
```

- [ ] **Step 3: `server/src/controllers/authController.js` 작성**

```js
const axios = require('axios');
const pool = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI, CLIENT_URL } = require('../config/env');

// 카카오 로그인 페이지로 리다이렉트
const kakaoLogin = (req, res) => {
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
  res.redirect(url);
};

// 카카오 콜백: 인가코드 → 카카오 토큰 → 사용자 정보 → JWT 발급
const kakaoCallback = async (req, res) => {
  const { code } = req.query;
  try {
    // 1. 인가코드로 카카오 토큰 교환
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID,
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      },
    });
    const kakaoAccessToken = tokenRes.data.access_token;

    // 2. 카카오 사용자 정보 조회
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    const kakaoId = String(userRes.data.id);
    const nickname = userRes.data.kakao_account?.profile?.nickname || 'User';
    const email = userRes.data.kakao_account?.email || null;

    // 3. DB upsert
    const result = await pool.query(
      `INSERT INTO users (kakao_id, nickname, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (kakao_id) DO UPDATE SET nickname = $2, email = $3
       RETURNING id, role`,
      [kakaoId, nickname, email]
    );
    const user = result.rows[0];

    // 4. JWT 발급
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // 5. Refresh Token DB 저장
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    // 6. 단명 코드를 서버 메모리에 저장 후 프론트엔드로 코드만 전달 (URL 토큰 노출 방지)
    const tempCode = require('crypto').randomBytes(16).toString('hex');
    // 서버 Map에 30초 유효 코드 저장
    global.authCodes = global.authCodes || new Map();
    global.authCodes.set(tempCode, { accessToken, refreshToken });
    setTimeout(() => global.authCodes.delete(tempCode), 30000);

    res.redirect(`${CLIENT_URL}/auth/callback?code=${tempCode}`);
  } catch (err) {
    console.error('Kakao callback error:', err);
    res.redirect(`${CLIENT_URL}?error=login_failed`);
  }
};

// Access Token 재발급
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = verifyRefreshToken(refreshToken);

    // DB에서 유효한 토큰인지 확인
    const result = await pool.query(
      `SELECT id FROM refresh_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()`,
      [refreshToken]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = signAccessToken({ userId: decoded.userId, role: decoded.role });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// 로그아웃 (Refresh Token 무효화)
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query(`UPDATE refresh_tokens SET revoked = true WHERE token = $1`, [refreshToken]);
  }
  res.json({ message: 'Logged out' });
};

module.exports = { kakaoLogin, kakaoCallback, refresh, logout };
```

- [ ] **Step 4: `server/src/routes/auth.js` 작성**

```js
const router = require('express').Router();
const { loginLimiter } = require('../middleware/rateLimiter');
const { kakaoLogin, kakaoCallback, refresh, logout } = require('../controllers/authController');

router.get('/kakao', loginLimiter, kakaoLogin);
router.get('/kakao/callback', kakaoCallback);
// 임시 코드 → 실제 토큰 교환 (URL에 JWT 직접 노출 방지)
router.get('/token', (req, res) => {
  const { code } = req.query;
  const data = global.authCodes?.get(code);
  if (!data) return res.status(400).json({ error: 'Invalid or expired code' });
  global.authCodes.delete(code);
  res.json(data);
});
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
```

- [ ] **Step 5: `server/src/app.js`에 라우트 등록**

```js
// app.js에 추가 (헬스체크 아래)
app.use('/api/auth', require('./routes/auth'));
```

- [ ] **Step 6: 서버 실행 후 수동 테스트**

```bash
npm run dev
# 브라우저에서 http://localhost:4000/api/auth/kakao 접속
# 카카오 로그인 화면이 뜨면 성공
```

- [ ] **Step 7: 커밋**

```bash
git add server/src/controllers/authController.js server/src/routes/auth.js server/src/middleware/rateLimiter.js server/src/app.js
git commit -m "feat: add kakao oauth login and JWT auth endpoints"
```

---

## Task 6: 사용자 + 계좌 API

**Files:**
- Create: `server/src/controllers/usersController.js`
- Create: `server/src/controllers/accountsController.js`
- Create: `server/src/routes/users.js`
- Create: `server/src/routes/accounts.js`
- Create: `server/tests/accounts.test.js`

- [ ] **Step 1: 계좌 API 테스트 작성**

```js
// server/tests/accounts.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let token, userId, accountId;

beforeAll(async () => {
  // 테스트 유저 생성
  const result = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('test_kakao_999', 'TestUser') RETURNING id, role`
  );
  userId = result.rows[0].id;
  token = signAccessToken({ userId, role: 'user' });
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
});

test('POST /api/accounts - 계좌 생성', async () => {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '생활비 계좌' });
  expect(res.status).toBe(201);
  expect(res.body.name).toBe('생활비 계좌');
  expect(res.body.balance).toBe(0);
  accountId = res.body.id;
});

test('GET /api/accounts - 계좌 목록 조회', async () => {
  const res = await request(app)
    .get('/api/accounts')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(0);
});

test('POST /api/accounts/:id/deposit - 입금', async () => {
  const res = await request(app)
    .post(`/api/accounts/${accountId}/deposit`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 50000 });
  expect(res.status).toBe(200);
  expect(res.body.balance).toBe(50000);
});

test('POST /api/accounts/:id/withdraw - 잔액 초과 출금 거부', async () => {
  const res = await request(app)
    .post(`/api/accounts/${accountId}/withdraw`)
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 100000 });
  expect(res.status).toBe(400);
});

test('타인 계좌 접근 금지 (IDOR 방어)', async () => {
  const otherResult = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('other_kakao_999', 'Other') RETURNING id, role`
  );
  const otherToken = signAccessToken({ userId: otherResult.rows[0].id, role: 'user' });
  const res = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set('Authorization', `Bearer ${otherToken}`);
  expect(res.status).toBe(403);
  await pool.query(`DELETE FROM users WHERE id = $1`, [otherResult.rows[0].id]);
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npm test -- tests/accounts.test.js
```

Expected: FAIL (routes not registered)

- [ ] **Step 3: `server/src/controllers/usersController.js` 작성**

```js
const pool = require('../config/db');

const getMe = async (req, res) => {
  const result = await pool.query(`SELECT id, nickname, email, role, created_at FROM users WHERE id = $1`, [req.user.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
};

const updateMe = async (req, res) => {
  const { nickname } = req.body;
  if (!nickname) return res.status(400).json({ error: 'nickname is required' });
  const result = await pool.query(
    `UPDATE users SET nickname = $1 WHERE id = $2 RETURNING id, nickname, email, role`,
    [nickname, req.user.userId]
  );
  res.json(result.rows[0]);
};

module.exports = { getMe, updateMe };
```

- [ ] **Step 4: `server/src/controllers/accountsController.js` 작성**

```js
const pool = require('../config/db');

const getAccounts = async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.userId]
  );
  res.json(result.rows);
};

const createAccount = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    `INSERT INTO accounts (user_id, name) VALUES ($1, $2) RETURNING *`,
    [req.user.userId, name]
  );
  res.status(201).json(result.rows[0]);
};

const getAccount = async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM accounts WHERE id = $1`,
    [req.params.id]
  );
  const account = result.rows[0];
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  const txResult = await pool.query(
    `SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json({ ...account, transactions: txResult.rows });
};

const deposit = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const acct = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
  if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
  if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING *`,
      [amount, req.params.id]
    );
    await client.query(
      `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'deposit', $2, '입금')`,
      [req.params.id, amount]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const withdraw = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const acct = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
  if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
  if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
  if (acct.rows[0].balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING *`,
      [amount, req.params.id]
    );
    await client.query(
      `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'withdrawal', $2, '출금')`,
      [req.params.id, amount]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteAccount = async (req, res) => {
  const acct = await pool.query(`SELECT * FROM accounts WHERE id = $1`, [req.params.id]);
  if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
  if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  // 활성 구독이 있으면 삭제 불가
  const subs = await pool.query(
    `SELECT id FROM subscriptions WHERE account_id = $1 AND status = 'active'`,
    [req.params.id]
  );
  if (subs.rows.length > 0) {
    return res.status(400).json({ error: 'Cannot delete account with active subscriptions' });
  }

  await pool.query(`DELETE FROM accounts WHERE id = $1`, [req.params.id]);
  res.status(204).send();
};

module.exports = { getAccounts, createAccount, getAccount, deposit, withdraw, deleteAccount };
```

- [ ] **Step 5: 라우트 파일 작성 및 app.js 등록**

```js
// server/src/routes/users.js
const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { getMe, updateMe } = require('../controllers/usersController');
router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);
module.exports = router;

// server/src/routes/accounts.js
const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/accountsController');
router.get('/', auth, c.getAccounts);
router.post('/', auth, c.createAccount);
router.get('/:id', auth, c.getAccount);
router.post('/:id/deposit', auth, c.deposit);
router.post('/:id/withdraw', auth, c.withdraw);
router.delete('/:id', auth, c.deleteAccount);
module.exports = router;
```

```js
// app.js에 추가
app.use('/api/users', require('./routes/users'));
app.use('/api/accounts', require('./routes/accounts'));
```

- [ ] **Step 6: 테스트 실행 (통과 확인)**

```bash
npm test -- tests/accounts.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 7: 커밋**

```bash
git add server/src/controllers/usersController.js server/src/controllers/accountsController.js server/src/routes/users.js server/src/routes/accounts.js server/src/app.js server/tests/accounts.test.js
git commit -m "feat: add users and accounts API with IDOR protection"
```

---

## Task 7: 상품 + 구독 API

**Files:**
- Create: `server/src/controllers/productsController.js`
- Create: `server/src/controllers/subscriptionsController.js`
- Create: `server/src/routes/products.js`
- Create: `server/src/routes/subscriptions.js`
- Create: `server/tests/subscriptions.test.js`

- [ ] **Step 1: 구독 API 테스트 작성**

```js
// server/tests/subscriptions.test.js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let token, userId, accountId, productId, subscriptionId;

beforeAll(async () => {
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('sub_test_kakao', 'SubUser') RETURNING id, role`
  );
  userId = user.rows[0].id;
  token = signAccessToken({ userId, role: 'user' });

  const account = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '테스트 계좌', 100000) RETURNING id`,
    [userId]
  );
  accountId = account.rows[0].id;

  const product = await pool.query(
    `INSERT INTO products (name, category, amount, billing_day) VALUES ('우유배달', 'delivery', 30000, 5) RETURNING id`
  );
  productId = product.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
});

test('POST /api/subscriptions - 상품 가입', async () => {
  const res = await request(app)
    .post('/api/subscriptions')
    .set('Authorization', `Bearer ${token}`)
    .send({ product_id: productId, account_id: accountId });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe('active');
  subscriptionId = res.body.id;
});

test('GET /api/subscriptions - 구독 목록 조회', async () => {
  const res = await request(app)
    .get('/api/subscriptions')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(1);
});

test('PUT /api/subscriptions/:id - 구독 일시정지', async () => {
  const res = await request(app)
    .put(`/api/subscriptions/${subscriptionId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'paused' });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('paused');
});

test('DELETE /api/subscriptions/:id - 구독 해지', async () => {
  const res = await request(app)
    .delete(`/api/subscriptions/${subscriptionId}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('cancelled');
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npm test -- tests/subscriptions.test.js
```

Expected: FAIL

- [ ] **Step 3: `server/src/controllers/productsController.js` 작성**

```js
const pool = require('../config/db');

const getProducts = async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC`
  );
  res.json(result.rows);
};

const getProduct = async (req, res) => {
  const result = await pool.query(`SELECT * FROM products WHERE id = $1 AND is_active = true`, [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
};

module.exports = { getProducts, getProduct };
```

- [ ] **Step 4: `server/src/controllers/subscriptionsController.js` 작성**

```js
const pool = require('../config/db');

const getSubscriptions = async (req, res) => {
  const result = await pool.query(
    `SELECT s.*, p.name as product_name, p.amount, p.billing_day, p.category
     FROM subscriptions s
     JOIN products p ON s.product_id = p.id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [req.user.userId]
  );
  res.json(result.rows);
};

const createSubscription = async (req, res) => {
  const { product_id, account_id } = req.body;
  if (!product_id || !account_id) return res.status(400).json({ error: 'product_id and account_id are required' });

  // 계좌 소유권 확인
  const acct = await pool.query(`SELECT user_id FROM accounts WHERE id = $1`, [account_id]);
  if (!acct.rows[0]) return res.status(404).json({ error: 'Account not found' });
  if (acct.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  // 상품 존재 확인
  const prod = await pool.query(`SELECT id FROM products WHERE id = $1 AND is_active = true`, [product_id]);
  if (!prod.rows[0]) return res.status(404).json({ error: 'Product not found' });

  // 중복 가입 방지
  const dup = await pool.query(
    `SELECT id FROM subscriptions WHERE user_id = $1 AND product_id = $2 AND status = 'active'`,
    [req.user.userId, product_id]
  );
  if (dup.rows.length > 0) return res.status(409).json({ error: 'Already subscribed' });

  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, product_id, account_id) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.userId, product_id, account_id]
  );
  res.status(201).json(result.rows[0]);
};

const updateSubscription = async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const sub = await pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [req.params.id]);
  if (!sub.rows[0]) return res.status(404).json({ error: 'Not found' });
  if (sub.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  const result = await pool.query(
    `UPDATE subscriptions SET status = $1 WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );
  res.json(result.rows[0]);
};

const cancelSubscription = async (req, res) => {
  const sub = await pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [req.params.id]);
  if (!sub.rows[0]) return res.status(404).json({ error: 'Not found' });
  if (sub.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

  const result = await pool.query(
    `UPDATE subscriptions SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  res.json(result.rows[0]);
};

module.exports = { getSubscriptions, createSubscription, updateSubscription, cancelSubscription };
```

- [ ] **Step 5: 라우트 작성 및 app.js 등록**

```js
// server/src/routes/products.js
const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { getProducts, getProduct } = require('../controllers/productsController');
router.get('/', auth, getProducts);
router.get('/:id', auth, getProduct);
module.exports = router;

// server/src/routes/subscriptions.js
const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/subscriptionsController');
router.get('/', auth, c.getSubscriptions);
router.post('/', auth, c.createSubscription);
router.put('/:id', auth, c.updateSubscription);
router.delete('/:id', auth, c.cancelSubscription);
module.exports = router;
```

```js
// app.js에 추가
app.use('/api/products', require('./routes/products'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
```

- [ ] **Step 6: 테스트 실행 (통과 확인)**

```bash
npm test -- tests/subscriptions.test.js
```

Expected: PASS (4 tests)

- [ ] **Step 7: 커밋**

```bash
git add server/src/controllers/productsController.js server/src/controllers/subscriptionsController.js server/src/routes/products.js server/src/routes/subscriptions.js server/src/app.js server/tests/subscriptions.test.js
git commit -m "feat: add products and subscriptions API"
```

---

## Task 8: 어드민 API

**Files:**
- Create: `server/src/controllers/adminController.js`
- Create: `server/src/routes/admin.js`

- [ ] **Step 1: `server/src/controllers/adminController.js` 작성**

```js
const pool = require('../config/db');

const getUsers = async (req, res) => {
  const result = await pool.query(
    `SELECT id, nickname, email, role, created_at FROM users ORDER BY created_at DESC`
  );
  res.json(result.rows);
};

const getBillingLogs = async (req, res) => {
  const result = await pool.query(
    `SELECT bl.*, p.name as product_name, u.nickname
     FROM billing_logs bl
     JOIN products p ON bl.product_id = p.id
     JOIN subscriptions s ON bl.subscription_id = s.id
     JOIN users u ON s.user_id = u.id
     ORDER BY bl.executed_at DESC
     LIMIT 100`
  );
  res.json(result.rows);
};

const getAdminProducts = async (req, res) => {
  const result = await pool.query(`SELECT * FROM products ORDER BY created_at DESC`);
  res.json(result.rows);
};

const getAdminProduct = async (req, res) => {
  const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
};

const createProduct = async (req, res) => {
  const { name, category, description, amount, billing_day } = req.body;
  if (!name || !category || !amount || !billing_day) {
    return res.status(400).json({ error: 'name, category, amount, billing_day are required' });
  }
  const result = await pool.query(
    `INSERT INTO products (name, category, description, amount, billing_day) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, category, description, amount, billing_day]
  );
  res.status(201).json(result.rows[0]);
};

const updateProduct = async (req, res) => {
  const { name, category, description, amount, billing_day, is_active } = req.body;
  const result = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       category = COALESCE($2, category),
       description = COALESCE($3, description),
       amount = COALESCE($4, amount),
       billing_day = COALESCE($5, billing_day),
       is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [name, category, description, amount, billing_day, is_active, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
};

const deleteProduct = async (req, res) => {
  // 소프트 삭제 (is_active = false)
  const result = await pool.query(
    `UPDATE products SET is_active = false WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.status(204).send();
};

module.exports = { getUsers, getBillingLogs, getAdminProducts, getAdminProduct, createProduct, updateProduct, deleteProduct };
```

- [ ] **Step 2: `server/src/routes/admin.js` 작성**

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

module.exports = router;
```

- [ ] **Step 3: app.js에 등록**

```js
app.use('/api/admin', require('./routes/admin'));
```

- [ ] **Step 4: 어드민 권한 테스트**

```bash
# Postman 또는 curl로 일반 유저 토큰으로 /api/admin/users 접근
curl -H "Authorization: Bearer <user_token>" http://localhost:4000/api/admin/users
# 기대값: 403 Forbidden
```

- [ ] **Step 5: 커밋**

```bash
git add server/src/controllers/adminController.js server/src/routes/admin.js server/src/app.js
git commit -m "feat: add admin API with role-based access control"
```

---

## Task 9: node-cron 자동이체 스케줄러

**Files:**
- Create: `server/src/scheduler/autoDebit.js`
- Modify: `server/src/server.js`
- Create: `server/tests/scheduler.test.js`

- [ ] **Step 1: 스케줄러 테스트 작성**

```js
// server/tests/scheduler.test.js
const pool = require('../src/config/db');
const { runAutoDebit } = require('../src/scheduler/autoDebit');

let userId, accountId, productId, subscriptionId;

beforeAll(async () => {
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('cron_test_kakao', 'CronUser') RETURNING id`
  );
  userId = user.rows[0].id;

  const account = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '자동이체 계좌', 50000) RETURNING id`,
    [userId]
  );
  accountId = account.rows[0].id;

  // billing_day를 고정값 15로 사용하고, runAutoDebit(15)로 직접 주입
  const product = await pool.query(
    `INSERT INTO products (name, category, amount, billing_day) VALUES ('테스트 상품', 'etc', 10000, 15) RETURNING id`
  );
  productId = product.rows[0].id;

  const sub = await pool.query(
    `INSERT INTO subscriptions (user_id, product_id, account_id) VALUES ($1, $2, $3) RETURNING id`,
    [userId, productId, accountId]
  );
  subscriptionId = sub.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
});

test('자동이체 실행 - 잔액 차감 및 로그 기록', async () => {
  await runAutoDebit(15); // billing_day=15 고정 주입으로 날짜 무관하게 테스트

  const account = await pool.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
  expect(Number(account.rows[0].balance)).toBe(40000);

  const log = await pool.query(`SELECT * FROM billing_logs WHERE subscription_id = $1`, [subscriptionId]);
  expect(log.rows[0].status).toBe('success');
});

test('자동이체 실패 - 잔액 부족', async () => {
  // 잔액을 5000으로 낮춤 (상품 금액 10000보다 적음)
  await pool.query(`UPDATE accounts SET balance = 5000 WHERE id = $1`, [accountId]);
  await runAutoDebit(15);

  const log = await pool.query(
    `SELECT * FROM billing_logs WHERE subscription_id = $1 ORDER BY executed_at DESC LIMIT 1`,
    [subscriptionId]
  );
  expect(log.rows[0].status).toBe('failed');
  expect(log.rows[0].reason).toBe('잔액 부족');
});
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

```bash
npm test -- tests/scheduler.test.js
```

Expected: FAIL

- [ ] **Step 3: `server/src/scheduler/autoDebit.js` 작성**

```js
const cron = require('node-cron');
const pool = require('../config/db');

const runAutoDebit = async (targetDay = null) => {
  const today = targetDay ?? new Date().getDate();
  console.log(`[AutoDebit] Running for billing_day=${today}`);

  // 오늘 결제일인 활성 구독 조회
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

      // 잔액 확인
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

      // 잔액 차감
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [row.amount, row.account_id]
      );

      // 거래내역 기록
      await client.query(
        `INSERT INTO transactions (account_id, type, amount, description) VALUES ($1, 'auto_debit', $2, '자동이체')`,
        [row.account_id, row.amount]
      );

      await client.query('COMMIT');

      // 성공 로그
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

const startScheduler = () => {
  // 매일 자정 실행
  cron.schedule('0 0 * * *', runAutoDebit, { timezone: 'Asia/Seoul' });
  console.log('[AutoDebit] Scheduler started');
};

module.exports = { runAutoDebit, startScheduler };
```

- [ ] **Step 4: `server/src/server.js`에 스케줄러 등록**

```js
const app = require('./app');
const { PORT } = require('./config/env');
const { startScheduler } = require('./scheduler/autoDebit');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduler();
});
```

- [ ] **Step 5: 테스트 실행 (통과 확인)**

```bash
npm test -- tests/scheduler.test.js
```

Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add server/src/scheduler/autoDebit.js server/src/server.js server/tests/scheduler.test.js
git commit -m "feat: add node-cron auto-debit scheduler with transaction safety"
```

---

## Task 10: React 앱 기본 구조 + 인증 흐름

**Files:**
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/api/client.js`
- Create: `client/src/api/auth.js`
- Create: `client/src/store/authStore.js`
- Create: `client/src/components/ProtectedRoute.jsx`
- Create: `client/src/components/AdminRoute.jsx`
- Create: `client/src/pages/Landing.jsx`

- [ ] **Step 1: `client/src/store/authStore.js` 작성**

```js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' }
  )
);
```

- [ ] **Step 2: `client/src/api/client.js` 작성 (토큰 자동 갱신 인터셉터)**

```js
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

// 요청 인터셉터: 헤더에 Access Token 자동 첨부
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 401 시 Refresh Token으로 재발급
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      try {
        const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        setTokens(res.data.accessToken, refreshToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return api(original);
      } catch {
        logout();
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 3: `client/src/api/auth.js` 작성**

```js
import api from './client';

export const getMe = () => api.get('/users/me');
export const updateMe = (data) => api.put('/users/me', data);
export const logout = (refreshToken) => api.post('/auth/logout', { refreshToken });
export const refresh = (refreshToken) => api.post('/auth/refresh', { refreshToken });
```

- [ ] **Step 4: `client/src/App.jsx` 작성**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Subscriptions from './pages/Subscriptions';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTransfers from './pages/admin/AdminTransfers';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/products/new" element={<AdminProductForm />} />
              <Route path="/admin/products/:id" element={<AdminProductForm />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/transfers" element={<AdminTransfers />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: `client/src/components/ProtectedRoute.jsx` 작성**

```jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute() {
  const { accessToken } = useAuthStore();
  return accessToken ? <Outlet /> : <Navigate to="/" replace />;
}
```

- [ ] **Step 6: `client/src/components/AdminRoute.jsx` 작성**

```jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AdminRoute() {
  const { user } = useAuthStore();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
```

- [ ] **Step 7: `client/src/pages/Landing.jsx` 작성**

```jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Landing() {
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (accessToken) navigate('/dashboard');
  }, [accessToken, navigate]);

  const handleKakaoLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/kakao`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Jamie CMS</h1>
        <p className="text-slate-500">정기결제 자동이체 관리 서비스</p>
        <button
          onClick={handleKakaoLogin}
          className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold px-8 py-3 rounded-xl flex items-center gap-2 mx-auto transition"
        >
          카카오로 로그인
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: `client/src/pages/AuthCallback.jsx` 작성 (OAuth 콜백 처리)**

```jsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMe } from '../api/auth';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { setTokens, setUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const code = params.get('code');
    if (!code) { navigate('/'); return; }

    // 서버에서 임시 코드를 실제 토큰으로 교환
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/auth/token?code=${code}`)
      .then(r => r.json())
      .then(({ accessToken, refreshToken }) => {
        setTokens(accessToken, refreshToken);
        return getMe();
      })
      .then((res) => {
        setUser(res.data);
        navigate('/dashboard');
      })
      .catch(() => navigate('/'));
  }, [params, setTokens, setUser, navigate]);

  return <div className="min-h-screen flex items-center justify-center">로그인 중...</div>;
}
```

- [ ] **Step 9: 클라이언트 실행 및 로그인 플로우 확인**

```bash
cd client
npm run dev
# http://localhost:5173 → 랜딩 → 카카오 로그인 → /dashboard 리다이렉트
```

- [ ] **Step 10: 커밋**

```bash
git add client/src/
git commit -m "feat: add React app with Kakao OAuth login flow and auth store"
```

---

## Task 11: React 공통 레이아웃 + 사용자 주요 화면

**Files:**
- Create: `client/src/components/Layout.jsx`
- Create: `client/src/pages/Dashboard.jsx`
- Create: `client/src/pages/Accounts.jsx`
- Create: `client/src/pages/AccountDetail.jsx`
- Create: `client/src/api/accounts.js`

- [ ] **Step 1: `client/src/api/accounts.js` 작성**

```js
import api from './client';

export const getAccounts = () => api.get('/accounts');
export const createAccount = (name) => api.post('/accounts', { name });
export const getAccount = (id) => api.get(`/accounts/${id}`);
export const deposit = (id, amount) => api.post(`/accounts/${id}/deposit`, { amount });
export const withdraw = (id, amount) => api.post(`/accounts/${id}/withdraw`, { amount });
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);
```

- [ ] **Step 2: `client/src/components/Layout.jsx` 작성**

```jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { logout as logoutApi } from '../api/auth';

export default function Layout() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutApi(refreshToken);
    logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-900 mr-4">Jamie CMS</span>
          <NavLink to="/dashboard" className={navClass}>대시보드</NavLink>
          <NavLink to="/products" className={navClass}>상품</NavLink>
          <NavLink to="/subscriptions" className={navClass}>구독</NavLink>
          <NavLink to="/accounts" className={navClass}>계좌</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={navClass}>어드민</NavLink>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.nickname}</span>
          <NavLink to="/profile" className={navClass}>프로필</NavLink>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">로그아웃</button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: `client/src/pages/Dashboard.jsx` 작성**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccounts } from '../api/accounts';
import { getSubscriptions } from '../api/subscriptions';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  useEffect(() => {
    getAccounts().then(r => setAccounts(r.data));
    getSubscriptions().then(r => setSubscriptions(r.data));
  }, []);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const activeCount = subscriptions.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.nickname}님</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">총 잔액</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{totalBalance.toLocaleString()}원</p>
          <Link to="/accounts" className="text-blue-500 text-sm mt-2 inline-block">계좌 관리 →</Link>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">활성 구독</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{activeCount}개</p>
          <Link to="/subscriptions" className="text-blue-500 text-sm mt-2 inline-block">구독 관리 →</Link>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-900 mb-4">구독 중인 상품</h2>
        {subscriptions.filter(s => s.status === 'active').length === 0 ? (
          <p className="text-slate-400 text-sm">구독 중인 상품이 없어요. <Link to="/products" className="text-blue-500">상품 둘러보기 →</Link></p>
        ) : (
          <ul className="space-y-2">
            {subscriptions.filter(s => s.status === 'active').map(s => (
              <li key={s.id} className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-700">{s.product_name}</span>
                <span className="text-slate-900 font-medium">{Number(s.amount).toLocaleString()}원 / 매월 {s.billing_day}일</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 나머지 계좌/상품/구독 페이지는 같은 패턴으로 작성**

각 페이지는 `useEffect`로 API 호출 → 상태 저장 → JSX 렌더링 패턴을 따름.

`client/src/api/products.js`:
```js
import api from './client';
export const getProducts = () => api.get('/products');
export const getProduct = (id) => api.get(`/products/${id}`);
```

`client/src/api/subscriptions.js`:
```js
import api from './client';
export const getSubscriptions = () => api.get('/subscriptions');
export const createSubscription = (product_id, account_id) => api.post('/subscriptions', { product_id, account_id });
export const updateSubscription = (id, status) => api.put(`/subscriptions/${id}`, { status });
export const cancelSubscription = (id) => api.delete(`/subscriptions/${id}`);
```

- [ ] **Step 5: 개발 서버에서 전체 플로우 확인**

```
1. http://localhost:5173 → 카카오 로그인
2. Dashboard 진입 확인
3. 계좌 생성 → 입금 → 잔액 확인
4. 상품 목록 → 상품 가입
5. 구독 목록 확인
```

- [ ] **Step 6: 커밋**

```bash
git add client/src/
git commit -m "feat: add dashboard, accounts, products, subscriptions pages"
```

---

## Task 12: 어드민 React 화면

**Files:**
- Create: `client/src/api/admin.js`
- Create: `client/src/pages/admin/AdminDashboard.jsx`
- Create: `client/src/pages/admin/AdminProducts.jsx`
- Create: `client/src/pages/admin/AdminProductForm.jsx`
- Create: `client/src/pages/admin/AdminUsers.jsx`
- Create: `client/src/pages/admin/AdminTransfers.jsx`

- [ ] **Step 1: `client/src/api/admin.js` 작성**

```js
import api from './client';
export const getAdminUsers = () => api.get('/admin/users');
export const getAdminTransfers = () => api.get('/admin/transfers');
export const getAdminProducts = () => api.get('/admin/products');
export const getAdminProduct = (id) => api.get(`/admin/products/${id}`);
export const createProduct = (data) => api.post('/admin/products', data);
export const updateProduct = (id, data) => api.put(`/admin/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/admin/products/${id}`);
```

- [ ] **Step 2: `client/src/pages/admin/AdminProductForm.jsx` 작성 (등록/수정 통합)**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProduct, updateProduct, getAdminProduct } from '../../api/admin';

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({
    name: '', category: 'etc', description: '', amount: '', billing_day: ''
  });

  useEffect(() => {
    if (isEdit) {
      getAdminProduct(id).then(r => setForm(r.data));
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEdit) await updateProduct(id, form);
    else await createProduct(form);
    navigate('/admin/products');
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? '상품 수정' : '상품 등록'}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">상품명</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 py-2" value={form.name}
            onChange={e => setForm({...form, name: e.target.value})} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">카테고리</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2" value={form.category}
            onChange={e => setForm({...form, category: e.target.value})}>
            <option value="delivery">배달/배송</option>
            <option value="rental">렌탈</option>
            <option value="donation">기부금</option>
            <option value="etc">기타</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">결제 금액 (원)</label>
          <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2" value={form.amount}
            onChange={e => setForm({...form, amount: e.target.value})} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">매월 결제일 (1~28)</label>
          <input type="number" min="1" max="28" className="w-full border border-slate-200 rounded-lg px-3 py-2"
            value={form.billing_day} onChange={e => setForm({...form, billing_day: e.target.value})} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">설명</label>
          <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2" rows={3}
            value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>
        <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium hover:bg-slate-700 transition">
          {isEdit ? '수정 완료' : '상품 등록'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 어드민 화면 테스트**

```
1. Supabase에서 내 계정 role을 'admin'으로 변경
2. 재로그인
3. /admin/products/new → 상품 등록
4. /admin/users → 회원 목록 확인
5. /admin/transfers → 자동이체 내역 확인
```

- [ ] **Step 4: 커밋**

```bash
git add client/src/pages/admin/ client/src/api/admin.js
git commit -m "feat: add admin pages for product management and monitoring"
```

---

## Task 13: 보안 강화 + OWASP 침투 테스트

**Files:**
- Create: `server/tests/security.test.js`
- Modify: `server/src/app.js`

- [ ] **Step 1: 입력값 검증 미들웨어 추가 (express-validator)**

`server/src/routes/accounts.js` POST 라우트에 유효성 검사 추가:

```js
const { body, validationResult } = require('express-validator');

const validateCreateAccount = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 50 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

router.post('/', auth, validateCreateAccount, c.createAccount);
```

- [ ] **Step 2: `server/tests/security.test.js` 작성**

```js
const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { signAccessToken } = require('../src/utils/jwt');

let userToken, adminToken, userId, accountId;

beforeAll(async () => {
  const user = await pool.query(
    `INSERT INTO users (kakao_id, nickname, role) VALUES ('sec_user', 'SecUser', 'user') RETURNING id, role`
  );
  userId = user.rows[0].id;
  userToken = signAccessToken({ userId, role: 'user' });
  adminToken = signAccessToken({ userId: 'fake-admin-id', role: 'user' }); // user role

  const account = await pool.query(
    `INSERT INTO accounts (user_id, name, balance) VALUES ($1, '보안테스트 계좌', 10000) RETURNING id`,
    [userId]
  );
  accountId = account.rows[0].id;
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
});

// 1. JWT 위변조
test('JWT 위변조된 토큰 거부', async () => {
  const res = await request(app)
    .get('/api/users/me')
    .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJoYWNrIn0.fakesignature');
  expect(res.status).toBe(401);
});

// 2. 토큰 없이 요청
test('토큰 없이 보호된 라우트 접근 거부', async () => {
  const res = await request(app).get('/api/users/me');
  expect(res.status).toBe(401);
});

// 3. 관리자 권한 탈취 시도
test('일반 유저가 어드민 API 접근 불가', async () => {
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(403);
});

// 4. IDOR - 타인 계좌 접근
test('타인 계좌 접근 불가 (IDOR)', async () => {
  const other = await pool.query(
    `INSERT INTO users (kakao_id, nickname) VALUES ('sec_other', 'Other') RETURNING id, role`
  );
  const otherToken = signAccessToken({ userId: other.rows[0].id, role: 'user' });

  const res = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set('Authorization', `Bearer ${otherToken}`);
  expect(res.status).toBe(403);
  await pool.query(`DELETE FROM users WHERE id = $1`, [other.rows[0].id]);
});

// 5. SQL Injection 시도
test('SQL Injection 입력 시 에러 없이 처리', async () => {
  const res = await request(app)
    .post('/api/accounts')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name: "'; DROP TABLE users; --" });
  // 400 (유효성 검사) 또는 201 (이름 자체로 저장) 중 하나여야 함. 500이면 안 됨.
  expect(res.status).not.toBe(500);
});

// 6. Rate Limit 테스트
test('로그인 API 5회 초과 시 429 반환', async () => {
  const requests = Array(6).fill(null).map(() =>
    request(app).get('/api/auth/kakao')
  );
  const results = await Promise.all(requests);
  const tooMany = results.filter(r => r.status === 429);
  expect(tooMany.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: 테스트 실행**

```bash
npm test -- tests/security.test.js
```

Expected: PASS (6 tests)

- [ ] **Step 4: 커밋**

```bash
git add server/tests/security.test.js server/src/
git commit -m "test: add OWASP security test scenarios (JWT, IDOR, SQLi, rate limit)"
```

---

## Task 14: 배포

**Files:**
- Create: `server/Procfile`
- Create: `client/.env.production`

- [ ] **Step 1: GitHub 저장소 생성 및 푸시**

```bash
# GitHub에서 새 저장소 생성: jamie-cms (public)
git remote add origin https://github.com/<username>/jamie-cms.git
git push -u origin main
```

- [ ] **Step 2: Railway 백엔드 배포**

1. railway.app → New Project → Deploy from GitHub → `jamie-cms` 선택
2. Root Directory: `server`
3. Variables 탭에서 환경변수 추가:
   - `DATABASE_URL` (Supabase URI)
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `KAKAO_CLIENT_ID`
   - `KAKAO_REDIRECT_URI` = `https://<railway-domain>/api/auth/kakao/callback`
   - `CLIENT_URL` = `https://<vercel-domain>`
4. 배포 완료 후 도메인 확인 → `/health` 접속

- [ ] **Step 3: 카카오 콘솔 Redirect URI 업데이트**

카카오 개발자 콘솔 → 앱 설정 → 카카오 로그인 → Redirect URI에 Railway URL 추가:
`https://<railway-domain>/api/auth/kakao/callback`

- [ ] **Step 4: Vercel 프론트엔드 배포**

1. vercel.com → New Project → Import from GitHub → `jamie-cms`
2. Root Directory: `client`
3. Environment Variables:
   - `VITE_API_URL` = `https://<railway-domain>/api`
4. Deploy

- [ ] **Step 5: E2E 확인**

```
1. https://<vercel-domain> 접속
2. 카카오 로그인 성공
3. 계좌 생성 → 입금 → 잔액 확인
4. 상품 가입 → 구독 목록 확인
5. 어드민: 상품 등록 → 회원 목록 확인
```

- [ ] **Step 6: 최종 커밋 및 태그**

```bash
git add .
git commit -m "chore: add deployment configs"
git tag v1.0.0
git push origin main --tags
```

---

## 전체 테스트 실행

```bash
cd server
npm test
```

Expected:
```
PASS tests/health.test.js
PASS tests/jwt.test.js
PASS tests/accounts.test.js
PASS tests/subscriptions.test.js
PASS tests/scheduler.test.js
PASS tests/security.test.js

Test Suites: 6 passed
Tests:       20+ passed
```
