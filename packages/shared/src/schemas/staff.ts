// Staff = `profiles` rows with role 'barber' or 'staff' (the owner is excluded
// from the staff list). Creating staff means creating an auth.users row first
// (FK on profiles.id), then the profile row. The auth user is created with
// `email_confirm: true` and a random throwaway password — staff log in via
// the password-recovery flow when (if) we surface a staff portal.
import { z } from 'zod';
import { PixKeyTypeSchema } from './pix';
import { HoursMapSchema } from './organization-update';
import { validatePixKeyFormat } from '../pix';

const E164_RE = /^\+[1-9]\d{1,14}$/;

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const optionalPhone = z
  .string()
  .regex(E164_RE, 'phone must be E.164 (e.g. +5511999998888)')
  .nullable()
  .optional();

const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().email().nullable().optional(),
);

export const StaffRoleSchema = z.enum(['barber', 'staff']);

export const StaffSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: StaffRoleSchema,
  displayName: z.string().min(2).max(80),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bio: z.string().nullable().optional(),
  pixKey: z.string().nullable().optional(),
  pixKeyType: PixKeyTypeSchema.nullable().optional(),
  commissionPct: z.number().min(0).max(1).nullable().optional(),
  partnerStatus: z.enum(['parceiro', 'employee']),
  isActive: z.boolean(),
  assignedServiceIds: z.array(z.string().uuid()).default([]),
  schedule: HoursMapSchema.default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateStaffInputSchema = z
  .object({
    email: z.string().trim().email(),
    role: StaffRoleSchema.default('barber'),
    displayName: z.string().trim().min(2).max(80),
    phone: optionalPhone,
    bio: optionalTrimmedText(500),
    pixKey: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    pixKeyType: PixKeyTypeSchema.nullable().optional(),
    commissionPct: z.coerce.number().min(0).max(1).nullable().optional(),
    partnerStatus: z.enum(['parceiro', 'employee']).default('parceiro'),
    assignedServiceIds: z.array(z.string().uuid()).default([]),
    schedule: HoursMapSchema.default({}),
  })
  // If pixKey is set, pixKeyType is required and must match the format.
  .refine(
    (d) => {
      if (!d.pixKey) return true;
      if (!d.pixKeyType) return false;
      return validatePixKeyFormat(d.pixKey, d.pixKeyType);
    },
    {
      message: 'pixKey does not match pixKeyType format (or pixKeyType is missing)',
      path: ['pixKey'],
    },
  );

export const UpdateStaffInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),
    phone: optionalPhone,
    email: optionalEmail,
    bio: optionalTrimmedText(500),
    pixKey: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    pixKeyType: PixKeyTypeSchema.nullable().optional(),
    commissionPct: z.coerce.number().min(0).max(1).nullable().optional(),
    partnerStatus: z.enum(['parceiro', 'employee']).optional(),
    isActive: z.boolean().optional(),
    assignedServiceIds: z.array(z.string().uuid()).optional(),
    schedule: HoursMapSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'at least one field is required',
  })
  .refine(
    (d) => {
      if (d.pixKey == null) return true;
      if (!d.pixKeyType) return false;
      return validatePixKeyFormat(d.pixKey, d.pixKeyType);
    },
    {
      message: 'pixKey does not match pixKeyType format (or pixKeyType is missing)',
      path: ['pixKey'],
    },
  );

export const StaffListQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
