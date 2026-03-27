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
