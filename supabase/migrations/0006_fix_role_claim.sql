-- ============================================================================
-- Migration 0006 — Harden custom_access_token_hook (two fixes in one).
--
-- Two distinct bugs surfaced as 401s on every authenticated API call:
--
-- (1) The hook in 0002/0004 wrote the app role ('owner','barber','staff',
--     'customer') into the JWT 'role' claim. Supabase/PostgREST treat 'role'
--     as the PostgreSQL role and run SET LOCAL ROLE from it — every request
--     errored with: role "owner" does not exist.
--     Fix: write the app role into 'user_role' and leave 'role' alone so
--     Supabase keeps it as 'authenticated' (the default PostgREST expects).
--
-- (2) The hook ran with default SECURITY INVOKER, i.e. as supabase_auth_admin.
--     That role has table-level GRANTs on public.profiles but is still subject
--     to RLS, and at hook execution time there is no JWT context yet — so
--     auth.jwt()-based RLS policies (current_org_id()) filter every row out.
--     The SELECT silently returned no rows, organization_id was never injected
--     into the JWT, and the API rejected every request as 'unauthorized' or
--     'claims_missing'.
--     Fix: declare the function SECURITY DEFINER + SET search_path = public
--     so it runs as the function owner (postgres, which bypasses RLS) with a
--     pinned search path (standard hardening to prevent schema-hijacking).
--     Then re-apply the standard hook grants.
--
-- MANUAL STEP REQUIRED:
--   1. Apply this file in the Supabase SQL Editor.
--   2. Have any signed-in users sign out + sign in (or call
--      supabase.auth.refreshSession()) so their JWT is reissued.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims        jsonb;
  user_profile  RECORD;
  client_org    UUID;
BEGIN
  claims := event -> 'claims';

  SELECT organization_id, role
    INTO user_profile
    FROM public.profiles
   WHERE id = (event ->> 'user_id')::uuid;

  IF user_profile.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_profile.organization_id::text));
    claims := jsonb_set(claims, '{user_role}',       to_jsonb(user_profile.role));
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END IF;

  SELECT organization_id
    INTO client_org
    FROM public.clients
   WHERE auth_user_id = (event ->> 'user_id')::uuid;

  IF client_org IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb('customer'::text));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Re-apply standard auth-hook grants. SECURITY DEFINER makes the function run
-- as its owner regardless, but EXECUTE still needs to be granted to the role
-- that calls it (supabase_auth_admin), and explicitly revoked from anyone else
-- so it cannot be invoked from app SQL.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
