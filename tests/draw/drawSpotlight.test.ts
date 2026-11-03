// holofote do sorteio dos nomes: um pop-up por equipe, com a arte, o nome e os integrantes (sempre como texto)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpotlight, type SpotlightItem } from '@presentation/views/draw/fx/spotlight';

const item = (over: Partial<SpotlightItem> = {}): SpotlightItem => ({
  number: 7,
  name: 'Equipe Charizard',
  image: '/pokemon/6.webp',
  color: '#ff6b3d',
  members: ['Ana Souza', 'Bruno Lima'],
  index: 6,
  total: 46,
  ...over,
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('holofote do sorteio dos nomes', () => {
  it('mostra a equipe grande: número e posição, arte, nome, integrantes e a cor do tipo', () => {
    const spot = createSpotlight(() => undefined);
    spot.show(item(), 1800);
    const card = document.querySelector<HTMLElement>('.spotlight__card');
    expect(card?.querySelector('.spotlight__count')?.textContent).toBe('Equipe 7 · 7 de 46');
    expect(card?.querySelector('img')?.getAttribute('src')).toBe('/pokemon/6.webp');
    expect(card?.querySelector('.spotlight__name')?.textContent).toBe('Equipe Charizard');
    expect([...(card?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual([
      'Ana Souza',
      'Bruno Lima',
    ]);
    expect(card?.style.getPropertyValue('--type')).toBe('#ff6b3d');
    expect(card?.classList.contains('is-in')).toBe(true);
  });

  it('a próxima equipe troca o conteúdo no mesmo pop-up; fechar tira da tela', () => {
    const spot = createSpotlight(() => undefined);
    spot.show(item(), 1800);
    spot.show(item({ number: 8, name: 'Equipe Blastoise', index: 7 }), 1800);
    expect(document.querySelectorAll('.spotlight')).toHaveLength(1);
    expect(document.querySelector('.spotlight__name')?.textContent).toBe('Equipe Blastoise');
    spot.close();
    expect(document.querySelector('.spotlight')).toBeNull();
  });

  it('"Revelar tudo" do pop-up chama o pulo; nome de pessoa não vira HTML', () => {
    const onSkip = vi.fn();
    const spot = createSpotlight(onSkip);
    spot.show(item({ members: ['<b>x</b>'] }), 1800);
    document.querySelector<HTMLButtonElement>('.spotlight__skip')?.click();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.spotlight__members b')).toBeNull();
  });
});
