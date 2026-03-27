const router = require('express').Router();
const { loginLimiter } = require('../middleware/rateLimiter');
const { kakaoLogin, kakaoCallback, exchangeToken, refresh, logout } = require('../controllers/authController');

router.get('/kakao', loginLimiter, kakaoLogin);
router.get('/kakao/callback', kakaoCallback);
router.get('/token', exchangeToken);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
