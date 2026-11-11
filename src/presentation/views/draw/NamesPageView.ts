import type { SavedTeam } from '@application/draw/DrawGateway';
import type { PokemonEntry } from '@application/draw/TeamDrawUseCases';
import type { DrawServices } from '@composition/draw';
import { TeamNamesViewModel, type TeamNamesState } from '@presentation/view-models/draw/TeamNamesViewModel';
import { personName } from '@presentation/formatters/personName';
import { confirmDialog } from './confirmDialog';
import { follow, h, mustFind, pokemonImage } from './dom';
import { countdown, type Countdown } from './fx/countdown';
import { finale } from './fx/finale';
import { createTeamViewer, type CarouselItem } from './fx/carousel';
import { prefersReducedMotion, rowSchedule, typeColor } from './fx/timing';

const SPIN_MS = 90;
const AUTO_RETRY_MS = 4000;

// 2ª tela do sorteio: os Pokémon das equipes. Enquanto a planilha grava, silhuetas passam rápido; depois cada card da
// grade mostra a silhueta, ganha cor e o nome da equipe, um depois do outro. "Revelar tudo" pula para o fim
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
  const presentTeams = mustFind<HTMLButtonElement>('[data-present-teams]', root);
  const viewer = createTeamViewer();
  let revealTimers: number[] = [];
  const reduced = prefersReducedMotion();

  // equipe -> instante em que a revelação dela começa (performance.now); some quando a animação termina
  const revealAt = new Map<number, number>();
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
      h('h3', { class: 'poke__name' }, pokemon && !spinning ? team.name : `Equipe ${team.number}`),
      h(
        'details',
        { class: 'poke__members' },
        h('summary', {}, `${team.members.length} integrantes`),
        h('ul', {}, ...team.members.map((m) => h('li', {}, personName(m.name)))),
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
    drawAll.textContent = running ? 'Sorteando…' : 'Sortear';
    // tudo sorteado: o botão sai de cena e o próximo passo (ver a página das equipes) fica sozinho em destaque
    drawAll.hidden = !running && pending === 0 && state.teams.length > 0;
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
    presentTeams.hidden = !allNamed || !revealed;

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
    // cascata na própria grade, fileira por fileira: cada card vira silhueta, ganha cor e mostra o nome, um depois do
    // outro, e a tela só desce quando a fileira de cima terminou
    const rows = rowsOf(fresh);
    const schedule = rowSchedule(rows.map((row) => row.length));
    const startedAt = performance.now();
    fresh.forEach((number, i) => revealAt.set(number, startedAt + (schedule.delays[i] as number)));
    rows.forEach((row, index) => {
      revealTimers.push(
        window.setTimeout(() => {
          const logo = grid.querySelector(`[data-logo="${row[0]}"]`);
          if (logo) follow(logo, reduced);
        }, schedule.scrolls[index]),
      );
    });
    revealTimers.push(window.setTimeout(finishReveal, schedule.end));
  };

  // as equipes que entram agora, agrupadas pela fileira em que aparecem na grade (mesma altura = mesma fileira)
  const rowsOf = (numbers: readonly number[]): number[][] => {
    const rows: number[][] = [];
    let top: number | null = null;
    for (const number of numbers) {
      const card = grid.querySelector<HTMLElement>(`[data-logo="${number}"]`)?.closest<HTMLElement>('.poke');
      const offset = card?.offsetTop ?? 0;
      if (top === null || offset !== top) rows.push([]);
      top = offset;
      (rows.at(-1) as number[]).push(number);
    }
    return rows;
  };

  const finishReveal = () => {
    revealTimers.forEach((timer) => window.clearTimeout(timer));
    revealTimers = [];
    const multiple = revealAt.size > 1;
    const total = revealAt.size;
    revealAt.clear();
    render(vm.state.value);
    if (multiple) finale('Equipes nomeadas!', `${total} equipes com nome de Pokémon`, reduced);
    void autoPublish();
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
    if (revealAt.size > 0) finishReveal();
  };

  // popup para chamar cada equipe à frente, depois que todas têm nome
  const openViewer = () => {
    const items = vm.state.value.teams.flatMap((team): CarouselItem[] => {
      const pokemon = team.pokemonId !== null ? byId.get(team.pokemonId) : undefined;
      if (!pokemon) return [];
      return [
        {
          number: team.number,
          name: team.name,
          image: pokemonImage(pokemon.id),
          color: typeColor(pokemon.types),
          members: team.members.map((m) => personName(m.name)),
        },
      ];
    });
    viewer.open(items);
  };

  vm.state.subscribe((state) => {
    scheduleReveals(state);
    render(state);
  });

  drawAll.addEventListener('click', async () => {
    if (drawAll.disabled) return;
    drawing = true;
    pendingCountdown = countdown(reduced);
    // o sorteio grava na planilha enquanto a contagem 3-2-1 roda (o suspense não espera a rede depois da contagem);
    // a revelação só começa quando as duas coisas terminaram (o view model segura o mínimo de suspense)
    const run = vm.drawAll();
    render(vm.state.value);
    await pendingCountdown.done;
    pendingCountdown = null;
    await run;
    drawing = false;
  });
  skipButton.addEventListener('click', skip);
  presentTeams.addEventListener('click', openViewer);
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
