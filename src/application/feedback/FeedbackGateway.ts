// porta da avaliação entre colegas: o navegador só conhece estes resultados. As notas vão, nunca voltam
import type { PeerRating } from '@domain/value-objects/PeerReview';

export interface FeedbackPerson {
  name: string;
  team: string;
}

export interface FeedbackDay {
  day: string;
  label: string;
  opens: string;
  closes: string;
}

export interface Colleague {
  id: string;
  name: string;
}

export interface RatingToSend extends PeerRating {
  id: string;
}

export type EnterResult =
  | {
      kind: 'open';
      person: FeedbackPerson;
      day: FeedbackDay;
      next: FeedbackDay | null;
      colleagues: Colleague[];
      ticket: string;
    }
  | { kind: 'done'; person: FeedbackPerson; day: FeedbackDay; next: FeedbackDay | null }
  | { kind: 'closed' | 'alone'; person: FeedbackPerson; next: FeedbackDay | null }
  | { kind: 'not-found' | 'rate-limited' | 'unavailable' };

export type SubmitResult =
  | { kind: 'sent' | 'already' | 'closed'; next: FeedbackDay | null }
  | { kind: 'expired' | 'invalid' | 'busy' | 'unavailable' };

export interface FeedbackGateway {
  enter(email: string, whatsapp: string): Promise<EnterResult>;
  submit(ticket: string, ratings: RatingToSend[]): Promise<SubmitResult>;
}
