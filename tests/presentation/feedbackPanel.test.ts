// contas do painel de avaliações: quem avaliou em cada dia, média recebida, notas baixas, faltas e o CSV
import { describe, expect, it } from 'vitest';
import type { FeedbackReport, ReportRating } from '../../src/application/feedback/FeedbackReport';
import {
  currentDay,
  daySummary,
  lowRatings,
  personRows,
  teamsOf,
  toCsv,
} from '../../src/presentation/view-models/feedback/feedbackPanel';

const W12 = {
  day: '2026-11-12',
  label: '12/11',
  opens: '2026-11-12T21:00:00-03:00',
  closes: '2026-11-12T23:59:59-03:00',
};
const W13 = {
  day: '2026-11-13',
  label: '13/11',
  opens: '2026-11-13T19:00:00-03:00',
  closes: '2026-11-13T23:59:59-03:00',
};
const at = (iso: string) => Date.parse(iso);

function rating(
  day: string,
  author: string,
  target: string,
  stars: number | null,
  extra: Partial<ReportRating> = {},
): ReportRating {
  return {
    day,
    team: 'Mew',
    target,
    targetProtocol: target,
    author,
    authorProtocol: author,
    stars,
    absent: stars === null,
    reason: '',
    sentAt: `${day}T22:10:00.000Z`,
    ...extra,
  };
}

const REPORT: FeedbackReport = {
  windows: [W12, W13],
  people: [
    { protocol: 'B', name: 'Bruno', team: 'Mew' },
    { protocol: 'A', name: 'Ana', team: 'Mew' },
    { protocol: 'C', name: 'Caio', team: 'Mew' },
    { protocol: 'D', name: 'Duda', team: 'Onix' },
  ],
  ratings: [
    rating('2026-11-12', 'A', 'B', 5),
    rating('2026-11-12', 'A', 'C', 2, { reason: 'Ficou no celular o tempo todo.' }),
    rating('2026-11-12', 'B', 'A', 4),
    rating('2026-11-12', 'B', 'C', null, { reason: 'Não apareceu na sala de aula.' }),
  ],
};

describe('painel de avaliações · contas', () => {
  it('ordena por equipe e nome e marca quem avaliou, quem não avaliou e quem ainda pode', () => {
    const rows = personRows(REPORT, at('2026-11-13T00:30:00-03:00'));
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Bruno', 'Caio', 'Duda']);
    expect(rows[0]?.days['2026-11-12']?.state).toEqual({ kind: 'done', at: '2026-11-12T22:10:00.000Z' });
    expect(rows[2]?.days['2026-11-12']?.state.kind).toBe('missing');
    expect(rows[2]?.days['2026-11-13']?.state.kind).toBe('soon');
    const during = personRows(REPORT, at('2026-11-12T22:00:00-03:00'));
    expect(during[2]?.days['2026-11-12']?.state.kind).toBe('open');
  });

  it('média ignora faltas; notas baixas contam 3 estrelas ou menos e faltas', () => {
    const rows = personRows(REPORT, at('2026-11-12T22:00:00-03:00'));
    const caio = rows.find((r) => r.name === 'Caio')?.days['2026-11-12'];
    expect(caio).toMatchObject({ received: 2, average: 2, low: 2, absences: 1 });
    expect(rows.find((r) => r.name === 'Bruno')?.days['2026-11-12']).toMatchObject({ average: 5, low: 0 });
    expect(rows.find((r) => r.name === 'Duda')?.days['2026-11-12']?.average).toBeNull();
    expect(rows.find((r) => r.name === 'Caio')?.totalLow).toBe(2);
  });

  it('resumo do dia e lista de notas baixas', () => {
    const rows = personRows(REPORT, at('2026-11-12T22:00:00-03:00'));
    expect(daySummary(rows, '2026-11-12')).toEqual({ people: 4, done: 2, low: 2, absences: 1 });
    expect(lowRatings(REPORT, '2026-11-12').map((r) => r.stars)).toEqual([2, null]);
    expect(lowRatings(REPORT, '2026-11-13')).toEqual([]);
    expect(teamsOf(REPORT)).toEqual(['Mew', 'Onix']);
  });

  it('abre no dia aberto agora, senão no último que já abriu', () => {
    expect(currentDay([W12, W13], at('2026-11-12T10:00:00-03:00'))).toBe('2026-11-12');
    expect(currentDay([W12, W13], at('2026-11-12T22:00:00-03:00'))).toBe('2026-11-12');
    expect(currentDay([W12, W13], at('2026-11-13T12:00:00-03:00'))).toBe('2026-11-12');
    expect(currentDay([W12, W13], at('2026-11-13T20:00:00-03:00'))).toBe('2026-11-13');
    expect(currentDay([], 0)).toBeNull();
  });

  it('CSV com ponto e vírgula, acentos (BOM), aspas e proteção contra fórmula', () => {
    const csv = toCsv([
      ['Nome', 'Justificativa'],
      ['=Ana', 'disse "oi"; saiu'],
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\'=Ana;"disse ""oi""; saiu"');
  });
});
