const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

require('dotenv').config();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();

app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
