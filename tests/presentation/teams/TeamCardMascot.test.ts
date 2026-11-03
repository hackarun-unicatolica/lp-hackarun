// card da página /equipes: equipe com mascote (Pokémon) ganha o círculo com a cor do tipo e os tipos em português;
// sem mascote volta ao card de sempre (o mesmo card é reaproveitado quando a lista ao vivo muda)
import { describe, expect, it } from 'vitest';
import { fillTeamCard } from '@presentation/views/teams/TeamCardRenderer';
import type { PublicTeam } from '@presentation/view-models/teams/TeamsViewModel';

function card(): HTMLElement {
  const li = document.createElement('li');
  li.innerHTML = `<div data-team-frame><span data-team-initials></span></div>
    <h2 data-team-name></h2><ul data-team-people hidden></ul><span data-team-pips></span><span data-team-count></span>`;
  return li;
}

const team = (over: Partial<PublicTeam>): PublicTeam => ({
  id: 't',
  name: 'Equipe Charizard',
  memberCount: 4,
  imageUrl: '/pokemon/6.webp',
  mascot: { pokemonId: 6, types: ['fire', 'flying'] },
  members: ['Ana Souza', 'Bruno Lima'],
  ...over,
});

describe('card da equipe com mascote', () => {
  it('mostra a arte num círculo com a cor do tipo (sem texto de tipo)', () => {
    const li = card();
    fillTeamCard(li, team({}));
    expect(li.classList.contains('is-mascot')).toBe(true);
    expect(li.style.getPropertyValue('--type')).toBe('#ff6b3d');
    expect(li.querySelector<HTMLImageElement>('.team-card__img')?.getAttribute('src')).toBe(
      '/pokemon/6.webp',
    );
  });

  it('lista os nomes de quem está na equipe, como texto puro, e some quando a equipe não tem ninguém', () => {
    const li = card();
    fillTeamCard(li, team({ members: ['Ana Souza', '<b>Bruno</b>'] }));
    const people = li.querySelector<HTMLElement>('[data-team-people]');
    expect(people?.hidden).toBe(false);
    expect([...(people?.children ?? [])].map((c) => c.textContent)).toEqual(['Ana Souza', '<b>Bruno</b>']);
    expect(people?.querySelector('b')).toBeNull();
    fillTeamCard(li, team({ members: [] }));
    expect(people?.hidden).toBe(true);
    expect(people?.children).toHaveLength(0);
  });

  it('reaproveitado para uma equipe sem mascote, volta ao card de sempre', () => {
    const li = card();
    fillTeamCard(li, team({}));
    fillTeamCard(li, team({ name: 'Os Brabos', imageUrl: null, mascot: null }));
    expect(li.classList.contains('is-mascot')).toBe(false);
    expect(li.style.getPropertyValue('--type')).toBe('');
  });
});
