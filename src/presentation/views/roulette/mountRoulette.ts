import type { ToolCatalog } from '@domain/roulette/ToolCatalog';
import type { Sleep } from '@shared/utils/async';
import { RouletteViewModel, type RouletteState } from '@presentation/view-models/roulette/RouletteViewModel';
import { confirmLabel, hint, spinCounter, spinLabel } from '@presentation/view-models/roulette/rouletteCopy';
import { mustFind } from '../dom';
import { SpinShow, type SpinSlot } from './SpinShow';
import { WheelLightning } from './WheelLightning';

// raio da roda em fração da metade do canvas dos raios (igual ao --wheel-inset do roulette.css)
const RIM_RATIO = 0.74;

export interface RouletteOptions {
  random?: () => number;
  sleep?: Sleep;
  reducedMotion?: boolean;
}

interface Slot extends SpinSlot {
  root: HTMLButtonElement;
  description: HTMLElement;
}

// liga a página /roleta ao ViewModel: desenha o estado, toca a animação de cada giro e ouve botões e teclado
export function mountRoulette(
  catalog: ToolCatalog,
  root: ParentNode = document,
  options: RouletteOptions = {},
): RouletteViewModel {
  const viewModel = new RouletteViewModel(catalog, options.random);
  const reducedMotion =
    options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const spinButton = mustFind<HTMLButtonElement>('[data-spin]', root);
  const spinText = mustFind<HTMLElement>('[data-spin-label]', root);
  const counter = mustFind<HTMLElement>('[data-counter]', root);
  const hintText = mustFind<HTMLElement>('[data-hint]', root);
  const confirmButton = mustFind<HTMLButtonElement>('[data-confirm]', root);
  const result = mustFind<HTMLElement>('[data-result]', root);
  const slices = [...root.querySelectorAll<SVGElement>('[data-slice]')];
  const slots: Slot[] = [...root.querySelectorAll<HTMLButtonElement>('[data-slot]')].map((slot) => ({
    root: slot,
    category: mustFind<HTMLElement>('[data-slot-category]', slot),
    tool: mustFind<HTMLElement>('[data-slot-tool]', slot),
    description: mustFind<HTMLElement>('[data-slot-description]', slot),
  }));

  const sliceIndex = (categoryId: string): number =>
    catalog.categories.findIndex((category) => category.id === categoryId);
  const tone = (categoryId: string): string => String(sliceIndex(categoryId) + 1);
  const canvas = root.querySelector<HTMLCanvasElement>('[data-lightning]');

  const show = new SpinShow({
    wheel: mustFind<HTMLElement>('[data-wheel]', root),
    sliceCount: catalog.categories.length,
    sliceIndex,
    toolNames: (id) => catalog.categories[sliceIndex(id)]?.tools.map((tool) => tool.name) ?? [],
    lightning: canvas && !reducedMotion ? new WheelLightning(canvas, RIM_RATIO) : null,
    reducedMotion,
    ...(options.sleep ? { sleep: options.sleep } : {}),
    ...(options.random ? { random: options.random } : {}),
  });

  function render(state: RouletteState): void {
    body.dataset['phase'] = state.phase;
    spinText.textContent = spinLabel(state);
    counter.textContent = spinCounter(state);
    hintText.textContent = hint(state);
    spinButton.disabled = state.phase === 'spinning' || state.phase === 'chosen' || state.spinsLeft === 0;
    // sem giros sobrando o botão some: só resta escolher
    spinButton.hidden = state.phase !== 'spinning' && state.spinsLeft === 0;
    confirmButton.hidden = state.phase !== 'deciding' || state.selected === null;
    confirmButton.textContent = confirmLabel(state);

    // fatia em que a roda acabou de parar fica acesa; as dos giros anteriores, apagadas (não saem de novo)
    const used = new Set(state.draws.map((draw) => draw.categoryId));
    const current = state.phase === 'spinning' ? undefined : state.draws.at(-1)?.categoryId;
    for (const slice of slices) {
      const id = slice.dataset['slice'] ?? '';
      slice.classList.toggle('is-current', id === current);
      slice.classList.toggle('is-used', used.has(id) && id !== current);
    }

    slots.forEach((slot, index) => {
      const draw = state.draws[index];
      // o cartão do giro em andamento é da animação: aqui só entram os já revelados e os vazios
      if (!draw && state.phase === 'spinning' && index === state.draws.length) return;
      slot.root.dataset['state'] = draw ? 'filled' : 'empty';
      slot.root.disabled = !draw || state.phase !== 'deciding';
      slot.root.setAttribute('aria-pressed', String(state.selected === index));
      if (draw) slot.root.dataset['tone'] = tone(draw.categoryId);
      else delete slot.root.dataset['tone'];
      slot.category.textContent = draw ? draw.categoryName : `Giro ${index + 1}`;
      slot.tool.textContent = draw ? draw.tool.name : '?';
      slot.description.textContent = draw ? draw.tool.description : '';
    });

    result.hidden = state.phase !== 'chosen';
    if (state.chosen) {
      result.dataset['tone'] = tone(state.chosen.categoryId);
      mustFind('[data-result-tool]', result).textContent = state.chosen.tool.name;
      mustFind('[data-result-category]', result).textContent = state.chosen.categoryName;
      mustFind('[data-result-description]', result).textContent = state.chosen.tool.description;
    }
  }

  viewModel.state.subscribe((state, previous) => {
    render(state);
    const slot = slots[state.draws.length];
    if (state.landing && state.landing !== previous.landing && slot) {
      void show.play(state.landing, slot, tone(state.landing.categoryId)).then(() => viewModel.settle());
    }
  });

  spinButton.addEventListener('click', () => viewModel.spin());
  confirmButton.addEventListener('click', () => viewModel.confirm());
  mustFind<HTMLButtonElement>('[data-next]', root).addEventListener('click', () => viewModel.nextTeam());
  slots.forEach((slot, index) => slot.root.addEventListener('click', () => viewModel.select(index)));

  const fullscreenButton = root.querySelector<HTMLButtonElement>('[data-fullscreen]');
  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  fullscreenButton?.addEventListener('click', toggleFullscreen);

  // atalhos de quem opera o notebook: Espaço gira, 1 a 3 marcam o cartão e F abre a tela cheia
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'f') return toggleFullscreen();
    if (['1', '2', '3'].includes(key)) return viewModel.select(Number(key) - 1);
    // num botão em foco o Espaço já vale como clique
    if (key === ' ' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      viewModel.spin();
    }
  });

  return viewModel;
}
