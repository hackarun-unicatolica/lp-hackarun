import type { DrawServices } from '@composition/draw';
import type { DrawPreview } from '@application/draw/TeamDrawUseCases';
import { TeamDrawViewModel, type TeamDrawState } from '@presentation/view-models/draw/TeamDrawViewModel';
import { follow, h, mustFind } from './dom';
import { personName } from '@presentation/formatters/personName';
import { confirmDialog } from './confirmDialog';
import { plural, stat, teamCard } from './teamCards';
import { countdown, type Countdown } from './fx/countdown';
import { finale } from './fx/finale';
import { prefersReducedMotion } from './fx/timing';
import { revealTeams, type TeamsReveal } from './TeamsReveal';

// 1ª tela do sorteio: credenciados, sorteio das equipes com revelação em cascata e gravação na planilha. Na tela do show
// só aparece o sorteio (sem relatório nem avisos); o resumo fica registrado na aba Sorteio da planilha
export function mountTeamsPage(services: DrawServices, root: ParentNode = document): TeamDrawViewModel {
  const vm = new TeamDrawViewModel({
    status: services.status,
    generate: services.generate,
    save: services.save,
  });
  const stats = mustFind('[data-stats]', root);
  const message = mustFind<HTMLElement>('[data-message]', root);
  const grid = mustFind('[data-grid]', root);
  const progress = mustFind<HTMLElement>('[data-progress]', root);
  const progressText = mustFind('[data-progress-text]', progress);
  const progressBar = mustFind<HTMLElement>('[data-progress-bar]', progress);
  const drawButton = mustFind<HTMLButtonElement>('[data-draw]', root);
  const saveButton = mustFind<HTMLButtonElement>('[data-save]', root);
  const skipButton = mustFind<HTMLButtonElement>('[data-skip]', root);
  const seedInput = mustFind<HTMLInputElement>('[data-seed]', root);
  const reduced = prefersReducedMotion();
  // planilha real: grava sozinho ao sortear (o botão "Salvar na planilha" é só do teste)
  const { autoSave } = services;

  // o "show" em andamento (contagem e cascata); null = nada rodando
  let show: { countdown: Countdown | null; reveal: TeamsReveal | null } | null = null;
  let shownPreview: DrawPreview | null = null;

  const skip = () => {
    show?.countdown?.skip();
    show?.reveal?.skip();
  };

  const setProgress = (revealed: number, total: number) => {
    progress.hidden = total === 0;
    progressText.textContent =
      revealed < total ? `Equipe ${revealed + 1} de ${total}` : `${total} equipes formadas`;
    progressBar.style.setProperty('--value', String(total ? revealed / total : 0));
  };

  const confirm = (teams: number, people: number, replacing: boolean) =>
    confirmDialog({
      title: 'Gravar na planilha?',
      text:
        `${plural(teams, 'equipe', 'equipes')} para ${people} pessoas: a coluna Equipe da aba Inscritos e a aba Equipes serão preenchidas.` +
        (replacing ? ' Já existe um sorteio salvo, e este vai substituí-lo.' : ''),
      yes: 'Gravar',
    });

  const confirmRedo = (saved: number) =>
    confirmDialog({
      title: 'Sortear de novo?',
      text: `Já existem ${plural(saved, 'equipe salva', 'equipes salvas')} na planilha. Sortear de novo substitui todas elas.`,
      yes: 'Sortear de novo',
    });

  const render = (state: TeamDrawState) => {
    const busy =
      state.status === 'loading' || state.status === 'drawing' || state.status === 'saving' || show !== null;
    const preview = state.preview;
    // alguma equipe já tem nome (nesta tela ou na planilha): as equipes não podem mais ser refeitas
    const locked =
      (preview?.locked ?? false) || (state.sheet?.saved.some((t) => t.pokemonId !== null) ?? false);
    stats.replaceChildren(
      stat('credenciados', state.sheet ? String(state.sheet.accredited) : '–'),
      stat('equipes', preview ? String(preview.result.report.teams) : '–'),
      stat(
        'sorteio salvo',
        state.sheet
          ? state.sheet.saved.length > 0
            ? `${state.sheet.saved.length} equipes`
            : 'não definido'
          : '–',
      ),
    );

    drawButton.textContent = locked
      ? 'Sorteio encerrado'
      : state.status === 'drawing'
        ? 'Sorteando…'
        : preview
          ? 'Sortear de novo'
          : 'Sortear equipes';
    drawButton.disabled = busy || locked;
    saveButton.disabled = busy || !preview || state.saved || locked;
    // planilha real grava sozinho; o botão só volta se a gravação falhar (mesmas equipes da tela, sem sortear de novo)
    const retry = autoSave && preview !== null && !state.saved && state.error !== null;
    saveButton.hidden = autoSave && !retry;
    saveButton.textContent =
      state.status === 'saving'
        ? 'Gravando…'
        : state.saved
          ? 'Gravado ✓'
          : retry
            ? 'Tentar gravar de novo'
            : 'Salvar na planilha';
    skipButton.hidden = show === null;

    message.replaceChildren();
    message.dataset['kind'] = state.error ? 'error' : state.saved ? 'ok' : '';
    if (state.error) message.append(state.error);
    else if (state.saved) {
      message.append(
        h('span', { class: 'message__text' }, 'Equipes salvas na base de dados.'),
        h(
          'a',
          { class: 'message__next', href: '/sorteio/nomes' },
          'Ir para o sorteio dos nomes',
          h('span', { class: 'message__arrow', 'aria-hidden': 'true' }),
        ),
      );
    } else if (preview?.alreadySaved && show === null) {
      message.append('Já existe um sorteio salvo na planilha. Se gravar este, ele substitui o anterior.');
    }

    if (preview && preview !== shownPreview) void startShow(preview);
  };

  // o sorteio já foi feito (e nada foi gravado ainda): aqui é só a revelação na tela
  async function startShow(preview: DrawPreview): Promise<void> {
    shownPreview = preview;
    const { teams } = preview.result;
    show = { countdown: null, reveal: null };
    grid.replaceChildren();
    setProgress(0, teams.length);
    render(vm.state.value);

    show.countdown = countdown(reduced);
    await show.countdown.done;

    const cards = teams.map(teamCard);
    grid.replaceChildren(...cards);
    const names = teams.flatMap((t) => t.members.map((m) => personName(m.name)));
    show.reveal = revealTeams(cards, {
      names,
      reduced,
      onProgress: setProgress,
      onEnter: (card) => follow(card, reduced),
    });
    await show.reveal.done;

    show = null;
    finale(
      'Equipes formadas!',
      `${plural(teams.length, 'equipe formada', 'equipes formadas')} para o hackathon`,
      reduced,
    );
    render(vm.state.value);
  }

  vm.state.subscribe(render);
  drawButton.addEventListener('click', async () => {
    if (!autoSave) return void vm.draw(seedInput.value);
    // na planilha real o sorteio grava na hora: refazer substitui as equipes já salvas, então pergunta antes
    const saved = vm.state.value.sheet?.saved.length ?? 0;
    if (saved > 0 && !(await confirmRedo(saved))) return;
    await vm.drawAndSave(seedInput.value);
  });
  skipButton.addEventListener('click', skip);
  saveButton.addEventListener('click', async () => {
    const preview = vm.state.value.preview;
    if (!preview) return;
    if (autoSave) return void vm.save();
    const { report: r } = preview.result;
    if (await confirm(r.teams, r.participants, preview.alreadySaved)) await vm.save();
  });
  void vm.load();
  return vm;
}
