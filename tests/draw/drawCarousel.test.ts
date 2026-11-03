// carrossel do sorteio dos nomes: uma equipe por vez no centro, vizinhas desfocadas, sem entregar o resultado antes da hora
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCarousel, type CarouselItem } from '@presentation/views/draw/fx/carousel';

const item = (n: number, over: Partial<CarouselItem> = {}): CarouselItem => ({
  number: n,
  name: `Equipe P${n}`,
  image: `/pokemon/${n}.webp`,
  color: '#ff6b3d',
  members: [`Ana ${n}`, `Bruno ${n}`],
  ...over,
});
const ITEMS = [1, 2, 3, 4].map((n) => item(n));
const STEP = 1000;

const card = (n: number) => document.querySelector<HTMLElement>(`[data-team="${n}"]`);
const slot = (n: number) =>
  ['gone-left', 'prev', 'current', 'next', 'gone-right'].find((s) => card(n)?.classList.contains(`is-${s}`));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('carrossel dos nomes', () => {
  it('a equipe 1 abre no centro, a 2 espera à direita; ninguém à esquerda ainda', () => {
    const carousel = createCarousel(() => undefined);
    void carousel.play(ITEMS, STEP);
    expect(slot(1)).toBe('current');
    expect(slot(2)).toBe('next');
    expect(card(3)).toBeNull();
    expect(document.querySelector('.carousel__counter')?.textContent).toBe('Equipe 1 · 1 de 4');
  });

  it('não entrega o resultado: o card que chega mostra só a pokébola e o nome fica escondido', () => {
    const carousel = createCarousel(() => undefined);
    void carousel.play(ITEMS, STEP);
    expect(card(2)?.querySelector('img')).toBeNull();
    expect(card(2)?.querySelector('.ball')).not.toBeNull();
    expect(card(2)?.querySelector('.carousel__name')?.textContent).toBe('Quem é esse Pokémon?');
  });

  it('no centro vira silhueta, depois revela arte, nome e integrantes', () => {
    const carousel = createCarousel(() => undefined);
    void carousel.play(ITEMS, STEP);
    vi.advanceTimersByTime(250);
    expect(card(1)?.classList.contains('is-guessing')).toBe(true);
    expect(card(1)?.querySelector('img')?.getAttribute('src')).toBe('/pokemon/1.webp');
    expect(card(1)?.querySelector('.carousel__name')?.textContent).toBe('Quem é esse Pokémon?');
    vi.advanceTimersByTime(300);
    expect(card(1)?.classList.contains('is-revealed')).toBe(true);
    expect(card(1)?.classList.contains('is-guessing')).toBe(false);
    expect(card(1)?.querySelector('.carousel__name')?.textContent).toBe('Equipe P1');
    expect([...(card(1)?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual([
      'Ana 1',
      'Bruno 1',
    ]);
  });

  it('a cada passo o carrossel anda: a anterior vai para a esquerda e a próxima chega ao centro', () => {
    const carousel = createCarousel(() => undefined);
    void carousel.play(ITEMS, STEP);
    vi.advanceTimersByTime(STEP);
    expect([slot(1), slot(2), slot(3)]).toEqual(['prev', 'current', 'next']);
    vi.advanceTimersByTime(STEP);
    expect([slot(1), slot(2), slot(3), slot(4)]).toEqual(['gone-left', 'prev', 'current', 'next']);
    expect(document.querySelector('.carousel__counter')?.textContent).toBe('Equipe 3 · 3 de 4');
  });

  it('termina depois da última, fecha a tela e resolve; só uma equipe também funciona', async () => {
    const carousel = createCarousel(() => undefined);
    const done = vi.fn();
    void carousel.play(ITEMS, STEP).then(done);
    vi.advanceTimersByTime(STEP * ITEMS.length - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.carousel')).toBeNull();
    const single = vi.fn();
    void carousel.play([item(9)], 500).then(single);
    expect(slot(9)).toBe('current');
    await vi.advanceTimersByTimeAsync(500);
    expect(single).toHaveBeenCalledTimes(1);
  });

  it('"Revelar tudo" chama o pulo e parar resolve na hora, sem timers sobrando', async () => {
    const onSkip = vi.fn();
    const carousel = createCarousel(onSkip);
    const done = vi.fn();
    void carousel.play(ITEMS, STEP).then(done);
    document.querySelector<HTMLButtonElement>('.carousel__skip')?.click();
    expect(onSkip).toHaveBeenCalledTimes(1);
    carousel.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.carousel')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('nome de pessoa nunca vira HTML', () => {
    const carousel = createCarousel(() => undefined);
    void carousel.play([item(1, { members: ['<b>x</b>'] })], STEP);
    expect(document.querySelector('.carousel__members b')).toBeNull();
    expect(document.querySelector('.carousel__members li')?.textContent).toBe('<b>x</b>');
  });
});
