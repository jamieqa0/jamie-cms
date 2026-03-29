-- 019_invoices_table.sql

-- invoices 테이블
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  billing_log_id  UUID REFERENCES billing_logs(id),  -- 결제 후 연결 (nullable)
  amount          BIGINT NOT NULL,
  supply_amount   BIGINT NOT NULL,
  vat             BIGINT NOT NULL,
  status          VARCHAR NOT NULL DEFAULT 'issued'
                  CHECK (status IN ('issued', 'paid', 'failed')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
);

-- transactions에 invoice_id 추가 (nullable FK)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
