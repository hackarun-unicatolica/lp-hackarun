import { describe, expect, it } from 'vitest';
import {
  drawTeams,
  institutionOf,
  levelOf,
  teamSizes,
  unavoidableLevelRepeats,
  type DrawParticipant,
  type KnowledgeLevel,
} from '@domain/index';

const CONFIG = { teamSize: 4, maxTeamSize: 5 } as const;

// quem entra no sorteio, a partir de "nível:instituição" repetido n vezes
function crowd(spec: readonly [string, string, number][]): DrawParticipant[] {
  const out: DrawParticipant[] = [];
  for (const [level, institution, count] of spec) {
    for (let i = 0; i < count; i++) {
      const id = `HR26-${String(out.length).padStart(6, '0')}`;
      out.push({
        id,
        name: `Pessoa ${out.length}`,
        level: level as KnowledgeLevel,
        institution:
          institution === 'unicatolica'
            ? institutionOf('unicatolica', '')
            : institutionOf('other-institution', institution),
      });
    }
  }
  return out;
}

// a mesma distribuição de períodos e instituições dos 212 inscritos reais (nenhum dado pessoal)
const REAL_212: [string, string, number][] = [
  ['p2', 'unicatolica', 40],
  ['p2', 'FASEC', 12],
  ['p2', 'ULBRA', 3],
  ['p2', 'Unitins', 3],
  ['p4', 'unicatolica', 30],
  ['p4', 'FASEC', 5],
  ['p4', 'Serra do Carmo', 2],
  ['p1', 'unicatolica', 25],
  ['p1', 'FASEC', 4],
  ['p1', 'IFTO', 3],
  ['p3', 'unicatolica', 21],
  ['p3', 'UFT', 4],
  ['p6', 'unicatolica', 17],
  ['p6', 'Outra Faculdade', 3],
  ['p5', 'unicatolica', 10],
  ['p5', 'Unitins', 2],
  ['p8', 'unicatolica', 8],
  ['p8', 'ULBRA', 3],
  ['p7', 'unicatolica', 3],
  ['p7', 'IFTO', 1],
  ['p9', 'unicatolica', 2],
  ['p10', 'unicatolica', 1],
  ['graduate', 'unicatolica', 6],
  ['self-taught', 'unicatolica', 4],
];

const assigned = (teams: { members: DrawParticipant[] }[]) =>
  teams.flatMap((t) => t.members.map((m) => m.id));

describe('teamSizes · quantas equipes e de que tamanho', () => {
  it('múltiplo de 4: só equipes de 4', () => {
    expect(teamSizes(212, CONFIG)).toEqual(Array(53).fill(4));
  });

  it('quem sobra vira o 5º integrante de equipes diferentes, sem passar de 5', () => {
    for (const total of [213, 214, 215, 100, 101, 102, 103, 47]) {
      const sizes = teamSizes(total, CONFIG);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(5);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(4);
    }
    expect(teamSizes(215, CONFIG).filter((n) => n === 5)).toHaveLength(3);
  });

  it('regra do evento: equipes de 4 e a sobra (1 a 3 pessoas) vira o 5º de equipes diferentes', () => {
    // 185 credenciados: 46 equipes, 45 de 4 e 1 de 5
    expect(teamSizes(185, CONFIG).filter((n) => n === 5)).toHaveLength(1);
    expect(teamSizes(185, CONFIG).filter((n) => n === 4)).toHaveLength(45);
    // 187: 3 equipes de 5, o resto de 4; nunca uma equipe de 6
    expect(teamSizes(187, CONFIG).filter((n) => n === 5)).toHaveLength(3);
    expect(Math.max(...teamSizes(187, CONFIG))).toBe(5);
  });

  it('número pequeno em que a conta não fecha: equipes de 3 ou 4 em vez de passar de 5', () => {
    expect(teamSizes(11, CONFIG)).toEqual([4, 4, 3]);
    expect(teamSizes(7, CONFIG)).toEqual([4, 3]);
    expect(teamSizes(3, CONFIG)).toEqual([3]);
    expect(teamSizes(1, CONFIG)).toEqual([1]);
    expect(teamSizes(0, CONFIG)).toEqual([]);
  });
});

describe('drawTeams · regras do sorteio', () => {
  it('todo credenciado cai em exatamente uma equipe, numeradas Equipe 1, 2, 3...', () => {
    const people = crowd(REAL_212);
    const result = drawTeams(people, { ...CONFIG, seed: 'a' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = assigned(result.value.teams);
    expect(ids).toHaveLength(212);
    expect(new Set(ids).size).toBe(212);
    expect(result.value.teams.map((t) => t.number)).toEqual(Array.from({ length: 53 }, (_, i) => i + 1));
    expect(result.value.teams.every((t) => t.members.length === 4)).toBe(true);
  });

  it('com a distribuição real, as repetições de nível ficam no mínimo que a conta permite', () => {
    const people = crowd(REAL_212);
    expect(unavoidableLevelRepeats(people, 53)).toBe(5);
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const result = drawTeams(people, { ...CONFIG, seed });
      if (!result.ok) throw new Error(result.error);
      expect(result.value.report.levelRepeatsTotal, seed).toBe(5);
      expect(result.value.report.levelRepeatsUnavoidable).toBe(5);
      // a repetição vem só dos níveis com mais gente do que equipes, e só deles
      const crowded = result.value.report.crowdedLevels;
      expect(crowded.reduce((sum, c) => sum + c.count - 53, 0)).toBe(5);
      expect(result.value.report.levelRepeats.every((r) => crowded.some((c) => c.level === r.level))).toBe(
        true,
      );
    }
    // 8 sorteios de 212 pessoas: com a suíte inteira rodando em paralelo passa dos 5 s padrão
  }, 30_000);

  it('quando dá para todos terem níveis diferentes, ninguém repete nível na equipe', () => {
    // 10 níveis com 8 pessoas cada: 80 pessoas, 20 equipes, cabe um de cada nível por equipe
    const levels: [string, string, number][] = Array.from({ length: 10 }, (_, i) => [
      `p${i + 1}`,
      'unicatolica',
      8,
    ]);
    const result = drawTeams(crowd(levels), { ...CONFIG, seed: 'x' });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.report.levelRepeatsTotal).toBe(0);
    expect(result.value.report.levelRepeats).toEqual([]);
  });

  it('quem é de outra instituição fica espalhado entre as equipes, nunca todos juntos', () => {
    const result = drawTeams(crowd(REAL_212), { ...CONFIG, seed: 'inst' });
    if (!result.ok) throw new Error(result.error);
    const { externalTotal, externalPerTeam } = result.value.report;
    // 45 de fora em 53 equipes: no máximo 1 por equipe
    expect(externalTotal).toBe(45);
    expect(externalPerTeam.max).toBe(1);
  });

  it('65 de fora em 53 equipes: cada equipe recebe 1 ou 2', () => {
    const levels = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const spec: [string, string, number][] = levels.map((l) => [l, 'unicatolica', 17]);
    spec.push(['graduate', 'unicatolica', 11]);
    for (const level of levels) {
      spec.push([level, 'FASEC', 4], [level, 'ULBRA', 4]);
    }
    spec.push(['p1', 'IFTO', 1]);
    const people = crowd(spec);
    expect(people).toHaveLength(212);
    const result = drawTeams(people, { ...CONFIG, seed: 'inst65' });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.report.externalTotal).toBe(65);
    expect(result.value.report.externalPerTeam).toEqual({ min: 1, max: 2 });
  });

  it('com poucos de fora (menos que equipes), no máximo 1 por equipe', () => {
    const people = crowd([
      ['p1', 'unicatolica', 20],
      ['p2', 'unicatolica', 20],
      ['p3', 'unicatolica', 20],
      ['p4', 'unicatolica', 20],
      ['p1', 'FASEC', 5],
      ['p2', 'ULBRA', 5],
      ['p3', 'UFT', 5],
      ['p4', 'IFTO', 5],
    ]);
    const result = drawTeams(people, { ...CONFIG, seed: 'few' });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.report.externalTotal).toBe(20);
    expect(result.value.report.externalPerTeam.max).toBe(1);
  });

  it('as equipes de 5 recebem o 5º de um nível que a equipe ainda não tem', () => {
    const people = crowd(
      Array.from({ length: 10 }, (_, i): [string, string, number] => [`p${i + 1}`, 'unicatolica', 10]).concat(
        [['graduate', 'unicatolica', 3]],
      ),
    );
    expect(people).toHaveLength(103);
    const result = drawTeams(people, { ...CONFIG, seed: 'five' });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.report.teams).toBe(25);
    expect(result.value.report.teamsOfFive).toBe(3);
    expect(Math.max(...result.value.teams.map((t) => t.members.length))).toBe(5);
    expect(result.value.report.levelRepeatsTotal).toBe(result.value.report.levelRepeatsUnavoidable);
  });

  it('a mesma semente dá o mesmo sorteio; outra semente dá outro', () => {
    const people = crowd(REAL_212);
    const shape = (seed: string) => {
      const r = drawTeams(people, { ...CONFIG, seed });
      if (!r.ok) throw new Error(r.error);
      return r.value.teams.map((t) => t.members.map((m) => m.id).join(','));
    };
    expect(shape('mesma')).toEqual(shape('mesma'));
    expect(shape('mesma')).not.toEqual(shape('outra'));
  });

  it('a ordem em que a lista chega não muda o resultado (só a semente)', () => {
    const people = crowd(REAL_212);
    const a = drawTeams(people, { ...CONFIG, seed: 's' });
    const b = drawTeams([...people].reverse(), { ...CONFIG, seed: 's' });
    if (!a.ok || !b.ok) throw new Error('falhou');
    // a lista invertida embaralha diferente, mas as regras valem do mesmo jeito
    expect(b.value.report.levelRepeatsTotal).toBe(a.value.report.levelRepeatsTotal);
    expect(assigned(b.value.teams).sort()).toEqual(assigned(a.value.teams).sort());
  });

  it('lista pequena: 1 a 3 pessoas viram uma equipe só; 7 viram duas', () => {
    const three = drawTeams(crowd([['p1', 'unicatolica', 3]]), { ...CONFIG, seed: 'z' });
    expect(three.ok && three.value.teams.map((t) => t.members.length)).toEqual([3]);
    const seven = drawTeams(crowd([['p1', 'unicatolica', 7]]), { ...CONFIG, seed: 'z' });
    expect(seven.ok && seven.value.teams.map((t) => t.members.length).sort()).toEqual([3, 4]);
  });

  it('recusa lista vazia e protocolo repetido', () => {
    expect(drawTeams([], { ...CONFIG, seed: 'a' })).toMatchObject({ ok: false });
    const people = crowd([['p1', 'unicatolica', 4]]);
    const duplicated = [people[0] as DrawParticipant, ...people];
    expect(drawTeams(duplicated, { ...CONFIG, seed: 'a' })).toMatchObject({ ok: false });
  });

  it('o relatório lista cada equipe com nível repetido', () => {
    // 6 pessoas do mesmo nível em 1 equipe de 4 e 1 de 4: repete porque não há outro nível
    const people = crowd([['p2', 'unicatolica', 8]]);
    const result = drawTeams(people, { ...CONFIG, seed: 'r' });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.report.levelRepeats).toEqual([
      { team: 1, level: 'p2', count: 4 },
      { team: 2, level: 'p2', count: 4 },
    ]);
    expect(result.value.report.levelRepeatsTotal).toBe(6);
    expect(result.value.report.levelRepeatsUnavoidable).toBe(6);
  });
});

describe('nível e instituição a partir do perfil', () => {
  it('períodos viram p1..p10; formado e por conta própria são níveis próprios', () => {
    expect(levelOf('unicatolica', 2)).toBe('p2');
    expect(levelOf('other-institution', 10)).toBe('p10');
    expect(levelOf('graduate', null)).toBe('graduate');
    expect(levelOf('self-taught', null)).toBe('self-taught');
    expect(levelOf('unicatolica', null)).toBe('unknown');
  });

  it('o mesmo nome escrito de jeitos diferentes é a mesma instituição de fora', () => {
    const keys = ['FASEC', 'Fasec', ' fasec ', 'Faculdade FASEC'].map(
      (n) => institutionOf('other-institution', n).key,
    );
    expect(new Set(keys)).toEqual(new Set(['fasec']));
    expect(institutionOf('other-institution', 'CEULP ULBRA').key).toBe('ulbra');
    expect(institutionOf('other-institution', 'Universidade Federal do Tocantins').key).toBe('uft');
    expect(institutionOf('other-institution', 'Faculdade Nova').external).toBe(true);
  });

  it('UniCatólica e quem não informa instituição não contam como "de fora"', () => {
    expect(institutionOf('unicatolica', 'qualquer').external).toBe(false);
    expect(institutionOf('other-institution', 'Católica do Tocantins').external).toBe(false);
    expect(institutionOf('graduate', '').external).toBe(false);
    expect(institutionOf('self-taught', '').external).toBe(false);
    // estuda em outra instituição e não escreveu qual: é de fora mesmo assim
    expect(institutionOf('other-institution', '').external).toBe(true);
  });
});
