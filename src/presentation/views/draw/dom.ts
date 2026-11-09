export { h, mustFind } from '../dom';

export const pokemonImage = (id: number): string => `/pokemon/${id}.webp`;

// leva a tela até o card que acabou de aparecer (só rola quando ele está fora da tela)
export function follow(el: Element, reducedMotion: boolean): void {
  el.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
}
