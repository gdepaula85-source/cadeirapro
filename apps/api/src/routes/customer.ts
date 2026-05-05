// Customer-side endpoints. These accept JWTs minted by the customer signup
// flow (role='customer', no organization_id claim — see migration 0004).
// Scope is enforced server-side via the clients.auth_user_id lookup in
// requireCustomerAuth, so every query in this file uses service_role and
// filters by the resolved organizationId / clientId.
import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import { requireCustomerAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { NotFound } from '../lib/errors';

export const customerRouter = new Hono<AppEnv>();

customerRouter.get('/v1/customer/me', requireCustomerAuth, async (c) => {
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

  if (clientRes.error) throw new Error(`customer_me_client_lookup_failed: ${clientRes.error.message}`);
  if (orgRes.error) throw new Error(`customer_me_org_lookup_failed: ${orgRes.error.message}`);
  if (!clientRes.data) throw new NotFound('customer_not_found');
  if (!orgRes.data) throw new NotFound('organization_not_found');
  // A customer whose clients row was anonymized (LGPD erase) shouldn't be
  // able to keep using the app — surface that as a clean 404.
  if (clientRes.data.anonymized_at) throw new NotFound('customer_anonymized');

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
    },
  });
});
