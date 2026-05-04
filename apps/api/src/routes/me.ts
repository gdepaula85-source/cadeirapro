// GET /v1/me — bootstrap endpoint for the dashboard.
// Returns { data: { user: Profile, organization: Organization } } using the
// caller's JWT, so RLS applies (defense in depth alongside the manual
// organization_id filter).
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireAuth } from '../middleware/auth';
import { supabaseAsUser } from '../lib/supabase';
import { NotFound } from '../lib/errors';

export const meRouter = new Hono<AppEnv>();

meRouter.get('/v1/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const config = c.get('config');
  const supabase = supabaseAsUser(config, user.accessToken);

  const [profileRes, orgRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('organizations').select('*').eq('id', user.organizationId!).maybeSingle(),
  ]);

  if (profileRes.error) throw new Error(`profile_lookup_failed: ${profileRes.error.message}`);
  if (orgRes.error) throw new Error(`org_lookup_failed: ${orgRes.error.message}`);
  if (!profileRes.data) throw new NotFound('profile_not_found');
  if (!orgRes.data) throw new NotFound('organization_not_found');

  return c.json({
    data: {
      user: profileToCamel(profileRes.data),
      organization: organizationToCamel(orgRes.data),
    },
  });
});

// DB → API casing translation. Snake → camel, narrow types live in
// @cadeirapro/shared. Manual for now; consider a generic serializer if this
// pattern repeats across many endpoints in S2.
function profileToCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    pixKey: row.pix_key,
    pixKeyType: row.pix_key_type,
    commissionPct: row.commission_pct === null ? null : Number(row.commission_pct),
    partnerStatus: row.partner_status,
    isActive: row.is_active,
    schedule: row.schedule,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function organizationToCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    legalName: row.legal_name,
    cnpj: row.cnpj,
    cpf: row.cpf,
    address: row.address,
    timezone: row.timezone,
    currency: row.currency,
    primaryPixKey: row.primary_pix_key,
    primaryPixKeyType: row.primary_pix_key_type,
    whatsappPhone: row.whatsapp_phone,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    themeId: row.theme_id,
    themeConfig: row.theme_config,
    hours: row.hours,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    platformFeePct: Number(row.platform_fee_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
