import type { SavedTeam } from '@application/draw/DrawGateway';
import type { PokemonEntry } from '@application/draw/TeamDrawUseCases';
import type { DrawServices } from '@composition/draw';
import { TeamNamesViewModel, type TeamNamesState } from '@presentation/view-models/draw/TeamNamesViewModel';
import { confirmDialog } from './confirmDialog';
import { follow, h, mustFind, pokemonImage } from './dom';
import { countdown, type Countdown } from './fx/countdown';
import { finale } from './fx/finale';
import { cascadeDelays, NAME_REVEAL, prefersReducedMotion, typeColor, typeLabel } from './fx/timing';

const SPIN_MS = 90;
const AUTO_RETRY_MS = 4000;

// 2ª tela do sorteio: "Quem é esse Pokémon?". Enquanto a planilha grava, silhuetas passam rápido; depois a silhueta do
// Pokémon sorteado fica um instante e a cor aparece com um flash, junto com o nome da equipe. "Sortear todas" revela em
// cascata; "Revelar tudo" pula para o fim
export function mountNamesPage(services: DrawServices, root: ParentNode = document): TeamNamesViewModel {
  const { catalog } = services;
  const byId = new Map<number, PokemonEntry>(catalog.map((p) => [p.id, p]));
  const vm = new TeamNamesViewModel({
    status: services.status,
    names: services.names,
    publish: services.publish,
    catalog,
  });
  const stats = mustFind('[data-stats]', root);
  const message = mustFind<HTMLElement>('[data-message]', root);
  const grid = mustFind('[data-grid]', root);
  const drawAll = mustFind<HTMLButtonElement>('[data-draw-all]', root);
  const skipButton = mustFind<HTMLButtonElement>('[data-skip]', root);
  const publishButton = mustFind<HTMLButtonElement>('[data-publish]', root);
  const viewTeams = mustFind<HTMLAnchorElement>('[data-view-teams]', root);
  const reduced = prefersReducedMotion();

  // equipe -> instante em que a revelação dela começa (performance.now); some quando a animação termina
  const revealAt = new Map<number, number>();
  const timers: number[] = [];
  let named = new Set<number>();
  let spinTimer = 0;
  let pendingCountdown: Countdown | null = null;
  // um sorteio pedido nesta tela está em andamento (as equipes que ganharem nome agora são reveladas com animação)
  let drawing = false;

  const randomId = () => (catalog[Math.floor(Math.random() * catalog.length)] as PokemonEntry).id;

  // silhuetas passando nos cards que estão sendo sorteados
  const spin = (numbers: readonly number[]) => {
    window.clearInterval(spinTimer);
    if (numbers.length === 0 || reduced) return;
    spinTimer = window.setInterval(() => {
      for (const number of numbers) {
        const img = grid.querySelector<HTMLImageElement>(`[data-logo="${number}"] img`);
        if (img) img.src = pokemonImage(randomId());
      }
    }, SPIN_MS);
  };

  const ball = () =>
    h('span', { class: 'ball', 'aria-hidden': 'true' }, h('span', { class: 'ball__button' }));

  const card = (team: SavedTeam, spinning: boolean): HTMLElement => {
    const pokemon = team.pokemonId !== null ? byId.get(team.pokemonId) : undefined;
    const start = revealAt.get(team.number);
    const revealing = pokemon !== undefined && start !== undefined;
    const state = spinning ? 'spinning' : revealing ? 'reveal' : pokemon ? 'done' : 'pending';
    const style = [
      pokemon ? `--type:${typeColor(pokemon.types)}` : '',
      revealing ? `--delay:${Math.round(start - performance.now())}ms` : '',
    ]
      .filter(Boolean)
      .join(';');
    return h(
      'article',
      { class: 'poke', 'data-state': state, style: style || undefined },
      h('span', { class: 'poke__number' }, `Equipe ${team.number}`),
      h(
        'div',
        { class: 'poke__logo', 'data-logo': String(team.number) },
        spinning
          ? h('img', { src: pokemonImage(randomId()), alt: '', width: '160', height: '160' })
          : pokemon
            ? h('img', { src: pokemonImage(pokemon.id), alt: pokemon.name, width: '160', height: '160' })
            : ball(),
      ),
      h(
        'h3',
        { class: 'poke__name' },
        spinning ? 'Quem é esse Pokémon?' : pokemon ? team.name : `Equipe ${team.number}`,
      ),
      h(
        'p',
        { class: 'poke__meta' },
        pokemon ? pokemon.types.map(typeLabel).join(' · ') : spinning ? '' : 'Aguardando o sorteio',
      ),
      h(
        'details',
        { class: 'poke__members' },
        h('summary', {}, `${team.members.length} integrantes`),
        h('ul', {}, ...team.members.map((m) => h('li', {}, m.name))),
      ),
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          'data-draw-one': String(team.number),
          disabled: pokemon !== undefined || spinning || undefined,
        },
        pokemon ? 'Já sorteada' : 'Sortear nome',
      ),
    );
  };

  const render = (state: TeamNamesState) => {
    const namedCount = state.teams.filter((t) => t.pokemonId !== null).length;
    stats.replaceChildren(
      h(
        'div',
        { class: 'stat' },
        h('span', { class: 'stat__value' }, String(state.teams.length)),
        h('span', { class: 'stat__label' }, 'equipes'),
      ),
    );
    const pending = state.teams.length - namedCount;
    const running = state.spinning.length > 0 || pendingCountdown !== null;
    drawAll.disabled = state.loading || running || pending === 0;
    drawAll.textContent = running
      ? 'Sorteando…'
      : pending === 0 && state.teams.length > 0
        ? 'Todas sorteadas ✓'
        : 'Sortear todas';
    skipButton.hidden = !running && revealAt.size === 0;
    // a publicação sai sozinha quando a revelação termina; o botão é só reserva (falhou, ou a página abriu depois) e o
    // link para a página das equipes aparece quando já está publicado
    const allNamed = state.teams.length > 0 && pending === 0;
    const published = allNamed && state.teams.every((t) => t.published);
    const revealed = !running && revealAt.size === 0;
    publishButton.hidden = !allNamed || published || !revealed;
    publishButton.disabled = state.publishing;
    publishButton.textContent = state.publishing
      ? 'Publicando…'
      : state.error
        ? 'Tentar publicar de novo'
        : 'Publicar no site';
    viewTeams.hidden = !published || !revealed;

    message.replaceChildren();
    message.dataset['kind'] = state.error ? 'error' : published ? 'ok' : '';
    if (state.error) message.append(state.error);
    else if (published && revealed) {
      message.append('Equipes publicadas no site. A página das equipes atualiza em até 1 minuto.');
    } else if (!state.loading && state.teams.length === 0) {
      message.append(
        'Ainda não há equipes salvas. ',
        h('a', { href: '/sorteio' }, '← Sortear as equipes primeiro'),
      );
    }
    grid.replaceChildren(...state.teams.map((t) => card(t, state.spinning.includes(t.number))));
    spin(state.spinning);
  };

  // equipes que acabaram de ganhar nome: agenda a revelação de cada uma (em cascata quando são várias)
  const scheduleReveals = (state: TeamNamesState) => {
    const now = new Set(state.teams.filter((t) => t.pokemonId !== null).map((t) => t.number));
    const fresh = [...now].filter((n) => !named.has(n)).sort((a, b) => a - b);
    const firstLoad = named.size === 0 && state.spinning.length === 0 && revealAt.size === 0 && !drawing;
    named = now;
    if (fresh.length === 0 || firstLoad) return;
    if (reduced) {
      void autoPublish();
      return;
    }
    const base = performance.now();
    const delays = cascadeDelays(fresh.length, NAME_REVEAL.staggerMs, NAME_REVEAL.maxTotalMs);
    fresh.forEach((number, i) => {
      const at = base + (delays[i] ?? 0);
      revealAt.set(number, at);
      // a tela rola até o card quando a revelação dele começa (descontando o menu fixo do topo)
      timers.push(
        window.setTimeout(() => {
          const el = grid.querySelector(`[data-logo="${number}"]`)?.closest('.poke');
          if (el) follow(el, reduced);
        }, delays[i] ?? 0),
      );
    });
    const last = (delays.at(-1) ?? 0) + NAME_REVEAL.revealMs;
    timers.push(
      window.setTimeout(() => {
        revealAt.clear();
        render(vm.state.value);
        if (fresh.length > 1)
          finale('Equipes nomeadas!', `${fresh.length} equipes com nome de Pokémon`, reduced);
        void autoPublish();
      }, last),
    );
  };

  // fim do sorteio: publica em /equipes em segundo plano, sem confirmação. Se falhar, tenta mais uma vez e, persistindo
  // o erro, o botão "Tentar publicar de novo" aparece. Nunca roda ao abrir a página, só depois de uma revelação
  const autoPublish = async (): Promise<void> => {
    const ready = () => {
      const { teams, publishing } = vm.state.value;
      return !publishing && teams.length > 0 && teams.every((t) => t.pokemonId !== null && !t.published);
    };
    if (!ready()) return;
    await vm.publish();
    if (vm.state.value.error && ready()) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTO_RETRY_MS));
      if (ready()) await vm.publish();
    }
  };

  const skip = () => {
    pendingCountdown?.skip();
    if (revealAt.size === 0) return;
    timers.splice(0).forEach((t) => window.clearTimeout(t));
    revealAt.clear();
    render(vm.state.value);
    void autoPublish();
  };

  vm.state.subscribe((state) => {
    scheduleReveals(state);
    render(state);
  });

  drawAll.addEventListener('click', async () => {
    if (drawAll.disabled) return;
    drawing = true;
    pendingCountdown = countdown(reduced);
    render(vm.state.value);
    await pendingCountdown.done;
    pendingCountdown = null;
    await vm.drawAll();
    drawing = false;
  });
  grid.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-draw-one]');
    if (!button || button.disabled) return;
    drawing = true;
    void vm.drawOne(Number(button.dataset['drawOne'])).finally(() => {
      drawing = false;
    });
  });
  skipButton.addEventListener('click', skip);
  publishButton.addEventListener('click', async () => {
    const total = vm.state.value.teams.length;
    const yes = await confirmDialog({
      title: 'Publicar no site?',
      text: `As ${total} equipes vão aparecer na página pública /equipes, com o nome e o Pokémon de cada uma.`,
      yes: 'Publicar',
    });
    if (yes) await vm.publish();
  });
  void vm.load();
  return vm;
}
