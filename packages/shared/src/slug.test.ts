import { describe, it, expect } from 'vitest';
import { slugify, randomSlugSuffix } from './slug';

describe('slugify', () => {
  it('handles plain ASCII', () => {
    expect(slugify('Joao Barber Shop')).toBe('joao-barber-shop');
    expect(slugify('Demo Barbearia')).toBe('demo-barbearia');
  });

  it('strips Brazilian diacritics', () => {
    expect(slugify('Espaço Barbearia')).toBe('espaco-barbearia');
    expect(slugify('São Paulo Cortes')).toBe('sao-paulo-cortes');
    expect(slugify('Cabeleireiro do João')).toBe('cabeleireiro-do-joao');
  });

  it('collapses non-alphanumeric runs', () => {
    expect(slugify('Foo & Bar / Baz')).toBe('foo-bar-baz');
    expect(slugify('A!!!B???C')).toBe('a-b-c');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello');
    expect(slugify('!@#hi#@!')).toBe('hi');
  });

  it('falls back when normalized input is empty', () => {
    expect(slugify('')).toBe('shop');
    expect(slugify('   ')).toBe('shop');
    expect(slugify('!@#$%')).toBe('shop');
    expect(slugify('---')).toBe('shop');
  });

  it('accepts custom fallback', () => {
    expect(slugify('', { fallback: 'unnamed' })).toBe('unnamed');
  });

  it('honours maxLength and re-trims trailing hyphens', () => {
    const long = 'a-very-long-shop-name-that-keeps-on-going-forever-and-ever-and-ever';
    const out = slugify(long, { maxLength: 20 });
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).not.toMatch(/-$/);
  });

  it('keeps numbers', () => {
    expect(slugify('Studio 2025')).toBe('studio-2025');
  });
});

describe('randomSlugSuffix', () => {
  it('produces lowercase alphanumeric of given length', () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSlugSuffix();
      expect(s).toMatch(/^[a-z0-9]{4}$/);
    }
  });

  it('honours custom length', () => {
    expect(randomSlugSuffix(8)).toMatch(/^[a-z0-9]{8}$/);
    expect(randomSlugSuffix(1)).toMatch(/^[a-z0-9]$/);
  });

  it('rejects non-positive length', () => {
    expect(() => randomSlugSuffix(0)).toThrow();
    expect(() => randomSlugSuffix(-1)).toThrow();
  });

  it('produces different values on repeated calls (randomness sanity)', () => {
    const samples = new Set<string>();
    for (let i = 0; i < 200; i++) samples.add(randomSlugSuffix(8));
    // 200 8-char alphanumeric samples should not collide in practice
    expect(samples.size).toBeGreaterThan(195);
  });
});
