import { z } from 'zod';

const isoDate = z.string().datetime();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const ScheduleBlockSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  barberId: z.string().uuid().nullable(),
  startsAt: isoDate,
  endsAt: isoDate,
  reason: z.string().nullable().optional(),
  barberName: z.string().nullable().optional(),
  createdAt: isoDate,
});

export const CreateScheduleBlockInputSchema = z
  .object({
    barberId: z.string().uuid().nullable().optional(),
    startsAt: isoDate,
    endsAt: isoDate,
    reason: optionalText(200),
  })
  .refine((input) => new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const UpdateScheduleBlockInputSchema = z
  .object({
    barberId: z.string().uuid().nullable().optional(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    reason: optionalText(200),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'at least one field is required',
  })
  .refine(
    (input) => {
      if (!input.startsAt || !input.endsAt) return true;
      return new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime();
    },
    { message: 'endsAt must be after startsAt', path: ['endsAt'] },
  );

export const ScheduleBlockListQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  barberId: z.string().uuid().optional(),
});
