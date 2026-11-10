-- Optional invoice/bill attachments for stock receipts. Keeps receipts and the
-- stock ledger immutable; the file metadata is stored in its own append-only table.
CREATE TABLE IF NOT EXISTS stock_receipt_attachments (
  attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id UUID NOT NULL UNIQUE REFERENCES stock_receipts(receipt_id) ON DELETE RESTRICT,
  file_name VARCHAR(260) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  mime_type VARCHAR(120) NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_attachments_uploaded_at
  ON stock_receipt_attachments(uploaded_at DESC);
DROP TRIGGER IF EXISTS trg_stock_receipt_attachments_append_only ON stock_receipt_attachments;
CREATE TRIGGER trg_stock_receipt_attachments_append_only
  BEFORE UPDATE OR DELETE ON stock_receipt_attachments
  FOR EACH ROW EXECUTE FUNCTION fn_reject_stock_record_mutation();
