import { Observable } from '@shared/core/Observable';
import { wait } from '@shared/utils/async';
import type {
  Colleague,
  FeedbackDay,
  FeedbackGateway,
  FeedbackPerson,
} from '@application/feedback/FeedbackGateway';
import {
  cleanReason,
  ratingProblem,
  type PeerRating,
  type RatingProblem,
} from '@domain/value-objects/PeerReview';

export type FeedbackScreen = 'identify' | 'rate' | 'finished';
export type FeedbackOutcome = 'sent' | 'already' | 'closed' | 'alone';

export interface PeerFeedbackState {
  screen: FeedbackScreen;
  busy: boolean;
  // a planilha está ocupada e o envio segue tentando sozinho
  queued: boolean;
  error: string | null;
  person: FeedbackPerson | null;
  day: FeedbackDay | null;
  next: FeedbackDay | null;
  colleagues: Colleague[];
  ratings: Record<string, PeerRating>;
  problems: Record<string, RatingProblem>;
  outcome: FeedbackOutcome | null;
}

const INITIAL: PeerFeedbackState = {
  screen: 'identify',
  busy: false,
  queued: false,
  error: null,
  person: null,
  day: null,
  next: null,
  colleagues: [],
  ratings: {},
  problems: {},
  outcome: null,
};

const UNAVAILABLE = 'Não conseguimos falar com o sistema agora. Tente de novo em instantes.';
const BUSY = 'Muita gente enviando ao mesmo tempo. Suas respostas continuam aqui: toque em enviar de novo.';
// planilha ocupada: tenta de novo sozinho por uns 3 minutos antes de pedir um novo toque (no pico, a fila da planilha
// anda devagar). Repetir é seguro, ela recusa o segundo envio. O sorteio do tempo evita que todos voltem juntos
const RETRY_DELAYS_MS = [4000, 8000, 12000, 16000, 20000, 25000, 30000, 30000];
const RETRY_JITTER_MS = 3000;

const emptyRating = (): PeerRating => ({ stars: null, absent: false, reason: '' });

export class PeerFeedbackViewModel {
  readonly state = new Observable<PeerFeedbackState>(INITIAL);
  private ticket = '';

  constructor(
    private readonly gateway: FeedbackGateway,
    private readonly sleep: (ms: number) => Promise<void> = wait,
  ) {}

  private patch(partial: Partial<PeerFeedbackState>): void {
    this.state.update((s) => ({ ...s, ...partial }));
  }

  private finish(outcome: FeedbackOutcome, next: FeedbackDay | null): void {
    this.ticket = '';
    this.patch({ screen: 'finished', outcome, next, busy: false, error: null, ratings: {}, problems: {} });
  }

  async enter(email: string, whatsapp: string): Promise<void> {
    if (this.state.value.busy) return;
    const digits = whatsapp.replace(/\D/g, '');
    if (!email.includes('@') || digits.length < 10) {
      this.patch({ error: 'Preencha o e-mail e o WhatsApp com DDD, como na sua inscrição.' });
      return;
    }
    this.patch({ busy: true, error: null });
    const result = await this.gateway.enter(email, whatsapp);
    switch (result.kind) {
      case 'not-found':
        this.patch({
          busy: false,
          error:
            'Não encontramos ninguém em equipe com esses dados. Confira o e-mail e o WhatsApp da sua inscrição.',
        });
        return;
      case 'rate-limited':
        this.patch({ busy: false, error: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
        return;
      case 'unavailable':
        this.patch({ busy: false, error: UNAVAILABLE });
        return;
      case 'open':
        this.ticket = result.ticket;
        this.patch({
          screen: 'rate',
          busy: false,
          person: result.person,
          day: result.day,
          next: result.next,
          colleagues: result.colleagues,
          ratings: Object.fromEntries(result.colleagues.map((c) => [c.id, emptyRating()])),
          problems: {},
        });
        return;
      case 'done':
        this.patch({ person: result.person, day: result.day });
        this.finish('already', result.next);
        return;
      default:
        this.patch({ person: result.person });
        this.finish(result.kind, result.next);
    }
  }

  private change(id: string, partial: Partial<PeerRating>): void {
    this.state.update((s) => {
      const current = s.ratings[id];
      if (!current || s.busy) return s;
      const problems = Object.fromEntries(Object.entries(s.problems).filter(([key]) => key !== id));
      return { ...s, error: null, problems, ratings: { ...s.ratings, [id]: { ...current, ...partial } } };
    });
  }

  setStars(id: string, stars: number): void {
    this.change(id, { stars, absent: false });
  }

  setAbsent(id: string, absent: boolean): void {
    this.change(id, { absent, stars: null });
  }

  setReason(id: string, reason: string): void {
    this.change(id, { reason });
  }

  private validate(): Record<string, RatingProblem> {
    const entries = Object.entries(this.state.value.ratings).flatMap(([id, rating]) => {
      const problem = ratingProblem(rating);
      return problem ? [[id, problem] as const] : [];
    });
    return Object.fromEntries(entries);
  }

  async submit(): Promise<void> {
    const { busy, ratings } = this.state.value;
    if (busy) return;
    const problems = this.validate();
    if (Object.keys(problems).length > 0) {
      this.patch({ problems, error: 'Falta completar a avaliação dos colegas marcados.' });
      return;
    }
    this.patch({ busy: true, error: null, problems: {} });
    const payload = Object.entries(ratings).map(([id, r]) => ({ id, ...r, reason: cleanReason(r.reason) }));

    let result = await this.gateway.submit(this.ticket, payload);
    for (const delay of RETRY_DELAYS_MS) {
      if (result.kind !== 'busy') break;
      this.patch({ queued: true });
      await this.sleep(delay + Math.random() * RETRY_JITTER_MS);
      result = await this.gateway.submit(this.ticket, payload);
    }
    this.patch({ queued: false });

    switch (result.kind) {
      case 'sent':
      case 'already':
      case 'closed':
        this.finish(result.kind, result.next);
        return;
      case 'expired':
        this.ticket = '';
        this.patch({
          ...INITIAL,
          error: 'Sua sessão expirou. Entre de novo para enviar a avaliação.',
        });
        return;
      case 'invalid':
        this.patch({
          busy: false,
          error: 'Sua equipe mudou ou algo não foi aceito. Recarregue a página e avalie de novo.',
        });
        return;
      case 'busy':
        this.patch({ busy: false, error: BUSY });
        return;
      default:
        this.patch({ busy: false, error: UNAVAILABLE });
    }
  }
}
