// holofote do sorteio dos nomes: cada equipe aparece num pop-up grande, uma por vez, antes de ir para a grade. A arte
// entra como silhueta ("Quem é esse Pokémon?"), ganha cor com um flash e o nome da equipe e os integrantes aparecem
// junto. "Revelar tudo" (no pop-up ou na tela) pula o resto
import { h } from '../dom';

export interface SpotlightItem {
  number: number;
  name: string;
  image: string;
  color: string;
  members: readonly string[];
  index: number;
  total: number;
}

export interface Spotlight {
  show(item: SpotlightItem, stepMs: number): void;
  close(): void;
}

export function createSpotlight(onSkip: () => void): Spotlight {
  let overlay: HTMLElement | null = null;

  const ensure = (): HTMLElement => {
    if (overlay) return overlay;
    const skip = h('button', { class: 'btn btn--ghost spotlight__skip', type: 'button' }, 'Revelar tudo');
    skip.addEventListener('click', onSkip);
    overlay = h(
      'div',
      { class: 'spotlight', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sorteio do nome da equipe' },
      h('div', { class: 'spotlight__card', 'data-spot-card': true }),
      skip,
    );
    document.body.append(overlay);
    return overlay;
  };

  return {
    show(item, stepMs) {
      const root = ensure();
      const card = root.querySelector<HTMLElement>('[data-spot-card]');
      if (!card) return;
      card.style.setProperty('--type', item.color);
      card.style.setProperty('--step', `${stepMs}ms`);
      card.replaceChildren(
        h('p', { class: 'spotlight__count' }, `Equipe ${item.number} · ${item.index + 1} de ${item.total}`),
        h(
          'div',
          { class: 'spotlight__logo' },
          h('img', { src: item.image, alt: '', width: '320', height: '320' }),
        ),
        h('h2', { class: 'spotlight__name', 'aria-live': 'polite' }, item.name),
        h('ul', { class: 'spotlight__members' }, ...item.members.map((m) => h('li', {}, m))),
      );
      // reinicia a animação a cada equipe
      card.classList.remove('is-in');
      void card.offsetWidth;
      card.classList.add('is-in');
    },
    close() {
      overlay?.remove();
      overlay = null;
    },
  };
}
