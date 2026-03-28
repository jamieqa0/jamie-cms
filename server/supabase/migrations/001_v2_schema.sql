-- 1. accounts.type 컬럼 추가
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'personal'
  CHECK (type IN ('personal', 'collection'));

-- 2. subscriptions.payment_method 컬럼 추가
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR NOT NULL DEFAULT 'account'
  CHECK (payment_method IN ('account', 'card', 'phone'));

-- 3. 시스템 유저 Seed
INSERT INTO users (kakao_id, nickname, role)
VALUES ('system', '시스템', 'admin')
ON CONFLICT (kakao_id) DO NOTHING;

-- 4. 기관 집금 계좌 Seed (시스템 유저 소유, 없을 때만 삽입)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE type = 'collection') THEN
    INSERT INTO accounts (user_id, name, type, balance)
    SELECT id, '기관 집금 계좌', 'collection', 0
    FROM users WHERE kakao_id = 'system';
  END IF;
END $$;
