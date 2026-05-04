import { describe, it, expect } from 'vitest';
import {
  HoursMapSchema,
  HoursWindowSchema,
  ThemeConfigSchema,
  UpdateOrganizationInputSchema,
} from './organization-update';

describe('HoursWindowSchema', () => {
  it('accepts valid open/close', () => {
    expect(HoursWindowSchema.parse({ open: '09:00', close: '18:00' })).toEqual({
      open: '09:00',
      close: '18:00',
    });
  });
  it('rejects malformed times', () => {
    expect(() => HoursWindowSchema.parse({ open: '9:00', close: '18:00' })).toThrow();
    expect(() => HoursWindowSchema.parse({ open: '24:00', close: '18:00' })).toThrow();
  });
  it('rejects open ≥ close', () => {
    expect(() => HoursWindowSchema.parse({ open: '18:00', close: '09:00' })).toThrow();
    expect(() => HoursWindowSchema.parse({ open: '12:00', close: '12:00' })).toThrow();
  });
});

describe('HoursMapSchema', () => {
  it('accepts a partial week with split-day windows', () => {
    expect(
      HoursMapSchema.parse({
        mon: [
          { open: '09:00', close: '12:00' },
          { open: '14:00', close: '18:00' },
        ],
        sat: [{ open: '09:00', close: '14:00' }],
      }),
    ).toBeTruthy();
  });
  it('rejects unknown day keys', () => {
    expect(() => HoursMapSchema.parse({ funday: [] })).toThrow();
  });
});

describe('ThemeConfigSchema', () => {
  it('accepts hex colors and a logo URL', () => {
    expect(
      ThemeConfigSchema.parse({
        primary: '#1e293b',
        accent: '#f59e0b',
        logoUrl: 'https://example.com/logo.png',
      }),
    ).toBeTruthy();
  });
  it('rejects bad hex', () => {
    expect(() => ThemeConfigSchema.parse({ primary: 'red' })).toThrow();
    expect(() => ThemeConfigSchema.parse({ primary: '#abc' })).toThrow();
  });
});

describe('UpdateOrganizationInputSchema', () => {
  it('rejects empty patches', () => {
    expect(() => UpdateOrganizationInputSchema.parse({})).toThrow(/at least one field/);
  });

  it('accepts a name-only patch', () => {
    expect(UpdateOrganizationInputSchema.parse({ name: 'Nova Barbearia' })).toEqual({
      name: 'Nova Barbearia',
    });
  });

  it('rejects pix key without type', () => {
    expect(() => UpdateOrganizationInputSchema.parse({ primaryPixKey: '12345678901' })).toThrow(
      /primaryPixKey/,
    );
  });

  it('rejects pix key/type mismatch', () => {
    expect(() =>
      UpdateOrganizationInputSchema.parse({
        primaryPixKey: 'not-a-cpf',
        primaryPixKeyType: 'cpf',
      }),
    ).toThrow(/primaryPixKey/);
  });

  it('accepts a valid pix key/type pair', () => {
    const parsed = UpdateOrganizationInputSchema.parse({
      primaryPixKey: '12345678901',
      primaryPixKeyType: 'cpf',
    });
    expect(parsed.primaryPixKey).toBe('12345678901');
  });

  it('accepts hours + branding patch', () => {
    const parsed = UpdateOrganizationInputSchema.parse({
      hours: { mon: [{ open: '09:00', close: '18:00' }] },
      themeConfig: { primary: '#1e293b' },
    });
    expect(parsed.hours?.mon?.[0]?.open).toBe('09:00');
    expect(parsed.themeConfig?.primary).toBe('#1e293b');
  });
});
