import type {
  EnterResult,
  FeedbackDay,
  FeedbackGateway,
  RatingToSend,
  SubmitResult,
} from '@application/feedback/FeedbackGateway';

// a função do site segura o envio enquanto a planilha atende a fila (até uns 40 s)
const TIMEOUT_MS = 50_000;

interface ApiBody extends Partial<Omit<Extract<EnterResult, { kind: 'open' }>, 'kind' | 'day' | 'next'>> {
  ok?: boolean;
  status?: string;
  error?: string;
  day?: FeedbackDay;
  next?: FeedbackDay | null;
}

async function post(path: string, payload: unknown): Promise<ApiBody | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return (await response.json()) as ApiBody;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class SiteFeedbackGateway implements FeedbackGateway {
  async enter(email: string, whatsapp: string): Promise<EnterResult> {
    const body = await post('/api/feedback/entrar', { email, whatsapp });
    if (!body) return { kind: 'unavailable' };
    if (body.ok !== true || !body.person) {
      if (body.error === 'not-found') return { kind: 'not-found' };
      if (body.error === 'rate-limited') return { kind: 'rate-limited' };
      return { kind: 'unavailable' };
    }
    const { person } = body;
    const next = body.next ?? null;
    if (body.status === 'open' && body.day && body.colleagues && body.ticket) {
      return { kind: 'open', person, day: body.day, next, colleagues: body.colleagues, ticket: body.ticket };
    }
    if (body.status === 'done' && body.day) return { kind: 'done', person, day: body.day, next };
    if (body.status === 'alone') return { kind: 'alone', person, next };
    if (body.status === 'closed') return { kind: 'closed', person, next };
    return { kind: 'unavailable' };
  }

  async submit(ticket: string, ratings: RatingToSend[]): Promise<SubmitResult> {
    const body = await post('/api/feedback/enviar', { ticket, ratings });
    if (!body) return { kind: 'busy' };
    const next = body.next ?? null;
    if (body.ok === true) return { kind: 'sent', next };
    switch (body.error) {
      case 'already':
        return { kind: 'already', next };
      case 'closed':
        return { kind: 'closed', next };
      case 'expired':
        return { kind: 'expired' };
      case 'invalid':
        return { kind: 'invalid' };
      case 'busy':
        return { kind: 'busy' };
      default:
        return { kind: 'unavailable' };
    }
  }
}
