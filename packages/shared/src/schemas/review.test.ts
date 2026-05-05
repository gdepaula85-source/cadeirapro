import { describe, expect, it } from 'vitest';
import { CreateReviewInputSchema } from './review';

describe('CreateReviewInputSchema', () => {
  it('accepts a valid rating and trims comments', () => {
    const parsed = CreateReviewInputSchema.parse({
      bookingId: '11111111-1111-4111-8111-111111111111',
      rating: 5,
      comment: '  Excelente atendimento  ',
    });

    expect(parsed).toEqual({
      bookingId: '11111111-1111-4111-8111-111111111111',
      rating: 5,
      comment: 'Excelente atendimento',
    });
  });

  it('turns blank comments into null', () => {
    expect(
      CreateReviewInputSchema.parse({
        bookingId: '11111111-1111-4111-8111-111111111111',
        rating: 4,
        comment: '   ',
      }).comment,
    ).toBeNull();
  });

  it('rejects ratings outside 1-5', () => {
    expect(() =>
      CreateReviewInputSchema.parse({
        bookingId: '11111111-1111-4111-8111-111111111111',
        rating: 6,
      }),
    ).toThrow();
  });
});
