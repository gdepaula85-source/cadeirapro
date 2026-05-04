import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  CreateServiceInputSchema,
  ServiceListQuerySchema,
  UpdateServiceInputSchema,
} from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

const IdParamSchema = z.object({ id: z.string().uuid() });

export const servicesRouter = new Hono<AppEnv>();

servicesRouter.use('/v1/services/*', requireAuth);
servicesRouter.use('/v1/services', requireAuth);

servicesRouter.get('/v1/services', validate('query', ServiceListQuerySchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const query = c.req.valid('query');

  let db = supabase
    .from('services')
    .select('*')
    .eq('organization_id', user.organizationId!)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!query.includeInactive) db = db.eq('is_active', true);

  const { data, error } = await db;
  if (error) throw new Error(`services_list_failed: ${error.message}`);
  return c.json({ data: (data ?? []).map(serviceToCamel) });
});

servicesRouter.post(
  '/v1/services',
  requireRole('owner', 'staff'),
  idempotency,
  validate('json', CreateServiceInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const config = c.get('config');
    const input = c.req.valid('json');
    const supabase = supabaseAsUser(config, user.accessToken);

    const { data, error } = await supabase
      .from('services')
      .insert({
        organization_id: user.organizationId!,
        name: input.name,
        description: input.description ?? null,
        duration_minutes: input.durationMinutes,
        price_cents: input.priceCents,
        photo_url: input.photoUrl ?? null,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      })
      .select('*')
      .single();

    if (error) throw new Error(`service_create_failed: ${error.message}`);

    await audit(c, 'service.create', data.id, { name: data.name });
    return c.json({ data: serviceToCamel(data) }, 201);
  },
);

servicesRouter.get('/v1/services/:id', validate('param', IdParamSchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const { id } = c.req.valid('param');

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', user.organizationId!)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`service_lookup_failed: ${error.message}`);
  if (!data) throw new NotFound('service_not_found');
  return c.json({ data: serviceToCamel(data) });
});

servicesRouter.patch(
  '/v1/services/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  validate('json', UpdateServiceInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
    if (input.priceCents !== undefined) patch.price_cents = input.priceCents;
    if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

    const { data, error } = await supabase
      .from('services')
      .update(patch)
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`service_update_failed: ${error.message}`);
    if (!data) throw new NotFound('service_not_found');

    await audit(c, 'service.update', data.id, { fields: Object.keys(patch) });
    return c.json({ data: serviceToCamel(data) });
  },
);

servicesRouter.delete(
  '/v1/services/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');

    const { data, error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`service_archive_failed: ${error.message}`);
    if (!data) throw new NotFound('service_not_found');

    await audit(c, 'service.archive', data.id, { name: data.name });
    return c.json({ data: serviceToCamel(data) });
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
    entity: 'services',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
}

function serviceToCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    photoUrl: row.photo_url,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
