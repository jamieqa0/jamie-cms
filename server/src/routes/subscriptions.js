const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/subscriptionsController');
router.get('/', auth, c.getSubscriptions);
router.post('/', auth, c.createSubscription);
router.put('/:id', auth, c.updateSubscription);
router.delete('/:id', auth, c.cancelSubscription);
module.exports = router;
