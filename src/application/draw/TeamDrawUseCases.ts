import {
  DEFAULT_DRAW_CONFIG,
  drawTeams,
  fail,
  ok,
  pickOne,
  shuffled,
  type DrawResult,
  type Random,
  type Result,
} from '@domain/index';
import type { DrawGateway, SavedTeam } from './DrawGateway';

// os Pokémon que podem dar nome às equipes (catálogo local, baixado da PokeAPI)
export interface PokemonEntry {
  id: number;
  name: string;
  types: readonly string[];
}

// "Equipe Charizard"
export const teamNameOf = (pokemon: Pick<PokemonEntry, 'name'>): string => `Equipe ${pokemon.name}`;

// semente legível: dia, hora e um sufixo; fica registrada na planilha (dá pra refazer o mesmo sorteio)
export function newSeed(now: Date, random: Random): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes(),
  )}${pad(now.getSeconds())}`;
  return `${stamp}-${Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')}`;
}

export interface DrawStatus {
  accredited: number;
  saved: SavedTeam[];
  // planilha de ensaio (nome dela); ausente na oficial
  testLabel?: string | null;
}

// o que a planilha tem agora: quantos credenciados e se já existe sorteio salvo (as telas abrem mostrando isto)
export class GetDrawStatus {
  constructor(private readonly gateway: DrawGateway) {}

  async execute(): Promise<DrawStatus> {
    const [participants, saved, testLabel] = await Promise.all([
      this.gateway.loadAccredited(),
      this.gateway.loadSavedTeams(),
      this.gateway.loadTestLabel(),
    ]);
    return {
      accredited: participants.length,
      saved: [...saved].sort((a, b) => a.number - b.number),
      testLabel,
    };
  }
}

export interface DrawPreview {
  result: DrawResult;
  // já existe sorteio salvo na planilha (a tela avisa antes de salvar por cima)
  alreadySaved: boolean;
  // alguma equipe já tem nome: refazer as equipes bagunçaria os nomes, então fica bloqueado
  locked: boolean;
}

// 1ª tela: forma as equipes com os credenciados, sem gravar nada. Pode sortear de novo quantas vezes quiser
export class GenerateTeamDraw {
  constructor(
    private readonly gateway: DrawGateway,
    private readonly now: () => Date,
    private readonly random: Random,
  ) {}

  async execute(seed?: string): Promise<Result<DrawPreview, string>> {
    const [participants, saved] = await Promise.all([
      this.gateway.loadAccredited(),
      this.gateway.loadSavedTeams(),
    ]);
    const result = drawTeams(participants, {
      ...DEFAULT_DRAW_CONFIG,
      seed: seed?.trim() || newSeed(this.now(), this.random),
    });
    if (!result.ok) return fail(result.error);
    return ok({
      result: result.value,
      alreadySaved: saved.length > 0,
      locked: saved.some((team) => team.pokemonId !== null),
    });
  }
}

export class SaveTeamDraw {
  constructor(private readonly gateway: DrawGateway) {}

  // grava o sorteio mostrado na tela. Se já havia um salvo, só troca quando nenhuma equipe tem nome ainda. `known` =
  // as equipes salvas que a tela já leu (poupa uma ida à planilha, que leva segundos; a planilha confere de novo)
  async execute(result: DrawResult, known?: readonly SavedTeam[]): Promise<Result<void, string>> {
    const saved = known ?? (await this.gateway.loadSavedTeams());
    if (saved.some((team) => team.pokemonId !== null)) {
      return fail('Alguma equipe já tem nome: não dá mais para refazer as equipes.');
    }
    await this.gateway.saveTeams(result, { replace: saved.length > 0 });
    return ok(undefined);
  }
}

export interface NameDrawn {
  team: SavedTeam;
  pokemon: PokemonEntry;
}

// 2ª tela: sorteia o Pokémon (e com ele o nome) de cada equipe, sem repetir
export class DrawTeamNames {
  constructor(
    private readonly gateway: DrawGateway,
    private readonly catalog: readonly PokemonEntry[],
    private readonly random: Random,
  ) {}

  private available(teams: readonly SavedTeam[]): PokemonEntry[] {
    const used = new Set(teams.map((t) => t.pokemonId).filter((id): id is number => id !== null));
    return this.catalog.filter((p) => !used.has(p.id));
  }

  // uma equipe: escolhe um Pokémon livre e grava. Equipe que já tem nome não é sorteada de novo. `known` = as equipes
  // que a tela já leu (sem reler a planilha); quem decide no fim é a planilha, que recusa Pokémon ou nome repetido
  async drawOne(teamNumber: number, known?: readonly SavedTeam[]): Promise<Result<NameDrawn, string>> {
    const teams = known ?? (await this.gateway.loadSavedTeams());
    const team = teams.find((t) => t.number === teamNumber);
    if (!team) return fail(`A Equipe ${teamNumber} não está salva na planilha.`);
    if (team.pokemonId !== null) return fail(`A ${team.name} já foi sorteada.`);
    const pool = this.available(teams);
    if (pool.length === 0) return fail('Acabaram os Pokémon do catálogo.');
    const pokemon = pickOne(pool, this.random);
    await this.gateway.saveTeamNames([
      { number: team.number, name: teamNameOf(pokemon), pokemonId: pokemon.id },
    ]);
    return ok({ team: { ...team, name: teamNameOf(pokemon), pokemonId: pokemon.id }, pokemon });
  }

  // todas as que ainda não têm nome: sorteia tudo na memória (sem repetir) e grava num pedido só, que a planilha confere
  // inteiro antes de gravar
  async drawAll(known?: readonly SavedTeam[]): Promise<Result<NameDrawn[], string>> {
    const teams = known ?? (await this.gateway.loadSavedTeams());
    const pending = teams.filter((t) => t.pokemonId === null).sort((a, b) => a.number - b.number);
    if (pending.length === 0) return fail('Todas as equipes já foram sorteadas.');
    const pool = this.available(teams);
    if (pool.length < pending.length) {
      return fail('Não há Pokémon suficientes no catálogo para todas as equipes.');
    }
    const chosen = shuffled(pool, this.random).slice(0, pending.length);
    const drawn = pending.map((team, i) => {
      const pokemon = chosen[i] as PokemonEntry;
      return { team: { ...team, name: teamNameOf(pokemon), pokemonId: pokemon.id }, pokemon };
    });
    await this.gateway.saveTeamNames(
      drawn.map(({ team, pokemon }) => ({ number: team.number, name: team.name, pokemonId: pokemon.id })),
    );
    return ok(drawn);
  }
}

// "Publicar no site": só com todas as equipes nomeadas (a página /equipes mostra nome e Pokémon de cada uma)
export class PublishTeams {
  constructor(private readonly gateway: DrawGateway) {}

  async execute(known?: readonly SavedTeam[]): Promise<Result<number, string>> {
    const teams = known ?? (await this.gateway.loadSavedTeams());
    if (teams.length === 0) return fail('Ainda não há equipes salvas.');
    if (teams.some((t) => t.pokemonId === null)) {
      return fail('Ainda há equipe sem nome: sorteie todos os nomes antes de publicar.');
    }
    await this.gateway.publishTeams();
    return ok(teams.length);
  }
}
