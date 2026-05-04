import { z } from 'zod';

const E164_RE = /^\+[1-9]\d{1,14}$/;

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const ClientSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  phone: z.string().regex(E164_RE),
  name: z.string().min(1).max(80),
  email: z.string().email().nullable().optional(),
  lgpdConsentAt: z.string().datetime().nullable().optional(),
  anonymizedAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateClientInputSchema = z.object({
  phone: z.string().regex(E164_RE, 'phone must be E.164 (e.g. +5511999998888)'),
  name: z.string().trim().min(1).max(80),
  email: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().email().nullable().optional(),
  ),
  lgpdConsentAt: z.string().datetime().nullable().optional(),
  notes: optionalTrimmedText(1000),
});

export const UpdateClientInputSchema = CreateClientInputSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'at least one field is required' },
);

export const ClientListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .regex(/^[\p{L}\p{N}\s+@._-]*$/u)
    .optional(),
});
