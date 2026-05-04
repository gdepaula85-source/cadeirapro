// Sign-up service. SPRINT_1 §6: the demo critical path.
//
// Flow:
//   1. Generate slug from shopName; retry up to 3× on unique-constraint collision
//   2. supabaseAdmin.auth.admin.createUser(email, password, email_confirm: false)
//      — Supabase sends the verification email via built-in SMTP (Q1 default).
//   3. Call create_organization_for_owner RPC — atomic org + profile + audit insert.
//   4. On RPC failure, best-effort delete the auth user (rollback step 2).
//   5. Return { userId, organizationId, slug }.
//
// Per Build Guide §14.1, the RPC writes the audit_log row inside the same
// transaction as the org insert, so the route handler does NOT call
// writeAuditLog separately.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SignUpInput } from '@cadeirapro/shared';
import { slugify, randomSlugSuffix } from '@cadeirapro/shared';
import { BadRequest, Conflict } from '../../lib/errors';
import type { Logger } from '../../lib/logger';

export interface SignUpDeps {
  supabaseAdmin: SupabaseClient;
  platformFeeDefaultPct: number;
  logger: Logger;
}

export interface SignUpResult {
  userId: string;
  organizationId: string;
  slug: string;
}

const MAX_SLUG_RETRIES = 3;
const PG_UNIQUE_VIOLATION = '23505';

export async function signUp(input: SignUpInput, deps: SignUpDeps): Promise<SignUpResult> {
  const { supabaseAdmin, platformFeeDefaultPct, logger } = deps;

  // ── 1. Create the auth user. Supabase Auth handles email uniqueness and
  // sends the verification email via built-in SMTP (Q1 default).
  const createUserRes = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false,
  });

  if (createUserRes.error) {
    logger.warn('signup_create_user_failed', { message: createUserRes.error.message });
    // Supabase surfaces the email-already-registered case as a 422 with a
    // 'User already registered' message. Map to 409 conflict so the dashboard
    // can show a clean error state.
    if (/already (registered|exists)/i.test(createUserRes.error.message)) {
      throw new Conflict('email_in_use');
    }
    throw new BadRequest('signup_failed', { detail: createUserRes.error.message });
  }
  const userId = createUserRes.data.user?.id;
  if (!userId) {
    throw new Error('signup_no_user_id_returned');
  }

  // ── 2. Insert org + profile + audit via RPC, with slug-collision retry.
  //   first attempt: slugify(shopName)
  //   retries 1..3:  `${baseSlug}-${randomSlugSuffix(4)}`
  const baseSlug = slugify(input.shopName);
  let slug = baseSlug;
  let lastError: unknown = null;
  let result: { organization_id: string; slug: string } | null = null;

  for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt += 1) {
    const rpc = await supabaseAdmin.rpc('create_organization_for_owner', {
      p_user_id: userId,
      p_email: input.email,
      p_slug: slug,
      p_shop_name: input.shopName,
      p_cpf_or_cnpj: input.cpfOrCnpj,
      p_primary_pix_key: input.primaryPixKey,
      p_primary_pix_key_type: input.primaryPixKeyType,
      p_whatsapp_phone: input.whatsappPhone ?? null,
      p_platform_fee_pct: platformFeeDefaultPct,
    });

    if (!rpc.error) {
      result = rpc.data as { organization_id: string; slug: string };
      break;
    }

    lastError = rpc.error;
    if (rpc.error.code === PG_UNIQUE_VIOLATION && attempt < MAX_SLUG_RETRIES) {
      const next = `${baseSlug}-${randomSlugSuffix(4)}`;
      logger.info('signup_slug_collision_retry', { attempt: attempt + 1, from: slug, to: next });
      slug = next;
      continue;
    }

    // Non-retryable error or out of retries — break and roll back the auth user.
    break;
  }

  if (!result) {
    logger.error('signup_rpc_failed_rolling_back_user', {
      user_id: userId,
      error: String(lastError),
    });
    // Best-effort cleanup of the auth user. Failure here is logged but
    // doesn't change the surfaced error — the user will see the original RPC failure.
    const delRes = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delRes.error) {
      logger.error('signup_rollback_delete_user_failed', {
        user_id: userId,
        message: delRes.error.message,
      });
    }
    throw new Error(`signup_rpc_failed: ${String(lastError)}`);
  }

  return {
    userId,
    organizationId: result.organization_id,
    slug: result.slug,
  };
}
