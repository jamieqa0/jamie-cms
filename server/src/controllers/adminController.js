const pool = require('../config/db');

const getUsers = async (req, res) => {
  const result = await pool.query(
    `SELECT id, nickname, email, role, created_at FROM users ORDER BY created_at DESC`
  );
  res.json(result.rows);
};

const getBillingLogs = async (req, res) => {
  const result = await pool.query(
    `SELECT bl.*, p.name as product_name, u.nickname
     FROM billing_logs bl
     JOIN products p ON bl.product_id = p.id
     JOIN subscriptions s ON bl.subscription_id = s.id
     JOIN users u ON s.user_id = u.id
     ORDER BY bl.executed_at DESC
     LIMIT 100`
  );
  res.json(result.rows);
};

const getAdminProducts = async (req, res) => {
  const result = await pool.query(`SELECT * FROM products ORDER BY created_at DESC`);
  res.json(result.rows);
};

const getAdminProduct = async (req, res) => {
  const result = await pool.query(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
};

const createProduct = async (req, res) => {
  const { name, category, description, amount, billing_day } = req.body;
  if (!name || !category || !amount || !billing_day) {
    return res.status(400).json({ error: 'name, category, amount, billing_day are required' });
  }
  const result = await pool.query(
    `INSERT INTO products (name, category, description, amount, billing_day) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, category, description, amount, billing_day]
  );
  res.status(201).json(result.rows[0]);
};

const updateProduct = async (req, res) => {
  const { name, category, description, amount, billing_day, is_active } = req.body;
  const result = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       category = COALESCE($2, category),
       description = COALESCE($3, description),
       amount = COALESCE($4, amount),
       billing_day = COALESCE($5, billing_day),
       is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [name, category, description, amount, billing_day, is_active, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
};

const deleteProduct = async (req, res) => {
  const result = await pool.query(
    `UPDATE products SET is_active = false WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.status(204).send();
};

module.exports = { getUsers, getBillingLogs, getAdminProducts, getAdminProduct, createProduct, updateProduct, deleteProduct };
