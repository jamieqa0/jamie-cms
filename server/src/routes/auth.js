const router = require('express').Router();
const { loginLimiter } = require('../middleware/rateLimiter');
const { kakaoLogin, kakaoCallback, exchangeToken, refresh, logout, devLogin } = require('../controllers/authController');

router.get('/kakao', loginLimiter, kakaoLogin);
router.get('/kakao/callback', kakaoCallback);
router.get('/dev-login', devLogin); // 비밀 통로!
router.get('/token', exchangeToken); // 프론트엔드가 호출하는 경로 복구!
router.post('/exchange', exchangeToken);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
