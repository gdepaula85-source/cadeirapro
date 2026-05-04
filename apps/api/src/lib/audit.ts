// Audit log writes. Build Guide §14.1: route handlers (not DB triggers)
// write the audit row for every tenant-data mutation.
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActorKind = 'user' | 'system' | 'webhook';

export interface AuditLogInput {
  organizationId: string;
  actorId: string | null;
  actorKind: ActorKind;
  action: string; // e.g. 'organization.create'
  entity: string; // e.g. 'organizations'
  entityId: string | null;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Insert one audit_log row using the service-role client. Caller passes
 * the supabaseAdmin instance to avoid re-creating it per request.
 *
 * Best-effort: failures are surfaced via the returned error but should not
 * block the user-facing response. Caller decides whether to log-and-continue
 * or fail the request.
 */
export async function writeAuditLog(
  supabase: SupabaseClient,
  input: AuditLogInput,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('audit_log').insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    actor_kind: input.actorKind,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId,
    payload: input.payload ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}
