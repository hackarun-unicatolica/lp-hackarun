import { Observable } from '@shared/core/Observable';
import type { Random } from '@domain/draw/random';
import { RouletteRound, type RouletteDraw } from '@domain/roulette/RouletteRound';
import type { ToolCatalog } from '@domain/roulette/ToolCatalog';

// idle: ninguém girou ainda. spinning: a roda está girando. deciding: a equipe escolhe uma das sorteadas ou gira de
// novo. chosen: a ferramenta está definida e a rodada acabou
export type RoulettePhase = 'idle' | 'spinning' | 'deciding' | 'chosen';

export interface RouletteState {
  phase: RoulettePhase;
  // o que já apareceu na tela (o giro em andamento só entra quando a roda para)
  draws: readonly RouletteDraw[];
  // onde a roda vai parar no giro em andamento
  landing: RouletteDraw | null;
  spinsLeft: number;
  // cartão marcado, ainda sem confirmar
  selected: number | null;
  chosen: RouletteDraw | null;
}

const initial = (round: RouletteRound): RouletteState => ({
  phase: 'idle',
  draws: [],
  landing: null,
  spinsLeft: round.spinsLeft,
  selected: null,
  chosen: null,
});

export class RouletteViewModel {
  readonly state: Observable<RouletteState>;
  private round: RouletteRound;

  constructor(
    private readonly catalog: ToolCatalog,
    private readonly random: Random = Math.random,
  ) {
    this.round = RouletteRound.start(catalog);
    this.state = new Observable(initial(this.round));
  }

  // o sorteio acontece aqui, antes da animação: a roda só mostra o resultado
  spin(): void {
    const { phase } = this.state.value;
    if ((phase !== 'idle' && phase !== 'deciding') || !this.round.canSpin) return;
    this.round = this.round.spin(this.random);
    const landing = this.round.draws.at(-1) ?? null;
    this.state.update((state) => ({ ...state, phase: 'spinning', landing, selected: null }));
  }

  // a View avisa quando a roda parou e a ferramenta foi revelada
  settle(): void {
    if (this.state.value.phase !== 'spinning') return;
    this.state.update((state) => ({
      ...state,
      phase: 'deciding',
      draws: this.round.draws,
      landing: null,
      spinsLeft: this.round.spinsLeft,
    }));
  }

  select(index: number): void {
    const { phase, draws } = this.state.value;
    if (phase !== 'deciding' || !Number.isInteger(index) || !draws[index]) return;
    this.state.update((state) => ({ ...state, selected: index }));
  }

  confirm(): void {
    const { phase, selected } = this.state.value;
    if (phase !== 'deciding' || selected === null) return;
    this.round = this.round.choose(selected);
    this.state.update((state) => ({
      ...state,
      phase: 'chosen',
      chosen: this.round.chosen,
      spinsLeft: 0,
    }));
  }

  // só depois da escolha: no meio da rodada a equipe não recomeça
  nextTeam(): void {
    if (this.state.value.phase !== 'chosen') return;
    this.round = RouletteRound.start(this.catalog);
    this.state.set(initial(this.round));
  }
}
