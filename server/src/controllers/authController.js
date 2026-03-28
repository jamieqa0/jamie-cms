const axios = require('axios');
const pool = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const kakaoLogin = (req, res) => {
  const { KAKAO_CLIENT_ID, KAKAO_REDIRECT_URI } = process.env;
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${KAKAO_REDIRECT_URI}&response_type=code`;
  console.log('--- REDIRECTING TO KAKAO ---');
  if (!KAKAO_CLIENT_ID || !KAKAO_REDIRECT_URI) {
    console.error('ERROR: KAKAO_CLIENT_ID or KAKAO_REDIRECT_URI is missing!');
  }
  res.redirect(url);
};

const kakaoCallback = async (req, res) => {
  const { code } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL;
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

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, expires_at = $3`,
      [user.id, refreshToken, expiresAt]
    );

    const crypto = require('crypto');
    const tempCode = crypto.randomBytes(16).toString('hex');
    global.authCodes = global.authCodes || new Map();
    global.authCodes.set(tempCode, { accessToken, refreshToken });
    setTimeout(() => global.authCodes.delete(tempCode), 30000);

    res.redirect(`${CLIENT_URL}/auth/callback?code=${tempCode}`);
  } catch (err) {
    console.error('Kakao error:', err.message);
    res.redirect(`${CLIENT_URL}?error=login_failed`);
  }
};

const exchangeToken = async (req, res) => {
  const { code } = req.query;
  try {
    if (global.authCodes && global.authCodes.has(code)) {
      const tokens = global.authCodes.get(code);
      global.authCodes.delete(code);
      return res.json(tokens);
    }
    res.status(401).json({ error: 'Invalid or expired code' });
  } catch (err) {
    res.status(500).json({ error: 'Exchange error' });
  }
};

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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE refresh_tokens SET revoked = true WHERE token = $1`, [refreshToken]);
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [decoded.userId, newRefreshToken, expiresAt]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [refreshToken]);
  }
  res.json({ message: 'Logged out' });
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

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload); // 진짜 토큰 발행!
    const refreshToken = signRefreshToken(payload); // 진짜 토큰 발행!

    const crypto = require('crypto');
    const tempCode = crypto.randomBytes(16).toString('hex');
    global.authCodes = global.authCodes || new Map();
    global.authCodes.set(tempCode, { accessToken, refreshToken });
    setTimeout(() => global.authCodes.delete(tempCode), 60000);

    console.log('--- DEV LOGIN SUCCESS (REAL JWT) ---');
    res.redirect(`${CLIENT_URL}/auth/callback?code=${tempCode}`);
  } catch (err) {
    console.error('Dev login error:', err);
    res.redirect(`${CLIENT_URL}?error=dev_login_failed`);
  }
};

module.exports = { kakaoLogin, kakaoCallback, exchangeToken, refresh, logout, devLogin };
