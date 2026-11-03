// carrossel do sorteio dos nomes: as equipes passam uma de cada vez e o card do CENTRO é o foco (grande e nítido);
// quem já passou (esquerda) e quem está chegando (direita) ficam menores e desfocados. O card que chega mostra só a
// pokébola (não entrega o resultado); no centro ele vira a silhueta do Pokémon, ganha cor num flash e mostra o nome
// da equipe e os integrantes. "Revelar tudo" encerra na hora
import { h } from '../dom';

export interface CarouselItem {
  number: number;
  name: string;
  image: string;
  // cor do tipo do Pokémon (brilho do card)
  color: string;
  members: readonly string[];
}

export interface Carousel {
  // passa as equipes uma a uma (`stepMs` cada) e resolve quando acaba ou quando alguém pede `stop`
  play(items: readonly CarouselItem[], stepMs: number): Promise<void>;
  stop(): void;
}

// em que ponto do tempo de cada equipe a silhueta e a revelação acontecem (fração do passo)
const GUESS_AT = 0.2;
const REVEAL_AT = 0.5;
const MYSTERY = 'Quem é esse Pokémon?';

type Slot = 'gone-left' | 'prev' | 'current' | 'next' | 'gone-right';

const slotFor = (offset: number): Slot => {
  if (offset < -1) return 'gone-left';
  if (offset === -1) return 'prev';
  if (offset === 0) return 'current';
  if (offset === 1) return 'next';
  return 'gone-right';
};

function makeCard(item: CarouselItem): HTMLElement {
  const logo = h(
    'div',
    { class: 'carousel__logo' },
    h('span', { class: 'ball', 'aria-hidden': 'true' }, h('span', { class: 'ball__button' })),
  );
  const name = h('h2', { class: 'carousel__name' }, MYSTERY);
  const members = h('ul', { class: 'carousel__members' }, ...item.members.map((m) => h('li', {}, m)));
  const card = h(
    'article',
    { class: 'carousel__card is-gone-right', 'data-team': String(item.number) },
    h('p', { class: 'carousel__team' }, `Equipe ${item.number}`),
    logo,
    name,
    members,
  );
  card.style.setProperty('--type', item.color);
  return card;
}

export function createCarousel(onSkip: () => void): Carousel {
  let overlay: HTMLElement | null = null;
  let timers: number[] = [];
  let finish: (() => void) | null = null;

  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };

  const close = () => {
    clearTimers();
    overlay?.remove();
    overlay = null;
    const done = finish;
    finish = null;
    done?.();
  };

  return {
    play(items, stepMs) {
      close();
      if (items.length === 0) return Promise.resolve();
      const skip = h('button', { class: 'btn btn--ghost carousel__skip', type: 'button' }, 'Revelar tudo');
      skip.addEventListener('click', onSkip);
      const counter = h('p', { class: 'carousel__counter', 'aria-hidden': 'true' });
      const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
      const stage = h('div', { class: 'carousel__stage' });
      overlay = h(
        'div',
        {
          class: 'carousel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Sorteio do nome das equipes',
        },
        counter,
        stage,
        live,
        skip,
      );
      document.body.append(overlay);

      const cards = new Map<number, HTMLElement>();
      const cardAt = (index: number): HTMLElement | null => {
        const item = items[index];
        if (!item) return null;
        let card = cards.get(index);
        if (!card) {
          card = makeCard(item);
          cards.set(index, card);
          stage.append(card);
          // força o layout: o card nasce fora da tela, à direita, e só então desliza para o lugar
          void card.offsetWidth;
        }
        return card;
      };

      const setSlot = (card: HTMLElement, slot: Slot) => {
        for (const s of ['gone-left', 'prev', 'current', 'next', 'gone-right'] as const) {
          card.classList.toggle(`is-${s}`, s === slot);
        }
      };

      const place = (current: number) => {
        for (const index of [current - 1, current, current + 1]) cardAt(index);
        for (const [index, card] of cards) {
          setSlot(card, slotFor(index - current));
          // dois à esquerda já saíram da tela: tira do DOM depois da transição
          if (index < current - 2) {
            cards.delete(index);
            timers.push(window.setTimeout(() => card.remove(), 800));
          }
        }
      };

      const reveal = (index: number) => {
        const item = items[index];
        const card = cards.get(index);
        if (!item || !card) return;
        const logo = card.querySelector('.carousel__logo');
        const name = card.querySelector('.carousel__name');
        const img = h('img', { src: item.image, alt: '', width: '320', height: '320' });
        logo?.replaceChildren(img);
        card.classList.add('is-guessing');
        if (name) name.textContent = MYSTERY;
        timers.push(
          window.setTimeout(
            () => {
              card.classList.remove('is-guessing');
              card.classList.add('is-revealed');
              if (name) name.textContent = item.name;
              live.textContent = `${item.name}. ${item.members.join(', ')}.`;
            },
            Math.round(stepMs * (REVEAL_AT - GUESS_AT)),
          ),
        );
      };

      const step = (index: number) => {
        if (index >= items.length) {
          close();
          return;
        }
        counter.textContent = `Equipe ${items[index]?.number} · ${index + 1} de ${items.length}`;
        place(index);
        timers.push(window.setTimeout(() => reveal(index), Math.round(stepMs * GUESS_AT)));
        timers.push(window.setTimeout(() => step(index + 1), stepMs));
      };

      return new Promise<void>((resolve) => {
        finish = resolve;
        step(0);
      });
    },
    stop() {
      close();
    },
  };
}
