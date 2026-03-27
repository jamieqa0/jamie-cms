const { body, validationResult } = require('express-validator');
const router = require('express').Router();
const auth = require('../middleware/authenticate');
const c = require('../controllers/accountsController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

router.get('/', auth, c.getAccounts);
router.post('/', auth,
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 50 }),
  validate,
  c.createAccount
);
router.get('/:id', auth, c.getAccount);
router.post('/:id/deposit', auth,
  body('amount').isInt({ min: 1 }).withMessage('amount must be a positive integer'),
  validate,
  c.deposit
);
router.post('/:id/withdraw', auth,
  body('amount').isInt({ min: 1 }).withMessage('amount must be a positive integer'),
  validate,
  c.withdraw
);
router.delete('/:id', auth, c.deleteAccount);

module.exports = router;
