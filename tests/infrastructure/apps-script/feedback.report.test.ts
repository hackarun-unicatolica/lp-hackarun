// painel da organização: a ação feedback-report devolve os dias, as equipes e as avaliações, sem contato de ninguém
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTHOR, REASON, setup, target } from '../../helpers/apps-script/feedbackSetup';

type Report = {
  ok: boolean;
  error?: string;
  windows: { day: string; label: string }[];
  people: Record<string, string>[];
  ratings: Record<string, unknown>[];
};

describe('Apps Script · relatório do painel de avaliações', () => {
  const report = (call: ReturnType<typeof setup>['call']) =>
    call({ action: 'feedback-report' }) as unknown as Report;

  it('lista os 3 dias (12, 13 e 14/11) e só quem está em equipe e não cancelou', () => {
    const { call } = setup();
    const res = report(call);
    expect(res.ok).toBe(true);
    expect(res.windows.map((w) => w.label)).toEqual(['12/11', '13/11', '14/11']);
    expect(res.people.map((p) => p.protocol)).toEqual([
      'HR26-AAAAAA',
      'HR26-BBBBBB',
      'HR26-CCCCCC',
      'HR26-DDDDDD',
    ]);
    expect(Object.keys(res.people[0] ?? {}).sort()).toEqual(['name', 'protocol', 'team']);
    expect(res.ratings).toEqual([]);
  });

  it('devolve cada avaliação com o dia, a nota, a falta e a justificativa', () => {
    const { call, send } = setup();
    send([
      target('HR26-BBBBBB', 'Bruno Lima', { stars: 5 }),
      target('HR26-CCCCCC', 'Caio Melo', { absent: true, stars: null, reason: REASON }),
    ]);
    const res = report(call);
    expect(res.ratings).toHaveLength(2);
    expect(res.ratings[0]).toMatchObject({
      day: '2026-11-13',
      team: 'Equipe Mew',
      target: 'Bruno Lima',
      targetProtocol: 'HR26-BBBBBB',
      author: AUTHOR.name,
      authorProtocol: AUTHOR.protocol,
      stars: 5,
      absent: false,
      reason: '',
    });
    expect(res.ratings[1]).toMatchObject({ stars: null, absent: true, reason: REASON });
    expect(String(res.ratings[0]?.['sentAt'])).toMatch(/^2026-11-13T/);
  });

  it('nome que começa com = volta sem o apóstrofo de proteção da planilha', () => {
    const { call, send } = setup();
    send([target('HR26-BBBBBB', '=Bruno', { stars: 4 })]);
    expect(report(call).ratings[0]?.['target']).toBe('=Bruno');
  });

  it('sem a chave certa, não devolve nada', () => {
    const { script } = setup();
    const res = script.post({ token: 'x'.repeat(40), action: 'feedback-report' });
    expect(res).toMatchObject({ ok: false, error: 'unauthorized' });
  });
});
