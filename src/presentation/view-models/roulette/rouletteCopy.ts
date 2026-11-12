import { MAX_SPINS } from '@domain/roulette/ToolCatalog';
import type { RouletteState } from './RouletteViewModel';

// textos da roleta que mudam com o estado (a tela é lida de longe, numa TV: frases curtas)
export function spinLabel(state: RouletteState): string {
  if (state.phase === 'spinning') return 'Girando…';
  return state.draws.length === 0 ? 'Girar' : 'Girar de novo';
}

export function spinCounter(state: RouletteState): string {
  const used = MAX_SPINS - state.spinsLeft;
  if (state.phase === 'spinning') return `Giro ${state.draws.length + 1} de ${MAX_SPINS}`;
  if (state.spinsLeft === 0) return `${MAX_SPINS} giros usados`;
  return used === 0 ? `Até ${MAX_SPINS} giros` : `${giros(state.spinsLeft)} sobrando`;
}

export function hint(state: RouletteState): string {
  switch (state.phase) {
    case 'idle':
      return 'Girem a roleta para sortear a primeira ferramenta.';
    case 'spinning':
      return 'Sorteando a categoria e a ferramenta…';
    case 'chosen':
      return 'Ferramenta definida. Procurem o NPC para registrar.';
    case 'deciding':
      if (state.selected !== null) return 'Confirmem a escolha. Depois disso, não dá para trocar.';
      if (state.spinsLeft === 0) return 'Os giros acabaram: escolham uma das três ferramentas.';
      return state.draws.length === 1
        ? `Fiquem com esta ferramenta ou girem de novo (${giros(state.spinsLeft)}).`
        : `Escolham uma das ferramentas ou girem de novo (${giros(state.spinsLeft)}).`;
  }
}

export function confirmLabel(state: RouletteState): string {
  const draw = state.selected === null ? undefined : state.draws[state.selected];
  return draw ? `Confirmar: ${draw.tool.name}` : 'Confirmar escolha';
}

const giros = (count: number): string => (count === 1 ? '1 giro' : `${count} giros`);
