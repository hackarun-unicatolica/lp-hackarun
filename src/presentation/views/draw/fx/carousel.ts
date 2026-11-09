// popup para apresentar as equipes depois do sorteio dos nomes: uma equipe por vez no centro, com os integrantes, e as
// vizinhas desfocadas dos lados. A organização passa com "Avançar" e "Voltar" (ou as setas do teclado) enquanto chama
// cada equipe à frente
import { h } from '../dom';

export interface CarouselItem {
  number: number;
  name: string;
  image: string;
  // cor do tipo do Pokémon (brilho do card)
  color: string;
  members: readonly string[];
}

export interface TeamViewer {
  open(items: readonly CarouselItem[], start?: number): void;
  close(): void;
}

type Slot = 'gone-left' | 'prev' | 'current' | 'next' | 'gone-right';
const SLOTS: readonly Slot[] = ['gone-left', 'prev', 'current', 'next', 'gone-right'];

const slotFor = (offset: number): Slot => {
  if (offset < -1) return 'gone-left';
  if (offset === -1) return 'prev';
  if (offset === 0) return 'current';
  if (offset === 1) return 'next';
  return 'gone-right';
};

function makeCard(item: CarouselItem): HTMLElement {
  const card = h(
    'article',
    { class: 'carousel__card', 'data-team': String(item.number) },
    h('p', { class: 'carousel__team' }, `Equipe ${item.number}`),
    h(
      'div',
      { class: 'carousel__logo' },
      h('img', { src: item.image, alt: '', width: '320', height: '320' }),
    ),
    h('h2', { class: 'carousel__name' }, item.name),
    h('ul', { class: 'carousel__members' }, ...item.members.map((m) => h('li', {}, m))),
  );
  card.style.setProperty('--type', item.color);
  return card;
}

export function createTeamViewer(): TeamViewer {
  let overlay: HTMLElement | null = null;
  let onKey: ((event: KeyboardEvent) => void) | null = null;

  const close = () => {
    overlay?.remove();
    overlay = null;
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = null;
  };

  return {
    close,
    open(items, start = 0) {
      close();
      if (items.length === 0) return;
      const counter = h('p', { class: 'carousel__counter', 'aria-live': 'polite' });
      const stage = h('div', { class: 'carousel__stage' });
      const back = h('button', { class: 'btn btn--ghost btn--xl', type: 'button' }, 'Voltar');
      const forward = h('button', { class: 'btn btn--primary btn--xl', type: 'button' }, 'Avançar');
      const exit = h('button', { class: 'btn btn--ghost carousel__close', type: 'button' }, 'Fechar');
      const cards = items.map(makeCard);
      stage.append(...cards);
      overlay = h(
        'div',
        { class: 'carousel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Apresentação das equipes' },
        counter,
        stage,
        h('div', { class: 'carousel__nav' }, back, forward),
        exit,
      );
      document.body.append(overlay);

      let current = Math.min(Math.max(start, 0), items.length - 1);
      const last = items.length - 1;
      const show = () => {
        cards.forEach((card, index) => {
          const slot = slotFor(index - current);
          for (const s of SLOTS) card.classList.toggle(`is-${s}`, s === slot);
          card.classList.toggle('is-revealed', slot === 'current');
        });
        const item = items[current] as CarouselItem;
        counter.textContent = `Equipe ${item.number} · ${current + 1} de ${items.length}`;
        back.disabled = current === 0;
        forward.textContent = current === last ? 'Concluir' : 'Avançar';
      };
      const go = (delta: number) => {
        if (current + delta > last) {
          close();
          return;
        }
        current = Math.max(0, current + delta);
        show();
      };

      back.addEventListener('click', () => go(-1));
      forward.addEventListener('click', () => go(1));
      exit.addEventListener('click', close);
      onKey = (event) => {
        if (event.key === 'ArrowRight') go(1);
        else if (event.key === 'ArrowLeft') go(-1);
        else if (event.key === 'Escape') close();
      };
      document.addEventListener('keydown', onKey);
      show();
      forward.focus();
    },
  };
}
