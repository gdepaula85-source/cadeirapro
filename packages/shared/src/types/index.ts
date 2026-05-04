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
  UpdateOrganizationInputSchema,
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
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInputSchema>;
export type HoursMap = z.infer<typeof HoursMapSchema>;
export type HoursWindow = z.infer<typeof HoursWindowSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
