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
  // entre um Pokémon e o próximo da mesma fileira no "Sortear"
  staggerMs: 240,
  // a revelação inteira (46 equipes ≈ 15 s); a tela só desce para a fileira seguinte quando a anterior terminou
  maxTotalMs: 18_000,
  // duração da passagem silhueta -> cor (bate com o CSS .poke--reveal)
  revealMs: 1100,
  // tempo da rolagem até a próxima fileira, antes de ela começar a ser revelada
  scrollMs: 450,
  minStaggerMs: 60,
} as const;

export interface RowTiming {
  staggerMs: number;
  maxTotalMs: number;
  revealMs: number;
  scrollMs: number;
  minStaggerMs: number;
}

export interface RowSchedule {
  // em que instante (ms) cada card começa a ser revelado, na ordem de entrada
  delays: number[];
  // em que instante a tela rola até cada fileira
  scrolls: number[];
  // quando o último card termina de ser revelado
  end: number;
}

// revelação por fileira: dentro dela os cards entram em sequência; a tela só rola para a fileira seguinte quando o
// último card da anterior terminou de aparecer, e a nova fileira só começa depois da rolagem
export function rowSchedule(rowSizes: readonly number[], config: RowTiming = NAME_REVEAL): RowSchedule {
  const rows = rowSizes.filter((size) => size > 0);
  const cards = rows.reduce((sum, size) => sum + size, 0);
  const gaps = cards - rows.length;
  const fixed = rows.length * config.revealMs + Math.max(0, rows.length - 1) * config.scrollMs;
  const free = Math.floor((config.maxTotalMs - fixed) / Math.max(gaps, 1));
  const stagger = gaps === 0 ? 0 : Math.max(config.minStaggerMs, Math.min(config.staggerMs, free));
  const delays: number[] = [];
  const scrolls: number[] = [];
  let start = 0;
  rows.forEach((size, index) => {
    scrolls.push(index === 0 ? 0 : start - config.scrollMs);
    for (let i = 0; i < size; i++) delays.push(start + i * stagger);
    start += (size - 1) * stagger + config.revealMs + config.scrollMs;
  });
  return { delays, scrolls, end: rows.length === 0 ? 0 : start - config.scrollMs };
}

// cores e nomes dos tipos ficam no formatador compartilhado (a página /equipes usa os mesmos)
export { TYPE_LABELS, typeColor, typeLabel } from '@presentation/formatters/pokemonTypes';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
