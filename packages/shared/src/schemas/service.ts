import { z } from 'zod';

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(720),
  priceCents: z.number().int().min(0).max(10_000_000),
  photoUrl: z.string().url().nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateServiceInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: optionalTrimmedText(500),
  durationMinutes: z.coerce.number().int().min(5).max(720),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  photoUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const UpdateServiceInputSchema = CreateServiceInputSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'at least one field is required' },
);

export const ServiceListQuerySchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
