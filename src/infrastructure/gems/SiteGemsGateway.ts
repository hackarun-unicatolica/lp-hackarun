import type { DeliveryState, GemsGateway, GemsResult } from '@application/gems/GemsPorts';
import {
  cleanQuestion,
  cleanQueueState,
  type GemColor,
  type GemQuestion,
  type QueueState,
} from '@domain/gems/GemQueue';

// mesma rota das ações do sorteio: a função da Cloudflare confere a sessão da organização e repassa com a chave
const API = '/api/sorteio';
const TIMEOUT_MS = 30_000;

interface ApiBody {
  ok?: boolean;
  message?: string;
  questions?: unknown;
  state?: unknown;
  teams?: unknown;
  done?: unknown;
}

// lista da entrega vinda da planilha: o que não for texto some
function cleanDelivery(body: ApiBody): DeliveryState | null {
  if (!Array.isArray(body.teams) || !Array.isArray(body.done)) return null;
  const teams = body.teams.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
  const done = body.done.flatMap((d: unknown) => {
    const item = d as { team?: unknown; at?: unknown };
    return typeof item?.team === 'string' && typeof item.at === 'string'
      ? [{ team: item.team, at: item.at }]
      : [];
  });
  return { teams, done };
}

async function post(body: Record<string, unknown>): Promise<GemsResult<ApiBody>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401) return { kind: 'login' };
    const parsed = (await response.json()) as ApiBody;
    if (parsed.ok === true) return { kind: 'ok', value: parsed };
    if (parsed.message) return { kind: 'unavailable', message: parsed.message };
    return { kind: 'unavailable', message: parsed.message ?? 'A planilha não respondeu como esperado.' };
  } catch {
    return { kind: 'unavailable', message: 'Sem conexão com a planilha.' };
  } finally {
    clearTimeout(timer);
  }
}

export class SiteGemsGateway implements GemsGateway {
  async load(color: GemColor): Promise<GemsResult<{ questions: GemQuestion[]; state: QueueState }>> {
    const result = await post({ action: 'gems-load', color });
    if (result.kind !== 'ok') return result;
    const questions = Array.isArray(result.value.questions)
      ? result.value.questions.map(cleanQuestion).filter((q): q is GemQuestion => q !== null)
      : [];
    const state = cleanQueueState(result.value.state);
    if (!state) return { kind: 'unavailable', message: 'A planilha devolveu uma fila inválida.' };
    return { kind: 'ok', value: { questions, state } };
  }

  async sync(color: GemColor, state: QueueState): Promise<GemsResult<QueueState>> {
    const result = await post({ action: 'gems-sync', color, state });
    if (result.kind !== 'ok') return result;
    const saved = cleanQueueState(result.value.state);
    return saved ? { kind: 'ok', value: saved } : { kind: 'unavailable', message: 'Resposta inválida.' };
  }

  delivery(): Promise<GemsResult<DeliveryState>> {
    return this.deliveryCall({ action: 'gems-teams' });
  }

  finish(team: string): Promise<GemsResult<DeliveryState>> {
    return this.deliveryCall({ action: 'gems-finish', team });
  }

  undo(team: string): Promise<GemsResult<DeliveryState>> {
    return this.deliveryCall({ action: 'gems-undo', team });
  }

  private async deliveryCall(body: Record<string, unknown>): Promise<GemsResult<DeliveryState>> {
    const result = await post(body);
    if (result.kind !== 'ok') return result;
    const state = cleanDelivery(result.value);
    return state ? { kind: 'ok', value: state } : { kind: 'unavailable', message: 'Resposta inválida.' };
  }
}
