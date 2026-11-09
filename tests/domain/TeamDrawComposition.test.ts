import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRAW_CONFIG,
  createRandom,
  drawTeams,
  femaleQuotas,
  teamSizes,
  type DrawParticipant,
  type KnowledgeLevel,
} from '@domain/index';

const LEVELS: KnowledgeLevel[] = ['p1', 'p3', 'p5', 'p7'];

function crowd(total: number, females: number): DrawParticipant[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `P${i}`,
    name: `Pessoa ${String(i).padStart(3, '0')}`,
    level: LEVELS[i % LEVELS.length] as KnowledgeLevel,
    institution: { key: i % 7 === 0 ? 'fora' : 'casa', label: 'x', external: i % 7 === 0 },
    ...(i < females ? { female: true } : {}),
  }));
}

const draw = (people: DrawParticipant[], seed = 'semente') => {
  const result = drawTeams(people, { ...DEFAULT_DRAW_CONFIG, seed });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const counts = (people: DrawParticipant[], seed?: string) =>
  draw(people, seed).teams.map((t) => t.members.filter((m) => m.female).length);
const sorted = (list: number[]) => [...list].filter((n) => n > 0).sort((a, b) => b - a);

describe('composição das equipes', () => {
  it.each([
    [41, [4, 3, ...Array<number>(17).fill(2)]],
    [40, [4, ...Array<number>(18).fill(2)]],
    [4, [4]],
    [6, [4, 2]],
    [7, [4, 3]],
  ])('%i meninas em 46 equipes', (females, expected) => {
    expect(sorted(counts(crowd(184, females)))).toEqual(expected);
  });

  it('5 meninas nunca deixam uma sozinha, com ou sem equipe de 5', () => {
    expect(sorted(counts(crowd(184, 5)))).toEqual([3, 2]);
    expect(sorted(counts(crowd(185, 5)))).toEqual([5]);
  });

  it.each([2, 3])('%i meninas ficam juntas', (females) => {
    expect(sorted(counts(crowd(184, females)))).toEqual([females]);
  });

  it('com qualquer quantidade, nenhuma menina fica sozinha e as quantias fecham', () => {
    for (const total of [12, 23, 45, 184, 185]) {
      const sizes = teamSizes(total, DEFAULT_DRAW_CONFIG);
      for (let females = 2; females <= total; females++) {
        const quotas = femaleQuotas(females, sizes, createRandom(`q${total}-${females}`));
        expect(
          quotas.reduce((a, b) => a + b, 0),
          `${total}/${females}`,
        ).toBe(females);
        expect(quotas.includes(1), `${total}/${females}`).toBe(false);
        quotas.forEach((quota, i) => expect(quota).toBeLessThanOrEqual(sizes[i] as number));
      }
    }
  });

  it('continua separando períodos e espalhando quem é de fora', () => {
    const people = crowd(184, 41);
    const { report } = draw(people);
    expect(report.levelRepeatsTotal).toBe(0);
    expect(report.externalPerTeam.max - report.externalPerTeam.min).toBeLessThanOrEqual(1);
  }, 30_000);

  it('sem meninas marcadas, o resultado é o mesmo de antes para a mesma semente', () => {
    const people = crowd(48, 0).map(({ id, name, level, institution }) => ({ id, name, level, institution }));
    expect(draw(people, 'a').teams).toEqual(draw(people, 'a').teams);
    expect(counts(people, 'a').every((n) => n === 0)).toBe(true);
  });

  it('a mesma semente repete o sorteio', () => {
    const people = crowd(60, 13);
    expect(draw(people, 'x').teams).toEqual(draw(people, 'x').teams);
  });
});
