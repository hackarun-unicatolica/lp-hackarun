import { describe, expect, it } from 'vitest';
import { toolCatalog } from '@composition/roulette';
import { createRandom } from '@domain/draw/random';
import { MAX_SPINS } from '@domain/roulette/ToolCatalog';
import { RouletteViewModel } from '@presentation/view-models/roulette/RouletteViewModel';
import { confirmLabel, hint, spinCounter, spinLabel } from '@presentation/view-models/roulette/rouletteCopy';

const setup = (seed = 'equipe') => new RouletteViewModel(toolCatalog(), createRandom(seed));

function spinAndSettle(vm: RouletteViewModel, times = 1): void {
  for (let i = 0; i < times; i++) {
    vm.spin();
    vm.settle();
  }
}

describe('catálogo oficial da roleta', () => {
  const catalog = toolCatalog();

  it('tem as cinco categorias do roteiro e cinquenta ferramentas', () => {
    expect(catalog.categories.map((category) => category.name)).toEqual([
      'Planejamento e design',
      'Frontend e desenvolvimento',
      'Backend e dados',
      'Infraestrutura e segurança',
      'Testes, métricas e lançamento',
    ]);
    expect(catalog.toolCount).toBe(50);
  });

  it('o rótulo da roda cabe na fatia: duas linhas de até 16 letras', () => {
    for (const category of catalog.categories) {
      expect(category.wheelLabel).toHaveLength(2);
      for (const line of category.wheelLabel) expect(line.length).toBeLessThanOrEqual(16);
    }
  });
});

describe('RouletteViewModel', () => {
  it('o giro só aparece nos cartões quando a roda para', () => {
    const vm = setup();
    vm.spin();
    expect(vm.state.value).toMatchObject({ phase: 'spinning', draws: [], spinsLeft: MAX_SPINS });
    expect(vm.state.value.landing).not.toBeNull();

    const landing = vm.state.value.landing;
    vm.settle();
    expect(vm.state.value).toMatchObject({ phase: 'deciding', landing: null, spinsLeft: MAX_SPINS - 1 });
    expect(vm.state.value.draws).toEqual([landing]);
  });

  it('ignora um segundo clique em girar enquanto a roda gira', () => {
    const vm = setup();
    vm.spin();
    const landing = vm.state.value.landing;
    vm.spin();
    vm.spin();
    expect(vm.state.value.landing).toBe(landing);
    vm.settle();
    expect(vm.state.value.draws).toHaveLength(1);
  });

  it('para no terceiro giro, em três categorias diferentes', () => {
    const vm = setup();
    spinAndSettle(vm, MAX_SPINS + 2);
    const { draws, spinsLeft, phase } = vm.state.value;
    expect(draws).toHaveLength(MAX_SPINS);
    expect(new Set(draws.map((draw) => draw.categoryId)).size).toBe(MAX_SPINS);
    expect(spinsLeft).toBe(0);
    expect(phase).toBe('deciding');
  });

  it('não marca cartão vazio, nem enquanto gira, e não confirma sem marcar', () => {
    const vm = setup();
    vm.select(0);
    vm.confirm();
    expect(vm.state.value).toMatchObject({ phase: 'idle', selected: null, chosen: null });

    vm.spin();
    vm.select(0);
    expect(vm.state.value.selected).toBeNull();

    vm.settle();
    vm.select(1);
    vm.select(7);
    vm.confirm();
    expect(vm.state.value).toMatchObject({ phase: 'deciding', selected: null, chosen: null });
  });

  it('girar de novo desmarca o cartão: a equipe decide outra vez com as novas opções', () => {
    const vm = setup();
    spinAndSettle(vm);
    vm.select(0);
    vm.spin();
    expect(vm.state.value.selected).toBeNull();
  });

  it('confirma a ferramenta marcada e encerra a rodada', () => {
    const vm = setup();
    spinAndSettle(vm, 2);
    vm.select(1);
    const picked = vm.state.value.draws[1];
    vm.confirm();
    expect(vm.state.value).toMatchObject({ phase: 'chosen', spinsLeft: 0 });
    expect(vm.state.value.chosen).toBe(picked);

    vm.spin();
    vm.select(0);
    vm.confirm();
    expect(vm.state.value.phase).toBe('chosen');
    expect(vm.state.value.chosen).toBe(picked);
  });

  it('a próxima equipe só começa depois da escolha, e começa do zero', () => {
    const vm = setup();
    spinAndSettle(vm, 2);
    vm.nextTeam();
    expect(vm.state.value.draws).toHaveLength(2);

    vm.select(0);
    vm.confirm();
    vm.nextTeam();
    expect(vm.state.value).toEqual({
      phase: 'idle',
      draws: [],
      landing: null,
      spinsLeft: MAX_SPINS,
      selected: null,
      chosen: null,
    });
    spinAndSettle(vm, MAX_SPINS);
    expect(vm.state.value.draws).toHaveLength(MAX_SPINS);
  });
});

describe('textos da roleta', () => {
  it('acompanham a rodada do começo ao fim', () => {
    const vm = setup();
    const text = () => {
      const state = vm.state.value;
      return [spinLabel(state), spinCounter(state), hint(state)];
    };

    expect(text()).toEqual(['Girar', 'Até 3 giros', 'Girem a roleta para sortear a primeira ferramenta.']);
    vm.spin();
    expect(text()).toEqual(['Girando…', 'Giro 1 de 3', 'Sorteando a categoria e a ferramenta…']);
    vm.settle();
    expect(text()).toEqual([
      'Girar de novo',
      '2 giros sobrando',
      'Fiquem com esta ferramenta ou girem de novo (2 giros).',
    ]);
    spinAndSettle(vm);
    expect(text()).toEqual([
      'Girar de novo',
      '1 giro sobrando',
      'Escolham uma das ferramentas ou girem de novo (1 giro).',
    ]);
    spinAndSettle(vm);
    expect(text().slice(1)).toEqual([
      '3 giros usados',
      'Os giros acabaram: escolham uma das três ferramentas.',
    ]);

    expect(confirmLabel(vm.state.value)).toBe('Confirmar escolha');
    vm.select(2);
    expect(hint(vm.state.value)).toBe('Confirmem a escolha. Depois disso, não dá para trocar.');
    expect(confirmLabel(vm.state.value)).toBe(`Confirmar: ${vm.state.value.draws[2]?.tool.name}`);
    vm.confirm();
    expect(hint(vm.state.value)).toBe('Ferramenta definida. Procurem o NPC para registrar.');
  });
});
