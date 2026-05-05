// PATCH /v1/organization — owner edits shop info, working hours, branding.
// The /v1/me endpoint already serves the org for read; this only adds
// owner-controlled writes.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { UpdateOrganizationInputSchema } from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

export const organizationRouter = new Hono<AppEnv>();

organizationRouter.use('/v1/organization', requireAuth);

organizationRouter.patch(
  '/v1/organization',
  requireRole('owner'),
  idempotency,
  validate('json', UpdateOrganizationInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const config = c.get('config');
    const supabase = supabaseAsUser(config, user.accessToken);
    const input = c.req.valid('json');

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.legalName !== undefined) patch.legal_name = input.legalName;
    if (input.cnpj !== undefined) patch.cnpj = input.cnpj;
    if (input.cpf !== undefined) patch.cpf = input.cpf;
    if (input.primaryPixKey !== undefined) patch.primary_pix_key = input.primaryPixKey;
    if (input.primaryPixKeyType !== undefined) patch.primary_pix_key_type = input.primaryPixKeyType;
    if (input.whatsappPhone !== undefined) patch.whatsapp_phone = input.whatsappPhone;
    if (input.address !== undefined) patch.address = input.address;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
    if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl;
    if (input.hours !== undefined) patch.hours = input.hours;
    if (input.themeId !== undefined) patch.theme_id = input.themeId;
    if (input.themeConfig !== undefined) patch.theme_config = input.themeConfig;

    const { data, error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', user.organizationId!)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`organization_update_failed: ${error.message}`);
    if (!data) throw new NotFound('organization_not_found');

    await audit(c, 'organization.update', data.id, { fields: Object.keys(patch) });
    return c.json({ data: organizationToCamel(data) });
  },
);

async function audit(
  c: Context<AppEnv>,
  action: string,
  entityId: string,
  payload: Record<string, unknown>,
) {
  const user = c.get('user')!;
  const { error } = await writeAuditLog(supabaseAdmin(c.get('config')), {
    organizationId: user.organizationId!,
    actorId: user.id,
    actorKind: 'user',
    action,
    entity: 'organizations',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
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
    platformFeePct: row.platform_fee_pct === null ? 0 : Number(row.platform_fee_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
