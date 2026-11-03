// pedaços da 1ª tela do sorteio: números do topo e o card de cada equipe
import type { DrawnTeam } from '@domain/index';
import { personName } from '@presentation/formatters/personName';
import { h } from './dom';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function stat(label: string, value: string): HTMLElement {
  return h(
    'div',
    { class: 'stat' },
    h('span', { class: 'stat__value' }, value),
    h('span', { class: 'stat__label' }, label),
  );
}

// card montado "fechado": os nomes aparecem como ??? e a revelação gira e trava no nome certo (data-name). No telão
// só os nomes (período e instituição ficam na planilha)
export function teamCard(team: DrawnTeam): HTMLElement {
  return h(
    'article',
    { class: 'team team--waiting' },
    h(
      'header',
      { class: 'team__head' },
      h('h3', {}, `Equipe ${team.number}`),
      h('span', { class: 'team__count' }, `${team.members.length}`),
    ),
    h(
      'ul',
      { class: 'team__members' },
      ...team.members.map((m) =>
        h('li', {}, h('span', { class: 'member__name', 'data-name': personName(m.name) }, '???')),
      ),
    ),
  );
}
