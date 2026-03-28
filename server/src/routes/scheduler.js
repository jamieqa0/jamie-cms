const router = require('express').Router();
const { runScheduler } = require('../controllers/schedulerController');

router.post('/run', runScheduler);

module.exports = router;
