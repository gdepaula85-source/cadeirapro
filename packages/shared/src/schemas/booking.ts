// Booking schemas. The bookings table already exists from migration 0001.
// S2 adds CRUD + availability computation on top.
import { z } from 'zod';

export const BookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
]);

export const BookingSourceSchema = z.enum(['widget', 'manual', 'whatsapp']);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const isoDate = z.string().datetime();

export const BookingSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: isoDate,
  endsAt: isoDate,
  status: BookingStatusSchema,
  source: BookingSourceSchema,
  notes: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  cancelledAt: isoDate.nullable().optional(),
  // Optional joined fields the API may include for list rendering.
  clientName: z.string().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  barberName: z.string().nullable().optional(),
  serviceName: z.string().nullable().optional(),
  serviceDurationMinutes: z.number().int().positive().nullable().optional(),
  servicePriceCents: z.number().int().nonnegative().nullable().optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const CreateBookingInputSchema = z.object({
  clientId: z.string().uuid(),
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: isoDate,
  // Owner-created bookings default to confirmed (no payment in S2).
  status: z.enum(['pending', 'confirmed']).default('confirmed'),
  source: z.enum(['manual', 'widget', 'whatsapp']).default('manual'),
  notes: optionalText(1000),
});

export const UpdateBookingInputSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    barberId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    startsAt: isoDate.optional(),
    status: BookingStatusSchema.optional(),
    notes: optionalText(1000),
    cancellationReason: optionalText(500),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'at least one field is required',
  });

// Date range (inclusive on both ends). Used by /v1/bookings list.
export const BookingListQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  barberId: z.string().uuid().optional(),
  status: BookingStatusSchema.optional(),
});

// Availability query. date is YYYY-MM-DD in the shop's tz.
export const AvailabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export const AvailabilitySlotSchema = z.object({
  startsAt: isoDate,
  endsAt: isoDate,
});
