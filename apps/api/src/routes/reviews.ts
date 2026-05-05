import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

const IdParamSchema = z.object({ id: z.string().uuid() });

export const reviewsRouter = new Hono<AppEnv>();

reviewsRouter.use('/v1/reviews/*', requireAuth);
reviewsRouter.use('/v1/reviews', requireAuth);

reviewsRouter.get('/v1/reviews', async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);

  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, organization_id, booking_id, client_id, barber_id, service_id, rating, comment, is_public, created_at, updated_at, ' +
        'clients(name), profiles!reviews_barber_id_fkey(display_name), services(name)',
    )
    .eq('organization_id', user.organizationId!)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`reviews_list_failed: ${error.message}`);
  return c.json({ data: (data ?? []).map(reviewToCamel) });
});

reviewsRouter.patch(
  '/v1/reviews/:id/visibility',
  requireRole('owner', 'staff'),
  idempotency,
  validate('param', IdParamSchema),
  validate('json', z.object({ isPublic: z.boolean() })),
  async (c) => {
    const user = c.get('user')!;
    const input = c.req.valid('json');
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');

    const { data, error } = await supabase
      .from('reviews')
      .update({ is_public: input.isPublic })
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .select(
        'id, organization_id, booking_id, client_id, barber_id, service_id, rating, comment, is_public, created_at, updated_at, ' +
          'clients(name), profiles!reviews_barber_id_fkey(display_name), services(name)',
      )
      .maybeSingle();

    if (error) throw new Error(`review_visibility_update_failed: ${error.message}`);
    if (!data) throw new NotFound('review_not_found');

    await audit(c, 'review.visibility_update', id, { is_public: input.isPublic });
    return c.json({ data: reviewToCamel(data) });
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
    entity: 'reviews',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
}

interface JoinedClient {
  name?: string;
}

interface JoinedBarber {
  display_name?: string;
}

interface JoinedService {
  name?: string;
}

function reviewToCamel(row: unknown) {
  const r = row as Record<string, unknown>;
  const client = r.clients as JoinedClient | null | undefined;
  const barber = r.profiles as JoinedBarber | null | undefined;
  const service = r.services as JoinedService | null | undefined;

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
    clientName: client?.name ?? null,
    barberName: barber?.display_name ?? null,
    serviceName: service?.name ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
