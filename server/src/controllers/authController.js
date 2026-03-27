const axios = require('axios');
const pool = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const kakaoLogin = (req, res) => {
  const { KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI } = process.env;
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
  console.log('--- REDIRECTING TO KAKAO ---');
  console.log('URL:', url);
  if (!KAKAO_CLIENT_ID || !KAKAO_REDIRECT_URI) {
    console.error('ERROR: KAKAO_CLIENT_ID or KAKAO_REDIRECT_URI is missing!');
  }
  res.redirect(url);
};

const kakaoCallback = async (req, res) => {
  const { code } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL;
  console.log('--- DEBUG INFO ---');
  console.log('KAKAO_CLIENT_ID:', process.env.KAKAO_CLIENT_ID);
  console.log('KAKAO_REDIRECT_URI:', process.env.KAKAO_REDIRECT_URI);
  console.log('------------------');
  try {
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      },
    });
    const kakaoAccessToken = tokenRes.data.access_token;

    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    const kakaoId = String(userRes.data.id);
    const nickname = userRes.data.kakao_account?.profile?.nickname || 'User';
    const email = userRes.data.kakao_account?.email || null;

    const result = await pool.query(
      `INSERT INTO users (kakao_id, nickname, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (kakao_id) DO UPDATE SET nickname = $2, email = $3
       RETURNING id, role`,
      [kakaoId, nickname, email]
    );
    const user = result.rows[0];
    console.log('--- DB INSERT SUCCESS ---');
    console.log('User id:', user.id);
    console.log('-------------------------');

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    // 임시 코드로 토큰 전달 (URL에 JWT 직접 노출 방지)
    const crypto = require('crypto');
    const tempCode = crypto.randomBytes(16).toString('hex');
    global.authCodes = global.authCodes || new Map();
    global.authCodes.set(tempCode, { accessToken, refreshToken });
    setTimeout(() => global.authCodes.delete(tempCode), 30000);

    res.redirect(`${CLIENT_URL}/auth/callback?code=${tempCode}`);
  } catch (err) {
    if (err.response) {
      console.error('Kakao auth error details:', err.response.data);
    } else {
      console.error('Kakao auth error:', err.message);
    }
    res.redirect(`${CLIENT_URL}?error=login_failed`);
  }
};

const exchangeToken = (req, res) => {
  const { code } = req.query;
  const data = global.authCodes?.get(code);
  if (!data) return res.status(400).json({ error: 'Invalid or expired code' });
  global.authCodes.delete(code);
  res.json(data);
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const decoded = verifyRefreshToken(refreshToken);
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

const logout = async (req, res) => {
  const { refreshToken } = req.body;
const axios = require('axios');
const pool = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const kakaoLogin = (req, res) => {
  const { KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI } = process.env;
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
  console.log('--- REDIRECTING TO KAKAO ---');
  console.log('URL:', url);
  if (!KAKAO_CLIENT_ID || !KAKAO_REDIRECT_URI) {
    console.error('ERROR: KAKAO_CLIENT_ID or KAKAO_REDIRECT_URI is missing!');
  }
  res.redirect(url);
};

const kakaoCallback = async (req, res) => {
  const { code } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL;
  console.log('--- DEBUG INFO ---');
  console.log('KAKAO_CLIENT_ID:', process.env.KAKAO_CLIENT_ID);
  console.log('KAKAO_REDIRECT_URI:', process.env.KAKAO_REDIRECT_URI);
  console.log('------------------');
  try {
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        redirect_uri: process.env.KAKAO_REDIRECT_URI,
        code,
      },
    });
    const kakaoAccessToken = tokenRes.data.access_token;

    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    const kakaoId = String(userRes.data.id);
    const nickname = userRes.data.kakao_account?.profile?.nickname || 'User';
    const email = userRes.data.kakao_account?.email || null;

    const result = await pool.query(
      `INSERT INTO users (kakao_id, nickname, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (kakao_id) DO UPDATE SET nickname = $2, email = $3
       RETURNING id, role`,
      [kakaoId, nickname, email]
    );
    const user = result.rows[0];
    console.log('--- DB INSERT SUCCESS ---');
    console.log('User id:', user.id);
    console.log('-------------------------');

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    // 임시 코드로 토큰 전달 (URL에 JWT 직접 노출 방지)
    const crypto = require('crypto');
    const tempCode = crypto.randomBytes(16).toString('hex');
    global.authCodes = global.authCodes || new Map();
    global.authCodes.set(tempCode, { accessToken, refreshToken });
    setTimeout(() => global.authCodes.delete(tempCode), 30000);

    res.redirect(`${CLIENT_URL}/auth/callback?code=${tempCode}`);
  } catch (err) {
    if (err.response) {
      console.error('Kakao auth error details:', err.response.data);
    } else {
      console.error('Kakao auth error:', err.message);
    }
    res.redirect(`${CLIENT_URL}?error=login_failed`);
  }
};

const logout = async (req, res) => {
  res.json({ message: 'Logged out' });
};

const exchangeToken = async (req, res) => {
  const { code } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL;

  console.log('--- EXCHANGING TOKEN ---');
  console.log('Code:', code);
  
  try {
    if (global.authCodes && global.authCodes.has(code)) {
      const tokens = global.authCodes.get(code);
      global.authCodes.delete(code);
      console.log('Token exchange success!');
      return res.json(tokens);
    }
    
    console.warn('Invalid or expired code:', code);
    res.status(401).json({ error: 'Invalid or expired code' });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(500).json({ error: 'Exchange error' });
  }
};

const refresh = async (req, res) => {
  // refresh 로직 (생략 가능하면 기존 유지)
  res.json({ message: 'Refresh placeholder' });
};

const devLogin = async (req, res) => {
  const CLIENT_URL = process.env.CLIENT_URL;
  try {
    const result = await pool.query(
      `INSERT INTO users (kakao_id, nickname, email, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (kakao_id) DO UPDATE SET nickname = $2, email = $3, role = $4
       RETURNING id, role`,
      ['dev_admin_123', 'Dev Admin', 'admin@test.com', 'admin']
    );
    const user = result.rows[0];

    // JWT payload 및 token 생성 로직 (필요 시 sign 유틸리티 사용)
    const payload = { userId: user.id, role: user.role };
    // 임시로 가짜 토큰 생성 (실제 secret 사용 권장)
    const accessToken = 'dev-access-token-' + Date.now();
    const refreshToken = 'dev-refresh-token-' + Date.now();

    global.authCodes = global.authCodes || new Map();
    const tempCode = require('crypto').randomBytes(16).toString('hex');
    global.authCodes.set(tempCode, { accessToken, refreshToken });
    setTimeout(() => global.authCodes.delete(tempCode), 60000);

    console.log('--- DEV LOGIN SUCCESS ---');
    console.log('Redirecting to:', `${CLIENT_URL}/auth/callback?code=${tempCode}`);
    res.redirect(`${CLIENT_URL}/auth/callback?code=${tempCode}`);
  } catch (err) {
    console.error('Dev login error:', err);
    res.redirect(`${CLIENT_URL}?error=dev_login_failed`);
  }
};

module.exports = { kakaoLogin, kakaoCallback, exchangeToken, refresh, logout, devLogin };
