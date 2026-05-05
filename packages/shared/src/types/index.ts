import type { z } from 'zod';
import type {
  OrganizationSchema,
  ProfileSchema,
  RoleSchema,
  SignUpInputSchema,
  MeSchema,
  PixKeyTypeSchema,
  ServiceSchema,
  CreateServiceInputSchema,
  UpdateServiceInputSchema,
  ServiceListQuerySchema,
  ClientSchema,
  CreateClientInputSchema,
  UpdateClientInputSchema,
  ClientListQuerySchema,
  StaffSchema,
  StaffRoleSchema,
  CreateStaffInputSchema,
  UpdateStaffInputSchema,
  StaffListQuerySchema,
  BookingSchema,
  BookingStatusSchema,
  BookingSourceSchema,
  CreateBookingInputSchema,
  UpdateBookingInputSchema,
  BookingListQuerySchema,
  AvailabilityQuerySchema,
  AvailabilitySlotSchema,
  ScheduleBlockSchema,
  CreateScheduleBlockInputSchema,
  UpdateScheduleBlockInputSchema,
  ScheduleBlockListQuerySchema,
  ReviewSchema,
  CreateReviewInputSchema,
  UpdateOrganizationInputSchema,
  AddressSchema,
  HoursMapSchema,
  HoursWindowSchema,
  ThemeConfigSchema,
} from '../schemas';

export type Organization = z.infer<typeof OrganizationSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type SignUpInput = z.infer<typeof SignUpInputSchema>;
export type Me = z.infer<typeof MeSchema>;
export type PixKeyType = z.infer<typeof PixKeyTypeSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;
export type ServiceListQuery = z.infer<typeof ServiceListQuerySchema>;
export type Client = z.infer<typeof ClientSchema>;
export type CreateClientInput = z.infer<typeof CreateClientInputSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientInputSchema>;
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>;
export type Staff = z.infer<typeof StaffSchema>;
export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type CreateStaffInput = z.infer<typeof CreateStaffInputSchema>;
export type UpdateStaffInput = z.infer<typeof UpdateStaffInputSchema>;
export type StaffListQuery = z.infer<typeof StaffListQuerySchema>;
export type Booking = z.infer<typeof BookingSchema>;
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export type BookingSource = z.infer<typeof BookingSourceSchema>;
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof UpdateBookingInputSchema>;
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;
export type ScheduleBlock = z.infer<typeof ScheduleBlockSchema>;
export type CreateScheduleBlockInput = z.infer<typeof CreateScheduleBlockInputSchema>;
export type UpdateScheduleBlockInput = z.infer<typeof UpdateScheduleBlockInputSchema>;
export type ScheduleBlockListQuery = z.infer<typeof ScheduleBlockListQuerySchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInputSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type HoursMap = z.infer<typeof HoursMapSchema>;
export type HoursWindow = z.infer<typeof HoursWindowSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

/**
 * Response shape of GET /v1/dashboard/kpis. Read-only — no Zod schema
 * because it isn't user-input. `noShowRate` is a percentage in [0, 100]
 * or `null` when the 30-day denominator (no_show + completed) is zero.
 */
export interface DashboardKpis {
  bookingsToday: number;
  revenueTodayCents: number;
  noShowRate: number | null;
  activeClients90d: number;
}

// ----------------------------------------------------------------------------
// Customer-side types (per migration 0004 — per-shop white-label customer app)
// ----------------------------------------------------------------------------

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
}

export interface CustomerOrganization {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  themeId: string;
  themeConfig: Record<string, unknown>;
  timezone: string;
  whatsappPhone: string | null;
}

export interface CustomerBookingSummary {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  source: BookingSource;
  serviceName: string | null;
  serviceDurationMinutes: number | null;
  servicePriceCents: number | null;
  barberName: string | null;
  reviewId: string | null;
  reviewRating: number | null;
}

export interface CustomerHistoryStats {
  totalBookings: number;
  completedBookings: number;
  upcomingBookings: number;
  totalSpentCents: number;
  memberSince: string;
}

/** Response shape of GET /v1/customer/me. */
export interface CustomerMe {
  customer: CustomerProfile;
  organization: CustomerOrganization;
  stats: CustomerHistoryStats;
  upcomingBookings: CustomerBookingSummary[];
  pastBookings: CustomerBookingSummary[];
}

/** Body shape of POST /v1/public/orgs/:slug/customer/sign-up. */
export interface CustomerSignUpInput {
  name: string;
  phone: string;
  email: string;
  password: string;
}

/** Response shape of the same endpoint. */
export interface CustomerSignUpResponse {
  userId: string;
  organizationId: string;
  slug: string;
}
