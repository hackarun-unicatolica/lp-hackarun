import { describe, expect, it } from 'vitest';
import { REASON_MAX, REASON_MIN, needsReason, ratingProblem } from '@domain/value-objects/PeerReview';

const REASON = 'x'.repeat(REASON_MIN);

describe('PeerReview', () => {
  it.each([
    [1, true],
    [2, true],
    [3, true],
    [4, false],
    [5, false],
  ])('%i estrelas: justificativa obrigatória = %s', (stars, needed) => {
    expect(needsReason({ stars, absent: false })).toBe(needed);
    expect(ratingProblem({ stars, absent: false, reason: '' })).toBe(needed ? 'reason-short' : null);
    expect(ratingProblem({ stars, absent: false, reason: REASON })).toBeNull();
  });

  it('não compareceu substitui as estrelas e exige motivo', () => {
    expect(ratingProblem({ stars: null, absent: true, reason: '' })).toBe('reason-short');
    expect(ratingProblem({ stars: null, absent: true, reason: REASON })).toBeNull();
    expect(ratingProblem({ stars: 4, absent: true, reason: REASON })).toBe('score');
  });

  it.each([null, 0, 6, 2.5, Number.NaN])('estrelas inválidas: %s', (stars) => {
    expect(ratingProblem({ stars, absent: false, reason: REASON })).toBe('score');
  });

  it('espaço não conta como motivo e o limite vale depois de limpar', () => {
    expect(ratingProblem({ stars: 1, absent: false, reason: ' '.repeat(40) })).toBe('reason-short');
    expect(ratingProblem({ stars: 1, absent: false, reason: `  ${'a'.repeat(REASON_MAX)}  ` })).toBeNull();
    expect(ratingProblem({ stars: 1, absent: false, reason: 'a'.repeat(REASON_MAX + 1) })).toBe(
      'reason-long',
    );
  });
});
