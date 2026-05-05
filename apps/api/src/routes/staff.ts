// Staff = profiles rows with role 'barber' or 'staff'. Owner-only writes.
//
// Create flow (no RPC, sequential calls with rollback):
//   1. supabaseAdmin.auth.admin.createUser({ email, password: random,
//      email_confirm: true })  — staff don't get verification emails; if
//      they need to log in later they use the password-reset flow.
//   2. supabase (as user) inserts into profiles with the new user's id.
//   3. On profile insert failure, supabaseAdmin.auth.admin.deleteUser to
//      roll back step 1.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  CreateStaffInputSchema,
  StaffListQuerySchema,
  UpdateStaffInputSchema,
} from '@cadeirapro/shared';
import type { AppEnv } from '../app-env';
import { requireAuth, requireRole } from '../middleware/auth';
import { idempotency } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { BadRequest, Conflict, NotFound } from '../lib/errors';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { writeAuditLog } from '../lib/audit';

const IdParamSchema = z.object({ id: z.string().uuid() });
const PG_UNIQUE_VIOLATION = '23505';

export const staffRouter = new Hono<AppEnv>();

staffRouter.use('/v1/staff/*', requireAuth);
staffRouter.use('/v1/staff', requireAuth);

staffRouter.get('/v1/staff', validate('query', StaffListQuerySchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const query = c.req.valid('query');

  let db = supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', user.organizationId!)
    .in('role', ['barber', 'staff'])
    .order('display_name', { ascending: true });

  if (!query.includeInactive) db = db.eq('is_active', true);

  const { data, error } = await db;
  if (error) throw new Error(`staff_list_failed: ${error.message}`);
  return c.json({ data: await withServiceAssignments(supabase, data ?? []) });
});

staffRouter.post(
  '/v1/staff',
  requireRole('owner'),
  idempotency,
  validate('json', CreateStaffInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const config = c.get('config');
    const input = c.req.valid('json');
    const admin = supabaseAdmin(config);
    const assignedServiceIds = input.role === 'barber' ? input.assignedServiceIds : [];
    const schedule = input.role === 'barber' ? input.schedule : {};

    // 1. Auth user. email_confirm: true means no verification email sent.
    const password = generateThrowawayPassword();
    const createUserRes = await admin.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
    });

    if (createUserRes.error) {
      const msg = createUserRes.error.message;
      if (/already (registered|exists)/i.test(msg)) throw new Conflict('staff_email_in_use');
      throw new Error(`staff_create_user_failed: ${msg}`);
    }
    const newUserId = createUserRes.data.user?.id;
    if (!newUserId) throw new Error('staff_create_user_no_id');

    // 2. Profile row (service-role bypasses RLS, but we still scope to org).
    const { data, error } = await admin
      .from('profiles')
      .insert({
        id: newUserId,
        organization_id: user.organizationId!,
        role: input.role,
        display_name: input.displayName,
        email: input.email,
        phone: input.phone ?? null,
        bio: input.bio ?? null,
        pix_key: input.pixKey ?? null,
        pix_key_type: input.pixKeyType ?? null,
        commission_pct: input.commissionPct ?? null,
        partner_status: input.partnerStatus,
        is_active: true,
        schedule,
      })
      .select('*')
      .single();

    if (error) {
      // 3. Rollback the auth user.
      const delRes = await admin.auth.admin.deleteUser(newUserId);
      if (delRes.error) {
        c.get('logger').error('staff_rollback_delete_user_failed', {
          userId: newUserId,
          message: delRes.error.message,
        });
      }
      throw new Error(`staff_profile_insert_failed: ${error.message}`);
    }

    try {
      await replaceServiceAssignments(admin, user.organizationId!, data.id, assignedServiceIds);
    } catch (err) {
      await admin.from('profiles').delete().eq('id', newUserId);
      const delRes = await admin.auth.admin.deleteUser(newUserId);
      if (delRes.error) {
        c.get('logger').error('staff_rollback_delete_user_failed', {
          userId: newUserId,
          message: delRes.error.message,
        });
      }
      if (err instanceof BadRequest) throw err;
      throw new Error(`staff_service_assignment_failed: ${(err as Error).message}`);
    }

    await audit(c, 'staff.create', data.id, {
      role: data.role,
      display_name: data.display_name,
      email: data.email,
      assigned_service_ids: assignedServiceIds,
    });
    return c.json({ data: staffToCamel(data, assignedServiceIds) }, 201);
  },
);

staffRouter.get('/v1/staff/:id', validate('param', IdParamSchema), async (c) => {
  const user = c.get('user')!;
  const supabase = supabaseAsUser(c.get('config'), user.accessToken);
  const { id } = c.req.valid('param');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', user.organizationId!)
    .eq('id', id)
    .in('role', ['barber', 'staff'])
    .maybeSingle();

  if (error) throw new Error(`staff_lookup_failed: ${error.message}`);
  if (!data) throw new NotFound('staff_not_found');
  const [enriched] = await withServiceAssignments(supabase, [data]);
  return c.json({ data: enriched });
});

staffRouter.patch(
  '/v1/staff/:id',
  requireRole('owner'),
  idempotency,
  validate('param', IdParamSchema),
  validate('json', UpdateStaffInputSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');

    const patch: Record<string, unknown> = {};
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.email !== undefined) patch.email = input.email;
    if (input.bio !== undefined) patch.bio = input.bio;
    if (input.pixKey !== undefined) patch.pix_key = input.pixKey;
    if (input.pixKeyType !== undefined) patch.pix_key_type = input.pixKeyType;
    if (input.commissionPct !== undefined) patch.commission_pct = input.commissionPct;
    if (input.partnerStatus !== undefined) patch.partner_status = input.partnerStatus;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const existingRes = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .in('role', ['barber', 'staff'])
      .maybeSingle();

    if (existingRes.error) throw new Error(`staff_lookup_failed: ${existingRes.error.message}`);
    if (!existingRes.data) throw new NotFound('staff_not_found');

    if (input.schedule !== undefined) {
      patch.schedule = existingRes.data.role === 'barber' ? input.schedule : {};
    }

    let data = existingRes.data;
    if (Object.keys(patch).length > 0) {
      const updateRes = await supabase
        .from('profiles')
        .update(patch)
        .eq('organization_id', user.organizationId!)
        .eq('id', id)
        .in('role', ['barber', 'staff'])
        .select('*')
        .maybeSingle();

      if (updateRes.error?.code === PG_UNIQUE_VIOLATION) throw new Conflict('staff_email_in_use');
      if (updateRes.error) throw new Error(`staff_update_failed: ${updateRes.error.message}`);
      if (!updateRes.data) throw new NotFound('staff_not_found');
      data = updateRes.data;
    }

    const assignedServiceIds =
      data.role === 'barber' && input.assignedServiceIds !== undefined
        ? input.assignedServiceIds
        : [];

    if (input.assignedServiceIds !== undefined) {
      await replaceServiceAssignments(
        supabaseAdmin(c.get('config')),
        user.organizationId!,
        data.id,
        assignedServiceIds,
      );
    }

    const assigned =
      input.assignedServiceIds !== undefined
        ? assignedServiceIds
        : await serviceIdsForStaff(supabase, data.id);

    await audit(c, 'staff.update', data.id, {
      fields: [
        ...Object.keys(patch),
        ...(input.assignedServiceIds !== undefined ? ['assigned_service_ids'] : []),
      ],
    });
    return c.json({ data: staffToCamel(data, assigned) });
  },
);

staffRouter.delete(
  '/v1/staff/:id',
  requireRole('owner'),
  idempotency,
  validate('param', IdParamSchema),
  async (c) => {
    const user = c.get('user')!;
    const supabase = supabaseAsUser(c.get('config'), user.accessToken);
    const { id } = c.req.valid('param');

    // Soft-deactivate. Hard-delete (and the auth.users row) lands when we
    // surface a "remove permanently" action with confirmation in S3+.
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('organization_id', user.organizationId!)
      .eq('id', id)
      .in('role', ['barber', 'staff'])
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`staff_archive_failed: ${error.message}`);
    if (!data) throw new NotFound('staff_not_found');

    await audit(c, 'staff.archive', data.id, { display_name: data.display_name });
    const assigned = await serviceIdsForStaff(supabase, data.id);
    return c.json({ data: staffToCamel(data, assigned) });
  },
);

// 24-char base64url-shaped throwaway. Cryptographically random; the staff
// member never sees it (they reset via password-recovery before first login).
function generateThrowawayPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // Convert each byte to a base64url-safe char.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

async function replaceServiceAssignments(
  supabase: ReturnType<typeof supabaseAdmin>,
  organizationId: string,
  staffId: string,
  serviceIds: string[],
): Promise<void> {
  const unique = [...new Set(serviceIds)];

  if (unique.length > 0) {
    const { data, error } = await supabase
      .from('services')
      .select('id')
      .eq('organization_id', organizationId)
      .in('id', unique);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== unique.length) throw new BadRequest('invalid_service_assignment');
  }

  const del = await supabase.from('service_barbers').delete().eq('barber_id', staffId);
  if (del.error) throw new Error(del.error.message);

  if (unique.length === 0) return;
  const ins = await supabase
    .from('service_barbers')
    .insert(unique.map((serviceId) => ({ service_id: serviceId, barber_id: staffId })));
  if (ins.error) throw new Error(ins.error.message);
}

async function serviceIdsForStaff(
  supabase: ReturnType<typeof supabaseAsUser>,
  staffId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('service_barbers')
    .select('service_id')
    .eq('barber_id', staffId);
  if (error) throw new Error(`staff_service_assignments_lookup_failed: ${error.message}`);
  return (data ?? []).map((row) => row.service_id as string);
}

async function withServiceAssignments(
  supabase: ReturnType<typeof supabaseAsUser>,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id as string);
  const { data, error } = await supabase
    .from('service_barbers')
    .select('service_id, barber_id')
    .in('barber_id', ids);
  if (error) throw new Error(`staff_service_assignments_lookup_failed: ${error.message}`);

  const byStaff = new Map<string, string[]>();
  for (const row of data ?? []) {
    const staffId = row.barber_id as string;
    const serviceId = row.service_id as string;
    byStaff.set(staffId, [...(byStaff.get(staffId) ?? []), serviceId]);
  }

  return rows.map((row) => staffToCamel(row, byStaff.get(row.id as string) ?? []));
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
    entity: 'profiles',
    entityId,
    payload,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  if (error) c.get('logger').warn('audit_write_failed', { action, entityId, error: error.message });
}

function staffToCamel(row: Record<string, unknown>, assignedServiceIds: string[] = []) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    pixKey: row.pix_key,
    pixKeyType: row.pix_key_type,
    commissionPct: row.commission_pct === null ? null : Number(row.commission_pct),
    partnerStatus: row.partner_status,
    isActive: row.is_active,
    assignedServiceIds,
    schedule: row.schedule ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
