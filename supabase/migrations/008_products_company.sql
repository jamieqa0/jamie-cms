-- products 테이블에 company_id FK 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES users(id);
