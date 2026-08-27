-- FlowDoverz document store (Firestore-compatible paths)
CREATE TABLE IF NOT EXISTS app_documents (
  path TEXT PRIMARY KEY,
  collection_path TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_documents_collection_path ON app_documents (collection_path);
CREATE INDEX IF NOT EXISTS idx_app_documents_doc_id ON app_documents (collection_path, doc_id);
CREATE INDEX IF NOT EXISTS idx_app_documents_data ON app_documents USING GIN (data jsonb_path_ops);

-- Storage buckets (create in Supabase Dashboard → Storage if SQL bucket creation is unavailable):
-- extension-files, payment-screenshots, reseller-packs, reseller-logos
