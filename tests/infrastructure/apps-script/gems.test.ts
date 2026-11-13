// gemas dos NPCs no Apps Script (Gems.gs): só responde com a chave; cada cor recebe só as suas questões; a fila junta
// o que veio do aparelho com o que já estava guardado, pela mesma regra do site
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mergeQueueStates } from '../../../src/domain/gems/GemQueue';
import { AppsScriptSandbox } from '../../helpers/apps-script/sandbox';
import { FakeSheet } from '../../helpers/apps-script/sheetFakes';

const TOKEN = 'k'.repeat(40);

interface GemsResponse {
  ok: boolean;
  error?: string;
  questions?: { n: number; question: string; options: string[]; answer: string }[];
  state?: { round: number; used: number[]; updatedAt: number };
}

function setup() {
  const script = new AppsScriptSandbox();
  script.properties['SORTEIO_TOKEN'] = TOKEN;
  const sheet = script.book.add(new FakeSheet('Questões'));
  sheet.appendRow(['Cor', 'Nº', 'Pergunta', 'A', 'B', 'C', 'D', 'Resposta']);
  sheet.appendRow(['Azul', 2, 'Segunda azul?', 'a', 'b', 'c', 'd', 'c']);
  sheet.appendRow(['azul', 1, 'Primeira azul?', 'a', 'b', 'c', 'd', 'B']);
  sheet.appendRow(['vermelho', 1, 'Vermelha?', 'a', 'b', 'c', 'd', 'A']);
  sheet.appendRow(['azul', 3, 'Sem resposta', 'a', 'b', 'c', 'd', '']);
  sheet.appendRow(['azul', 4, 'Falta alternativa', 'a', 'b', '', 'd', 'A']);
  sheet.appendRow(['azul', 1, 'Número repetido', 'a', 'b', 'c', 'd', 'A']);
  const post = (body: Record<string, unknown>) =>
    script.post({ token: TOKEN, ...body }) as unknown as GemsResponse;
  return { script, post };
}

describe('Apps Script · gemas dos NPCs', () => {
  it('sem a chave certa não responde', () => {
    const { script } = setup();
    expect(script.post({ action: 'gems-load', color: 'azul', token: 'errada' }).error).toBe('unauthorized');
  });

  it('cor desconhecida é recusada', () => {
    const { post } = setup();
    expect(post({ action: 'gems-load', color: 'verde' }).error).toBe('invalid');
  });

  it('cada cor recebe só as suas questões, em ordem, sem linhas incompletas nem número repetido', () => {
    const { post } = setup();
    const azul = post({ action: 'gems-load', color: 'azul' });
    expect(azul.ok).toBe(true);
    expect(azul.questions?.map((q) => q.n)).toEqual([1, 2]);
    expect(azul.questions?.[0]).toEqual({
      n: 1,
      question: 'Primeira azul?',
      options: ['a', 'b', 'c', 'd'],
      answer: 'B',
    });
    expect(post({ action: 'gems-load', color: 'vermelho' }).questions?.map((q) => q.question)).toEqual([
      'Vermelha?',
    ]);
    expect(post({ action: 'gems-load', color: 'amarelo' }).questions).toEqual([]);
  });

  it('fila começa vazia na rodada 1 e guarda o que o aparelho mandou', () => {
    const { post } = setup();
    expect(post({ action: 'gems-load', color: 'azul' }).state).toEqual({ round: 1, used: [], updatedAt: 0 });
    const state = { round: 1, used: [2], updatedAt: 100 };
    expect(post({ action: 'gems-sync', color: 'azul', state }).state).toEqual(state);
    expect(post({ action: 'gems-load', color: 'azul' }).state).toEqual(state);
    // a fila de uma cor não mexe na outra
    expect(post({ action: 'gems-load', color: 'vermelho' }).state?.used).toEqual([]);
  });

  it('junta as filas pela mesma regra do site (rodada maior vence; mesma rodada soma)', () => {
    const { post } = setup();
    const first = { round: 1, used: [1, 2], updatedAt: 10 };
    const second = { round: 1, used: [2, 3], updatedAt: 20 };
    post({ action: 'gems-sync', color: 'azul', state: first });
    const merged = post({ action: 'gems-sync', color: 'azul', state: second }).state;
    expect(merged).toEqual(mergeQueueStates(first, second));
    const older = { round: 1, used: [9], updatedAt: 5 };
    const next = { round: 2, used: [4], updatedAt: 30 };
    expect(post({ action: 'gems-sync', color: 'azul', state: next }).state).toEqual(next);
    expect(post({ action: 'gems-sync', color: 'azul', state: older }).state).toEqual(next);
  });

  it('fila torta é recusada sem apagar a guardada', () => {
    const { post } = setup();
    post({ action: 'gems-sync', color: 'azul', state: { round: 1, used: [1], updatedAt: 1 } });
    expect(post({ action: 'gems-sync', color: 'azul', state: { round: 0, used: [] } }).error).toBe('invalid');
    expect(post({ action: 'gems-load', color: 'azul' }).state?.used).toEqual([1]);
  });
});
