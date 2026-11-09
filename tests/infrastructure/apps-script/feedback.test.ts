// avaliação entre colegas no Apps Script (Feedback.gs): só responde com a chave, uma vez por pessoa por dia e nos
// horários certos
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LOW_STARS, REASON_MAX, REASON_MIN, STARS_MAX } from '../../../src/domain/value-objects/PeerReview';
import { identityKey } from '../../../src/server/feedback/roster';
import { AUTHOR, GOOD, PEOPLE, REASON, TOKEN, setup, target } from '../../helpers/apps-script/feedbackSetup';

describe('Apps Script · avaliação entre colegas', () => {
  it('sem a chave certa não responde nem grava', () => {
    const { script } = setup();
    expect(script.post({ action: 'feedback-roster', token: 'errada' }).error).toBe('unauthorized');
    expect(script.book.getSheetByName('Avaliações')).toBeNull();
  });

  it('a lista traz só quem está em equipe e não cancelou, sem e-mail nem WhatsApp', () => {
    const { roster } = setup();
    const result = roster();
    expect(result.people.map((p) => p.protocol)).toEqual([
      'HR26-AAAAAA',
      'HR26-BBBBBB',
      'HR26-CCCCCC',
      'HR26-DDDDDD',
    ]);
    const text = JSON.stringify(result);
    expect(text).not.toContain('@exemplo.com');
    expect(text).not.toContain('99999');
  });

  it('o resumo da identidade é igual ao da função do site, com ou sem o 9 e o 55', async () => {
    const { roster } = setup();
    const ana = roster().people[0];
    const email = 'HR26-aaaaaa@exemplo.com ';
    for (const phone of ['(63) 99999-0101', '6399990101', '+55 63 99999-0101', '063999990101']) {
      expect(await identityKey(TOKEN, email, phone), phone).toBe(ana?.key);
    }
    expect(await identityKey(TOKEN, email, '(63) 98888-0101')).not.toBe(ana?.key);
  });

  it.each([
    ['12/11, noite do sorteio', '2026-11-12T21:00:00-03:00', false],
    ['13/11 antes de abrir', '2026-11-13T18:59:59-03:00', false],
    ['13/11 na abertura', '2026-11-13T19:00:00-03:00', true],
    ['13/11 no último segundo', '2026-11-13T23:59:59-03:00', true],
    ['14/11 antes de abrir', '2026-11-14T09:59:59-03:00', false],
    ['depois das finalistas', '2026-11-14T16:30:01-03:00', false],
  ])('horário: %s', (_label, at, open) => {
    const { script, send } = setup();
    script.now = Date.parse(at);
    const day = at.slice(0, 10);
    const res = send(GOOD, AUTHOR, day);
    if (open) expect(res.ok).toBe(true);
    else expect(res.error).toBe('closed');
  });

  it('grava uma linha por colega, com a nota, o motivo e quem avaliou', () => {
    const { script, send } = setup();
    expect(send().ok).toBe(true);
    const sheet = script.tab('Avaliações');
    expect(sheet.data).toHaveLength(2);
    expect(script.row(sheet, 1)).toMatchObject({
      Dia: 'Dia 13/11',
      Equipe: 'Equipe Mew',
      Avaliado: 'Caio Melo',
      Nota: 2,
      Justificativa: REASON,
      'Quem avaliou': 'Ana Souza',
      'Protocolo do avaliado': 'HR26-CCCCCC',
    });
    expect(script.flushes.at(-1)).toBe(true);
  });

  it('cada pessoa avalia uma única vez no dia: o segundo envio não grava nada', () => {
    const { script, send, roster } = setup();
    send();
    expect(send().error).toBe('already');
    expect(script.tab('Avaliações').data).toHaveLength(2);
    expect(roster().people[0]?.done).toEqual(['2026-11-13']);
    expect(roster().people[1]?.done).toEqual([]);
  });

  it('dia perdido não acumula: no dia seguinte avalia só aquele dia', () => {
    const { script, send } = setup();
    script.now = Date.parse('2026-11-14T11:00:00-03:00');
    expect(send(GOOD, AUTHOR, '2026-11-14').ok).toBe(true);
    expect(send(GOOD, AUTHOR, '2026-11-13').error).toBe('closed');
    expect(script.tab('Avaliações').data.map((r) => r[1])).toEqual(['Dia 14/11', 'Dia 14/11']);
  });

  it('não compareceu entra no lugar da nota, com justificativa', () => {
    const { script, send } = setup();
    send([
      target('HR26-BBBBBB', 'Bruno Lima', {
        stars: null,
        absent: true,
        reason: 'Não apareceu e não avisou.',
      }),
    ]);
    expect(script.row(script.tab('Avaliações'), 0)['Nota']).toBe('Não compareceu');
  });

  it.each([
    ['nota 3 sem motivo', { stars: LOW_STARS, reason: '' }],
    ['motivo curto demais', { stars: 1, reason: 'a'.repeat(REASON_MIN - 1) }],
    ['motivo longo demais', { stars: 1, reason: 'a'.repeat(REASON_MAX + 1) }],
    ['falta sem motivo', { stars: null, absent: true }],
    ['falta com estrelas', { stars: 2, absent: true, reason: REASON }],
    ['sem nota', { stars: null }],
    ['zero estrelas', { stars: 0 }],
    ['seis estrelas', { stars: STARS_MAX + 1 }],
    ['nota quebrada', { stars: 4.5 }],
    ['nota em texto', { stars: '5' }],
  ])('recusa e não grava: %s', (_label, score) => {
    const { script, send } = setup();
    expect(send([target('HR26-BBBBBB', 'Bruno Lima', score)]).error).toBe('invalid');
    expect(script.tab('Inscritos').data).toHaveLength(PEOPLE.length);
    expect(script.book.getSheetByName('Avaliações')).toBeNull();
  });

  it('recusa autoavaliação e colega repetido', () => {
    const { send } = setup();
    expect(send([target(AUTHOR.protocol, AUTHOR.name, { stars: 5 })]).error).toBe('invalid');
    expect(send([GOOD[0], GOOD[0]]).error).toBe('invalid');
  });

  it('nota boa não guarda texto e texto malicioso não vira fórmula', () => {
    const { script, send } = setup();
    send([
      target('HR26-BBBBBB', 'Bruno Lima', { stars: 4, reason: 'qualquer coisa' }),
      target('HR26-CCCCCC', 'Caio Melo', { stars: 1, reason: '=IMPORTXML("http://x","//a") ruim' }),
    ]);
    const sheet = script.tab('Avaliações');
    expect(script.row(sheet, 0)['Justificativa']).toBe('');
    expect(String(script.row(sheet, 1)['Justificativa']).startsWith("'=")).toBe(true);
  });

  it('planilha ocupada avisa para tentar de novo, sem gravar', () => {
    const { script, send, roster } = setup();
    roster();
    script.lock.busy = true;
    expect(send().error).toBe('busy');
    expect(script.tab('Avaliações').data).toHaveLength(0);
  });

  it('a propriedade troca os horários; valor torto fecha tudo', () => {
    const { script, send } = setup();
    script.properties['FEEDBACK_JANELAS'] = JSON.stringify([
      { day: '2026-11-09', opens: '2026-11-09T00:00:00-03:00', closes: '2026-11-09T23:59:59-03:00' },
    ]);
    script.now = Date.parse('2026-11-09T10:00:00-03:00');
    expect(send(GOOD, AUTHOR, '2026-11-09').ok).toBe(true);
    script.properties['FEEDBACK_JANELAS'] = 'amanhã';
    expect(send(GOOD, AUTHOR, '2026-11-09').error).toBe('closed');
    expect(script.errors.length).toBeGreaterThan(0);
  });
});
