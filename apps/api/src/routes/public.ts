// Public booking widget API. These routes are intentionally unauthenticated:
// they expose only the public shop/service/barber surface and create pending
// widget bookings for customers.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { validate } from '../middleware/validate';
import { BadRequest, Conflict, NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAnon } from '../lib/supabase';
import {
  computeAvailability,
  type TimeRange,
  type WorkingHoursMap,
} from '../services/calendar/availability';

const SlugParamSchema = z.object({
  slug: z.string().trim().min(2).max(80),
});

const PublicBarbersQuerySchema = z.object({
  serviceId: z.string().uuid().optional(),
});

const PublicAvailabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

const CustomerSignUpInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'phone must be E.164'),
  email: z.string().trim().email().max(120),
  password: z.string().min(10).max(128),
});

const PublicBookingInputSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  startsAt: z.string().datetime(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'phone must be E.164'),
  customerEmail: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      z.string().trim().email().nullable().optional(),
    )
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
});

const PG_EXCLUSION_VIOLATION = '23P01';

export const publicRouter = new Hono<AppEnv>();

publicRouter.get('/v1/public/orgs/:slug', validate('param', SlugParamSchema), async (c) => {
  const { slug } = c.req.valid('param');
  const supabase = supabaseAnon(c.get('config'));

  const { data, error } = await supabase
    .from('public_org_by_slug')
    .select(
      'id, slug, name, logo_url, cover_url, theme_id, theme_config, hours, timezone, address, whatsapp_phone',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`public_org_lookup_failed: ${error.message}`);
  if (!data) throw new NotFound('public_org_not_found');
  return c.json({ data: orgToCamel(data) });
});

publicRouter.get(
  '/v1/public/orgs/:slug/services',
  validate('param', SlugParamSchema),
  async (c) => {
    const org = await lookupPublicOrg(c, c.req.valid('param').slug);
    const supabase = supabaseAnon(c.get('config'));

    const { data, error } = await supabase
      .from('public_services')
      .select(
        'id, organization_id, name, description, duration_minutes, price_cents, photo_url, sort_order',
      )
      .eq('organization_id', org.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw new Error(`public_services_list_failed: ${error.message}`);
    return c.json({ data: (data ?? []).map(serviceToCamel) });
  },
);

publicRouter.get(
  '/v1/public/orgs/:slug/barbers',
  validate('param', SlugParamSchema),
  validate('query', PublicBarbersQuerySchema),
  async (c) => {
    const org = await lookupPublicOrg(c, c.req.valid('param').slug);
    const { serviceId } = c.req.valid('query');
    const supabase = supabaseAnon(c.get('config'));

    let db = supabase
      .from('public_barbers')
      .select('id, organization_id, display_name, avatar_url, bio, rating_count, rating_average')
      .eq('organization_id', org.id)
      .order('display_name', { ascending: true });

    if (serviceId) {
      const admin = supabaseAdmin(c.get('config'));
      const assignments = await admin
        .from('service_barbers')
        .select('barber_id, services!inner(organization_id)')
        .eq('service_id', serviceId)
        .eq('services.organization_id', org.id);
      if (assignments.error)
        throw new Error(`public_service_barbers_lookup_failed: ${assignments.error.message}`);
      const barberIds = (assignments.data ?? []).map((row) => row.barber_id as string);
      if (barberIds.length === 0) return c.json({ data: [] });
      db = db.in('id', barberIds);
    }

    const { data, error } = await db;
    if (error) throw new Error(`public_barbers_list_failed: ${error.message}`);
    return c.json({ data: (data ?? []).map(barberToCamel) });
  },
);

publicRouter.get(
  '/v1/public/orgs/:slug/availability',
  validate('param', SlugParamSchema),
  validate('query', PublicAvailabilityQuerySchema),
  async (c) => {
    const org = await lookupPublicOrg(c, c.req.valid('param').slug);
    const { serviceId, barberId, date } = c.req.valid('query');
    const slots = await computePublicSlots(c, org.id, serviceId, barberId, date);
    return c.json({ data: slots });
  },
);

publicRouter.post(
  '/v1/public/orgs/:slug/bookings',
  validate('param', SlugParamSchema),
  validate('json', PublicBookingInputSchema),
  async (c) => {
    const config = c.get('config');
    const org = await lookupPublicOrg(c, c.req.valid('param').slug);
    const input = c.req.valid('json');
    const supabase = supabaseAdmin(config);

    const service = await supabase
      .from('services')
      .select('id, duration_minutes, is_active')
      .eq('organization_id', org.id)
      .eq('id', input.serviceId)
      .maybeSingle();
    if (service.error)
      throw new Error(`public_booking_service_lookup_failed: ${service.error.message}`);
    if (!service.data || !service.data.is_active) throw new NotFound('service_not_found');

    await assertBarberCanPerformService(supabase, org.id, input.barberId, input.serviceId);

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequest('invalid_starts_at');
    const endsAt = new Date(startsAt.getTime() + Number(service.data.duration_minutes) * 60_000);

    const client = await supabase
      .from('clients')
      .upsert(
        {
          organization_id: org.id,
          phone: input.customerPhone,
          name: input.customerName,
          email: input.customerEmail ?? null,
          lgpd_consent_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,phone' },
      )
      .select('id')
      .single();
    if (client.error)
      throw new Error(`public_booking_client_upsert_failed: ${client.error.message}`);

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        organization_id: org.id,
        client_id: client.data.id,
        barber_id: input.barberId,
        service_id: input.serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'pending',
        source: 'widget',
        notes: input.notes ?? null,
      })
      .select('id, starts_at, ends_at, status')
      .single();

    if (error?.code === PG_EXCLUSION_VIOLATION) throw new Conflict('booking_overlap');
    if (error) throw new Error(`public_booking_create_failed: ${error.message}`);

    return c.json(
      {
        data: {
          id: data.id as string,
          startsAt: data.starts_at as string,
          endsAt: data.ends_at as string,
          status: data.status as string,
        },
      },
      201,
    );
  },
);

publicRouter.post(
  '/v1/public/orgs/:slug/customer/sign-up',
  validate('param', SlugParamSchema),
  validate('json', CustomerSignUpInputSchema),
  async (c) => {
    const { slug } = c.req.valid('param');
    const input = c.req.valid('json');
    const config = c.get('config');
    const admin = supabaseAdmin(config);

    const orgRes = await admin
      .from('organizations')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle();
    if (orgRes.error) throw new Error(`customer_signup_org_lookup_failed: ${orgRes.error.message}`);
    if (!orgRes.data) throw new NotFound('public_org_not_found');
    const orgId = orgRes.data.id as string;

    // Pre-flight: if a clients row in this org already has the same phone
    // AND it's already linked to a different auth user, fail before
    // creating an auth user we'd just have to roll back.
    const existingRes = await admin
      .from('clients')
      .select('id, auth_user_id')
      .eq('organization_id', orgId)
      .eq('phone', input.phone)
      .maybeSingle();
    if (existingRes.error)
      throw new Error(`customer_signup_clients_lookup_failed: ${existingRes.error.message}`);
    if (existingRes.data?.auth_user_id) {
      throw new Conflict('phone_already_linked', {
        hint: 'this phone is linked to an existing account at this shop — sign in instead',
      });
    }

    // Create the Supabase auth user. email_confirm: true skips the email
    // verification flow for the MVP — customers can log in immediately.
    // S4 follow-up: flip to email_confirm: false once the email template
    // and "Confirme seu e-mail" page are wired.
    const userRes = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (userRes.error) {
      const msg = userRes.error.message ?? '';
      if (/already registered/i.test(msg) || /already exists/i.test(msg)) {
        throw new Conflict('email_in_use');
      }
      throw new Error(`customer_signup_auth_create_failed: ${msg}`);
    }
    const authUserId = userRes.data.user!.id;

    try {
      if (existingRes.data) {
        // Link the existing (anonymous) clients row. Booking history merges
        // automatically via the existing client_id FK on bookings.
        const linkRes = await admin
          .from('clients')
          .update({
            auth_user_id: authUserId,
            name: input.name,
            email: input.email,
            lgpd_consent_at: new Date().toISOString(),
          })
          .eq('id', existingRes.data.id);
        if (linkRes.error) throw new Error(`customer_signup_link_failed: ${linkRes.error.message}`);
      } else {
        const createRes = await admin.from('clients').insert({
          organization_id: orgId,
          phone: input.phone,
          name: input.name,
          email: input.email,
          auth_user_id: authUserId,
          lgpd_consent_at: new Date().toISOString(),
        });
        if (createRes.error)
          throw new Error(`customer_signup_create_failed: ${createRes.error.message}`);
      }
    } catch (err) {
      // Roll back the auth user so the customer can retry. Best-effort —
      // log if the rollback itself fails so we can clean up manually.
      const cleanup = await admin.auth.admin.deleteUser(authUserId);
      if (cleanup.error) {
        c.get('logger').warn('customer_signup_rollback_failed', {
          authUserId,
          error: cleanup.error.message,
        });
      }
      throw err;
    }

    return c.json(
      {
        data: {
          userId: authUserId,
          organizationId: orgId,
          slug: orgRes.data.slug as string,
        },
      },
      201,
    );
  },
);

async function lookupPublicOrg(c: Context<AppEnv>, slug: string) {
  const supabase = supabaseAnon(c.get('config'));
  const { data, error } = await supabase
    .from('public_org_by_slug')
    .select('id, slug, name, timezone, hours')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`public_org_lookup_failed: ${error.message}`);
  if (!data) throw new NotFound('public_org_not_found');
  return data as {
    id: string;
    slug: string;
    name: string;
    timezone: string | null;
    hours: unknown;
  };
}

async function computePublicSlots(
  c: Context<AppEnv>,
  organizationId: string,
  serviceId: string,
  barberId: string,
  date: string,
) {
  const supabase = supabaseAdmin(c.get('config'));
  const dayStart = new Date(`${date}T00:00:00Z`).getTime();
  const dayQueryFrom = new Date(dayStart - 24 * 60 * 60_000).toISOString();
  const dayQueryTo = new Date(dayStart + 48 * 60 * 60_000).toISOString();

  const [orgRes, serviceRes, barberRes, assignmentRes, bookingsRes, blocksRes] = await Promise.all([
    supabase.from('organizations').select('timezone, hours').eq('id', organizationId).maybeSingle(),
    supabase
      .from('services')
      .select('id, duration_minutes, is_active')
      .eq('organization_id', organizationId)
      .eq('id', serviceId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, role, is_active, schedule')
      .eq('organization_id', organizationId)
      .eq('id', barberId)
      .in('role', ['owner', 'barber'])
      .maybeSingle(),
    supabase
      .from('service_barbers')
      .select('service_id')
      .eq('service_id', serviceId)
      .eq('barber_id', barberId)
      .maybeSingle(),
    supabase
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('organization_id', organizationId)
      .eq('barber_id', barberId)
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', dayQueryFrom)
      .lte('starts_at', dayQueryTo),
    supabase
      .from('schedule_blocks')
      .select('starts_at, ends_at')
      .eq('organization_id', organizationId)
      .or(`barber_id.eq.${barberId},barber_id.is.null`)
      .gte('starts_at', dayQueryFrom)
      .lte('starts_at', dayQueryTo),
  ]);

  if (orgRes.error) throw new Error(`public_org_lookup_failed: ${orgRes.error.message}`);
  if (!orgRes.data) throw new NotFound('public_org_not_found');
  if (serviceRes.error)
    throw new Error(`public_service_lookup_failed: ${serviceRes.error.message}`);
  if (!serviceRes.data || !serviceRes.data.is_active) throw new NotFound('service_not_found');
  if (barberRes.error) throw new Error(`public_barber_lookup_failed: ${barberRes.error.message}`);
  if (!barberRes.data || !barberRes.data.is_active) throw new NotFound('barber_not_found');
  if (assignmentRes.error)
    throw new Error(`public_service_assignment_lookup_failed: ${assignmentRes.error.message}`);
  if (!assignmentRes.data) throw new BadRequest('barber_not_assigned_to_service');
  if (bookingsRes.error)
    throw new Error(`public_bookings_list_failed: ${bookingsRes.error.message}`);
  if (blocksRes.error) throw new Error(`public_blocks_list_failed: ${blocksRes.error.message}`);

  const barberSchedule = (barberRes.data.schedule ?? {}) as WorkingHoursMap;
  const orgHours = (orgRes.data.hours ?? {}) as WorkingHoursMap;
  const workingHours = Object.keys(barberSchedule).length > 0 ? barberSchedule : orgHours;

  return computeAvailability({
    date,
    timezone: (orgRes.data.timezone as string) || 'America/Sao_Paulo',
    serviceDurationMinutes: Number(serviceRes.data.duration_minutes),
    workingHours,
    existingBookings: (
      (bookingsRes.data ?? []) as Array<{
        starts_at: string;
        ends_at: string;
      }>
    ).map(toRange),
    scheduleBlocks: ((blocksRes.data ?? []) as Array<{ starts_at: string; ends_at: string }>).map(
      toRange,
    ),
  });
}

async function assertBarberCanPerformService(
  supabase: ReturnType<typeof supabaseAdmin>,
  organizationId: string,
  barberId: string,
  serviceId: string,
) {
  const [barberRes, assignmentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, is_active, role')
      .eq('organization_id', organizationId)
      .eq('id', barberId)
      .in('role', ['owner', 'barber'])
      .maybeSingle(),
    supabase
      .from('service_barbers')
      .select('service_id')
      .eq('barber_id', barberId)
      .eq('service_id', serviceId)
      .maybeSingle(),
  ]);

  if (barberRes.error) throw new Error(`public_barber_lookup_failed: ${barberRes.error.message}`);
  if (!barberRes.data || !barberRes.data.is_active) throw new BadRequest('invalid_barber');
  if (assignmentRes.error)
    throw new Error(`public_service_assignment_lookup_failed: ${assignmentRes.error.message}`);
  if (!assignmentRes.data) throw new BadRequest('barber_not_assigned_to_service');
}

function toRange(row: { starts_at: string; ends_at: string }): TimeRange {
  return { startsAt: row.starts_at, endsAt: row.ends_at };
}

function orgToCamel(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    logoUrl: (row.logo_url as string | null) ?? null,
    coverUrl: (row.cover_url as string | null) ?? null,
    themeId: row.theme_id as string,
    themeConfig: (row.theme_config as Record<string, unknown> | null) ?? {},
    hours: (row.hours as Record<string, unknown> | null) ?? {},
    timezone: (row.timezone as string | null) ?? 'America/Sao_Paulo',
    address: row.address ?? null,
    whatsappPhone: (row.whatsapp_phone as string | null) ?? null,
  };
}

function serviceToCamel(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    durationMinutes: row.duration_minutes as number,
    priceCents: row.price_cents as number,
    photoUrl: (row.photo_url as string | null) ?? null,
    sortOrder: row.sort_order as number,
  };
}

function barberToCamel(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    ratingCount: (row.rating_count as number | null) ?? 0,
    ratingAverage: (row.rating_average as number | null) ?? null,
  };
}
