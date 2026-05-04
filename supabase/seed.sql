-- ============================================================================
-- Seed data — local dev / staging only. Idempotent (uses ON CONFLICT).
-- Build Guide §3 / SPRINT_1 §3 — one demo organization for the §10 demo
-- script to land against.
-- ============================================================================

INSERT INTO organizations (
  slug, name, primary_pix_key, primary_pix_key_type, plan, platform_fee_pct
)
VALUES (
  'demo',
  'Demo Barbearia',
  '00000000-0000-4000-8000-000000000000',  -- placeholder UUID-shaped Pix key
  'random',
  'trial',
  0.005
)
ON CONFLICT (slug) DO NOTHING;
