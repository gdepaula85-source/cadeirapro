// GET /v1/dashboard/kpis — aggregates for the four home-screen tiles.
//
// Uses supabaseAsUser so RLS applies on top of the manual organization_id
// filter (defense in depth, same pattern as bookings.ts).
//
// Pre-Pix this is the only place that joins bookings × services for a
// price total — once payments are real, revenue will switch to summing
// payments.amount_cents instead.
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireAuth } from '../middleware/auth';
import { supabaseAsUser } from '../lib/supabase';
import { shopDayBoundaries, nDaysAgoUtc } from '../services/dashboard/period';

export const dashboardRouter = new Hono<AppEnv>();

dashboardRouter.get('/v1/dashboard/kpis', requireAuth, async (c) => {
  const user = c.get('user')!;
  const config = c.get('config');
  const supabase = supabaseAsUser(config, user.accessToken);
  const orgId = user.organizationId!;

  const orgRes = await supabase
    .from('organizations')
    .select('timezone')
    .eq('id', orgId)
    .maybeSingle();
  if (orgRes.error) throw new Error(`kpi_org_lookup_failed: ${orgRes.error.message}`);
  const tz = ((orgRes.data?.timezone as string | undefined) ?? 'America/Sao_Paulo').trim();

  const now = new Date();
  const today = shopDayBoundaries(now, tz, 0);
  const last30Start = nDaysAgoUtc(now, tz, 30);
  const last90Start = nDaysAgoUtc(now, tz, 90);

  const [todayCountRes, todayRevenueRes, last30StatusRes, last90ClientsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('starts_at', today.startUtc)
      .lt('starts_at', today.endUtc)
      .neq('status', 'cancelled'),
    supabase
      .from('bookings')
      .select('services(price_cents)')
      .eq('organization_id', orgId)
      .gte('starts_at', today.startUtc)
      .lt('starts_at', today.endUtc)
      .in('status', ['confirmed', 'completed']),
    supabase
      .from('bookings')
      .select('status')
      .eq('organization_id', orgId)
      .gte('starts_at', last30Start)
      .lt('starts_at', today.startUtc)
      .in('status', ['no_show', 'completed']),
    supabase
      .from('bookings')
      .select('client_id')
      .eq('organization_id', orgId)
      .gte('starts_at', last90Start)
      .neq('status', 'cancelled'),
  ]);

  if (todayCountRes.error)
    throw new Error(`kpi_today_count_failed: ${todayCountRes.error.message}`);
  if (todayRevenueRes.error)
    throw new Error(`kpi_today_revenue_failed: ${todayRevenueRes.error.message}`);
  if (last30StatusRes.error)
    throw new Error(`kpi_30d_status_failed: ${last30StatusRes.error.message}`);
  if (last90ClientsRes.error)
    throw new Error(`kpi_90d_clients_failed: ${last90ClientsRes.error.message}`);

  const bookingsToday = todayCountRes.count ?? 0;

  const revenueTodayCents = (todayRevenueRes.data ?? []).reduce<number>((sum, row) => {
    const services = (row as { services?: { price_cents?: number } | null }).services;
    return sum + (services?.price_cents ?? 0);
  }, 0);

  let noShowCount = 0;
  let completedCount = 0;
  for (const row of (last30StatusRes.data ?? []) as Array<{ status: string }>) {
    if (row.status === 'no_show') noShowCount++;
    else if (row.status === 'completed') completedCount++;
  }
  const noShowDenom = noShowCount + completedCount;
  const noShowRate = noShowDenom > 0 ? (noShowCount / noShowDenom) * 100 : null;

  const distinctClientIds = new Set<string>();
  for (const row of (last90ClientsRes.data ?? []) as Array<{ client_id: string }>) {
    distinctClientIds.add(row.client_id);
  }

  return c.json({
    data: {
      bookingsToday,
      revenueTodayCents,
      noShowRate,
      activeClients90d: distinctClientIds.size,
    },
  });
});
