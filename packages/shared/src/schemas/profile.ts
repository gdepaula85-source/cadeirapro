import { z } from 'zod';
import { PixKeyTypeSchema } from './pix';

export const RoleSchema = z.enum(['owner', 'barber', 'staff']);

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: RoleSchema,
  displayName: z.string().min(1).max(80),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bio: z.string().nullable().optional(),
  pixKey: z.string().nullable().optional(),
  pixKeyType: PixKeyTypeSchema.nullable().optional(),
  commissionPct: z.number().min(0).max(1).nullable().optional(),
  partnerStatus: z.enum(['parceiro', 'employee']).default('parceiro'),
  isActive: z.boolean().default(true),
  schedule: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
