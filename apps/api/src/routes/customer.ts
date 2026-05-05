// Customer-side endpoints. These accept JWTs minted by the customer signup
// flow (role='customer', no organization_id claim — see migration 0004).
// Scope is enforced server-side via the clients.auth_user_id lookup in
// requireCustomerAuth, so every query in this file uses service_role and
// filters by the resolved organizationId / clientId.
import { Hono } from 'hono';
import {
  CreateReviewInputSchema,
  type BookingSource,
  type BookingStatus,
  type CustomerBookingSummary,
} from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireCustomerAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idempotency } from '../middleware/idempotency';
import { supabaseAdmin } from '../lib/supabase';
import { BadRequest, Conflict, NotFound } from '../lib/errors';

export const customerRouter = new Hono<AppEnv>();

customerRouter.use('/v1/customer/*', requireCustomerAuth);
customerRouter.use('/v1/customer', requireCustomerAuth);

customerRouter.get('/v1/customer/me', async (c) => {
  const customer = c.get('customer')!;
  const admin = supabaseAdmin(c.get('config'));

  const [clientRes, orgRes] = await Promise.all([
    admin
      .from('clients')
      .select('id, organization_id, name, phone, email, lgpd_consent_at, anonymized_at, created_at')
      .eq('id', customer.clientId)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('id, slug, name, logo_url, theme_id, theme_config, timezone, whatsapp_phone')
      .eq('id', customer.organizationId)
      .maybeSingle(),
  ]);

  if (clientRes.error)
    throw new Error(`customer_me_client_lookup_failed: ${clientRes.error.message}`);
  if (orgRes.error) throw new Error(`customer_me_org_lookup_failed: ${orgRes.error.message}`);
  if (!clientRes.data) throw new NotFound('customer_not_found');
  if (!orgRes.data) throw new NotFound('organization_not_found');
  // A customer whose clients row was anonymized (LGPD erase) shouldn't be
  // able to keep using the app — surface that as a clean 404.
  if (clientRes.data.anonymized_at) throw new NotFound('customer_anonymized');

  const nowIso = new Date().toISOString();
  const bookingsRes = await admin
    .from('bookings')
    .select(
      'id, starts_at, ends_at, status, source, created_at, ' +
        'services(name, duration_minutes, price_cents), ' +
        'profiles!bookings_barber_id_fkey(display_name)',
    )
    .eq('organization_id', customer.organizationId)
    .eq('client_id', customer.clientId)
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: false });

  if (bookingsRes.error)
    throw new Error(`customer_me_bookings_lookup_failed: ${bookingsRes.error.message}`);

  const bookings = (bookingsRes.data ?? []).map(customerBookingToCamel);
  const bookingIds = bookings.map((booking) => booking.id);
  const reviewsByBookingId = new Map<string, CustomerReviewLookup>();

  if (bookingIds.length > 0) {
    const reviewsRes = await admin
      .from('reviews')
      .select('id, booking_id, rating')
      .eq('organization_id', customer.organizationId)
      .in('booking_id', bookingIds);
    if (reviewsRes.error)
      throw new Error(`customer_me_reviews_lookup_failed: ${reviewsRes.error.message}`);
    for (const review of reviewsRes.data ?? []) {
      reviewsByBookingId.set(review.booking_id as string, {
        id: review.id as string,
        rating: review.rating as number,
      });
    }
  }

  for (const booking of bookings) {
    const review = reviewsByBookingId.get(booking.id);
    booking.reviewId = review?.id ?? null;
    booking.reviewRating = review?.rating ?? null;
  }

  const upcomingBookings = bookings
    .filter((booking) => booking.startsAt >= nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pastBookings = bookings
    .filter((booking) => booking.startsAt < nowIso)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');

  return c.json({
    data: {
      customer: {
        id: clientRes.data.id as string,
        name: clientRes.data.name as string,
        phone: clientRes.data.phone as string,
        email: clientRes.data.email as string | null,
        createdAt: clientRes.data.created_at as string,
      },
      organization: {
        id: orgRes.data.id as string,
        slug: orgRes.data.slug as string,
        name: orgRes.data.name as string,
        logoUrl: (orgRes.data.logo_url as string | null) ?? null,
        themeId: orgRes.data.theme_id as string,
        themeConfig: (orgRes.data.theme_config as Record<string, unknown> | null) ?? {},
        timezone: (orgRes.data.timezone as string | null) ?? 'America/Sao_Paulo',
        whatsappPhone: (orgRes.data.whatsapp_phone as string | null) ?? null,
      },
      stats: {
        totalBookings: bookings.length,
        completedBookings: completedBookings.length,
        upcomingBookings: upcomingBookings.length,
        totalSpentCents: completedBookings.reduce(
          (sum, booking) => sum + (booking.servicePriceCents ?? 0),
          0,
        ),
        memberSince: clientRes.data.created_at as string,
      },
      upcomingBookings: upcomingBookings.slice(0, 10),
      pastBookings: pastBookings.slice(0, 20),
    },
  });
});

customerRouter.post(
  '/v1/customer/reviews',
  idempotency,
  validate('json', CreateReviewInputSchema),
  async (c) => {
    const customer = c.get('customer')!;
    const input = c.req.valid('json');
    const admin = supabaseAdmin(c.get('config'));

    const bookingRes = await admin
      .from('bookings')
      .select('id, organization_id, client_id, barber_id, service_id, status, starts_at')
      .eq('organization_id', customer.organizationId)
      .eq('client_id', customer.clientId)
      .eq('id', input.bookingId)
      .maybeSingle();

    if (bookingRes.error)
      throw new Error(`customer_review_booking_lookup_failed: ${bookingRes.error.message}`);
    if (!bookingRes.data) throw new NotFound('booking_not_found');
    if (bookingRes.data.status !== 'completed') {
      throw new BadRequest('booking_not_reviewable', {
        hint: 'only completed bookings can be reviewed',
      });
    }

    const { data, error } = await admin
      .from('reviews')
      .insert({
        organization_id: customer.organizationId,
        booking_id: bookingRes.data.id,
        client_id: customer.clientId,
        barber_id: bookingRes.data.barber_id,
        service_id: bookingRes.data.service_id,
        rating: input.rating,
        comment: input.comment ?? null,
        is_public: true,
      })
      .select(
        'id, organization_id, booking_id, client_id, barber_id, service_id, rating, comment, is_public, created_at, updated_at',
      )
      .single();

    if (error?.code === '23505') throw new Conflict('already_reviewed');
    if (error) throw new Error(`customer_review_create_failed: ${error.message}`);

    return c.json({ data: reviewToCamel(data) }, 201);
  },
);

interface JoinedService {
  name?: string;
  duration_minutes?: number;
  price_cents?: number;
}

interface JoinedBarber {
  display_name?: string;
}

interface CustomerReviewLookup {
  id: string;
  rating: number;
}

function customerBookingToCamel(row: unknown): CustomerBookingSummary {
  const r = row as Record<string, unknown>;
  const service = r.services as JoinedService | null | undefined;
  const barber = r.profiles as JoinedBarber | null | undefined;
  return {
    id: r.id as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    status: r.status as BookingStatus,
    source: r.source as BookingSource,
    serviceName: service?.name ?? null,
    serviceDurationMinutes: service?.duration_minutes ?? null,
    servicePriceCents: service?.price_cents ?? null,
    barberName: barber?.display_name ?? null,
    reviewId: null,
    reviewRating: null,
  };
}

function reviewToCamel(row: unknown) {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    bookingId: r.booking_id as string,
    clientId: r.client_id as string,
    barberId: r.barber_id as string,
    serviceId: r.service_id as string,
    rating: r.rating as number,
    comment: (r.comment as string | null) ?? null,
    isPublic: r.is_public as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
