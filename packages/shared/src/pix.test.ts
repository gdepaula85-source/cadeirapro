import { describe, it, expect } from 'vitest';
import { validatePixKeyFormat, isPixKeyType, PIX_KEY_TYPES } from './pix';

describe('validatePixKeyFormat — cpf', () => {
  it('accepts 11 digits', () => {
    expect(validatePixKeyFormat('12345678901', 'cpf')).toBe(true);
  });
  it('rejects formatted CPF (S1: digits-only)', () => {
    expect(validatePixKeyFormat('123.456.789-01', 'cpf')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(validatePixKeyFormat('1234567890', 'cpf')).toBe(false);
    expect(validatePixKeyFormat('123456789012', 'cpf')).toBe(false);
  });
  it('rejects non-digits', () => {
    expect(validatePixKeyFormat('1234567890a', 'cpf')).toBe(false);
  });
});

describe('validatePixKeyFormat — cnpj', () => {
  it('accepts 14 digits', () => {
    expect(validatePixKeyFormat('12345678000190', 'cnpj')).toBe(true);
  });
  it('rejects formatted CNPJ', () => {
    expect(validatePixKeyFormat('12.345.678/0001-90', 'cnpj')).toBe(false);
  });
});

describe('validatePixKeyFormat — email', () => {
  it('accepts common shapes', () => {
    expect(validatePixKeyFormat('a@b.co', 'email')).toBe(true);
    expect(validatePixKeyFormat('user.name+tag@example.com.br', 'email')).toBe(true);
  });
  it('rejects malformed', () => {
    expect(validatePixKeyFormat('foo', 'email')).toBe(false);
    expect(validatePixKeyFormat('foo@bar', 'email')).toBe(false);
    expect(validatePixKeyFormat('@bar.com', 'email')).toBe(false);
  });
});

describe('validatePixKeyFormat — phone', () => {
  it('accepts E.164', () => {
    expect(validatePixKeyFormat('+5511999998888', 'phone')).toBe(true);
    expect(validatePixKeyFormat('+14155552671', 'phone')).toBe(true);
  });
  it('rejects missing +', () => {
    expect(validatePixKeyFormat('5511999998888', 'phone')).toBe(false);
  });
  it('rejects leading zero country code', () => {
    expect(validatePixKeyFormat('+0123456789', 'phone')).toBe(false);
  });
});

describe('validatePixKeyFormat — random (UUID v4)', () => {
  it('accepts a v4 UUID', () => {
    expect(validatePixKeyFormat('550e8400-e29b-41d4-a716-446655440000', 'random')).toBe(true);
  });
  it('rejects non-v4 (missing 4 in third group)', () => {
    expect(validatePixKeyFormat('550e8400-e29b-31d4-a716-446655440000', 'random')).toBe(false);
  });
  it('rejects wrong shape', () => {
    expect(validatePixKeyFormat('not-a-uuid', 'random')).toBe(false);
  });
});

describe('validatePixKeyFormat — edge cases', () => {
  it('rejects empty string for any type', () => {
    for (const t of PIX_KEY_TYPES) {
      expect(validatePixKeyFormat('', t)).toBe(false);
    }
  });
});

describe('isPixKeyType', () => {
  it('narrows valid strings', () => {
    expect(isPixKeyType('cpf')).toBe(true);
    expect(isPixKeyType('email')).toBe(true);
    expect(isPixKeyType('PHONE')).toBe(false); // case-sensitive
    expect(isPixKeyType('iban')).toBe(false);
    expect(isPixKeyType(42)).toBe(false);
  });
});
