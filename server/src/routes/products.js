const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { getProducts, getProduct } = require('../controllers/productsController');
router.get('/', auth, getProducts);
router.get('/:id', auth, getProduct);
module.exports = router;
