const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: crypto.randomBytes(16).toString('hex') }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
