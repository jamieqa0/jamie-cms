const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { getMe, updateMe } = require('../controllers/usersController');
router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);
module.exports = router;
