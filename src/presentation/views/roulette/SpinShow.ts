import { wait, type Sleep } from '@shared/utils/async';
import type { RouletteDraw } from '@domain/roulette/RouletteRound';
import { landingRotation } from './wheel';
import type { LightningMode } from './WheelLightning';

// animação de um giro: a roda gira até a fatia sorteada, os raios disparam e o cartão embaralha nomes da categoria
// antes de mostrar a ferramenta. Não decide nada: o resultado já vem pronto do ViewModel
export const SPIN_MS = 5200;
export const ROLL_MS = 1600;
const ROLL_STEP_MS = 85;

export interface SpinStage {
  wheel: HTMLElement;
  sliceCount: number;
  sliceIndex: (categoryId: string) => number;
  // nomes da categoria, para o cartão embaralhar antes de revelar
  toolNames: (categoryId: string) => readonly string[];
  lightning: { setMode(mode: LightningMode): void; burst(): void } | null;
  reducedMotion: boolean;
  sleep?: Sleep;
  random?: () => number;
}

export interface SpinSlot {
  root: HTMLElement;
  category: HTMLElement;
  tool: HTMLElement;
}

export class SpinShow {
  private rotation = 0;
  private readonly sleep: Sleep;
  private readonly random: () => number;

  constructor(private readonly stage: SpinStage) {
    this.sleep = stage.sleep ?? wait;
    this.random = stage.random ?? Math.random;
  }

  async play(draw: RouletteDraw, slot: SpinSlot, tone: string): Promise<void> {
    const { wheel, sliceCount, lightning, reducedMotion } = this.stage;
    const index = this.stage.sliceIndex(draw.categoryId);
    this.rotation = landingRotation(this.rotation, index, sliceCount, this.random());
    wheel.style.transitionDuration = reducedMotion ? '0ms' : `${SPIN_MS}ms`;
    wheel.style.transform = `rotate(${this.rotation}deg)`;

    if (!reducedMotion) {
      lightning?.setMode('storm');
      await this.sleep(SPIN_MS);
      lightning?.setMode('calm');
      lightning?.burst();
    }

    slot.root.dataset['tone'] = tone;
    slot.root.dataset['state'] = 'rolling';
    slot.category.textContent = draw.categoryName;
    if (!reducedMotion) await this.roll(draw, slot.tool);
    slot.tool.textContent = draw.tool.name;
  }

  private async roll(draw: RouletteDraw, target: HTMLElement): Promise<void> {
    const names = this.stage.toolNames(draw.categoryId);
    if (names.length < 2) return;
    let last = -1;
    for (let elapsed = 0; elapsed < ROLL_MS; elapsed += ROLL_STEP_MS) {
      let next = Math.floor(this.random() * names.length);
      if (next === last) next = (next + 1) % names.length;
      last = next;
      target.textContent = names[next] ?? '';
      await this.sleep(ROLL_STEP_MS);
    }
  }
}
