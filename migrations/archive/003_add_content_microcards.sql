-- Content microcards and quick-check results to better utilize DB for derived learning content
-- Run in Supabase SQL editor (or include in your migration pipeline)

-- ================================================
-- TABLE: content_microcards (publicly readable derived content)
-- ================================================
CREATE TABLE IF NOT EXISTS content_microcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  outcome_code TEXT NOT NULL,
  summary TEXT NOT NULL,              -- Paraphrased, short concept explanation
  steps JSONB NOT NULL DEFAULT '[]',  -- Array of brief worked steps/examples
  pitfall TEXT,                       -- Short common mistake
  quick_check JSONB NOT NULL DEFAULT '{}'::jsonb, -- { question, choices[], answer, explanation }
  recommended_resource_url TEXT,      -- Optional single next-best resource URL
  sources JSONB NOT NULL DEFAULT '[]',-- [{ type, title, url?, doc_stem?, pages? }]
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', -- active | draft | archived
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject, outcome_code)
);

CREATE INDEX IF NOT EXISTS idx_microcards_subject ON content_microcards(subject);
CREATE INDEX IF NOT EXISTS idx_microcards_unit ON content_microcards(unit_id);
CREATE INDEX IF NOT EXISTS idx_microcards_outcome ON content_microcards(outcome_code);

ALTER TABLE content_microcards ENABLE ROW LEVEL SECURITY;

-- Public read-only; write restricted to service role (admin pipelines)
DROP POLICY IF EXISTS content_microcards_read_all ON content_microcards;
DROP POLICY IF EXISTS content_microcards_insert_service ON content_microcards;
DROP POLICY IF EXISTS content_microcards_update_service ON content_microcards;
DROP POLICY IF EXISTS content_microcards_delete_service ON content_microcards;

CREATE POLICY content_microcards_read_all
  ON content_microcards
  FOR SELECT
  USING (true);

CREATE POLICY content_microcards_insert_service
  ON content_microcards
  FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY content_microcards_update_service
  ON content_microcards
  FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY content_microcards_delete_service
  ON content_microcards
  FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

REVOKE ALL ON TABLE content_microcards FROM PUBLIC;
GRANT SELECT ON TABLE content_microcards TO anon, authenticated;

-- ================================================
-- TABLE: quick_check_results (per-user learning signals)
-- ================================================
CREATE TABLE IF NOT EXISTS quick_check_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES study_plans(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  unit_id TEXT,
  outcome_code TEXT,
  microcard_id UUID REFERENCES content_microcards(id) ON DELETE SET NULL,
  correct BOOLEAN NOT NULL,
  selected TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_results_user ON quick_check_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_results_outcome ON quick_check_results(outcome_code);

ALTER TABLE quick_check_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qc_results_select_own ON quick_check_results;
DROP POLICY IF EXISTS qc_results_insert_own ON quick_check_results;
DROP POLICY IF EXISTS qc_results_update_own ON quick_check_results;
DROP POLICY IF EXISTS qc_results_delete_own ON quick_check_results;

CREATE POLICY qc_results_select_own
  ON quick_check_results
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY qc_results_insert_own
  ON quick_check_results
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY qc_results_update_own
  ON quick_check_results
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY qc_results_delete_own
  ON quick_check_results
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

