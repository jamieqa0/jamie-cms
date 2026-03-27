const router = require('express').Router();
const { loginLimiter } = require('../middleware/rateLimiter');
const { kakaoLogin, kakaoCallback, exchangeToken, refresh, logout } = require('../controllers/authController');

router.get('/kakao', kakaoLogin);
router.get('/kakao/callback', kakaoCallback);
router.get('/dev-login', devLogin); // 비밀 통로!
router.post('/exchange', exchangeToken);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
