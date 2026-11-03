// tempos do "show" do sorteio: suspense sem demorar. O resultado já está salvo antes da animação começar; isto é só a
// revelação, e "Revelar tudo" (tecla S) pula para o fim a qualquer momento

// intervalo entre uma equipe e a próxima entrar na tela; com muitas equipes ele encolhe para o total caber em `maxTotalMs`
export function staggerFor(count: number, preferredMs: number, maxTotalMs: number): number {
  if (count <= 1) return 0;
  return Math.min(preferredMs, Math.floor(maxTotalMs / (count - 1)));
}

// atraso de cada item da cascata (o primeiro entra na hora)
export function cascadeDelays(count: number, preferredMs: number, maxTotalMs: number): number[] {
  const step = staggerFor(count, preferredMs, maxTotalMs);
  return Array.from({ length: count }, (_, i) => i * step);
}

export const TEAM_REVEAL = {
  // entre uma equipe e a próxima (46 equipes ≈ 11 s)
  staggerMs: 250,
  maxTotalMs: 11_000,
  // quanto tempo os nomes giram na "roleta" antes de travar
  slotMs: 420,
  slotTickMs: 55,
} as const;

export const NAME_REVEAL = {
  // entre um Pokémon e o próximo no "Sortear todas" (46 equipes ≈ 11 s de cascata)
  staggerMs: 240,
  maxTotalMs: 11_000,
  // duração da passagem silhueta -> cor (bate com o CSS .poke--reveal)
  revealMs: 1100,
} as const;

// cores e nomes dos tipos ficam no formatador compartilhado (a página /equipes usa os mesmos)
export { TYPE_LABELS, typeColor, typeLabel } from '@presentation/formatters/pokemonTypes';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
