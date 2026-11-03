import type { Team, TeamRepository } from '@domain/index';
import type { AppsScriptClient } from '../registration/AppsScriptClient';
import { ContentMapper } from '../mappers/ContentMapper';
import pokemonCatalog from '../content/pokemon.json';
import { driveImageUrl, pokemonImageUrl } from './driveImageUrl';

// tipos de cada Pokémon do catálogo do sorteio (a cor do card na página /equipes)
const TYPES = new Map<number, readonly string[]>(pokemonCatalog.map((p) => [p.id, p.types]));

const TIMEOUT_MS = 6_000;

// o que o ?action=teams devolve: nome, quantidade e id da foto (nada pessoal)
interface TeamRow {
  id?: unknown;
  name?: unknown;
  memberCount?: unknown;
  // id do arquivo no Drive (coluna Imagem); vira URL pública só se tiver cara de id
  imageId?: unknown;
  // Pokémon do sorteio dos nomes (número da Pokédex); quando existe, é ele o logo
  pokemonId?: unknown;
}

// equipes confirmadas na planilha (GET ?action=teams); a planilha nunca manda dado pessoal
export class AppsScriptTeamRepository implements TeamRepository {
  private readonly client: AppsScriptClient;

  constructor(client: AppsScriptClient) {
    this.client = client;
  }

  async list(): Promise<Team[]> {
    const response = (await this.client.get({ action: 'teams' }, TIMEOUT_MS)) as {
      ok?: unknown;
      teams?: unknown;
    };
    if (response?.ok !== true || !Array.isArray(response.teams)) throw new Error('Invalid teams response');
    return (response.teams as TeamRow[]).flatMap((row) => AppsScriptTeamRepository.toTeam(row));
  }

  // só Pokémon do catálogo viram mascote (número torto ou fora da lista: card com a foto/iniciais de sempre)
  private static mascot(id: unknown): { pokemonId: number; types: readonly string[] } | null {
    const n = Number(id);
    const types = Number.isInteger(n) ? TYPES.get(n) : undefined;
    return types ? { pokemonId: n, types } : null;
  }

  // linha torta na planilha (nome vazio, gigante...) é ignorada em vez de derrubar a lista
  private static toTeam(row: TeamRow): Team[] {
    if (typeof row.id !== 'string' || typeof row.name !== 'string') return [];
    const count = Number(row.memberCount);
    try {
      return [
        ContentMapper.toTeam({
          id: row.id,
          name: row.name,
          // equipe confirmada tem pelo menos 1 pessoa, mesmo se a célula vier torta
          memberCount: Number.isFinite(count) && count > 0 ? Math.round(count) : 1,
          status: 'confirmed',
          imageUrl: pokemonImageUrl(row.pokemonId) ?? driveImageUrl(row.imageId),
          mascot: AppsScriptTeamRepository.mascot(row.pokemonId),
        }),
      ];
    } catch {
      return [];
    }
  }
}
