// tabelas do painel de avaliações, no jeito de planilha: cabeçalho fixo, linhas ruins destacadas. Cada função devolve
// também as linhas em texto, para o botão "Baixar CSV" levar exatamente o que está na tela
import type { FeedbackDay } from '@application/feedback/FeedbackGateway';
import type { ReportRating } from '@application/feedback/FeedbackReport';
import {
  isLow,
  type DayState,
  type PersonDay,
  type PersonRow,
} from '@presentation/view-models/feedback/feedbackPanel';
import { h } from '../dom';

export interface Table {
  el: HTMLElement;
  csv: (string | number)[][];
}

const TIME_ZONE = 'America/Araguaina';
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const stamp = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const timeOf = (iso: string): string => (iso ? clock.format(new Date(iso)) : '');
const stampOf = (iso: string): string => (iso ? stamp.format(new Date(iso)).replace(',', '') : '');

const STATE_TEXT: Record<DayState['kind'], string> = {
  done: 'Avaliou',
  open: 'Aguardando',
  soon: 'Ainda não abriu',
  missing: 'NÃO AVALIOU',
};

export function stateText(state: DayState): string {
  return state.kind === 'done' ? `Avaliou às ${timeOf(state.at)}` : STATE_TEXT[state.kind];
}

const average = (day: PersonDay): string =>
  day.average === null ? '—' : day.average.toFixed(1).replace('.', ',');

const scoreText = (r: ReportRating): string => (r.absent ? 'Não compareceu' : `${r.stars ?? '—'} ★`);

function grid(headers: string[], rows: (Node | string)[][], tones: (string | null)[]): HTMLElement {
  const head = h('tr', {}, ...headers.map((title) => h('th', { scope: 'col' }, title)));
  const body = rows.map((cells, i) =>
    h('tr', { 'data-tone': tones[i] ?? null }, ...cells.map((cell) => h('td', {}, cell))),
  );
  const empty = h(
    'tr',
    {},
    h('td', { colspan: String(headers.length), class: 'sheet__empty' }, 'Nada por aqui ainda.'),
  );
  return h(
    'div',
    { class: 'sheet' },
    h('table', {}, h('thead', {}, head), h('tbody', {}, ...(rows.length > 0 ? body : [empty]))),
  );
}

const badge = (state: DayState) => h('span', { class: 'state', 'data-state': state.kind }, stateText(state));
const tone = (low: number) => (low >= 2 ? 'alert-strong' : low === 1 ? 'alert' : null);

// um dia: quem avaliou e como cada um foi avaliado (igual à aba Acompanhamento, só que de um dia)
export function dayTable(rows: PersonRow[], day: string): Table {
  const headers = [
    'Equipe',
    'Participante',
    'Avaliou?',
    'Avaliações recebidas',
    'Média recebida',
    'Notas baixas',
    'Faltas',
  ];
  const list = rows.flatMap((row) => (row.days[day] ? [{ row, d: row.days[day] }] : []));
  const el = grid(
    headers,
    list.map(({ row, d }) => [
      row.team,
      row.name,
      badge(d.state),
      String(d.received),
      average(d),
      String(d.low),
      String(d.absences),
    ]),
    list.map(({ d }) => tone(d.low)),
  );
  const csv = [
    headers,
    ...list.map(({ row, d }) => [
      row.team,
      row.name,
      stateText(d.state),
      d.received,
      average(d),
      d.low,
      d.absences,
    ]),
  ];
  return { el, csv };
}

// todos os dias lado a lado, com o total de notas baixas no fim
export function overviewTable(rows: PersonRow[], windows: FeedbackDay[]): Table {
  const dayHeaders = windows.flatMap((w) => [`${w.label}: avaliou?`, `${w.label}: média`]);
  const headers = ['Equipe', 'Participante', ...dayHeaders, 'Total de notas baixas'];
  const cells = (row: PersonRow) =>
    windows.flatMap((w) => {
      const d = row.days[w.day];
      return d ? [badge(d.state), average(d)] : ['—', '—'];
    });
  const text = (row: PersonRow) =>
    windows.flatMap((w) => {
      const d = row.days[w.day];
      return d ? [stateText(d.state), average(d)] : ['', ''];
    });
  const el = grid(
    headers,
    rows.map((row) => [row.team, row.name, ...cells(row), String(row.totalLow)]),
    rows.map((row) => tone(row.totalLow)),
  );
  return { el, csv: [headers, ...rows.map((row) => [row.team, row.name, ...text(row), row.totalLow])] };
}

// lista de avaliações (notas baixas ou todas). withDay = mostra a coluna do dia (visão geral)
export function ratingsTable(ratings: ReportRating[], windows: FeedbackDay[], withDay: boolean): Table {
  const label = (day: string) => windows.find((w) => w.day === day)?.label ?? day;
  const headers = [
    ...(withDay ? ['Dia'] : []),
    'Equipe',
    'Avaliado',
    'Nota',
    'Justificativa',
    'Quem avaliou',
    'Enviado em',
  ];
  const line = (r: ReportRating) => [
    ...(withDay ? [label(r.day)] : []),
    r.team,
    r.target,
    scoreText(r),
    r.reason || '—',
    r.author,
    stampOf(r.sentAt),
  ];
  const tones = ratings.map((r) => (r.absent ? 'alert-strong' : isLow(r) ? 'alert' : null));
  return { el: grid(headers, ratings.map(line), tones), csv: [headers, ...ratings.map(line)] };
}
