import { describe, expect, it } from 'vitest';
import { createRandom } from '@domain/draw/random';
import { RouletteRound } from '@domain/roulette/RouletteRound';
import { MAX_SPINS, ToolCatalog, type ToolCategory } from '@domain/roulette/ToolCatalog';
import { DomainError } from '@domain/shared/DomainError';

const category = (id: string, tools: string[]): ToolCategory => ({
  id,
  name: `Categoria ${id}`,
  wheelLabel: [id],
  tools: tools.map((name) => ({ name, description: `Usar ${name}.` })),
});

const CATEGORIES = [
  category('a', ['a1', 'a2', 'a3']),
  category('b', ['b1', 'b2']),
  category('c', ['c1']),
  category('d', ['d1', 'd2', 'd3', 'd4']),
  category('e', ['e1', 'e2']),
];
const catalog = ToolCatalog.create(CATEGORIES);

function spinAll(seed: string): RouletteRound {
  const random = createRandom(seed);
  let round = RouletteRound.start(catalog);
  while (round.canSpin) round = round.spin(random);
  return round;
}

describe('ToolCatalog', () => {
  it('conta as ferramentas de todas as categorias', () => {
    expect(catalog.toolCount).toBe(12);
  });

  it('recusa menos categorias do que giros (não daria para cair sempre numa categoria diferente)', () => {
    expect(() => ToolCatalog.create(CATEGORIES.slice(0, MAX_SPINS - 1))).toThrow(DomainError);
  });

  it('recusa categoria repetida, sem ferramentas ou sem rótulo da roda', () => {
    const [a, b, c] = CATEGORIES as [ToolCategory, ToolCategory, ToolCategory];
    expect(() => ToolCatalog.create([a, b, { ...c, id: 'a' }])).toThrow('Categoria repetida');
    expect(() => ToolCatalog.create([a, b, { ...c, tools: [] }])).toThrow('sem ferramentas');
    expect(() => ToolCatalog.create([a, b, { ...c, wheelLabel: [] }])).toThrow('rótulo da roda');
    expect(() => ToolCatalog.create([a, b, { ...c, name: '  ' }])).toThrow('id e nome');
  });

  it('recusa a mesma ferramenta em duas categorias, mesmo com outra caixa', () => {
    const [a, b] = CATEGORIES as [ToolCategory, ToolCategory];
    expect(() => ToolCatalog.create([a, b, category('z', ['A1'])])).toThrow('Ferramenta repetida');
  });

  it('recusa ferramenta sem descrição', () => {
    const [a, b] = CATEGORIES as [ToolCategory, ToolCategory];
    const broken = { ...category('z', ['z1']), tools: [{ name: 'z1', description: '' }] };
    expect(() => ToolCatalog.create([a, b, broken])).toThrow('sem nome ou descrição');
  });
});

describe('RouletteRound', () => {
  it('começa sem sorteios, com três giros e sem poder escolher', () => {
    const round = RouletteRound.start(catalog);
    expect(round.draws).toEqual([]);
    expect(round.spinsLeft).toBe(MAX_SPINS);
    expect(round.canSpin).toBe(true);
    expect(round.canChoose).toBe(false);
    expect(round.chosen).toBeNull();
  });

  it('em qualquer semente: três giros, três categorias diferentes e a ferramenta é da categoria sorteada', () => {
    for (let seed = 0; seed < 300; seed++) {
      const round = spinAll(`equipe-${seed}`);
      expect(round.draws).toHaveLength(MAX_SPINS);
      expect(new Set(round.draws.map((draw) => draw.categoryId)).size).toBe(MAX_SPINS);
      for (const draw of round.draws) {
        const source = CATEGORIES.find((item) => item.id === draw.categoryId);
        expect(source?.tools.map((tool) => tool.name)).toContain(draw.tool.name);
        expect(draw.categoryName).toBe(source?.name);
      }
    }
  });

  it('todas as categorias e ferramentas conseguem sair (nenhuma fica de fora do sorteio)', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      for (const draw of spinAll(`cobertura-${seed}`).draws) seen.add(draw.tool.name);
    }
    expect(seen.size).toBe(catalog.toolCount);
  });

  it('a mesma semente repete o sorteio', () => {
    expect(spinAll('auditoria').draws).toEqual(spinAll('auditoria').draws);
  });

  it('não gira uma quarta vez', () => {
    const round = spinAll('limite');
    expect(round.canSpin).toBe(false);
    expect(round.spinsLeft).toBe(0);
    expect(() => round.spin(createRandom('x'))).toThrow(DomainError);
  });

  it('as categorias que sobram diminuem a cada giro', () => {
    const random = createRandom('sobra');
    let round = RouletteRound.start(catalog);
    for (let spin = 1; spin <= MAX_SPINS; spin++) {
      round = round.spin(random);
      const remaining = round.remainingCategories.map((item) => item.id);
      expect(remaining).toHaveLength(CATEGORIES.length - spin);
      for (const draw of round.draws) expect(remaining).not.toContain(draw.categoryId);
    }
  });

  it('dá para escolher já no primeiro giro, sem usar os outros', () => {
    const round = RouletteRound.start(catalog).spin(createRandom('cedo'));
    const done = round.choose(0);
    expect(done.chosen).toBe(round.draws[0]);
    expect(done.spinsLeft).toBe(0);
    expect(done.canSpin).toBe(false);
    expect(done.canChoose).toBe(false);
  });

  it('depois da escolha não gira nem troca', () => {
    const done = spinAll('fim').choose(1);
    expect(() => done.spin(createRandom('x'))).toThrow('já escolheu');
    expect(() => done.choose(0)).toThrow('já escolheu');
  });

  it('recusa escolher sem ter girado ou fora do que foi sorteado', () => {
    expect(() => RouletteRound.start(catalog).choose(0)).toThrow(DomainError);
    const round = RouletteRound.start(catalog).spin(createRandom('um'));
    for (const index of [1, -1, 0.5, Number.NaN]) expect(() => round.choose(index)).toThrow(DomainError);
  });

  it('é imutável: girar e escolher não mexem na rodada anterior', () => {
    const first = RouletteRound.start(catalog);
    const second = first.spin(createRandom('imutavel'));
    second.choose(0);
    expect(first.draws).toHaveLength(0);
    expect(second.chosen).toBeNull();
  });
});
