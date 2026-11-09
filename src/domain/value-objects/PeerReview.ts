// avaliação de um colega de equipe no dia: de 1 a 5 estrelas ou "não compareceu". Nota baixa (3 ou menos) e falta
// precisam de justificativa. Sem imports: a função da Cloudflare usa as mesmas regras. O Apps Script (Feedback.gs)
// repete os números e um teste confere que são iguais
export const STARS_MIN = 1;
export const STARS_MAX = 5;
export const LOW_STARS = 3;
export const REASON_MIN = 15;
export const REASON_MAX = 600;

export interface PeerRating {
  stars: number | null;
  absent: boolean;
  reason: string;
}

export type RatingProblem = 'score' | 'reason-short' | 'reason-long';

export const cleanReason = (text: string): string => text.replace(/\s+/g, ' ').trim();

export const needsReason = (rating: Pick<PeerRating, 'stars' | 'absent'>): boolean =>
  rating.absent || (rating.stars !== null && rating.stars <= LOW_STARS);

const validStars = (stars: number | null): boolean =>
  stars !== null && Number.isInteger(stars) && stars >= STARS_MIN && stars <= STARS_MAX;

export function ratingProblem(rating: PeerRating): RatingProblem | null {
  if (rating.absent ? rating.stars !== null : !validStars(rating.stars)) return 'score';
  const length = cleanReason(rating.reason).length;
  if (length > REASON_MAX) return 'reason-long';
  if (needsReason(rating) && length < REASON_MIN) return 'reason-short';
  return null;
}
