// fila de questões dos NPCs: a sorteada vai pro fim e só volta depois de todas as outras da cor
import { describe, expect, it } from 'vitest';
import {
  cleanQuestion,
  cleanQueueState,
  drawNext,
  EMPTY_QUEUE,
  mergeQueueStates,
  remainingIn,
  type QueueState,
} from '@domain/gems/GemQueue';

const FIFTY = Array.from({ length: 50 }, (_, i) => i + 1);

// gerador fixo (mesma sequência em toda rodada do teste)
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('sorteio da fila', () => {
  it('as 50 saem uma vez cada antes de qualquer repetição, e a 51ª abre a rodada 2', () => {
    const random = seeded(7);
    let state: QueueState = EMPTY_QUEUE;
    const drawn: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const next = drawNext(FIFTY, state, random, 1000 + i);
      if (!next) throw new Error('sem questão');
      drawn.push(next.n);
      state = next.state;
    }
    expect([...drawn].sort((a, b) => a - b)).toEqual(FIFTY);
    expect(state.round).toBe(1);
    expect(remainingIn(FIFTY, state)).toBe(0);
    const next = drawNext(FIFTY, state, random, 2000);
    expect(next?.state.round).toBe(2);
    expect(next?.state.used).toEqual([next?.n]);
  });

  it('nunca sorteia uma que já saiu na rodada, mesmo com o aleatório no limite', () => {
    const state: QueueState = { round: 3, used: FIFTY.slice(0, 49), updatedAt: 5 };
    expect(drawNext(FIFTY, state, () => 0.999999, 10)?.n).toBe(50);
    expect(drawNext(FIFTY, { ...state, used: FIFTY.slice(1) }, () => 0, 10)?.n).toBe(1);
  });

  it('número guardado que não existe mais na aba não trava a rodada', () => {
    const state: QueueState = { round: 1, used: [...FIFTY.slice(0, 49), 999], updatedAt: 1 };
    expect(drawNext(FIFTY, state, () => 0.5, 2)?.n).toBe(50);
  });

  it('o relógio da fila sempre anda, mesmo com o relógio do aparelho atrasado', () => {
    const next = drawNext(FIFTY, { round: 1, used: [], updatedAt: 9_000 }, () => 0, 100);
    expect(next?.state.updatedAt).toBe(9_001);
  });

  it('sem questões não sorteia', () => {
    expect(drawNext([], EMPTY_QUEUE, () => 0, 1)).toBeNull();
  });
});

describe('juntar a fila do aparelho com a da planilha', () => {
  it('rodada maior vence', () => {
    const a = { round: 2, used: [1], updatedAt: 1 };
    const b = { round: 1, used: [2, 3], updatedAt: 9 };
    expect(mergeQueueStates(a, b)).toBe(a);
    expect(mergeQueueStates(b, a)).toBe(a);
  });

  it('mesma rodada junta o que saiu nos dois lados, sem repetir', () => {
    const merged = mergeQueueStates(
      { round: 1, used: [1, 2], updatedAt: 5 },
      { round: 1, used: [2, 3], updatedAt: 7 },
    );
    expect(merged).toEqual({ round: 1, used: [1, 2, 3], updatedAt: 7 });
  });
});

describe('dados vindos de fora', () => {
  it('fila torta vira null; números repetidos e inválidos somem', () => {
    expect(cleanQueueState(null)).toBeNull();
    expect(cleanQueueState({ round: 0, used: [], updatedAt: 1 })).toBeNull();
    expect(cleanQueueState({ round: 1, used: 'x', updatedAt: 1 })).toBeNull();
    expect(cleanQueueState({ round: 1, used: [3, 3, -1, 'a', 2], updatedAt: 1 })).toEqual({
      round: 1,
      used: [3, 2],
      updatedAt: 1,
    });
  });

  it('questão precisa de texto, 4 alternativas e resposta A a D', () => {
    const good = { n: 1, question: 'Q?', options: ['a', 'b', 'c', 'd'], answer: 'b' };
    expect(cleanQuestion(good)?.answer).toBe('B');
    expect(cleanQuestion({ ...good, answer: 'E' })).toBeNull();
    expect(cleanQuestion({ ...good, options: ['a', 'b', 'c'] })).toBeNull();
    expect(cleanQuestion({ ...good, options: ['a', 'b', 'c', ' '] })).toBeNull();
    expect(cleanQuestion({ ...good, question: '  ' })).toBeNull();
  });
});
