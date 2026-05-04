-- ============================================================================
-- Sign-up RPC — atomic org + profile + audit_log insert.
-- SPRINT_1 §6: "one Postgres transaction via Supabase RPC, rollback on any
-- failure". The auth.users row is created out-of-band by
-- supabaseAdmin.auth.admin.createUser BEFORE this RPC is called; if this
-- RPC fails (e.g. slug collision), the caller deletes the auth user.
--
-- p_cpf_or_cnpj: 11 digits → cpf column; 14 digits → cnpj column.
-- p_whatsapp_phone may be NULL.
-- p_platform_fee_pct comes from env.PLATFORM_FEE_DEFAULT_PCT (S1 default 0.005).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_organization_for_owner(
  p_user_id              UUID,
  p_email                TEXT,
  p_slug                 TEXT,
  p_shop_name            TEXT,
  p_cpf_or_cnpj          TEXT,
  p_primary_pix_key      TEXT,
  p_primary_pix_key_type TEXT,
  p_whatsapp_phone       TEXT,
  p_platform_fee_pct     NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_cpf    TEXT;
  v_cnpj   TEXT;
BEGIN
  IF length(p_cpf_or_cnpj) = 11 THEN
    v_cpf := p_cpf_or_cnpj;
  ELSIF length(p_cpf_or_cnpj) = 14 THEN
    v_cnpj := p_cpf_or_cnpj;
  ELSE
    RAISE EXCEPTION 'cpf_or_cnpj must be 11 or 14 digits' USING ERRCODE = '22023';
  END IF;

  -- 1. Organization. Slug uniqueness is enforced by the existing UNIQUE index;
  -- on collision Postgres raises SQLSTATE 23505 and the application retries
  -- with a different slug (caller responsibility — see services/auth/sign-up.ts).
  INSERT INTO organizations (
    slug, name, cpf, cnpj,
    primary_pix_key, primary_pix_key_type, whatsapp_phone,
    plan, trial_ends_at, platform_fee_pct
  )
  VALUES (
    p_slug, p_shop_name, v_cpf, v_cnpj,
    p_primary_pix_key, p_primary_pix_key_type, p_whatsapp_phone,
    'trial', now() + INTERVAL '14 days', p_platform_fee_pct
  )
  RETURNING id INTO v_org_id;

  -- 2. Owner profile. FK to auth.users(id) — fails if p_user_id doesn't exist.
  INSERT INTO profiles (
    id, organization_id, role, display_name, email, phone
  )
  VALUES (
    p_user_id, v_org_id, 'owner', p_shop_name, p_email, p_whatsapp_phone
  );

  -- 3. Audit row.
  INSERT INTO audit_log (
    organization_id, actor_id, actor_kind, action, entity, entity_id, payload
  )
  VALUES (
    v_org_id, p_user_id, 'user', 'organization.create', 'organizations', v_org_id,
    jsonb_build_object('slug', p_slug, 'name', p_shop_name)
  );

  RETURN jsonb_build_object('organization_id', v_org_id, 'slug', p_slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_for_owner(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) TO service_role;
