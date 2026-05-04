-- ============================================================================
-- Custom Access Token Hook — injects organization_id and role into JWTs.
-- Build Guide §5.3.
--
-- MANUAL STEP REQUIRED — Supabase dashboard (cannot be automated):
--   Authentication → Hooks → Custom Access Token Hook → enable, select
--   public.custom_access_token_hook from the dropdown.
--
-- Until the hook is wired in the dashboard, JWTs lack organization_id and
-- the API's auth middleware will treat the user as having no org.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims        jsonb;
  user_profile  RECORD;
BEGIN
  SELECT organization_id, role
    INTO user_profile
    FROM public.profiles
   WHERE id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  IF user_profile.organization_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_profile.organization_id::text));
    claims := jsonb_set(claims, '{role}',            to_jsonb(user_profile.role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant supabase_auth_admin permission to invoke the hook.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- The hook also needs to read the profiles table.
GRANT SELECT ON public.profiles TO supabase_auth_admin;
