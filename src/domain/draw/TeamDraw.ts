import { fail, ok, type Result } from '../shared/Result';
import type { InstitutionGroup } from './InstitutionGroup';
import type { KnowledgeLevel } from './KnowledgeLevel';
import { createRandom, shuffled, type Random } from './random';

// quem entra no sorteio: só o que ele precisa pra formar as equipes (nada de e-mail ou telefone)
export interface DrawParticipant {
  // protocolo da inscrição (HR26-XXXXXX): identifica a pessoa na planilha
  id: string;
  name: string;
  level: KnowledgeLevel;
  institution: InstitutionGroup;
  female?: boolean;
  // a planilha marcou esta pessoa para a organização conferir antes do sorteio
  review?: boolean;
}

export interface DrawConfig {
  // equipes de 4; sobrou gente, entra como 5º integrante em equipes diferentes (nunca passa do máximo)
  teamSize: number;
  maxTeamSize: number;
  seed: string;
}

export const DEFAULT_DRAW_CONFIG = { teamSize: 4, maxTeamSize: 5 } as const;

export interface DrawnTeam {
  // "Equipe 1", "Equipe 2"...: a ordem do sorteio
  number: number;
  members: DrawParticipant[];
}

// o que a tela mostra pra organização conferir antes de salvar
export interface DrawReport {
  participants: number;
  teams: number;
  teamsOfFive: number;
  // pessoas de outras instituições e como elas ficaram (mín. e máx. por equipe)
  externalTotal: number;
  externalPerTeam: { min: number; max: number };
  // mesmo nível dentro da mesma equipe: o que sobrou e o mínimo que a conta permite
  levelRepeats: { team: number; level: KnowledgeLevel; count: number }[];
  levelRepeatsTotal: number;
  levelRepeatsUnavoidable: number;
  // níveis com mais gente do que equipes: é deles que vem a repetição que não tem como evitar
  crowdedLevels: { level: KnowledgeLevel; count: number }[];
  // duas pessoas da mesma instituição de fora na mesma equipe
  sameExternalInstitution: number;
}

export interface DrawResult {
  seed: string;
  teams: DrawnTeam[];
  report: DrawReport;
}

// pesos: o nível diferente manda; depois espalhar quem é de fora; depois não repetir a mesma instituição de fora
const W_LEVEL = 1000;
const W_EXTERNAL = 100;
const W_SAME_EXTERNAL = 10;

interface Targets {
  externalLow: number;
  externalHigh: number;
}

// quantas equipes e de que tamanho: 4 por equipe; quem sobra vira o 5º de equipes diferentes. Só quando a conta não
// fecha (ex.: 11 pessoas) as equipes ficam com 3 ou 4 em vez de passar do máximo
export function teamSizes(total: number, config: Pick<DrawConfig, 'teamSize' | 'maxTeamSize'>): number[] {
  if (total <= 0) return [];
  if (total < config.teamSize) return [total];
  let teams = Math.floor(total / config.teamSize);
  if (Math.ceil(total / teams) > config.maxTeamSize) teams = Math.ceil(total / config.teamSize);
  const base = Math.floor(total / teams);
  const extra = total % teams;
  return Array.from({ length: teams }, (_, i) => (i < extra ? base + 1 : base));
}

const FULL_TEAM = 4;

export function femaleQuotas(females: number, sizes: readonly number[], random: Random): number[] {
  const quotas = sizes.map(() => 0);
  if (females === 0) return quotas;
  const order = shuffled(
    sizes.map((_, i) => i),
    random,
  );
  const sizeOf = (i: number) => sizes[i] as number;
  if (females < FULL_TEAM) {
    quotas[order[0] as number] = females;
    return quotas;
  }
  const find = (size: number) => order.find((i) => sizeOf(i) === size);
  let full = find(FULL_TEAM);
  if (full === undefined || females === FULL_TEAM + 1) full = females > FULL_TEAM ? find(5) : full;
  let rest = females;
  if (full !== undefined) {
    quotas[full] = sizeOf(full);
    rest -= sizeOf(full);
  }
  const others = order.filter((i) => i !== full);
  const paired = others.slice(0, Math.floor(rest / 2));
  for (const i of paired) quotas[i] = Math.min(2, sizeOf(i));
  rest -= paired.reduce((sum, i) => sum + (quotas[i] as number), 0);
  const extras = paired.length > 0 ? paired : others;
  for (let turn = 0; rest > 0 && turn < females * extras.length; turn++) {
    const i = extras[turn % extras.length] as number;
    if ((quotas[i] as number) < sizeOf(i)) {
      quotas[i] = (quotas[i] as number) + 1;
      rest--;
    }
  }
  return quotas;
}

function hasRoom(members: readonly DrawParticipant[], person: DrawParticipant, size: number, quota: number) {
  const females = members.filter((m) => m.female).length;
  return person.female ? females < quota : members.length - females < size - quota;
}

function teamPenalty(members: readonly DrawParticipant[], targets: Targets): number {
  const levels = new Set<KnowledgeLevel>();
  const institutions = new Map<string, number>();
  let external = 0;
  for (const member of members) {
    levels.add(member.level);
    if (member.institution.external) {
      external++;
      institutions.set(member.institution.key, (institutions.get(member.institution.key) ?? 0) + 1);
    }
  }
  const levelRepeats = members.length - levels.size;
  const externalOff =
    Math.max(0, external - targets.externalHigh) + Math.max(0, targets.externalLow - external);
  let sameExternal = 0;
  for (const count of institutions.values()) sameExternal += count - 1;
  return levelRepeats * W_LEVEL + externalOff * W_EXTERNAL + sameExternal * W_SAME_EXTERNAL;
}

function levelCounts(participants: readonly DrawParticipant[]): Map<KnowledgeLevel, number> {
  const counts = new Map<KnowledgeLevel, number>();
  for (const p of participants) counts.set(p.level, (counts.get(p.level) ?? 0) + 1);
  return counts;
}

// o mínimo de repetições de nível que a conta permite: cada nível cabe uma vez por equipe, o resto repete
export function unavoidableLevelRepeats(participants: readonly DrawParticipant[], teams: number): number {
  let repeats = 0;
  for (const count of levelCounts(participants).values()) repeats += Math.max(0, count - teams);
  return repeats;
}

function buildReport(teams: readonly DrawnTeam[], all: readonly DrawParticipant[]): DrawReport {
  const levelRepeats: DrawReport['levelRepeats'] = [];
  let sameExternalInstitution = 0;
  const externalCounts: number[] = [];
  for (const team of teams) {
    const levels = new Map<KnowledgeLevel, number>();
    const institutions = new Map<string, number>();
    let external = 0;
    for (const m of team.members) {
      levels.set(m.level, (levels.get(m.level) ?? 0) + 1);
      if (m.institution.external) {
        external++;
        institutions.set(m.institution.key, (institutions.get(m.institution.key) ?? 0) + 1);
      }
    }
    for (const [level, count] of levels) {
      if (count > 1) levelRepeats.push({ team: team.number, level, count });
    }
    for (const count of institutions.values()) sameExternalInstitution += count - 1;
    externalCounts.push(external);
  }
  return {
    participants: all.length,
    teams: teams.length,
    teamsOfFive: teams.filter((t) => t.members.length === 5).length,
    externalTotal: externalCounts.reduce((sum, n) => sum + n, 0),
    externalPerTeam: { min: Math.min(...externalCounts), max: Math.max(...externalCounts) },
    levelRepeats,
    levelRepeatsTotal: levelRepeats.reduce((sum, r) => sum + (r.count - 1), 0),
    levelRepeatsUnavoidable: unavoidableLevelRepeats(all, teams.length),
    crowdedLevels: [...levelCounts(all)]
      .filter(([, count]) => count > teams.length)
      .map(([level, count]) => ({ level, count })),
    sameExternalInstitution,
  };
}

function totalPenalty(groups: readonly DrawParticipant[][], targets: Targets): number {
  return groups.reduce((sum, members) => sum + teamPenalty(members, targets), 0);
}

// uma tentativa: coloca os mais "difíceis" primeiro (nível mais comum) onde menos pesa e depois melhora trocando
// pessoas de equipe enquanto o total de problemas cai
function attempt(
  participants: readonly DrawParticipant[],
  sizes: readonly number[],
  quotas: readonly number[],
  targets: Targets,
  random: Random,
): DrawParticipant[][] {
  const groups: DrawParticipant[][] = sizes.map(() => []);
  const levelCount = new Map<KnowledgeLevel, number>();
  for (const p of participants) levelCount.set(p.level, (levelCount.get(p.level) ?? 0) + 1);
  const order = shuffled(participants, random).sort(
    (a, b) =>
      (levelCount.get(b.level) ?? 0) - (levelCount.get(a.level) ?? 0) ||
      Number(b.institution.external) - Number(a.institution.external),
  );

  for (const person of order) {
    let best = -1;
    let bestCost = Infinity;
    let bestTie = Infinity;
    groups.forEach((members, i) => {
      if (!hasRoom(members, person, sizes[i] as number, quotas[i] as number)) return;
      const cost = teamPenalty([...members, person], targets) - teamPenalty(members, targets);
      // empate: a equipe mais vazia, depois o acaso (com semente)
      const tie = members.length + random() * 0.5;
      if (cost < bestCost || (cost === bestCost && tie < bestTie)) {
        best = i;
        bestCost = cost;
        bestTie = tie;
      }
    });
    (groups[best] as DrawParticipant[]).push(person);
  }

  const swaps = Math.max(4000, participants.length * 150);
  for (let step = 0; step < swaps; step++) {
    const a = Math.floor(random() * groups.length);
    const b = Math.floor(random() * groups.length);
    if (a === b) continue;
    const ga = groups[a] as DrawParticipant[];
    const gb = groups[b] as DrawParticipant[];
    const i = Math.floor(random() * ga.length);
    const j = Math.floor(random() * gb.length);
    const pa = ga[i] as DrawParticipant;
    const pb = gb[j] as DrawParticipant;
    if (Boolean(pa.female) !== Boolean(pb.female)) continue;
    const before = teamPenalty(ga, targets) + teamPenalty(gb, targets);
    ga[i] = pb;
    gb[j] = pa;
    const after = teamPenalty(ga, targets) + teamPenalty(gb, targets);
    // melhora sempre; empate também (anda pelo platô), piora volta atrás
    if (after > before) {
      ga[i] = pa;
      gb[j] = pb;
    }
  }
  return groups;
}

const ATTEMPTS = 6;

export function drawTeams(
  participants: readonly DrawParticipant[],
  config: DrawConfig,
): Result<DrawResult, string> {
  if (participants.length === 0) return fail('Ninguém foi credenciado ainda: não há quem sortear.');
  if (new Set(participants.map((p) => p.id)).size !== participants.length) {
    return fail('Há inscrições repetidas na lista (mesmo protocolo).');
  }
  const sizes = teamSizes(participants.length, config);
  const external = participants.filter((p) => p.institution.external).length;
  const targets: Targets = {
    externalLow: Math.floor(external / sizes.length),
    externalHigh: Math.ceil(external / sizes.length),
  };

  const random = createRandom(config.seed);
  // quais equipes ficam com 5: sorteadas (as maiores vêm primeiro em `sizes`, aqui embaralhadas)
  const shuffledSizes = shuffled(sizes, random);
  const quotas = femaleQuotas(participants.filter((p) => p.female).length, shuffledSizes, random);
  let best: DrawParticipant[][] | null = null;
  let bestPenalty = Infinity;
  for (let i = 0; i < ATTEMPTS; i++) {
    const groups = attempt(participants, shuffledSizes, quotas, targets, createRandom(`${config.seed}#${i}`));
    const penalty = totalPenalty(groups, targets);
    if (penalty < bestPenalty) {
      best = groups;
      bestPenalty = penalty;
    }
  }
  const teams: DrawnTeam[] = (best as DrawParticipant[][]).map((members, index) => ({
    number: index + 1,
    members: [...members].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  }));
  return ok({ seed: config.seed, teams, report: buildReport(teams, participants) });
}
