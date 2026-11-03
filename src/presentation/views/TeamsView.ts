import { qs, qsa } from '@shared/utils/dom';
import {
  pickFaces,
  type PublicTeam,
  type TeamsState,
  type TeamsViewModel,
} from '@presentation/view-models/teams/TeamsViewModel';
import { confirmedLabel, foundLabel } from '@presentation/formatters/TeamLabels';
import { fillTeamCard, watchTeamImage } from './teams/TeamCardRenderer';

// vitrine da LP: quantos rostos cabem antes do "+N"
const FACES = 5;

// [data-teams]: contador ao vivo (LP e /equipes); na página de equipes também busca, grade de cards via
// <template> e estado vazio; na LP, a vitrine de fotos. Elemento que não existe na página é só ignorado
export class TeamsView {
  private readonly root: HTMLElement;
  private readonly vm: TeamsViewModel;
  private readonly list: HTMLElement | null;
  private readonly template: HTMLTemplateElement | null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;
  private renderedTeams: PublicTeam[] | null = null;
  private renderedFaces: PublicTeam[] | null = null;

  constructor(root: HTMLElement, vm: TeamsViewModel) {
    this.root = root;
    this.vm = vm;
    this.list = qs('[data-teams-list]', root);
    this.template = qs<HTMLTemplateElement>('template[data-teams-template]', root);
  }

  mount(): void {
    const input = qs<HTMLInputElement>('[data-teams-search]', this.root);
    input?.addEventListener('input', () => this.vm.setQuery(input.value));
    // o build já desenhou a lista inicial: não refaz à toa, só liga o "sem foto" dos cards prontos
    this.renderedTeams = this.vm.state.value.visible;
    if (this.list) qsa('[data-team-card]', this.list).forEach(watchTeamImage);
    this.renderFaces(this.vm.state.value.teams);
    this.vm.state.subscribe((state, prev) => this.render(state, prev));
    qs('[data-teams-retry]', this.root)?.addEventListener('click', () => void this.vm.refresh());
    this.renderPhase(this.vm.state.value);
    // /equipes: a lista é o conteúdo da página, busca na hora. Na LP só quando a seção chega perto da tela
    if (this.vm.isLive) {
      if (qs('[data-teams-loading]', this.root)) void this.vm.refresh();
      else this.refreshWhenVisible();
    }
  }

  private render(state: TeamsState, prev: TeamsState): void {
    const hasTeams = state.teams.length > 0;
    this.toggle('[data-teams-search-wrap]', hasTeams);
    this.renderPhase(state);
    // lista vazia some: leitor de tela não precisa ouvir "lista, 0 itens"
    this.toggle('[data-teams-list]', state.visible.length > 0);
    this.toggle('[data-teams-noresults]', hasTeams && state.visible.length === 0);
    this.setText('[data-teams-query]', state.query.trim());
    this.setText('[data-teams-count]', String(state.teams.length));
    this.setText('[data-teams-count-label]', confirmedLabel(state.teams.length));
    this.toggle('[data-teams-slots-text]', state.slots.remaining !== null);
    this.setText('[data-teams-remaining]', String(state.slots.remaining ?? ''));
    this.root.dataset['slotsLevel'] = state.slots.level;
    // nome diferente do [data-teams-count] (o número na tela), senão um seletor da página pega a raiz
    this.root.dataset['teamTotal'] = String(state.teams.length);
    this.list?.setAttribute('aria-busy', String(state.status === 'loading'));
    if (state.visible !== this.renderedTeams) this.renderList(state.visible);
    if (state.teams !== prev.teams) this.renderFaces(state.teams);
    if (state.query !== prev.query) this.announce(state);
  }

  // carregando / erro / vazio. Só a página /equipes tem o bloco de carregando: lá, sem equipes ainda e com a lista ao
  // vivo a caminho, aparece "Carregando" (e não "nenhuma equipe" nem o contador em 0). Na LP fica como sempre
  private renderPhase(state: TeamsState): void {
    const hasTeams = state.teams.length > 0;
    if (!qs('[data-teams-loading]', this.root)) {
      this.toggle('[data-teams-empty]', !hasTeams);
      return;
    }
    const waiting = !hasTeams && this.vm.isLive && (state.status === 'idle' || state.status === 'loading');
    const failed = !hasTeams && state.status === 'error';
    this.toggle('[data-teams-loading]', waiting);
    this.toggle('[data-teams-error]', failed);
    this.toggle('[data-teams-empty]', !hasTeams && !waiting && !failed);
    this.toggle('[data-teams-bar]', hasTeams);
    const retry = qs<HTMLButtonElement>('[data-teams-retry]', this.root);
    if (retry) retry.disabled = state.status === 'loading';
  }

  // lista pequena: refaz tudo, sem diff
  private renderList(teams: PublicTeam[]): void {
    this.renderedTeams = teams;
    if (!this.list || !this.template) return;
    const fragment = document.createDocumentFragment();
    teams.forEach((team) => {
      const card = this.clone(this.template);
      if (!card) return;
      fillTeamCard(card, team);
      fragment.append(card);
    });
    this.list.replaceChildren(fragment);
  }

  private renderFaces(teams: PublicTeam[]): void {
    const faces = qs('[data-teams-faces]', this.root);
    const template = qs<HTMLTemplateElement>('template[data-teams-face-template]', this.root);
    if (!faces || !template || teams === this.renderedFaces) return;
    this.renderedFaces = teams;
    const picked = pickFaces(teams, FACES);
    const items = picked.flatMap((team) => {
      const face = this.clone(template);
      if (face) fillTeamCard(face, team);
      return face ? [face] : [];
    });
    faces.replaceChildren(...items);
    faces.hidden = items.length === 0;
    this.setText('[data-teams-more]', teams.length > picked.length ? `+${teams.length - picked.length}` : '');
    this.toggle('[data-teams-more]', teams.length > picked.length);
  }

  // importNode, não cloneNode: o clone do <template> nasce no documento inerte dele, onde a foto não carrega
  // (complete = true, naturalWidth = 0) e o card caía nas iniciais a cada busca ou atualização da lista
  private clone(template: HTMLTemplateElement | null): HTMLElement | null {
    const source = template?.content.firstElementChild;
    const node = source ? document.importNode(source, true) : null;
    return node instanceof HTMLElement ? node : null;
  }

  // espera a pessoa parar de digitar pra anunciar o resultado
  private announce(state: TeamsState): void {
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      const total = state.teams.length;
      const text = state.query.trim()
        ? foundLabel(state.visible.length)
        : `${total} ${confirmedLabel(total)}`;
      this.setText('[data-teams-live]', text);
    }, 450);
  }

  // só busca na planilha quando a lista chega perto da tela (e de novo se voltar depois de 1 min)
  private refreshWhenVisible(): void {
    if (!('IntersectionObserver' in window)) {
      void this.vm.refresh();
      return;
    }
    new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void this.vm.refreshIfStale();
      },
      { rootMargin: '400px 0px' },
    ).observe(this.root);
  }

  private toggle(selector: string, visible: boolean): void {
    const el = qs(selector, this.root);
    if (el) el.hidden = !visible;
  }

  private setText(selector: string, text: string): void {
    const el = qs(selector, this.root);
    if (el && el.textContent !== text) el.textContent = text;
  }
}
