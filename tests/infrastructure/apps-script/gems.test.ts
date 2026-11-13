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

interface DeliveryResponse {
  ok: boolean;
  error?: string;
  teams?: string[];
  done?: { team: string; at: string }[];
}

function deliverySetup() {
  const { script, post } = setup();
  script.seed(
    [],
    [
      { Equipe: 'Equipe Muk', Status: 'confirmado' },
      { Equipe: 'Equipe Poliwhirl', Status: 'confirmado' },
      { Equipe: 'Equipe Rascunho', Status: 'pendente' },
    ],
  );
  const send = (body: Record<string, unknown>) => post(body) as unknown as DeliveryResponse;
  return { script, send };
}

describe('Apps Script · entrega final das insígnias', () => {
  it('lista só as equipes confirmadas e cria a aba Insígnias completas formatada', () => {
    const { script, send } = deliverySetup();
    const res = send({ action: 'gems-teams' });
    expect(res.teams).toEqual(['Equipe Muk', 'Equipe Poliwhirl']);
    expect(res.done).toEqual([]);
    const tab = script.tab('Insígnias completas');
    expect(tab.rows[0]).toEqual(['Equipe', 'Completou em', 'Situação']);
    expect(tab.frozen.rows).toBe(1);
    expect(script.properties['INSIGNIAS_VERSAO']).toBe('2');
  });

  it('a aba Questões ganha uma cor por palestra (regra na linha inteira) e o título congelado', () => {
    const { script, send } = deliverySetup();
    send({ action: 'gems-teams' });
    const questions = script.tab('Questões');
    expect(questions.frozen.rows).toBe(1);
    expect(questions.conditionalRules).toHaveLength(3);
    expect(questions.columnWidths.get(3)).toBe(380);
  });

  it('marca com a hora da marcação feita na tela (não a do envio), em ordem de chegada', () => {
    const { script, send } = deliverySetup();
    script.now = Date.parse('2026-11-13T21:00:00-03:00');
    const marked = '2026-11-13T20:00:00.000-03:00';
    send({ action: 'gems-finish', team: 'equipe poliwhirl', at: marked });
    const res = send({ action: 'gems-finish', team: 'Equipe Muk' });
    expect(res.done?.map((d) => d.team)).toEqual(['Equipe Poliwhirl', 'Equipe Muk']);
    expect(res.done?.[0]?.at).toBe(new Date(marked).toISOString());
    expect(res.done?.[1]?.at).toBe(new Date('2026-11-13T21:00:00-03:00').toISOString());
  });

  it('hora no futuro ou velha demais vira a hora do servidor', () => {
    const { script, send } = deliverySetup();
    script.now = Date.parse('2026-11-13T21:00:00-03:00');
    send({ action: 'gems-finish', team: 'Equipe Muk', at: '2026-11-13T22:00:00-03:00' });
    const res = send({ action: 'gems-finish', team: 'Equipe Poliwhirl', at: '2026-11-01T10:00:00-03:00' });
    const server = new Date(script.now).toISOString();
    expect(res.done?.map((d) => d.at)).toEqual([server, server]);
  });

  it('reenvio do mesmo pedido nunca duplica: marcar de novo e desmarcar de novo respondem ok sem mudar nada', () => {
    const { script, send } = deliverySetup();
    send({ action: 'gems-finish', team: 'Equipe Muk' });
    const again = send({ action: 'gems-finish', team: 'Equipe Muk' });
    expect(again.ok).toBe(true);
    expect(script.tab('Insígnias completas').data).toHaveLength(1);
    send({ action: 'gems-undo', team: 'Equipe Muk' });
    const undoAgain = send({ action: 'gems-undo', team: 'Equipe Muk' });
    expect(undoAgain.ok).toBe(true);
    expect(undoAgain.done).toEqual([]);
  });

  it('desmarcar apaga a linha da aba e não mexe nas outras', () => {
    const { script, send } = deliverySetup();
    send({ action: 'gems-finish', team: 'Equipe Muk' });
    send({ action: 'gems-finish', team: 'Equipe Poliwhirl' });
    send({ action: 'gems-undo', team: 'Equipe Muk' });
    const tab = script.tab('Insígnias completas');
    expect(tab.data.map((r) => r[0])).toEqual(['Equipe Poliwhirl']);
  });

  it('a aba da versão anterior perde a coluna Desmarcado em e as linhas desmarcadas', () => {
    const { script, send } = deliverySetup();
    const old = script.book.add(new FakeSheet('Insígnias completas'));
    old.appendRow(['Equipe', 'Completou em', 'Situação', 'Desmarcado em']);
    old.appendRow(['Equipe Muk', new Date(), 'desmarcado', new Date()]);
    old.appendRow(['Equipe Poliwhirl', new Date(), 'completou', '']);
    script.properties['INSIGNIAS_VERSAO'] = '1';
    const res = send({ action: 'gems-teams' });
    expect(res.done?.map((d) => d.team)).toEqual(['Equipe Poliwhirl']);
    expect(old.rows[0]).toEqual(['Equipe', 'Completou em', 'Situação']);
    expect(old.data).toHaveLength(1);
  });

  it('equipe que não existe ou não está confirmada é recusada', () => {
    const { send } = deliverySetup();
    expect(send({ action: 'gems-finish', team: 'Equipe Fantasma' }).error).toBe('unknown-team');
    expect(send({ action: 'gems-finish', team: 'Equipe Rascunho' }).error).toBe('unknown-team');
  });
});
