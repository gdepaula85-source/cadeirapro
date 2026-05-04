// Bookings CRUD. The bookings table already exists from migration 0001 with
// a no_overlap_per_barber EXCLUDE constraint, so the database itself rejects
// double-bookings — we surface that as 409 conflict_overlap.
//
// status semantics:
//   - manual owner-created bookings default to 'confirmed' (skip-pay path)
//   - widget bookings will land as 'pending' in S3 and flip to 'confirmed'
//     via Transfeera webhook
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  BookingListQuerySchema,
  CreateBookingInputSchema,
  UpdateBookingInputSchema,
} from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { BadRequest, Conflict, NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

const IdParamSchema = z.object({ id: z.string().uuid() });
const PG_EXCLUSION_VIOLATION = '23P01'; // no_overlap_per_barber
const PG_FK_VIOLATION = '23503';

export const bookingsRouter = new Hono<AppEnv>();

bookingsRouter.use('/v1/bookings/*', requireAuth);
bookingsRouter.use('/v1/bookings', requireAuth);

bookingsRouter.get('/v1/bookings', validate('query', BookingListQuerySchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const { from, to, barberId, status } = c.req.valid('query');

  let db = supabase
    .from('bookings')
    .select(
      'id, organization_id, client_id, barber_id, service_id, starts_at, ends_at, status, source, notes, cancellation_reason, cancelled_at, created_at, updated_at, ' +
        'clients(name, phone), profiles!bookings_barber_id_fkey(display_name), services(name, duration_minutes, price_cents)',
    )
    .eq('organization_id', user.organizationId!)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at', { ascending: true });

  if (barberId) db = db.eq('barber_id', barberId);
  if (status) db = db.eq('status', status);

  const { data, error } = await db;
  if (error) throw new Error(`bookings_list_failed: ${error.message}`);
  return c.json({ data: (data ?? []).map(bookingToCamel) });
});

bookingsRouter.post(
  '/v1/bookings',
  requireRole('owner', 'staff'),
  idempotency,
  validate('json', CreateBookingInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const config = c.get('config');
    const input = c.req.valid('json');
    const supabase = supabaseAsUser(config, user.accessToken);

    // Look up service duration to compute ends_at server-side. Don't trust
    // the client to send the right end time.
    const serviceRes = await supabase
      .from('services')
      .select('id, organization_id, duration_minutes, is_active')
      .eq('organization_id', user.organizationId!)
      .eq('id', input.serviceId)
      .maybeSingle();

    if (serviceRes.error)
      throw new Error(`booking_service_lookup_failed: ${serviceRes.error.message}`);
    if (!serviceRes.data) throw new NotFound('service_not_found');
    if (!serviceRes.data.is_active) throw new BadRequest('service_inactive');

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequest('invalid_starts_at');
    const endsAt = new Date(startsAt.getTime() + Number(serviceRes.data.duration_minutes) * 60_000);

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        organization_id: user.organizationId!,
        client_id: input.clientId,
        barber_id: input.barberId,
        service_id: input.serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: input.status,
        source: input.source,
        notes: input.notes ?? null,
      })
      .select(
        'id, organization_id, client_id, barber_id, service_id, starts_at, ends_at, status, source, notes, cancellation_reason, cancelled_at, created_at, updated_at, ' +
          'clients(name, phone), profiles!bookings_barber_id_fkey(display_name), services(name, duration_minutes, price_cents)',
      )
      .single();

    if (error?.code === PG_EXCLUSION_VIOLATION) throw new Conflict('booking_overlap');
    if (error?.code === PG_FK_VIOLATION) throw new BadRequest('invalid_reference');
    if (error) throw new Error(`booking_create_failed: ${error.message}`);

    const row = data as unknown as Record<string, unknown>;
    await audit(c, 'booking.create', row.id as string, {
      starts_at: row.starts_at,
      barber_id: row.barber_id,
      client_id: row.client_id,
      service_id: row.service_id,
    });
    return c.json({ data: bookingToCamel(row) }, 201);
  },
);

bookingsRouter.get('/v1/bookings/:id', validate('param', IdParamSchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const { id } = c.req.valid('param');

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, organization_id, client_id, barber_id, service_id, starts_at, ends_at, status, source, notes, cancellation_reason, cancelled_at, created_at, updated_at, ' +
        'clients(name, phone), profiles!bookings_barber_id_fkey(display_name), services(name, duration_minutes, price_cents)',
    )
    .eq('organization_id', user.organizationId!)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`booking_lookup_failed: ${error.message}`);
  if (!data) throw new NotFound('booking_not_found');
  return c.json({ data: bookingToCamel(data) });
});

bookingsRouter.patch(
  '/v1/bookings/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  validate('json', UpdateBookingInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');

    // If startsAt changes, recompute ends_at from the existing service duration.
    const patch: Record<string, unknown> = {};

    if (input.startsAt !== undefined) {
      // Need the service duration. Fetch the booking + service in one round
      // trip to avoid a race.
      const cur = await supabase
        .from('bookings')
        .select('service_id, services(duration_minutes)')
        .eq('organization_id', user.organizationId!)
        .eq('id', id)
        .maybeSingle();
      if (cur.error) throw new Error(`booking_lookup_failed: ${cur.error.message}`);
      if (!cur.data) throw new NotFound('booking_not_found');

      const dur = (cur.data as unknown as { services: { duration_minutes: number } }).services
        .duration_minutes;
      const startsAt = new Date(input.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw new BadRequest('invalid_starts_at');
      patch.starts_at = startsAt.toISOString();
      patch.ends_at = new Date(startsAt.getTime() + Number(dur) * 60_000).toISOString();
    }

    if (input.barberId !== undefined) patch.barber_id = input.barberId;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.cancellationReason !== undefined)
      patch.cancellation_reason = input.cancellationReason;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === 'cancelled') patch.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(patch)
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select(
        'id, organization_id, client_id, barber_id, service_id, starts_at, ends_at, status, source, notes, cancellation_reason, cancelled_at, created_at, updated_at, ' +
          'clients(name, phone), profiles!bookings_barber_id_fkey(display_name), services(name, duration_minutes, price_cents)',
      )
      .maybeSingle();

    if (error?.code === PG_EXCLUSION_VIOLATION) throw new Conflict('booking_overlap');
    if (error) throw new Error(`booking_update_failed: ${error.message}`);
    if (!data) throw new NotFound('booking_not_found');

    const row = data as unknown as Record<string, unknown>;
    await audit(c, 'booking.update', row.id as string, { fields: Object.keys(patch) });
    return c.json({ data: bookingToCamel(row) });
  },
);

bookingsRouter.delete(
  '/v1/bookings/:id',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select(
        'id, organization_id, client_id, barber_id, service_id, starts_at, ends_at, status, source, notes, cancellation_reason, cancelled_at, created_at, updated_at, ' +
          'clients(name, phone), profiles!bookings_barber_id_fkey(display_name), services(name, duration_minutes, price_cents)',
      )
      .maybeSingle();

    if (error) throw new Error(`booking_cancel_failed: ${error.message}`);
    if (!data) throw new NotFound('booking_not_found');

    const row = data as unknown as Record<string, unknown>;
    await audit(c, 'booking.cancel', row.id as string, {});
    return c.json({ data: bookingToCamel(row) });
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
    entity: 'bookings',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
}

// supabase-js doesn't carry types for joined selects without generated DB
// types — the helper accepts an unknown record and pulls fields by name.
interface JoinedClient {
  name?: string;
  phone?: string;
}
interface JoinedBarber {
  display_name?: string;
}
interface JoinedService {
  name?: string;
  duration_minutes?: number;
  price_cents?: number;
}

function bookingToCamel(row: unknown) {
  const r = row as Record<string, unknown>;
  const clients = r.clients as JoinedClient | null | undefined;
  const profiles = r.profiles as JoinedBarber | null | undefined;
  const services = r.services as JoinedService | null | undefined;
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    clientId: r.client_id as string,
    barberId: r.barber_id as string,
    serviceId: r.service_id as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    status: r.status as string,
    source: r.source as string,
    notes: (r.notes as string | null) ?? null,
    cancellationReason: (r.cancellation_reason as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    clientName: clients?.name ?? null,
    clientPhone: clients?.phone ?? null,
    barberName: profiles?.display_name ?? null,
    serviceName: services?.name ?? null,
    serviceDurationMinutes: services?.duration_minutes ?? null,
    servicePriceCents: services?.price_cents ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
