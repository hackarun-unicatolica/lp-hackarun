// fila de questões de um NPC das gemas: cada cor tem a sua. A questão sorteada vai para o fim da fila (acertando ou
// errando) e só volta depois que todas as outras da cor saírem. A regra de juntar duas filas é a mesma do Apps Script
// (gemsMerge_ em apps-script/Gems.gs)

export const GEM_COLORS = ['azul', 'amarelo', 'vermelho'] as const;
export type GemColor = (typeof GEM_COLORS)[number];

export const isGemColor = (value: unknown): value is GemColor =>
  typeof value === 'string' && (GEM_COLORS as readonly string[]).includes(value);

export const GEM_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type GemLetter = (typeof GEM_LETTERS)[number];

export interface GemQuestion {
  n: number;
  question: string;
  options: readonly [string, string, string, string];
  answer: GemLetter;
}

// rodada atual (começa em 1), números que já saíram nela e quando a fila mudou (ms)
export interface QueueState {
  round: number;
  used: readonly number[];
  updatedAt: number;
}

export const EMPTY_QUEUE: QueueState = { round: 1, used: [], updatedAt: 0 };

// rodada maior vence; na mesma rodada junta o que saiu dos dois lados, para nenhuma questão voltar antes da hora
export function mergeQueueStates(a: QueueState, b: QueueState): QueueState {
  if (a.round !== b.round) return a.round > b.round ? a : b;
  const used = [...a.used];
  for (const n of b.used) if (!used.includes(n)) used.push(n);
  return { round: a.round, used, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}

export const sameQueue = (a: QueueState, b: QueueState): boolean =>
  a.round === b.round && a.used.length === b.used.length && a.used.every((n) => b.used.includes(n));

// quantas questões da cor ainda não saíram nesta rodada
export function remainingIn(numbers: readonly number[], state: QueueState): number {
  return numbers.filter((n) => !state.used.includes(n)).length;
}

// sorteia entre as que ainda não saíram; acabou a rodada, começa outra com todas de volta
export function drawNext(
  numbers: readonly number[],
  state: QueueState,
  random: () => number,
  now: number,
): { n: number; state: QueueState } | null {
  if (numbers.length === 0) return null;
  let round = state.round;
  let used = state.used.filter((n) => numbers.includes(n));
  let available = numbers.filter((n) => !used.includes(n));
  if (available.length === 0) {
    round += 1;
    used = [];
    available = [...numbers];
  }
  const index = Math.min(available.length - 1, Math.floor(random() * available.length));
  const n = available[index] as number;
  return { n, state: { round, used: [...used, n], updatedAt: Math.max(now, state.updatedAt + 1) } };
}

// estado vindo de fora (armazenamento do navegador ou da planilha): o que não for válido vira null
export function cleanQueueState(value: unknown): QueueState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { round?: unknown; used?: unknown; updatedAt?: unknown };
  const round = Math.round(Number(raw.round));
  const updatedAt = Number(raw.updatedAt);
  if (!(round >= 1) || !(updatedAt >= 0) || !Array.isArray(raw.used)) return null;
  const used: number[] = [];
  for (const item of raw.used) {
    const n = Math.round(Number(item));
    if (n > 0 && n <= 10_000 && !used.includes(n)) used.push(n);
  }
  return { round, used, updatedAt };
}

export function cleanQuestion(value: unknown): GemQuestion | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { n?: unknown; question?: unknown; options?: unknown; answer?: unknown };
  const n = Number(raw.n);
  const options = Array.isArray(raw.options) ? raw.options.map((o) => (typeof o === 'string' ? o : '')) : [];
  const answer = typeof raw.answer === 'string' ? raw.answer.toUpperCase() : '';
  if (!Number.isInteger(n) || n <= 0 || typeof raw.question !== 'string' || !raw.question.trim()) return null;
  if (options.length !== 4 || options.some((o) => !o.trim())) return null;
  if (!(GEM_LETTERS as readonly string[]).includes(answer)) return null;
  return {
    n,
    question: raw.question,
    options: options as unknown as GemQuestion['options'],
    answer: answer as GemLetter,
  };
}
