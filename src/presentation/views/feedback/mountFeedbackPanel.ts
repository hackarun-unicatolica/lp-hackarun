// painel de avaliações da organização (/sorteio/avaliacoes): abas por dia + visão geral, filtro por equipe, atualiza
// sozinho a cada minuto e baixa o que está na tela em CSV
import type { FeedbackReport, FeedbackReportGateway } from '@application/feedback/FeedbackReport';
import {
  currentDay,
  daySummary,
  lowRatings,
  personRows,
  teamsOf,
  toCsv,
} from '@presentation/view-models/feedback/feedbackPanel';
import { h, mustFind } from '../dom';
import { dayTable, overviewTable, ratingsTable, timeOf, type Table } from './panelTables';

const REFRESH_MS = 60_000;
const ALL = '';
const OVERVIEW = 'geral';

interface PanelState {
  report: FeedbackReport | null;
  tab: string;
  team: string;
  loadedAt: string;
}

function card(label: string, value: string, tone: string | null = null): HTMLElement {
  return h('div', { class: 'stat', 'data-tone': tone }, h('strong', {}, value), h('span', {}, label));
}

function section(title: string, note: string, table: Table, file: string): HTMLElement {
  const download = h('button', { class: 'btn btn--ghost btn--small', type: 'button' }, 'Baixar CSV');
  download.addEventListener('click', () => {
    const blob = new Blob([toCsv(table.csv)], { type: 'text/csv;charset=utf-8' });
    const link = h('a', { href: URL.createObjectURL(blob), download: `${file}.csv` });
    link.click();
    URL.revokeObjectURL(link.href);
  });
  return h(
    'section',
    { class: 'block' },
    h('header', { class: 'block__head' }, h('div', {}, h('h2', {}, title), h('p', {}, note)), download),
    table.el,
  );
}

export function mountFeedbackPanel(
  gateway: FeedbackReportGateway,
  root: ParentNode = document,
): () => Promise<void> {
  const tabs = mustFind<HTMLElement>('[data-tabs]', root);
  const teamSelect = mustFind<HTMLSelectElement>('[data-team]', root);
  const content = mustFind<HTMLElement>('[data-content]', root);
  const status = mustFind<HTMLElement>('[data-status]', root);
  const refresh = mustFind<HTMLButtonElement>('[data-refresh]', root);
  const state: PanelState = { report: null, tab: '', team: ALL, loadedAt: '' };

  function renderTabs(report: FeedbackReport): void {
    const items = [
      ...report.windows.map((w) => ({ id: w.day, label: `Dia ${w.label}` })),
      { id: OVERVIEW, label: 'Visão geral' },
    ];
    tabs.replaceChildren(
      ...items.map((item) => {
        const button = h(
          'button',
          { type: 'button', role: 'tab', 'aria-selected': String(item.id === state.tab) },
          item.label,
        );
        button.addEventListener('click', () => {
          state.tab = item.id;
          render();
        });
        return button;
      }),
    );
  }

  function renderTeams(report: FeedbackReport): void {
    const options = [
      h('option', { value: ALL }, 'Todas as equipes'),
      ...teamsOf(report).map((t) => h('option', { value: t }, t)),
    ];
    teamSelect.replaceChildren(...options);
    teamSelect.value = teamsOf(report).includes(state.team) ? state.team : ALL;
    state.team = teamSelect.value;
  }

  function render(): void {
    const { report } = state;
    if (!report) return;
    renderTabs(report);
    const now = Date.now();
    const visible: FeedbackReport = {
      ...report,
      people: report.people.filter((p) => state.team === ALL || p.team === state.team),
      ratings: report.ratings.filter((r) => state.team === ALL || r.team === state.team),
    };
    const rows = personRows(visible, now);
    if (state.tab === OVERVIEW) {
      content.replaceChildren(
        section(
          'Acompanhamento de todos os dias',
          'Quem avaliou em cada dia e a média que recebeu dos colegas.',
          overviewTable(rows, report.windows),
          'acompanhamento-geral',
        ),
        section(
          'Notas baixas e faltas',
          '3 estrelas ou menos e “não compareceu”, de todos os dias.',
          ratingsTable(lowRatings(visible, null), report.windows, true),
          'notas-baixas-geral',
        ),
      );
      return;
    }
    const window = report.windows.find((w) => w.day === state.tab);
    if (!window) return;
    const summary = daySummary(rows, window.day);
    const closed = now > Date.parse(window.closes);
    const pending = summary.people - summary.done;
    const dayRatings = visible.ratings.filter((r) => r.day === window.day);
    const all = ratingsTable(dayRatings, report.windows, false);
    content.replaceChildren(
      h(
        'div',
        { class: 'stats' },
        card('avaliaram', `${summary.done} de ${summary.people}`),
        card(
          closed ? 'não avaliaram' : 'ainda não avaliaram',
          String(pending),
          closed && pending > 0 ? 'alert' : null,
        ),
        card('notas baixas', String(summary.low), summary.low > 0 ? 'alert' : null),
        card('faltas marcadas', String(summary.absences), summary.absences > 0 ? 'alert-strong' : null),
      ),
      section(
        `Acompanhamento · ${window.label}`,
        'Linha rosa = recebeu nota baixa ou falta.',
        dayTable(rows, window.day),
        `acompanhamento-${window.label.replace('/', '-')}`,
      ),
      section(
        'Notas baixas e faltas',
        'Precisam de atenção da organização.',
        ratingsTable(lowRatings(visible, window.day), report.windows, false),
        `notas-baixas-${window.label.replace('/', '-')}`,
      ),
      h(
        'details',
        { class: 'block block--all' },
        h('summary', {}, `Todas as avaliações do dia (${dayRatings.length})`),
        all.el,
      ),
    );
  }

  async function load(): Promise<void> {
    refresh.disabled = true;
    status.textContent = 'Atualizando…';
    const result = await gateway.load();
    refresh.disabled = false;
    if (result.kind === 'login') {
      window.location.assign('/sorteio/avaliacoes');
      return;
    }
    if (result.kind === 'unavailable') {
      status.textContent = state.report
        ? `${result.message} Mostrando os dados de ${state.loadedAt}.`
        : result.message;
      status.dataset['tone'] = 'alert';
      return;
    }
    state.report = result.report;
    state.loadedAt = timeOf(new Date().toISOString());
    if (!state.tab) state.tab = currentDay(result.report.windows, Date.now()) ?? OVERVIEW;
    status.textContent = `Atualizado às ${state.loadedAt} · atualiza sozinho a cada minuto`;
    delete status.dataset['tone'];
    renderTeams(result.report);
    render();
  }

  teamSelect.addEventListener('change', () => {
    state.team = teamSelect.value;
    render();
  });
  refresh.addEventListener('click', () => void load());
  setInterval(() => {
    if (document.visibilityState === 'visible') void load();
  }, REFRESH_MS);
  void load();
  return load;
}
