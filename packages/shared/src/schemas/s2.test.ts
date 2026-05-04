import { describe, expect, it } from 'vitest';
import {
  CreateClientInputSchema,
  ClientListQuerySchema,
  CreateServiceInputSchema,
  UpdateClientInputSchema,
  UpdateServiceInputSchema,
} from './index';

describe('Sprint 2 service schemas', () => {
  it('accepts a valid service create payload', () => {
    const parsed = CreateServiceInputSchema.parse({
      name: 'Corte masculino',
      description: '',
      durationMinutes: '45',
      priceCents: '7000',
    });

    expect(parsed).toEqual({
      name: 'Corte masculino',
      description: null,
      durationMinutes: 45,
      priceCents: 7000,
      isActive: true,
      sortOrder: 0,
    });
  });

  it('rejects non-integer cents and empty update bodies', () => {
    expect(() =>
      CreateServiceInputSchema.parse({
        name: 'Corte',
        durationMinutes: 30,
        priceCents: 7000.5,
      }),
    ).toThrow();

    expect(() => UpdateServiceInputSchema.parse({})).toThrow();
  });
});

describe('Sprint 2 client schemas', () => {
  it('accepts a valid client create payload', () => {
    const parsed = CreateClientInputSchema.parse({
      phone: '+5511999998888',
      name: 'Joao Silva',
      email: '',
      notes: '',
    });

    expect(parsed).toEqual({
      phone: '+5511999998888',
      name: 'Joao Silva',
      email: null,
      notes: null,
    });
  });

  it('rejects non-E.164 phone numbers and empty update bodies', () => {
    expect(() =>
      CreateClientInputSchema.parse({
        phone: '11999998888',
        name: 'Joao Silva',
      }),
    ).toThrow();

    expect(() => UpdateClientInputSchema.parse({})).toThrow();
  });

  it('keeps client search strings safe for PostgREST filters', () => {
    expect(ClientListQuerySchema.parse({ q: 'Joao +5511' })).toEqual({ q: 'Joao +5511' });
    expect(() => ClientListQuerySchema.parse({ q: 'Joao,phone.ilike.*' })).toThrow();
  });
});
