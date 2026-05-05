// Schedule block CRUD. Blocks can apply to the whole shop (barber_id null)
// or one barber, and the availability endpoint already subtracts them.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  CreateScheduleBlockInputSchema,
  ScheduleBlockListQuerySchema,
  UpdateScheduleBlockInputSchema,
} from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { BadRequest, NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

const IdParamSchema = z.object({ id: z.string().uuid() });

export const scheduleBlocksRouter = new Hono<AppEnv>();

scheduleBlocksRouter.use('/v1/schedule-blocks/*', requireAuth);
scheduleBlocksRouter.use('/v1/schedule-blocks', requireAuth);

scheduleBlocksRouter.get(
  '/v1/schedule-blocks',
  validate('query', ScheduleBlockListQuerySchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const query = c.req.valid('query');

    let db = supabase
      .from('schedule_blocks')
      .select(
        'id, organization_id, barber_id, starts_at, ends_at, reason, created_at, profiles!schedule_blocks_barber_id_fkey(display_name)',
      )
      .eq('organization_id', user.organizationId!)
      .lt('starts_at', query.to)
      .gt('ends_at', query.from)
      .order('starts_at', { ascending: true });

    if (query.barberId) {
      db = db.or(`barber_id.eq.${query.barberId},barber_id.is.null`);
    }

    const { data, error } = await db;
    if (error) throw new Error(`schedule_blocks_list_failed: ${error.message}`);
    return c.json({ data: (data ?? []).map(scheduleBlockToCamel) });
  },
);

scheduleBlocksRouter.post(
  '/v1/schedule-blocks',
  requireRole('owner', 'staff'),
  idempotency,
  validate('json', CreateScheduleBlockInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const input = c.req.valid('json');

    if (input.barberId) await assertActiveBarber(supabase, user.organizationId!, input.barberId);

    const { data, error } = await supabase
      .from('schedule_blocks')
      .insert({
        organization_id: user.organizationId!,
        barber_id: input.barberId ?? null,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        reason: input.reason ?? null,
      })
      .select(
        'id, organization_id, barber_id, starts_at, ends_at, reason, created_at, profiles!schedule_blocks_barber_id_fkey(display_name)',
      )
      .single();

    if (error) throw new Error(`schedule_block_create_failed: ${error.message}`);
    await audit(c, 'schedule_block.create', data.id, {
      barber_id: data.barber_id,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
    });
    return c.json({ data: scheduleBlockToCamel(data) }, 201);
  },
);

scheduleBlocksRouter.patch(
  '/v1/schedule-blocks/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  validate('json', UpdateScheduleBlockInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');

    const current = await supabase
      .from('schedule_blocks')
      .select('id, starts_at, ends_at')
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .maybeSingle();
    if (current.error) throw new Error(`schedule_block_lookup_failed: ${current.error.message}`);
    if (!current.data) throw new NotFound('schedule_block_not_found');

    if (input.barberId) await assertActiveBarber(supabase, user.organizationId!, input.barberId);

    const startsAt = input.startsAt ?? (current.data.starts_at as string);
    const endsAt = input.endsAt ?? (current.data.ends_at as string);
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new BadRequest('invalid_schedule_block_range');
    }

    const patch: Record<string, unknown> = {};
    if (input.barberId !== undefined) patch.barber_id = input.barberId;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
    if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
    if (input.reason !== undefined) patch.reason = input.reason;

    const { data, error } = await supabase
      .from('schedule_blocks')
      .update(patch)
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select(
        'id, organization_id, barber_id, starts_at, ends_at, reason, created_at, profiles!schedule_blocks_barber_id_fkey(display_name)',
      )
      .maybeSingle();

    if (error) throw new Error(`schedule_block_update_failed: ${error.message}`);
    if (!data) throw new NotFound('schedule_block_not_found');
    await audit(c, 'schedule_block.update', data.id, { fields: Object.keys(patch) });
    return c.json({ data: scheduleBlockToCamel(data) });
  },
);

scheduleBlocksRouter.delete(
  '/v1/schedule-blocks/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');

    const { data, error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select(
        'id, organization_id, barber_id, starts_at, ends_at, reason, created_at, profiles!schedule_blocks_barber_id_fkey(display_name)',
      )
      .maybeSingle();

    if (error) throw new Error(`schedule_block_delete_failed: ${error.message}`);
    if (!data) throw new NotFound('schedule_block_not_found');
    await audit(c, 'schedule_block.delete', data.id, {
      barber_id: data.barber_id,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
    });
    return c.json({ data: scheduleBlockToCamel(data) });
  },
);

async function assertActiveBarber(
  supabase: ReturnType<typeof supabaseAsUser>,
  organizationId: string,
  barberId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_active, role')
    .eq('organization_id', organizationId)
    .eq('id', barberId)
    .eq('role', 'barber')
    .maybeSingle();
  if (error) throw new Error(`barber_lookup_failed: ${error.message}`);
  if (!data || !data.is_active) throw new BadRequest('invalid_barber');
}

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
    entity: 'schedule_blocks',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
}

function joinedProfileName(row: Record<string, unknown>): string | null {
  const profile = row.profiles;
  if (Array.isArray(profile)) return (profile[0]?.display_name as string | undefined) ?? null;
  return ((profile as Record<string, unknown> | null)?.display_name as string | undefined) ?? null;
}

function scheduleBlockToCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    barberId: row.barber_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
    barberName: joinedProfileName(row),
    createdAt: row.created_at,
  };
}
