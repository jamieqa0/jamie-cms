CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id VARCHAR UNIQUE NOT NULL,
  nickname VARCHAR NOT NULL,
  email VARCHAR,
  role VARCHAR NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  type VARCHAR NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'collection')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'auto_debit')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  description VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  category VARCHAR NOT NULL CHECK (category IN ('delivery', 'rental', 'donation', 'etc')),
  description TEXT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  billing_day INT NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  payment_method VARCHAR NOT NULL DEFAULT 'account' CHECK (payment_method IN ('account', 'card', 'phone')),
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE billing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('success', 'failed')),
  reason VARCHAR,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
