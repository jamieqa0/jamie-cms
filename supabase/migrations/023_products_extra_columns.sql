-- 023_products_extra_columns.sql
-- products 테이블에 상품 설명 + 청구서 발행일 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS invoice_day INTEGER CHECK (invoice_day IN (1, 15));
