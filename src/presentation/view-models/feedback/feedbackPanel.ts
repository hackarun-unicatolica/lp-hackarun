// contas do painel de avaliações (/sorteio/avaliacoes): o mesmo que as abas Acompanhamento e Notas baixas da planilha,
// calculado no navegador a partir do relatório. Sem DOM aqui (testado no Vitest)
import type { FeedbackDay } from '@application/feedback/FeedbackGateway';
import type { FeedbackReport, ReportRating } from '@application/feedback/FeedbackReport';
import { LOW_STARS } from '@domain/value-objects/PeerReview';

// soon = janela ainda não abriu · open = aberta e a pessoa não enviou · done = enviou · missing = fechou sem enviar
export type DayState =
  { kind: 'done'; at: string } | { kind: 'open' } | { kind: 'soon' } | { kind: 'missing' };

export interface PersonDay {
  state: DayState;
  // quantos colegas avaliaram esta pessoa no dia
  received: number;
  // média das estrelas recebidas (faltas não entram); null = ninguém deu estrela
  average: number | null;
  low: number;
  absences: number;
}

export interface PersonRow {
  protocol: string;
  name: string;
  team: string;
  days: Record<string, PersonDay>;
  totalLow: number;
}

export interface DaySummary {
  people: number;
  done: number;
  low: number;
  absences: number;
}

export const isLow = (rating: Pick<ReportRating, 'absent' | 'stars'>): boolean =>
  rating.absent || (rating.stars !== null && rating.stars <= LOW_STARS);

function stateOf(window: FeedbackDay, sentAt: string | null, now: number): DayState {
  if (sentAt !== null) return { kind: 'done', at: sentAt };
  if (now < Date.parse(window.opens)) return { kind: 'soon' };
  return now > Date.parse(window.closes) ? { kind: 'missing' } : { kind: 'open' };
}

function personDay(window: FeedbackDay, protocol: string, ratings: ReportRating[], now: number): PersonDay {
  const given = ratings.filter((r) => r.authorProtocol === protocol);
  const sentAt = given.length > 0 ? (given.map((r) => r.sentAt).sort()[0] ?? '') : null;
  const received = ratings.filter((r) => r.targetProtocol === protocol);
  const stars = received.flatMap((r) => (r.stars === null ? [] : [r.stars]));
  return {
    state: stateOf(window, sentAt, now),
    received: received.length,
    average: stars.length > 0 ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
    low: received.filter(isLow).length,
    absences: received.filter((r) => r.absent).length,
  };
}

const byTeamThenName = (a: { team: string; name: string }, b: { team: string; name: string }) =>
  a.team.localeCompare(b.team, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR');

// uma linha por participante, com cada dia preenchido
export function personRows(report: FeedbackReport, now: number): PersonRow[] {
  return [...report.people].sort(byTeamThenName).map((person) => {
    const days: Record<string, PersonDay> = {};
    for (const window of report.windows) {
      const ratings = report.ratings.filter((r) => r.day === window.day);
      days[window.day] = personDay(window, person.protocol, ratings, now);
    }
    const totalLow = Object.values(days).reduce((sum, d) => sum + d.low, 0);
    return { protocol: person.protocol, name: person.name, team: person.team, days, totalLow };
  });
}

export function daySummary(rows: PersonRow[], day: string): DaySummary {
  const days = rows.flatMap((row) => (row.days[day] ? [row.days[day]] : []));
  return {
    people: days.length,
    done: days.filter((d) => d.state.kind === 'done').length,
    low: days.reduce((sum, d) => sum + d.low, 0),
    absences: days.reduce((sum, d) => sum + d.absences, 0),
  };
}

// notas de 3 estrelas ou menos e faltas; day = null junta todos os dias
export function lowRatings(report: FeedbackReport, day: string | null): ReportRating[] {
  return report.ratings
    .filter((r) => (day === null || r.day === day) && isLow(r))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.team.localeCompare(b.team, 'pt-BR') ||
        a.target.localeCompare(b.target, 'pt-BR'),
    );
}

export function teamsOf(report: FeedbackReport): string[] {
  return [...new Set(report.people.map((p) => p.team))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// dia atual do painel: o aberto agora; senão o último que já abriu; senão o primeiro
export function currentDay(windows: FeedbackDay[], now: number): string | null {
  const open = windows.find((w) => now >= Date.parse(w.opens) && now <= Date.parse(w.closes));
  if (open) return open.day;
  const started = windows.filter((w) => now >= Date.parse(w.opens));
  return (started.at(-1) ?? windows[0])?.day ?? null;
}

// CSV para abrir no Excel/Planilhas: ponto e vírgula (Excel em pt-BR) e BOM para os acentos
export function toCsv(rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n');
}
