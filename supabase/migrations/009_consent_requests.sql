-- 동의 요청 테이블 생성
CREATE TABLE IF NOT EXISTS consent_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES users(id),
  product_id       UUID NOT NULL REFERENCES products(id),
  customer_name    VARCHAR NOT NULL,
  customer_contact VARCHAR NOT NULL,
  invite_token     VARCHAR UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status           VARCHAR NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'rejected')),
  user_id          UUID REFERENCES users(id),
  subscription_id  UUID REFERENCES subscriptions(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
