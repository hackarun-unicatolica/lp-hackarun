// página do sorteio: as telas Equipes e Nomes vivem juntas e a troca entre elas não recarrega (só muda o endereço),
// para o modo apresentação em tela cheia não sair no meio do show. Cada tela é montada na primeira vez que aparece e
// relê a planilha quando volta a aparecer
import type { DrawServices } from '@composition/draw';
import { connect } from './connect';
import { mustFind } from './dom';
import { setupStage } from './fx/stage';
import { mountNamesPage } from './NamesPageView';
import { mountTeamsPage } from './TeamsPageView';

export type DrawStep = 'teams' | 'names';

const PATHS: Record<DrawStep, string> = { teams: '/sorteio', names: '/sorteio/nomes' };
const TITLES: Record<DrawStep, string> = { teams: 'Sorteio das equipes', names: 'Sorteio dos nomes' };

// /sorteio/nomes (com ou sem .html e barra no fim) = Nomes; o resto = Equipes
export function stepOf(pathname: string): DrawStep | null {
  const clean = pathname.replace(/\.html$/, '').replace(/\/+$/, '');
  if (clean === '/sorteio/nomes') return 'names';
  if (clean === '/sorteio') return 'teams';
  return null;
}

interface Screen {
  load(): Promise<void>;
}

export function startDrawApp(): void {
  setupStage();
  const roots: Record<DrawStep, HTMLElement> = {
    teams: mustFind<HTMLElement>('[data-screen="teams"]'),
    names: mustFind<HTMLElement>('[data-screen="names"]'),
  };
  const screens: Partial<Record<DrawStep, Screen>> = {};
  let services: DrawServices | null = null;
  let current: DrawStep = stepOf(location.pathname) ?? 'teams';

  const showError = (error: unknown) => {
    const message = mustFind<HTMLElement>('[data-message]', roots[current]);
    message.dataset['kind'] = 'error';
    message.textContent = error instanceof Error ? error.message : 'Não consegui falar com a planilha.';
  };

  const activate = (step: DrawStep, push: boolean) => {
    const changed = step !== current;
    current = step;
    for (const [name, root] of Object.entries(roots)) root.hidden = name !== step;
    mustFind('[data-title]').textContent = TITLES[step];
    document.title = `${TITLES[step]} · HackaRun 2026`;
    document.querySelectorAll<HTMLAnchorElement>('[data-step]').forEach((link) => {
      if (link.dataset['step'] === step) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    if (push && location.pathname !== PATHS[step]) history.pushState({ step }, '', PATHS[step]);
    if (changed) window.scrollTo({ top: 0 });
    if (!services) return;
    const screen = screens[step];
    if (!screen) {
      screens[step] =
        step === 'teams' ? mountTeamsPage(services, roots.teams) : mountNamesPage(services, roots.names);
    } else if (changed) {
      // a outra tela pode ter mudado a planilha (equipes salvas, nomes dados): relê
      void screen.load();
    }
  };

  // links para /sorteio e /sorteio/nomes trocam de tela sem recarregar
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target) return;
    const url = new URL(link.href, location.href);
    const step = url.origin === location.origin ? stepOf(url.pathname) : null;
    if (!step) return;
    event.preventDefault();
    activate(step, true);
  });
  window.addEventListener('popstate', () => activate(stepOf(location.pathname) ?? 'teams', false));

  connect()
    .then((ready) => {
      services = ready;
      activate(current, false);
    })
    .catch(showError);
}
