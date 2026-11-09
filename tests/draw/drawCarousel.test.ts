// popup de apresentação das equipes: uma por vez, passando com Avançar e Voltar
import { afterEach, describe, expect, it } from 'vitest';
import { createTeamViewer, type CarouselItem } from '@presentation/views/draw/fx/carousel';

const item = (n: number): CarouselItem => ({
  number: n,
  name: `Equipe P${n}`,
  image: `/pokemon/${n}.webp`,
  color: '#fff',
  members: [`Pessoa ${n}A`, `Pessoa ${n}B`],
});
const ITEMS = [item(1), item(2), item(3)];

const card = (n: number) => document.querySelector(`[data-team="${n}"]`);
const counter = () => document.querySelector('.carousel__counter')?.textContent;
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.carousel button')].find((b) => b.textContent === label);

describe('popup de apresentação das equipes', () => {
  const viewer = createTeamViewer();
  afterEach(() => viewer.close());

  it('abre na primeira equipe, com nome e integrantes', () => {
    viewer.open(ITEMS);
    expect(counter()).toBe('Equipe 1 · 1 de 3');
    expect(card(1)?.classList.contains('is-current')).toBe(true);
    expect(card(1)?.querySelector('.carousel__name')?.textContent).toBe('Equipe P1');
    expect(card(1)?.querySelectorAll('.carousel__members li')).toHaveLength(2);
    expect(card(2)?.classList.contains('is-next')).toBe(true);
  });

  it('Avançar e Voltar trocam a equipe; na primeira não dá para voltar', () => {
    viewer.open(ITEMS);
    expect(button('Voltar')?.disabled).toBe(true);
    button('Avançar')?.click();
    expect(counter()).toBe('Equipe 2 · 2 de 3');
    expect(card(1)?.classList.contains('is-prev')).toBe(true);
    button('Voltar')?.click();
    expect(counter()).toBe('Equipe 1 · 1 de 3');
  });

  it('na última equipe o botão vira Concluir e fecha o popup', () => {
    viewer.open(ITEMS, 2);
    button('Concluir')?.click();
    expect(document.querySelector('.carousel')).toBeNull();
  });

  it('setas do teclado passam e Esc fecha', () => {
    viewer.open(ITEMS);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(counter()).toBe('Equipe 2 · 2 de 3');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(counter()).toBe('Equipe 1 · 1 de 3');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.carousel')).toBeNull();
  });

  it('nome vindo da planilha entra como texto, nunca como HTML', () => {
    viewer.open([{ ...item(1), members: ['<b>x</b>'] }]);
    expect(document.querySelector('.carousel__members b')).toBeNull();
    expect(document.querySelector('.carousel__members li')?.textContent).toBe('<b>x</b>');
  });

  it('abrir de novo não empilha popups', () => {
    viewer.open(ITEMS);
    viewer.open(ITEMS);
    expect(document.querySelectorAll('.carousel')).toHaveLength(1);
  });
});
