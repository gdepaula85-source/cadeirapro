-- ============================================================================
-- CadeiraPro — initial schema
-- Build Guide §4.1 + four S1 additions decided 2026-05-03:
--   1. btree_gist extension (required for the booking exclusion constraint)
--   2. no_overlap_per_barber EXCLUDE constraint on bookings
--   3. clients.anonymized_at TIMESTAMPTZ for LGPD
--   4. idempotency_keys reused for webhook event dedup (no separate webhook_events table)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
CREATE TABLE organizations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     TEXT UNIQUE NOT NULL,
  name                     TEXT NOT NULL,
  legal_name               TEXT,
  cnpj                     TEXT,
  cpf                      TEXT,
  address                  JSONB,
  timezone                 TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency                 TEXT NOT NULL DEFAULT 'BRL',
  primary_pix_key          TEXT NOT NULL,
  primary_pix_key_type     TEXT NOT NULL CHECK (primary_pix_key_type IN ('cpf','cnpj','email','phone','random')),
  whatsapp_phone           TEXT,
  logo_url                 TEXT,
  cover_url                TEXT,
  theme_id                 TEXT NOT NULL DEFAULT 'classico',
  theme_config             JSONB NOT NULL DEFAULT '{}'::jsonb,
  hours                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan                     TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','solo','pro','pro_plus')),
  trial_ends_at            TIMESTAMPTZ,
  platform_fee_pct         NUMERIC(5,4) NOT NULL DEFAULT 0.005,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ============================================================================
-- PROFILES (one row per Supabase auth user)
-- ============================================================================
CREATE TABLE profiles (
  id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role                     TEXT NOT NULL CHECK (role IN ('owner','barber','staff')),
  display_name             TEXT NOT NULL,
  email                    TEXT,
  phone                    TEXT,
  avatar_url               TEXT,
  bio                      TEXT,
  pix_key                  TEXT,
  pix_key_type             TEXT CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','cnpj','email','phone','random')),
  commission_pct           NUMERIC(5,4) CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 1)),
  partner_status           TEXT NOT NULL DEFAULT 'parceiro' CHECK (partner_status IN ('parceiro','employee')),
  is_active                BOOLEAN NOT NULL DEFAULT true,
  schedule                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_org ON profiles(organization_id);

-- ============================================================================
-- SERVICES
-- ============================================================================
CREATE TABLE services (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  description              TEXT,
  duration_minutes         INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents              INTEGER NOT NULL CHECK (price_cents >= 0),
  photo_url                TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  sort_order               INTEGER NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_org ON services(organization_id);

-- ============================================================================
-- SERVICE ↔ BARBER assignment
-- ============================================================================
CREATE TABLE service_barbers (
  service_id               UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  barber_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, barber_id)
);
CREATE INDEX idx_service_barbers_barber ON service_barbers(barber_id);

-- ============================================================================
-- SCHEDULE BLOCKS (block-out times)
-- ============================================================================
CREATE TABLE schedule_blocks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  barber_id                UUID REFERENCES profiles(id) ON DELETE CASCADE, -- null = whole shop
  starts_at                TIMESTAMPTZ NOT NULL,
  ends_at                  TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  reason                   TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blocks_barber_time ON schedule_blocks(barber_id, starts_at, ends_at);
CREATE INDEX idx_blocks_org_time ON schedule_blocks(organization_id, starts_at, ends_at);

-- ============================================================================
-- PACKAGES (e.g. 5 cuts for price of 4)
-- ============================================================================
CREATE TABLE packages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id               UUID NOT NULL REFERENCES services(id),
  name                     TEXT NOT NULL,
  qty                      INTEGER NOT NULL CHECK (qty > 0),
  qty_paid                 INTEGER NOT NULL CHECK (qty_paid > 0 AND qty_paid <= qty),
  price_cents              INTEGER NOT NULL CHECK (price_cents >= 0),
  validity_days            INTEGER NOT NULL DEFAULT 365 CHECK (validity_days > 0),
  transferable             BOOLEAN NOT NULL DEFAULT false,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_org ON packages(organization_id);

-- ============================================================================
-- CLIENTS (with LGPD anonymized_at — S1 addition for the S6 erase endpoint)
-- ============================================================================
CREATE TABLE clients (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone                    TEXT NOT NULL,
  name                     TEXT NOT NULL,
  email                    TEXT,
  lgpd_consent_at          TIMESTAMPTZ,
  anonymized_at            TIMESTAMPTZ,                  -- S1 addition for LGPD
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone)
);
CREATE INDEX idx_clients_org_phone ON clients(organization_id, phone);

-- ============================================================================
-- CLIENT_PACKAGES (package balances)
-- ============================================================================
CREATE TABLE client_packages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id                UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_id               UUID NOT NULL REFERENCES packages(id),
  qty_total                INTEGER NOT NULL CHECK (qty_total > 0),
  qty_remaining            INTEGER NOT NULL CHECK (qty_remaining >= 0 AND qty_remaining <= qty_total),
  expires_at               TIMESTAMPTZ NOT NULL,
  purchased_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_payment_id        UUID
);
CREATE INDEX idx_client_packages_client ON client_packages(client_id);
CREATE INDEX idx_client_packages_org ON client_packages(organization_id);

-- ============================================================================
-- BOOKINGS — with overlap exclusion constraint (S1 addition)
-- ============================================================================
CREATE TABLE bookings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id                UUID NOT NULL REFERENCES clients(id),
  barber_id                UUID NOT NULL REFERENCES profiles(id),
  service_id               UUID NOT NULL REFERENCES services(id),
  starts_at                TIMESTAMPTZ NOT NULL,
  ends_at                  TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  status                   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','confirmed','completed','no_show','cancelled')),
  source                   TEXT NOT NULL DEFAULT 'widget'
                              CHECK (source IN ('widget','manual','whatsapp')),
  client_package_id        UUID REFERENCES client_packages(id),
  notes                    TEXT,
  cancellation_reason      TEXT,
  cancelled_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_org_time ON bookings(organization_id, starts_at);
CREATE INDEX idx_bookings_barber_time ON bookings(barber_id, starts_at);
CREATE INDEX idx_bookings_client ON bookings(client_id);

-- S1 addition: prevent double-booking the same barber. Only blocks pending
-- and confirmed bookings; cancelled / no_show / completed are excluded so
-- the slot can be re-used after a no-show.
ALTER TABLE bookings ADD CONSTRAINT no_overlap_per_barber
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('pending','confirmed'));

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE TABLE payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id               UUID REFERENCES bookings(id) ON DELETE SET NULL,
  client_package_id        UUID REFERENCES client_packages(id),
  provider                 TEXT NOT NULL,
  provider_payment_id      TEXT,
  amount_cents             INTEGER NOT NULL CHECK (amount_cents >= 0),
  status                   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','expired','refunded','failed')),
  qr_code                  TEXT,
  qr_image_url             TEXT,
  qr_expires_at            TIMESTAMPTZ,
  paid_at                  TIMESTAMPTZ,
  refunded_at              TIMESTAMPTZ,
  raw_response             JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- ============================================================================
-- PAYMENT_SPLITS (audit trail of how each payment was divided)
-- ============================================================================
CREATE TABLE payment_splits (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id               UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  recipient_kind           TEXT NOT NULL CHECK (recipient_kind IN ('shop','barber','platform')),
  recipient_pix_key        TEXT NOT NULL,
  recipient_pix_key_type   TEXT NOT NULL CHECK (recipient_pix_key_type IN ('cpf','cnpj','email','phone','random')),
  amount_cents             INTEGER NOT NULL CHECK (amount_cents >= 0),
  status                   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','failed')),
  provider_split_id        TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_splits_payment ON payment_splits(payment_id);

-- ============================================================================
-- WHATSAPP_MESSAGES
-- ============================================================================
CREATE TABLE whatsapp_messages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id                UUID REFERENCES clients(id),
  booking_id               UUID REFERENCES bookings(id),
  template_name            TEXT NOT NULL,
  to_phone                 TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued','sent','delivered','read','failed')),
  wa_message_id            TEXT,
  body                     JSONB,
  sent_at                  TIMESTAMPTZ,
  failed_reason            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_msg_org ON whatsapp_messages(organization_id, created_at);
CREATE INDEX idx_wa_msg_provider ON whatsapp_messages(wa_message_id);

-- ============================================================================
-- AUDIT_LOG
-- ============================================================================
CREATE TABLE audit_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id                 UUID,
  actor_kind               TEXT NOT NULL CHECK (actor_kind IN ('user','system','webhook')),
  action                   TEXT NOT NULL,
  entity                   TEXT NOT NULL,
  entity_id                UUID,
  payload                  JSONB,
  ip_address               INET,
  user_agent               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_time ON audit_log(organization_id, created_at DESC);

-- ============================================================================
-- IDEMPOTENCY_KEYS — also used for webhook event dedup (S1 addition #4).
--   Mutation idempotency keys: arbitrary UUID supplied by client.
--   Webhook event dedup keys:  '<provider>:<provider_payment_id>:<event_type>'
-- ============================================================================
CREATE TABLE idempotency_keys (
  key                      TEXT PRIMARY KEY,
  organization_id          UUID,
  request_hash             TEXT NOT NULL,
  response_status          INTEGER,
  response_body            JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at               TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE INDEX idx_idem_expires ON idempotency_keys(expires_at);

-- ============================================================================
-- §4.2 TRIGGERS — auto-update updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at      BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_services_updated_at      BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at       BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at      BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at      BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- §4.3 ROW LEVEL SECURITY
-- ============================================================================
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'organization_id', '')::UUID;
$$;

-- Enable RLS on every tenant-scoped table.
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_barbers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_splits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys   ENABLE ROW LEVEL SECURITY;

-- Organizations — user reads their own org only.
CREATE POLICY org_self_select ON organizations
  FOR SELECT USING (id = current_org_id());
CREATE POLICY org_self_update ON organizations
  FOR UPDATE USING (id = current_org_id())
  WITH CHECK (id = current_org_id());

-- Profiles — visible to anyone in the same org.
CREATE POLICY org_isolation_profiles ON profiles
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- Services / packages / clients / bookings / payments / blocks / wa_msgs / audit
-- All follow the same tenant isolation pattern.
CREATE POLICY org_isolation_services ON services
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_schedule_blocks ON schedule_blocks
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_packages ON packages
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_clients ON clients
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_client_packages ON client_packages
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_bookings ON bookings
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_payments ON payments
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY org_isolation_whatsapp_messages ON whatsapp_messages
  FOR ALL USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- audit_log: read-only for authenticated users in the org. Inserts come from
-- service-role API calls, which bypass RLS.
CREATE POLICY org_isolation_audit_log ON audit_log
  FOR SELECT USING (organization_id = current_org_id());

-- Junction tables — derive tenancy from the parent.
CREATE POLICY org_isolation_service_barbers ON service_barbers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM services s WHERE s.id = service_id AND s.organization_id = current_org_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM services s WHERE s.id = service_id AND s.organization_id = current_org_id())
  );

CREATE POLICY org_isolation_payment_splits ON payment_splits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id AND p.organization_id = current_org_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id AND p.organization_id = current_org_id())
  );

-- idempotency_keys: only the API service-role touches this. RLS enabled with
-- no policies → everyone except service-role is denied.

-- ============================================================================
-- PUBLIC VIEWS — exposed to anon for the booking widget (S3+).
-- Defined with security_invoker = off so the views run as their owner
-- (postgres) and bypass RLS on the underlying tables. Anon gets SELECT on
-- the views only — never on the underlying tables — so column exposure is
-- bounded by the view definition.
-- ============================================================================
CREATE VIEW public_org_by_slug
  WITH (security_invoker = off) AS
SELECT id, slug, name, logo_url, cover_url, theme_id, theme_config,
       hours, timezone, address, whatsapp_phone
  FROM organizations;

CREATE VIEW public_services
  WITH (security_invoker = off) AS
SELECT id, organization_id, name, description, duration_minutes,
       price_cents, photo_url, sort_order
  FROM services
 WHERE is_active = true;

CREATE VIEW public_barbers
  WITH (security_invoker = off) AS
SELECT id, organization_id, display_name, avatar_url, bio
  FROM profiles
 WHERE is_active = true AND role IN ('owner','barber');

CREATE VIEW public_packages
  WITH (security_invoker = off) AS
SELECT id, organization_id, service_id, name, qty, qty_paid, price_cents,
       validity_days, transferable
  FROM packages
 WHERE is_active = true;

GRANT SELECT ON public_org_by_slug TO anon;
GRANT SELECT ON public_services    TO anon;
GRANT SELECT ON public_barbers     TO anon;
GRANT SELECT ON public_packages    TO anon;
