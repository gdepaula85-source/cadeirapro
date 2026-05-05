import { describe, expect, it } from 'vitest';
import { CreateStaffInputSchema, StaffListQuerySchema, UpdateStaffInputSchema } from './index';

describe('CreateStaffInputSchema', () => {
  it('accepts a minimal barber payload', () => {
    const parsed = CreateStaffInputSchema.parse({
      email: 'barber@example.com',
      displayName: 'João Silva',
    });
    expect(parsed).toMatchObject({
      email: 'barber@example.com',
      displayName: 'João Silva',
      role: 'barber',
      partnerStatus: 'parceiro',
      assignedServiceIds: [],
      schedule: {},
    });
  });

  it('coerces commissionPct from string and accepts pix details', () => {
    const parsed = CreateStaffInputSchema.parse({
      email: 'b@e.com',
      displayName: 'Marcos',
      pixKey: '12345678901',
      pixKeyType: 'cpf',
      commissionPct: '0.5',
    });
    expect(parsed.commissionPct).toBe(0.5);
    expect(parsed.pixKey).toBe('12345678901');
  });

  it('rejects pixKey without matching pixKeyType', () => {
    expect(() =>
      CreateStaffInputSchema.parse({
        email: 'b@e.com',
        displayName: 'Pedro',
        pixKey: 'not-a-cpf',
        pixKeyType: 'cpf',
      }),
    ).toThrow(/pixKey/);
  });

  it('rejects pixKey when pixKeyType is missing', () => {
    expect(() =>
      CreateStaffInputSchema.parse({
        email: 'b@e.com',
        displayName: 'Pedro',
        pixKey: '12345678901',
      }),
    ).toThrow(/pixKey/);
  });

  it('rejects malformed E.164 phone', () => {
    expect(() =>
      CreateStaffInputSchema.parse({
        email: 'b@e.com',
        displayName: 'Lia',
        phone: '11999998888',
      }),
    ).toThrow();
  });
});

describe('UpdateStaffInputSchema', () => {
  it('rejects empty patches', () => {
    expect(() => UpdateStaffInputSchema.parse({})).toThrow(/at least one field/);
  });

  it('accepts a single-field patch', () => {
    expect(UpdateStaffInputSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it('accepts service assignments and weekly schedule', () => {
    const serviceId = '11111111-1111-4111-8111-111111111111';
    const parsed = UpdateStaffInputSchema.parse({
      assignedServiceIds: [serviceId],
      schedule: { mon: [{ open: '09:00', close: '18:00' }] },
    });
    expect(parsed.assignedServiceIds).toEqual([serviceId]);
    expect(parsed.schedule).toEqual({ mon: [{ open: '09:00', close: '18:00' }] });
  });

  it('rejects inverted schedule windows', () => {
    expect(() =>
      UpdateStaffInputSchema.parse({
        schedule: { mon: [{ open: '18:00', close: '09:00' }] },
      }),
    ).toThrow();
  });

  it('still validates pixKey/type pairing on update', () => {
    expect(() => UpdateStaffInputSchema.parse({ pixKey: '12345678901' })).toThrow(/pixKey/);
  });

  it('clearing pixKey to null is allowed', () => {
    const parsed = UpdateStaffInputSchema.parse({ pixKey: null, pixKeyType: null });
    expect(parsed.pixKey).toBeNull();
  });
});

describe('StaffListQuerySchema', () => {
  it('coerces includeInactive=true', () => {
    expect(StaffListQuerySchema.parse({ includeInactive: 'true' })).toEqual({
      includeInactive: true,
    });
  });
  it('treats missing/false as inactive-excluded', () => {
    expect(StaffListQuerySchema.parse({})).toEqual({ includeInactive: false });
    expect(StaffListQuerySchema.parse({ includeInactive: 'false' })).toEqual({
      includeInactive: false,
    });
  });
});
