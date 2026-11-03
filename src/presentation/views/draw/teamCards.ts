// pedaços da 1ª tela do sorteio: números do topo e o card de cada equipe
import { levelLabel, type DrawnTeam } from '@domain/index';
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

// card montado "fechado": os nomes aparecem como ??? e a revelação gira e trava no nome certo (data-name)
export function teamCard(team: DrawnTeam): HTMLElement {
  const counts = new Map<string, number>();
  for (const m of team.members) counts.set(m.level, (counts.get(m.level) ?? 0) + 1);
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
        h(
          'li',
          {},
          h('span', { class: 'member__name', 'data-name': m.name }, '???'),
          h(
            'span',
            { class: 'chips' },
            h(
              'span',
              { class: 'chip', 'data-repeat': String((counts.get(m.level) ?? 0) > 1) },
              levelLabel(m.level),
            ),
            m.institution.external && h('span', { class: 'chip chip--outside' }, m.institution.label),
          ),
        ),
      ),
    ),
  );
}
