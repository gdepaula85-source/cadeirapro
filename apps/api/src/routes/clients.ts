import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  ClientListQuerySchema,
  CreateClientInputSchema,
  UpdateClientInputSchema,
} from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { Conflict, NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

const IdParamSchema = z.object({ id: z.string().uuid() });
const PG_UNIQUE_VIOLATION = '23505';

export const clientsRouter = new Hono<AppEnv>();

clientsRouter.use('/v1/clients/*', requireAuth);
clientsRouter.use('/v1/clients', requireAuth);

clientsRouter.get('/v1/clients', validate('query', ClientListQuerySchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const { q } = c.req.valid('query');

  let db = supabase
    .from('clients')
    .select('*')
    .eq('organization_id', user.organizationId!)
    .is('anonymized_at', null)
    .order('name', { ascending: true });

  if (q) {
    db = db.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await db;
  if (error) throw new Error(`clients_list_failed: ${error.message}`);
  return c.json({ data: (data ?? []).map(clientToCamel) });
});

clientsRouter.post(
  '/v1/clients',
  requireRole('owner', 'staff'),
  idempotency,
  validate('json', CreateClientInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const input = c.req.valid('json');

    const { data, error } = await supabase
      .from('clients')
      .insert({
        organization_id: user.organizationId!,
        phone: input.phone,
        name: input.name,
        email: input.email ?? null,
        lgpd_consent_at: input.lgpdConsentAt ?? null,
        notes: input.notes ?? null,
      })
      .select('*')
      .single();

    if (error?.code === PG_UNIQUE_VIOLATION) throw new Conflict('client_phone_exists');
    if (error) throw new Error(`client_create_failed: ${error.message}`);

    await audit(c, 'client.create', data.id, { phone: data.phone, name: data.name });
    return c.json({ data: clientToCamel(data) }, 201);
  },
);

clientsRouter.get('/v1/clients/:id', validate('param', IdParamSchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const { id } = c.req.valid('param');

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', user.organizationId!)
    .eq('id', id)
    .is('anonymized_at', null)
    .maybeSingle();

  if (error) throw new Error(`client_lookup_failed: ${error.message}`);
  if (!data) throw new NotFound('client_not_found');
  return c.json({ data: clientToCamel(data) });
});

clientsRouter.patch(
  '/v1/clients/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  validate('json', UpdateClientInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');

    const patch: Record<string, unknown> = {};
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined) patch.email = input.email;
    if (input.lgpdConsentAt !== undefined) patch.lgpd_consent_at = input.lgpdConsentAt;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .is('anonymized_at', null)
      .select('*')
      .maybeSingle();

    if (error?.code === PG_UNIQUE_VIOLATION) throw new Conflict('client_phone_exists');
    if (error) throw new Error(`client_update_failed: ${error.message}`);
    if (!data) throw new NotFound('client_not_found');

    await audit(c, 'client.update', data.id, { fields: Object.keys(patch) });
    return c.json({ data: { id: data.id, anonymizedAt: data.anonymized_at } });
  },
);

// LGPD hard erase/anonymization lands in S6. Sprint 2 "delete" archives by
// anonymizing the user-facing record enough to remove it from normal lists.
clientsRouter.delete(
  '/v1/clients/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');

    const { data, error } = await supabase
      .from('clients')
      .update({
        phone: `anon:${id}`,
        name: 'Cliente removido',
        email: null,
        notes: null,
        anonymized_at: new Date().toISOString(),
      })
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .is('anonymized_at', null)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`client_archive_failed: ${error.message}`);
    if (!data) throw new NotFound('client_not_found');

    await audit(c, 'client.archive', data.id, {});
    return c.json({ data: clientToCamel(data) });
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
    entity: 'clients',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
}

function clientToCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    lgpdConsentAt: row.lgpd_consent_at,
    anonymizedAt: row.anonymized_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
