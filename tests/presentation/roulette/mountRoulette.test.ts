import { beforeEach, describe, expect, it } from 'vitest';
import { toolCatalog } from '@composition/roulette';
import { createRandom } from '@domain/draw/random';
import { mountRoulette } from '@presentation/views/roulette/mountRoulette';
import { sliceUnderPointer } from '@presentation/views/roulette/wheel';

const catalog = toolCatalog();

// mesmo contrato de data-atributos da página src/pages/roleta.astro
function page(): void {
  const slices = catalog.categories.map((category) => `<g data-slice="${category.id}"></g>`).join('');
  const slot = `<button data-slot data-state="empty" disabled>
    <span data-slot-category></span><strong data-slot-tool></strong><span data-slot-description></span>
  </button>`;
  document.body.innerHTML = `
    <svg data-wheel>${slices}</svg>
    <button data-spin><span data-spin-label></span></button>
    <p data-counter></p><p data-hint></p>
    ${slot.repeat(3)}
    <button data-confirm hidden></button>
    <div data-result hidden>
      <p data-result-category></p><h2 data-result-tool></h2><p data-result-description></p>
      <button data-next></button>
    </div>`;
}

const find = <T extends Element = HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector) as T;
const all = <T extends Element = HTMLElement>(selector: string): T[] => [
  ...document.querySelectorAll<T>(selector),
];
// a animação espera por promessas resolvidas: algumas voltas na fila bastam para o giro inteiro terminar
const settled = async (): Promise<void> => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
};

function mount(seed = 'tela') {
  page();
  return mountRoulette(catalog, document, {
    random: createRandom(seed),
    sleep: () => Promise.resolve(),
    reducedMotion: false,
  });
}

async function spin(): Promise<void> {
  find<HTMLButtonElement>('[data-spin]').click();
  await settled();
}

describe('tela da roleta', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('começa com os três cartões vazios e travados', () => {
    mount();
    expect(document.body.dataset['phase']).toBe('idle');
    expect(find('[data-spin-label]').textContent).toBe('Girar');
    for (const slot of all<HTMLButtonElement>('[data-slot]')) {
      expect(slot.dataset['state']).toBe('empty');
      expect(slot.disabled).toBe(true);
    }
    expect(find('[data-result]').hidden).toBe(true);
    expect(find('[data-confirm]').hidden).toBe(true);
  });

  it('a roda para na fatia da categoria que saiu no cartão', async () => {
    const vm = mount();
    await spin();
    const [draw] = vm.state.value.draws;
    const index = catalog.categories.findIndex((category) => category.id === draw?.categoryId);
    const rotation = Number(/rotate\((.+)deg\)/.exec(find('[data-wheel]').style.transform)?.[1]);
    expect(sliceUnderPointer(rotation, catalog.categories.length)).toBe(index);

    const slot = all<HTMLButtonElement>('[data-slot]')[0] as HTMLButtonElement;
    expect(slot.dataset['state']).toBe('filled');
    expect(slot.dataset['tone']).toBe(String(index + 1));
    expect(slot.disabled).toBe(false);
    expect(slot.querySelector('[data-slot-tool]')?.textContent).toBe(draw?.tool.name);
    expect(slot.querySelector('[data-slot-category]')?.textContent).toBe(draw?.categoryName);
    expect(slot.querySelector('[data-slot-description]')?.textContent).toBe(draw?.tool.description);
    expect(find(`[data-slice="${draw?.categoryId}"]`).classList.contains('is-current')).toBe(true);
  });

  it('depois de três giros o botão de girar some e as fatias usadas ficam marcadas', async () => {
    const vm = mount();
    await spin();
    await spin();
    await spin();
    await spin();
    expect(vm.state.value.draws).toHaveLength(3);
    expect(find<HTMLButtonElement>('[data-spin]').hidden).toBe(true);
    expect(all('[data-slot][data-state="filled"]')).toHaveLength(3);
    expect(all('[data-slice].is-used')).toHaveLength(2);
    expect(all('[data-slice].is-current')).toHaveLength(1);
  });

  it('marcar um cartão mostra o botão de confirmar com o nome da ferramenta', async () => {
    const vm = mount();
    await spin();
    await spin();
    const slots = all<HTMLButtonElement>('[data-slot]');
    slots[1]?.click();
    expect(slots.map((slot) => slot.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    const confirm = find<HTMLButtonElement>('[data-confirm]');
    expect(confirm.hidden).toBe(false);
    expect(confirm.textContent).toBe(`Confirmar: ${vm.state.value.draws[1]?.tool.name}`);
  });

  it('confirmar mostra a ferramenta da equipe e trava a rodada; "Próxima equipe" limpa tudo', async () => {
    const vm = mount();
    await spin();
    all<HTMLButtonElement>('[data-slot]')[0]?.click();
    const picked = vm.state.value.draws[0];
    find<HTMLButtonElement>('[data-confirm]').click();

    const result = find('[data-result]');
    expect(result.hidden).toBe(false);
    expect(find('[data-result-tool]').textContent).toBe(picked?.tool.name);
    expect(find('[data-result-category]').textContent).toBe(picked?.categoryName);
    expect(find<HTMLButtonElement>('[data-spin]').disabled).toBe(true);
    await spin();
    expect(vm.state.value.draws).toHaveLength(1);

    find<HTMLButtonElement>('[data-next]').click();
    expect(result.hidden).toBe(true);
    expect(all('[data-slot][data-state="empty"]')).toHaveLength(3);
    expect(all('[data-slice].is-used, [data-slice].is-current')).toHaveLength(0);
    expect(find<HTMLButtonElement>('[data-spin]').disabled).toBe(false);
  });

  it('teclado: Espaço gira e 1 a 3 marcam o cartão', async () => {
    const vm = mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await settled();
    expect(vm.state.value.draws).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(vm.state.value.selected).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(vm.state.value.selected).toBe(0);
  });
});
