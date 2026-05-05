// GET /v1/availability — returns the available slots a new booking can
// occupy for a given service + barber + date. Backed by the pure
// computeAvailability function so the logic is independently testable.
import { Hono } from 'hono';
import { AvailabilityQuerySchema } from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { BadRequest, NotFound } from '../lib/errors';
import { supabaseAsUser } from '../lib/supabase';
import {
  computeAvailability,
  type WorkingHoursMap,
  type TimeRange,
} from '../services/calendar/availability';

export const availabilityRouter = new Hono<AppEnv>();

availabilityRouter.use('/v1/availability', requireAuth);

availabilityRouter.get(
  '/v1/availability',
  validate('query', AvailabilityQuerySchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { serviceId, barberId, date } = c.req.valid('query');

    // Day window in shop tz → UTC for the bookings/blocks queries. We pad the
    // query window by one day on each side to cover any DST tail. RLS on the
    // org scopes the data; we still pass organization_id explicitly per BG §14.
    const dayStart = new Date(`${date}T00:00:00Z`).getTime();
    const dayQueryFrom = new Date(dayStart - 24 * 60 * 60_000).toISOString();
    const dayQueryTo = new Date(dayStart + 48 * 60 * 60_000).toISOString();

    const [orgRes, serviceRes, barberRes, assignmentRes, bookingsRes, blocksRes] = await Promise.all([
      supabase
        .from('organizations')
        .select('timezone, hours')
        .eq('id', user.organizationId!)
        .maybeSingle(),
      supabase
        .from('services')
        .select('id, organization_id, duration_minutes, is_active')
        .eq('organization_id', user.organizationId!)
        .eq('id', serviceId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, role, is_active, schedule')
        .eq('organization_id', user.organizationId!)
        .eq('id', barberId)
        .eq('role', 'barber')
        .maybeSingle(),
      supabase
        .from('service_barbers')
        .select('service_id')
        .eq('service_id', serviceId)
        .eq('barber_id', barberId)
        .maybeSingle(),
      supabase
        .from('bookings')
        .select('starts_at, ends_at, status, barber_id')
        .eq('organization_id', user.organizationId!)
        .eq('barber_id', barberId)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', dayQueryFrom)
        .lte('starts_at', dayQueryTo),
      supabase
        .from('schedule_blocks')
        .select('starts_at, ends_at, barber_id')
        .eq('organization_id', user.organizationId!)
        .or(`barber_id.eq.${barberId},barber_id.is.null`)
        .gte('starts_at', dayQueryFrom)
        .lte('starts_at', dayQueryTo),
    ]);

    if (orgRes.error) throw new Error(`org_lookup_failed: ${orgRes.error.message}`);
    if (!orgRes.data) throw new NotFound('organization_not_found');
    if (serviceRes.error) throw new Error(`service_lookup_failed: ${serviceRes.error.message}`);
    if (!serviceRes.data) throw new NotFound('service_not_found');
    if (!serviceRes.data.is_active) throw new BadRequest('service_inactive');
    if (barberRes.error) throw new Error(`barber_lookup_failed: ${barberRes.error.message}`);
    if (!barberRes.data || !barberRes.data.is_active) throw new NotFound('barber_not_found');
    if (assignmentRes.error)
      throw new Error(`service_assignment_lookup_failed: ${assignmentRes.error.message}`);
    if (!assignmentRes.data) throw new BadRequest('barber_not_assigned_to_service');
    if (bookingsRes.error) throw new Error(`bookings_list_failed: ${bookingsRes.error.message}`);
    if (blocksRes.error) throw new Error(`blocks_list_failed: ${blocksRes.error.message}`);

    const timezone = (orgRes.data.timezone as string) || 'America/Sao_Paulo';
    const barberSchedule = (barberRes.data.schedule ?? {}) as WorkingHoursMap;
    const orgHours = (orgRes.data.hours ?? {}) as WorkingHoursMap;
    const workingHours = Object.keys(barberSchedule).length > 0 ? barberSchedule : orgHours;

    const existingBookings: TimeRange[] = (bookingsRes.data ?? []).map((b) => ({
      startsAt: b.starts_at as string,
      endsAt: b.ends_at as string,
    }));
    const scheduleBlocks: TimeRange[] = (blocksRes.data ?? []).map((b) => ({
      startsAt: b.starts_at as string,
      endsAt: b.ends_at as string,
    }));

    const slots = computeAvailability({
      date,
      timezone,
      serviceDurationMinutes: Number(serviceRes.data.duration_minutes),
      workingHours,
      existingBookings,
      scheduleBlocks,
    });

    return c.json({ data: slots });
  },
);
