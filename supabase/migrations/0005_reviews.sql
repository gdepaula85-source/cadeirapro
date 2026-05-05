-- ============================================================================
-- CadeiraPro S4 - Customer reviews foundation
--
-- Reviews are written only by customer-auth endpoints, using service_role and
-- scoped through clients.auth_user_id. Owner/staff JWTs can read tenant reviews
-- through normal org RLS. Public exposure is limited to aggregate stats on
-- public_barbers; raw review text is not public yet.
-- ============================================================================

CREATE TABLE reviews (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id               UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id                UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  barber_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id               UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  rating                   INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment                  TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  is_public                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX idx_reviews_org_created ON reviews(organization_id, created_at DESC);
CREATE INDEX idx_reviews_barber_public ON reviews(barber_id, created_at DESC) WHERE is_public = true;
CREATE INDEX idx_reviews_client ON reviews(client_id, created_at DESC);

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_reviews ON reviews
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE OR REPLACE VIEW public_barbers
  WITH (security_invoker = off) AS
SELECT
  p.id,
  p.organization_id,
  p.display_name,
  p.avatar_url,
  p.bio,
  COALESCE(stats.rating_count, 0)::INTEGER AS rating_count,
  stats.rating_average
FROM profiles p
LEFT JOIN (
  SELECT
    barber_id,
    COUNT(*)::INTEGER AS rating_count,
    ROUND(AVG(rating)::NUMERIC, 2) AS rating_average
  FROM reviews
  WHERE is_public = true
  GROUP BY barber_id
) stats ON stats.barber_id = p.id
WHERE p.is_active = true AND p.role IN ('owner','barber');

GRANT SELECT ON public_barbers TO anon;
