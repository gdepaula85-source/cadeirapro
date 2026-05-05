-- ============================================================================
-- Migration 0004 — Customer auth foundation.
--
-- Adds the column + hook update needed to support per-shop customer accounts
-- alongside the existing owner/staff/barber auth surface.
--
-- MANUAL STEP REQUIRED — Supabase dashboard SQL Editor:
--   Apply this entire file. Then verify via Authentication → Hooks →
--   Custom Access Token Hook that the function is still selected
--   (it's the same name, so the existing config carries over).
--
-- Design notes:
--
-- 1. clients.auth_user_id links a clients row to a Supabase auth user.
--    NULL for anonymous bookings (the existing public-booking widget flow
--    keeps working). Populated on customer signup; phone-based linking
--    merges any pre-existing anonymous booking history into the new
--    account so customers see their full history on first login.
--
-- 2. UNIQUE constraint on auth_user_id: one auth user maps to at most one
--    clients row. The product is per-shop white-label — a customer who
--    visits a second shop signs up there with a different email.
--
-- 3. Hook update — for customer auth users we inject role='customer' but
--    DELIBERATELY DO NOT inject organization_id. This is the key security
--    decision:
--      - Owner JWTs carry organization_id → RLS filters tenant tables for
--        them as the user. Defense-in-depth on top of API-level filters.
--      - Customer JWTs lack organization_id → if a customer JWT hits any
--        existing owner endpoint (/v1/bookings, /v1/services, etc.), the
--        existing requireAuth middleware throws claims_missing 401. They
--        cannot accidentally read other customers' data via RLS even if
--        an API bug forgot to filter.
--      - Customer queries route through the new /v1/customer/* endpoints
--        which use service_role + manual scope-by-clients.auth_user_id.
--    No RLS policy changes are needed for this migration; the existing
--    org_isolation policies already deny customer JWTs (no org claim →
--    current_org_id() returns NULL → no rows match).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Column + indexes on clients.
-- ----------------------------------------------------------------------------

ALTER TABLE clients
  ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- One auth user → at most one clients row, across all orgs.
CREATE UNIQUE INDEX idx_clients_auth_user_id
  ON clients(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- The auth hook looks up by auth_user_id to find the linked org.
-- Already covered by the unique index above; no separate index needed.

-- ----------------------------------------------------------------------------
-- 2. Auth hook — extend to also surface role='customer' for linked users.
--    organization_id is intentionally NOT injected for customers (see header).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims        jsonb;
  user_profile  RECORD;
  client_org    UUID;
BEGIN
  claims := event -> 'claims';

  -- Owner / staff / barber path (existing behavior). Wins over customer
  -- if both somehow exist (an owner shouldn't also be a customer at their
  -- own shop, but if data drifts we err on the side of the higher-trust
  -- role).
  SELECT organization_id, role
    INTO user_profile
    FROM public.profiles
   WHERE id = (event ->> 'user_id')::uuid;

  IF user_profile.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_profile.organization_id::text));
    claims := jsonb_set(claims, '{role}',            to_jsonb(user_profile.role));
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END IF;

  -- Customer path. role='customer' only — no organization_id. Server-side
  -- /v1/customer/* endpoints look up the org via clients.auth_user_id.
  SELECT organization_id
    INTO client_org
    FROM public.clients
   WHERE auth_user_id = (event ->> 'user_id')::uuid;

  IF client_org IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb('customer'::text));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- The hook needs read access to clients (already has it for profiles from 0002).
GRANT SELECT ON public.clients TO supabase_auth_admin;
