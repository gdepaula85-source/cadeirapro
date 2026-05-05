import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  bookingId: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  isPublic: z.boolean(),
  clientName: z.string().nullable().optional(),
  barberName: z.string().nullable().optional(),
  serviceName: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateReviewInputSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: optionalText(1000),
});
